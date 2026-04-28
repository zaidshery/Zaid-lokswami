import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth/admin';
import { canManageSettings } from '@/lib/auth/permissions';
import {
  GEMINI_TTS_DEFAULT_VOICE,
  GEMINI_TTS_LANGUAGE_OPTIONS,
  GEMINI_TTS_MAX_TOTAL_CHARS,
  GEMINI_TTS_PROVIDER,
  GEMINI_TTS_VOICE_OPTIONS,
  isSupportedGeminiTtsLanguage,
} from '@/lib/constants/tts';
import connectDB from '@/lib/db/mongoose';
import TtsAuditEvent from '@/lib/models/TtsAuditEvent';
import TtsConfig from '@/lib/models/TtsConfig';
import { getGeminiTtsRuntimeConfig, isGeminiTtsConfigured } from '@/lib/ai/geminiTts';
import { getTtsConfig } from '@/lib/server/ttsAssets';
import { getTtsStorageConfig } from '@/lib/utils/ttsStorage';
import type { TtsConfigShape, TtsSurfaceKey } from '@/lib/types/tts';

type TtsConfigUpdateInput = Partial<{
  regenerateMissingFiles: boolean;
  retentionDays: number;
  forceStorage: boolean;
  prewarm: Partial<{
    latestBreakingLimit: number;
    latestArticleLimit: number;
    latestEpaperStoryLimit: number;
  }>;
  surfaces: Partial<
    Record<
      TtsSurfaceKey,
      Partial<{
        enabled: boolean;
        autoGenerate: boolean;
        defaultLanguageCode: string;
        defaultVoice: string;
      }>
    >
  >;
}>;

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unknown error';
}

function normalizePositiveInteger(value: unknown, min: number, max: number, fallback: number) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(parsed)));
}

function normalizeSurfaceUpdate(
  input: unknown,
  fallback: TtsConfigShape['surfaces'][TtsSurfaceKey]
) {
  const source = typeof input === 'object' && input ? (input as Record<string, unknown>) : {};

  const languageCandidate = String(source.defaultLanguageCode || '').trim();
  return {
    enabled: source.enabled === undefined ? fallback.enabled : Boolean(source.enabled),
    autoGenerate:
      source.autoGenerate === undefined ? fallback.autoGenerate : Boolean(source.autoGenerate),
    defaultLanguageCode:
      languageCandidate && isSupportedGeminiTtsLanguage(languageCandidate)
        ? languageCandidate
        : fallback.defaultLanguageCode,
    defaultVoice: GEMINI_TTS_DEFAULT_VOICE,
  };
}

async function requireAdmin() {
  const admin = await getAdminSession();
  if (!admin) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      ),
    };
  }
  if (!canManageSettings(admin.role)) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      ),
    };
  }

  return {
    ok: true as const,
    admin,
  };
}

async function buildSettingsPayload() {
  const config = await getTtsConfig();
  const runtime = getGeminiTtsRuntimeConfig();
  const storage = await getTtsStorageConfig().catch(() => null);

  return {
    config,
    runtime: {
      configured: isGeminiTtsConfigured(),
      provider: GEMINI_TTS_PROVIDER,
      model: runtime.model,
      defaultVoice: runtime.defaultVoice,
      maxCharacters: GEMINI_TTS_MAX_TOTAL_CHARS,
      supportedLanguages: GEMINI_TTS_LANGUAGE_OPTIONS,
      voices: GEMINI_TTS_VOICE_OPTIONS,
      env: {
        geminiApiKeyConfigured: Boolean(process.env.GEMINI_API_KEY?.trim()),
        digitalOceanSpacesConfigured: Boolean(
          process.env.DIGITALOCEAN_SPACES_ACCESS_KEY?.trim() &&
            process.env.DIGITALOCEAN_SPACES_SECRET_KEY?.trim() &&
            process.env.DIGITALOCEAN_SPACES_BUCKET?.trim() &&
            process.env.DIGITALOCEAN_SPACES_REGION?.trim()
        ),
        storageMode: storage?.mode || 'unavailable',
        forceStorageEnv: process.env.EPAPER_FORCE_STORAGE === '1',
        storageUploadsBaseDir: String(
          process.env.EPAPER_STORAGE_UPLOADS_BASE_DIR || 'storage/uploads'
        ).trim(),
      },
    },
  };
}

export async function GET() {
  try {
    const adminResult = await requireAdmin();
    if (!adminResult.ok) {
      return adminResult.response;
    }

    await connectDB();

    return NextResponse.json({
      success: true,
      data: await buildSettingsPayload(),
    });
  } catch (error) {
    console.error('Failed to load admin TTS settings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load TTS settings.' },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const adminResult = await requireAdmin();
    if (!adminResult.ok) {
      return adminResult.response;
    }

    await connectDB();

    const current = await getTtsConfig();
    const body = (await req.json().catch(() => ({}))) as TtsConfigUpdateInput;

    const nextConfig = {
      regenerateMissingFiles:
        body.regenerateMissingFiles === undefined
          ? current.regenerateMissingFiles
          : Boolean(body.regenerateMissingFiles),
      retentionDays: normalizePositiveInteger(
        body.retentionDays,
        1,
        3650,
        current.retentionDays
      ),
      forceStorage:
        body.forceStorage === undefined ? current.forceStorage : Boolean(body.forceStorage),
      prewarm: {
        latestBreakingLimit: normalizePositiveInteger(
          body.prewarm?.latestBreakingLimit,
          0,
          1000,
          current.prewarm.latestBreakingLimit
        ),
        latestArticleLimit: normalizePositiveInteger(
          body.prewarm?.latestArticleLimit,
          0,
          1000,
          current.prewarm.latestArticleLimit
        ),
        latestEpaperStoryLimit: normalizePositiveInteger(
          body.prewarm?.latestEpaperStoryLimit,
          0,
          5000,
          current.prewarm.latestEpaperStoryLimit
        ),
      },
      surfaces: {
        breaking: {
          ...normalizeSurfaceUpdate(body.surfaces?.breaking, current.surfaces.breaking),
          autoGenerate: true,
          defaultVoice: GEMINI_TTS_DEFAULT_VOICE,
        },
        article: {
          ...normalizeSurfaceUpdate(body.surfaces?.article, current.surfaces.article),
          autoGenerate: true,
          defaultVoice: GEMINI_TTS_DEFAULT_VOICE,
        },
        epaper: {
          ...normalizeSurfaceUpdate(body.surfaces?.epaper, current.surfaces.epaper),
          defaultVoice: GEMINI_TTS_DEFAULT_VOICE,
        },
      },
    };

    await TtsConfig.findOneAndUpdate(
      { key: 'default' },
      {
        $set: {
          ...nextConfig,
          key: 'default',
          provider: GEMINI_TTS_PROVIDER,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
    );

    await TtsAuditEvent.create({
      action: 'config_update',
      result: 'success',
      actorId: adminResult.admin.id,
      actorEmail: adminResult.admin.email,
      actorRole: adminResult.admin.role,
      message: 'Updated global TTS settings from admin.',
      metadata: {
        regenerateMissingFiles: nextConfig.regenerateMissingFiles,
        retentionDays: nextConfig.retentionDays,
        forceStorage: nextConfig.forceStorage,
        prewarm: nextConfig.prewarm,
      },
    });

    return NextResponse.json({
      success: true,
      data: await buildSettingsPayload(),
    });
  } catch (error) {
    console.error('Failed to update admin TTS settings:', error);
    return NextResponse.json(
      {
        success: false,
        error: `Failed to update TTS settings. ${getErrorMessage(error)}`,
      },
      { status: 500 }
    );
  }
}
