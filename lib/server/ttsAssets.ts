import 'server-only';

import crypto from 'crypto';
import { isGeminiTtsConfigured, getGeminiTtsRuntimeConfig, synthesizeGeminiSpeech } from '@/lib/ai/geminiTts';
import {
  GEMINI_TTS_DEFAULT_VOICE,
  GEMINI_TTS_OUTPUT_MIME_TYPE,
  GEMINI_TTS_PROVIDER,
  isSupportedGeminiTtsLanguage,
  isSupportedGeminiTtsVoice,
} from '@/lib/constants/tts';
import connectDB from '@/lib/db/mongoose';
import TtsAsset, { type TtsAssetDocument } from '@/lib/models/TtsAsset';
import TtsAuditEvent from '@/lib/models/TtsAuditEvent';
import TtsConfig, { type ITtsConfig } from '@/lib/models/TtsConfig';
import { buildSpokenBreakingHeadline } from '@/lib/types/breaking';
import {
  type TtsAuditAction,
  type TtsAuditResult,
  type TtsConfigShape,
  type TtsSourceType,
  type TtsSurfaceConfig,
  type TtsVariant,
  variantToSurfaceKey,
} from '@/lib/types/tts';
import {
  deleteStoredTtsAsset,
  hasStoredTtsAsset,
  saveTtsAudioBuffer,
} from '@/lib/utils/ttsStorage';

type TtsActorContext = {
  id?: string;
  email?: string;
  role?: string;
};

type EnsureTtsAssetInput = {
  sourceType: TtsSourceType;
  sourceId: string;
  sourceParentId?: string;
  variant: TtsVariant;
  title?: string;
  text: string;
  languageCode?: string;
  voice?: string;
  model?: string;
  forceRegenerate?: boolean;
  actor?: TtsActorContext;
  metadata?: Record<string, unknown>;
};

type EnsureTtsAssetResult = {
  asset: TtsAssetDocument | null;
  reused: boolean;
  config: TtsConfigShape;
  error?: string;
};

type QueueTtsAssetResult = {
  asset: TtsAssetDocument | null;
  status: 'ready' | 'queued' | 'processing' | 'failed';
  config: TtsConfigShape;
  error?: string;
};

type FindCurrentTtsAssetResult = {
  asset: TtsAssetDocument | null;
  config: TtsConfigShape;
  languageCode?: string;
  voice?: string;
  model?: string;
  contentVersionHash?: string;
  error?: string;
};

type ArticleListenSource = {
  title?: string;
  summary?: string;
  content?: string;
};

type EpaperStoryListenSource = {
  title?: string;
  excerpt?: string;
  contentHtml?: string;
};

const LEGACY_GEMINI_TTS_DEFAULT_VOICE = 'Charon';

function createDefaultTtsConfig(): TtsConfigShape {
  const forceStorage = process.env.EPAPER_FORCE_STORAGE === '1';

  return {
    key: 'default',
    provider: GEMINI_TTS_PROVIDER,
    regenerateMissingFiles: true,
    retentionDays: 90,
    forceStorage,
    surfaces: {
      breaking: {
        enabled: true,
        autoGenerate: true,
        defaultLanguageCode: 'hi-IN',
        defaultVoice: GEMINI_TTS_DEFAULT_VOICE,
      },
      article: {
        enabled: true,
        autoGenerate: true,
        defaultLanguageCode: 'hi-IN',
        defaultVoice: GEMINI_TTS_DEFAULT_VOICE,
      },
      epaper: {
        enabled: true,
        autoGenerate: false,
        defaultLanguageCode: 'hi-IN',
        defaultVoice: GEMINI_TTS_DEFAULT_VOICE,
      },
    },
    prewarm: {
      latestBreakingLimit: 10,
      latestArticleLimit: 25,
      latestEpaperStoryLimit: 50,
    },
  };
}

function mergeSurfaceConfig(
  defaults: TtsSurfaceConfig,
  source: Partial<TtsSurfaceConfig> | undefined,
  migrateLegacyDefaultVoice = false
): TtsSurfaceConfig {
  const sourceDefaultVoice =
    typeof source?.defaultVoice === 'string' ? source.defaultVoice.trim() : '';
  const defaultVoice =
    !migrateLegacyDefaultVoice && sourceDefaultVoice && isSupportedGeminiTtsVoice(sourceDefaultVoice)
      ? sourceDefaultVoice
      : defaults.defaultVoice;

  return {
    enabled: source?.enabled ?? defaults.enabled,
    autoGenerate: source?.autoGenerate ?? defaults.autoGenerate,
    defaultLanguageCode:
      typeof source?.defaultLanguageCode === 'string' &&
      source.defaultLanguageCode.trim()
        ? source.defaultLanguageCode.trim()
        : defaults.defaultLanguageCode,
    defaultVoice,
  };
}

function shouldMigrateLegacyDefaultVoices(
  surfaces: Partial<Record<'breaking' | 'article' | 'epaper', Partial<TtsSurfaceConfig>>> | undefined
) {
  if (!surfaces) {
    return false;
  }

  const voiceValues = [
    surfaces.breaking?.defaultVoice,
    surfaces.article?.defaultVoice,
    surfaces.epaper?.defaultVoice,
  ]
    .map((value) => String(value || '').trim())
    .filter(Boolean);

  return (
    voiceValues.length > 0 &&
    voiceValues.every(
      (value) => value.toLowerCase() === LEGACY_GEMINI_TTS_DEFAULT_VOICE.toLowerCase()
    )
  );
}

function normalizeTtsConfig(
  source: Partial<TtsConfigShape> | Partial<ITtsConfig> | null | undefined
): TtsConfigShape {
  const defaults = createDefaultTtsConfig();
  const surfaces =
    source && typeof source === 'object' && 'surfaces' in source ? source.surfaces : undefined;
  const prewarm =
    source && typeof source === 'object' && 'prewarm' in source ? source.prewarm : undefined;
  const migrateLegacyDefaultVoice = shouldMigrateLegacyDefaultVoices(surfaces);

  return {
    ...defaults,
    key: 'default',
    provider: GEMINI_TTS_PROVIDER,
    regenerateMissingFiles:
      typeof source?.regenerateMissingFiles === 'boolean'
        ? source.regenerateMissingFiles
        : defaults.regenerateMissingFiles,
    retentionDays:
      typeof source?.retentionDays === 'number' && Number.isFinite(source.retentionDays)
        ? source.retentionDays
        : defaults.retentionDays,
    forceStorage:
      typeof source?.forceStorage === 'boolean'
        ? source.forceStorage
        : defaults.forceStorage,
    surfaces: {
      breaking: mergeSurfaceConfig(
        defaults.surfaces.breaking,
        surfaces?.breaking,
        migrateLegacyDefaultVoice
      ),
      article: {
        ...mergeSurfaceConfig(
          defaults.surfaces.article,
          surfaces?.article,
          migrateLegacyDefaultVoice
        ),
        autoGenerate: true,
        defaultVoice: GEMINI_TTS_DEFAULT_VOICE,
      },
      epaper: mergeSurfaceConfig(
        defaults.surfaces.epaper,
        surfaces?.epaper,
        migrateLegacyDefaultVoice
      ),
    },
    prewarm: {
      latestBreakingLimit:
        typeof prewarm?.latestBreakingLimit === 'number' &&
        Number.isFinite(prewarm.latestBreakingLimit)
          ? prewarm.latestBreakingLimit
          : defaults.prewarm.latestBreakingLimit,
      latestArticleLimit:
        typeof prewarm?.latestArticleLimit === 'number' &&
        Number.isFinite(prewarm.latestArticleLimit)
          ? prewarm.latestArticleLimit
          : defaults.prewarm.latestArticleLimit,
      latestEpaperStoryLimit:
        typeof prewarm?.latestEpaperStoryLimit === 'number' &&
        Number.isFinite(prewarm.latestEpaperStoryLimit)
          ? prewarm.latestEpaperStoryLimit
          : defaults.prewarm.latestEpaperStoryLimit,
    },
  };
}

function sanitizeText(value: string) {
  return value.replace(/\r\n?/g, '\n').replace(/\u0000/g, '').trim();
}

function normalizeParagraphs(value: string) {
  return sanitizeText(value)
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

function decodeBasicHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

export function stripHtmlToTtsText(value: string) {
  const withoutScripts = value
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ');
  const withParagraphs = withoutScripts
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/\s*(p|div|li|section|article|h[1-6])\s*>/gi, '\n');
  const withoutTags = withParagraphs.replace(/<[^>]+>/g, ' ');
  return normalizeParagraphs(decodeBasicHtmlEntities(withoutTags));
}

export function buildArticleFullTtsText(source: ArticleListenSource) {
  const parts = [
    normalizeParagraphs(source.title || ''),
    normalizeParagraphs(source.summary || ''),
    stripHtmlToTtsText(source.content || ''),
  ].filter(Boolean);

  return parts.join('\n\n').trim();
}

export function buildEpaperStoryTtsText(source: EpaperStoryListenSource) {
  const bodyText = source.contentHtml
    ? stripHtmlToTtsText(source.contentHtml)
    : normalizeParagraphs(source.excerpt || '');
  const parts = [normalizeParagraphs(source.title || ''), bodyText].filter(Boolean);
  return parts.join('\n\n').trim();
}

export function buildBreakingHeadlineTtsText(input: { title?: string; city?: string }) {
  const title = String(input.title || '').trim();
  if (!title) return '';

  return buildSpokenBreakingHeadline({
    id: 'breaking',
    title,
    ...(input.city?.trim() ? { city: input.city.trim() } : {}),
  });
}

function detectPreferredLanguageCode(text: string, fallbackLanguageCode: string) {
  const devanagariCount = (text.match(/[\u0900-\u097F]/g) || []).length;
  const latinCount = (text.match(/[A-Za-z]/g) || []).length;

  if (devanagariCount > 0 && devanagariCount >= Math.max(1, Math.floor(latinCount / 2))) {
    return 'hi-IN';
  }

  if (latinCount > devanagariCount) {
    return 'en-IN';
  }

  return fallbackLanguageCode;
}

function normalizeLanguageCode(
  requestedLanguageCode: string | undefined,
  surface: TtsSurfaceConfig,
  text: string
) {
  const candidate = String(requestedLanguageCode || '').trim();
  if (candidate && isSupportedGeminiTtsLanguage(candidate)) {
    return candidate;
  }

  const surfaceDefault = surface.defaultLanguageCode.trim();
  if (surfaceDefault && isSupportedGeminiTtsLanguage(surfaceDefault)) {
    return surfaceDefault;
  }

  return detectPreferredLanguageCode(text, 'hi-IN');
}

function normalizeVoice(requestedVoice: string | undefined, surface: TtsSurfaceConfig) {
  void requestedVoice;

  const surfaceDefault = surface.defaultVoice.trim();
  if (surfaceDefault && isSupportedGeminiTtsVoice(surfaceDefault)) {
    return surfaceDefault;
  }

  return GEMINI_TTS_DEFAULT_VOICE;
}

function hashValue(value: string) {
  return crypto.createHash('sha1').update(value).digest('hex');
}

function normalizeSourceId(value: string) {
  return String(value || '').trim();
}

function buildAssetQuery(input: {
  sourceType: TtsSourceType;
  sourceId: string;
  variant: TtsVariant;
  provider: 'gemini';
  model: string;
  voice: string;
  languageCode: string;
  contentVersionHash: string;
}) {
  return {
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    variant: input.variant,
    provider: input.provider,
    model: input.model,
    voice: input.voice,
    languageCode: input.languageCode,
    contentVersionHash: input.contentVersionHash,
  };
}

function isLikelyHttpUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function buildMetadataWithDefaults(input: Record<string, unknown> | undefined) {
  return input && typeof input === 'object' ? input : {};
}

function buildStorageTargetDir(sourceType: TtsSourceType, sourceId: string, variant: TtsVariant) {
  const safeSourceId = normalizeSourceId(sourceId)
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return `${sourceType}/${safeSourceId || hashValue(sourceId)}/${variant}`;
}

async function recordTtsAuditEvent(input: {
  action: TtsAuditAction;
  result: TtsAuditResult;
  actor?: TtsActorContext;
  assetId?: string;
  sourceType?: TtsSourceType;
  sourceId?: string;
  variant?: TtsVariant;
  message?: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    await TtsAuditEvent.create({
      action: input.action,
      result: input.result,
      actorId: String(input.actor?.id || '').trim(),
      actorEmail: String(input.actor?.email || '').trim().toLowerCase(),
      actorRole: String(input.actor?.role || '').trim(),
      assetId: String(input.assetId || '').trim(),
      sourceType: input.sourceType,
      sourceId: String(input.sourceId || '').trim(),
      variant: input.variant,
      message: String(input.message || '').trim(),
      metadata: buildMetadataWithDefaults(input.metadata),
    });
  } catch (error) {
    console.error('Failed to write TTS audit event:', error);
  }
}

async function markAssetStale(
  asset: TtsAssetDocument,
  reason: string,
  actor?: TtsActorContext
) {
  asset.status = 'stale';
  asset.lastError = reason;
  asset.lastVerifiedAt = new Date();
  asset.failureCount = Math.max(0, asset.failureCount || 0);
  await asset.save();

  await recordTtsAuditEvent({
    action: 'mark_stale',
    result: 'success',
    actor,
    assetId: asset._id?.toString(),
    sourceType: asset.sourceType,
    sourceId: asset.sourceId,
    variant: asset.variant,
    message: reason,
  });
}

async function getReusableAsset(
  query: ReturnType<typeof buildAssetQuery>,
  actor?: TtsActorContext
) {
  const asset = await TtsAsset.findOne(query);
  if (!asset || asset.status !== 'ready' || !asset.audioUrl) {
    return null;
  }

  if (!isLikelyHttpUrl(asset.audioUrl) && !hasStoredTtsAsset(asset.audioUrl)) {
    await markAssetStale(asset, 'Stored TTS asset file is missing.', actor);
    return null;
  }

  asset.lastVerifiedAt = new Date();
  asset.lastAccessedAt = new Date();
  await asset.save();
  return asset;
}

async function saveFailureAsset(params: {
  query: ReturnType<typeof buildAssetQuery>;
  title: string;
  sourceParentId: string;
  charCount: number;
  metadata: Record<string, unknown>;
  reason: string;
}) {
  const existing = await TtsAsset.findOne(params.query);

  return TtsAsset.findOneAndUpdate(
    params.query,
    {
      $set: {
        title: params.title,
        sourceParentId: params.sourceParentId,
        status: 'failed',
        charCount: params.charCount,
        metadata: params.metadata,
        lastError: params.reason,
        audioUrl: existing?.audioUrl || '',
        mimeType: existing?.mimeType || GEMINI_TTS_OUTPUT_MIME_TYPE,
        storageMode: existing?.storageMode || (process.env.EPAPER_FORCE_STORAGE === '1' ? 'proxy' : 'public'),
      },
      $inc: {
        failureCount: 1,
      },
      $setOnInsert: {
        chunkCount: 0,
        generatedAt: null,
        lastVerifiedAt: null,
        lastAccessedAt: null,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

async function markOlderVariantAssetsStale(params: {
  assetId: string;
  sourceType: TtsSourceType;
  sourceId: string;
  variant: TtsVariant;
  provider: 'gemini';
  model: string;
  voice: string;
  languageCode: string;
}) {
  await TtsAsset.updateMany(
    {
      sourceType: params.sourceType,
      sourceId: params.sourceId,
      variant: params.variant,
      provider: params.provider,
      model: params.model,
      voice: params.voice,
      languageCode: params.languageCode,
      _id: { $ne: params.assetId },
      status: 'ready',
    },
    {
      $set: {
        status: 'stale',
        lastError: 'Superseded by a newer TTS asset.',
        lastVerifiedAt: new Date(),
      },
    }
  );
}

export async function getTtsConfig() {
  await connectDB();
  const defaults = createDefaultTtsConfig();

  const config = await TtsConfig.findOneAndUpdate(
    { key: 'default' },
    { $setOnInsert: defaults },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).lean<Partial<TtsConfigShape> | null>();

  return normalizeTtsConfig(config);
}

export async function findReusableTtsAsset(input: EnsureTtsAssetInput) {
  const normalizedText = sanitizeText(input.text || '');
  if (!normalizedText) return null;

  const config = await getTtsConfig();
  const surface = config.surfaces[variantToSurfaceKey(input.variant)];
  const runtime = getGeminiTtsRuntimeConfig();
  const languageCode = normalizeLanguageCode(input.languageCode, surface, normalizedText);
  const voice = normalizeVoice(input.voice, surface);
  const model = String(input.model || runtime.model || '').trim() || runtime.model;
  const query = buildAssetQuery({
    sourceType: input.sourceType,
    sourceId: normalizeSourceId(input.sourceId),
    variant: input.variant,
    provider: GEMINI_TTS_PROVIDER,
    model,
    voice,
    languageCode,
    contentVersionHash: hashValue(
      JSON.stringify({
        variant: input.variant,
        text: normalizedText,
        languageCode,
        voice,
        model,
        provider: GEMINI_TTS_PROVIDER,
      })
    ),
  });

  return getReusableAsset(query, input.actor);
}

export async function findCurrentTtsAsset(
  input: EnsureTtsAssetInput
): Promise<FindCurrentTtsAssetResult> {
  await connectDB();
  const config = await getTtsConfig();
  const sourceId = normalizeSourceId(input.sourceId);
  const normalizedText = sanitizeText(input.text || '');

  if (!sourceId || !normalizedText) {
    return {
      asset: null,
      config,
      error: 'Source id and text are required to inspect a shared TTS asset.',
    };
  }

  const surface = config.surfaces[variantToSurfaceKey(input.variant)];
  const runtime = getGeminiTtsRuntimeConfig();
  const languageCode = normalizeLanguageCode(input.languageCode, surface, normalizedText);
  const voice = normalizeVoice(input.voice, surface);
  const model = String(input.model || runtime.model || '').trim() || runtime.model;
  const contentVersionHash = hashValue(
    JSON.stringify({
      variant: input.variant,
      text: normalizedText,
      languageCode,
      voice,
      model,
      provider: GEMINI_TTS_PROVIDER,
    })
  );
  const query = buildAssetQuery({
    sourceType: input.sourceType,
    sourceId,
    variant: input.variant,
    provider: GEMINI_TTS_PROVIDER,
    model,
    voice,
    languageCode,
    contentVersionHash,
  });
  const asset = await TtsAsset.findOne(query);

  if (asset?.status === 'ready' && asset.audioUrl && !isLikelyHttpUrl(asset.audioUrl)) {
    if (!hasStoredTtsAsset(asset.audioUrl)) {
      await markAssetStale(asset, 'Stored TTS asset file is missing.', input.actor);
    }
  }

  const refreshedAsset = asset?._id ? await TtsAsset.findById(asset._id) : null;

  return {
    asset: refreshedAsset,
    config,
    languageCode,
    voice,
    model,
    contentVersionHash,
  };
}

export async function ensureTtsAsset(input: EnsureTtsAssetInput): Promise<EnsureTtsAssetResult> {
  await connectDB();
  const config = await getTtsConfig();
  const sourceId = normalizeSourceId(input.sourceId);
  const normalizedText = sanitizeText(input.text || '');
  const title = String(input.title || '').trim();
  const sourceParentId = String(input.sourceParentId || '').trim();

  if (!sourceId || !normalizedText) {
    return {
      asset: null,
      reused: false,
      config,
      error: 'Source id and text are required to create a shared TTS asset.',
    };
  }

  const surfaceKey = variantToSurfaceKey(input.variant);
  const surface = config.surfaces[surfaceKey];
  if (!surface.enabled) {
    return {
      asset: null,
      reused: false,
      config,
      error: `TTS is disabled for the ${surfaceKey} surface.`,
    };
  }

  const runtime = getGeminiTtsRuntimeConfig();
  const languageCode = normalizeLanguageCode(input.languageCode, surface, normalizedText);
  const voice = normalizeVoice(input.voice, surface);
  const model = String(input.model || runtime.model || '').trim() || runtime.model;
  const textHash = hashValue(normalizedText);
  const contentVersionHash = hashValue(
    JSON.stringify({
      variant: input.variant,
      text: normalizedText,
      languageCode,
      voice,
      model,
      provider: GEMINI_TTS_PROVIDER,
    })
  );
  const metadata = buildMetadataWithDefaults(input.metadata);
  const query = buildAssetQuery({
    sourceType: input.sourceType,
    sourceId,
    variant: input.variant,
    provider: GEMINI_TTS_PROVIDER,
    model,
    voice,
    languageCode,
    contentVersionHash,
  });

  if (!input.forceRegenerate) {
    const reusable = await getReusableAsset(query, input.actor);
    if (reusable) {
      return {
        asset: reusable,
        reused: true,
        config,
      };
    }
  }

  if (!isGeminiTtsConfigured()) {
    const failed = await saveFailureAsset({
      query,
      title,
      sourceParentId,
      charCount: normalizedText.length,
      metadata,
      reason: 'Gemini TTS is not configured.',
    });

    await recordTtsAuditEvent({
      action: input.forceRegenerate ? 'regenerate' : 'generate',
      result: 'failure',
      actor: input.actor,
      assetId: failed?._id?.toString(),
      sourceType: input.sourceType,
      sourceId,
      variant: input.variant,
      message: 'Gemini TTS is not configured.',
      metadata,
    });

    return {
      asset: failed,
      reused: false,
      config,
      error: 'Gemini TTS is not configured.',
    };
  }

  const synthesized = await synthesizeGeminiSpeech({
    text: normalizedText,
    languageCode,
    voice,
  });

  if (synthesized.mode !== 'gemini') {
    const failed = await saveFailureAsset({
      query,
      title,
      sourceParentId,
      charCount: normalizedText.length,
      metadata,
      reason: synthesized.reason,
    });

    await recordTtsAuditEvent({
      action: input.forceRegenerate ? 'regenerate' : 'generate',
      result: 'failure',
      actor: input.actor,
      assetId: failed?._id?.toString(),
      sourceType: input.sourceType,
      sourceId,
      variant: input.variant,
      message: synthesized.reason,
      metadata,
    });

    return {
      asset: failed,
      reused: false,
      config,
      error: synthesized.reason,
    };
  }

  const audioBuffer = Buffer.from(synthesized.audioBase64, 'base64');
  if (!audioBuffer.length) {
    const failed = await saveFailureAsset({
      query,
      title,
      sourceParentId,
      charCount: normalizedText.length,
      metadata,
      reason: 'Gemini TTS returned no audio data.',
    });

    await recordTtsAuditEvent({
      action: input.forceRegenerate ? 'regenerate' : 'generate',
      result: 'failure',
      actor: input.actor,
      assetId: failed?._id?.toString(),
      sourceType: input.sourceType,
      sourceId,
      variant: input.variant,
      message: 'Gemini TTS returned no audio data.',
      metadata,
    });

    return {
      asset: failed,
      reused: false,
      config,
      error: 'Gemini TTS returned no audio data.',
    };
  }

  const existing = await TtsAsset.findOne(query);
  const saved = await saveTtsAudioBuffer({
    buffer: audioBuffer,
    targetDir: buildStorageTargetDir(input.sourceType, sourceId, input.variant),
    targetName: `${contentVersionHash}.wav`,
  });

  if (existing?.audioUrl && existing.audioUrl !== saved.audioUrl) {
    await deleteStoredTtsAsset(existing.audioUrl).catch(() => undefined);
  }

  const ready = await TtsAsset.findOneAndUpdate(
    query,
    {
      $set: {
        title,
        sourceParentId,
        textHash,
        mimeType: synthesized.mimeType,
        audioUrl: saved.audioUrl,
        storageMode: saved.storageMode,
        status: 'ready',
        chunkCount: synthesized.chunkCount,
        charCount: normalizedText.length,
        generatedAt: new Date(),
        lastVerifiedAt: new Date(),
        lastAccessedAt: new Date(),
        lastError: '',
        metadata,
      },
      $setOnInsert: {
        failureCount: 0,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  if (ready?._id) {
    await markOlderVariantAssetsStale({
      assetId: ready._id.toString(),
      sourceType: input.sourceType,
      sourceId,
      variant: input.variant,
      provider: GEMINI_TTS_PROVIDER,
      model,
      voice,
      languageCode,
    });
  }

  await recordTtsAuditEvent({
    action: input.forceRegenerate ? 'regenerate' : 'generate',
    result: 'success',
    actor: input.actor,
    assetId: ready?._id?.toString(),
    sourceType: input.sourceType,
    sourceId,
    variant: input.variant,
    message: input.forceRegenerate
      ? 'Shared TTS asset regenerated successfully.'
      : 'Shared TTS asset generated successfully.',
    metadata: {
      ...metadata,
      chunkCount: synthesized.chunkCount,
      charCount: normalizedText.length,
    },
  });

  return {
    asset: ready,
    reused: false,
    config,
  };
}

export async function queueTtsAsset(input: EnsureTtsAssetInput): Promise<QueueTtsAssetResult> {
  await connectDB();
  const config = await getTtsConfig();
  const sourceId = normalizeSourceId(input.sourceId);
  const normalizedText = sanitizeText(input.text || '');
  const title = String(input.title || '').trim();
  const sourceParentId = String(input.sourceParentId || '').trim();

  if (!sourceId || !normalizedText) {
    return {
      asset: null,
      status: 'failed',
      config,
      error: 'Source id and text are required to queue a shared TTS asset.',
    };
  }

  const surfaceKey = variantToSurfaceKey(input.variant);
  const surface = config.surfaces[surfaceKey];
  if (!surface.enabled) {
    return {
      asset: null,
      status: 'failed',
      config,
      error: `TTS is disabled for the ${surfaceKey} surface.`,
    };
  }

  const runtime = getGeminiTtsRuntimeConfig();
  const languageCode = normalizeLanguageCode(input.languageCode, surface, normalizedText);
  const voice = normalizeVoice(input.voice, surface);
  const model = String(input.model || runtime.model || '').trim() || runtime.model;
  const textHash = hashValue(normalizedText);
  const contentVersionHash = hashValue(
    JSON.stringify({
      variant: input.variant,
      text: normalizedText,
      languageCode,
      voice,
      model,
      provider: GEMINI_TTS_PROVIDER,
    })
  );
  const metadata = {
    ...buildMetadataWithDefaults(input.metadata),
    queuedText: normalizedText,
    queuedAt: new Date().toISOString(),
  };
  const query = buildAssetQuery({
    sourceType: input.sourceType,
    sourceId,
    variant: input.variant,
    provider: GEMINI_TTS_PROVIDER,
    model,
    voice,
    languageCode,
    contentVersionHash,
  });

  const existing = await TtsAsset.findOne(query);
  if (existing?.status === 'ready' && existing.audioUrl) {
    return { asset: existing, status: 'ready', config };
  }

  if (existing?.status === 'processing') {
    return { asset: existing, status: 'processing', config };
  }

  if (existing?.status === 'failed') {
    return {
      asset: existing,
      status: 'failed',
      config,
      error: existing.lastError || 'TTS generation previously failed.',
    };
  }

  const queued = await TtsAsset.findOneAndUpdate(
    query,
    {
      $set: {
        sourceType: input.sourceType,
        sourceId,
        sourceParentId,
        variant: input.variant,
        title,
        textHash,
        contentVersionHash,
        languageCode,
        voice,
        provider: GEMINI_TTS_PROVIDER,
        model,
        mimeType: GEMINI_TTS_OUTPUT_MIME_TYPE,
        storageMode: process.env.EPAPER_FORCE_STORAGE === '1' ? 'proxy' : 'public',
        status: 'pending',
        charCount: normalizedText.length,
        metadata,
      },
      $setOnInsert: {
        audioUrl: '',
        chunkCount: 0,
        generatedAt: null,
        lastVerifiedAt: null,
        lastAccessedAt: null,
        failureCount: 0,
        lastError: '',
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return { asset: queued, status: 'queued', config };
}

export async function processQueuedTtsAssets(input: { limit?: number; staleProcessingMinutes?: number } = {}) {
  await connectDB();

  if (!isGeminiTtsConfigured()) {
    return {
      processed: 0,
      ready: 0,
      failed: 0,
      skipped: 0,
      error: 'Gemini TTS is not configured.',
    };
  }

  const limit = Math.max(1, Math.min(input.limit || 5, 25));
  const staleProcessingMinutes = Math.max(1, input.staleProcessingMinutes || 15);
  const staleProcessingCutoff = new Date(Date.now() - staleProcessingMinutes * 60 * 1000);
  const jobs = await TtsAsset.find({
    $or: [
      { status: 'pending' },
      { status: 'processing', updatedAt: { $lte: staleProcessingCutoff } },
    ],
  })
    .sort({ updatedAt: 1 })
    .limit(limit);

  let ready = 0;
  let failed = 0;
  let skipped = 0;

  for (const job of jobs) {
    try {
      const metadata = buildMetadataWithDefaults(job.metadata);
      const queuedText = typeof metadata.queuedText === 'string' ? metadata.queuedText.trim() : '';

      if (!queuedText) {
        job.status = 'failed';
        job.lastError = 'Queued TTS text is missing.';
        job.failureCount += 1;
        await job.save();
        failed += 1;
        continue;
      }

      job.status = 'processing';
      await job.save();

      const cleanMetadata = { ...metadata };
      delete cleanMetadata.queuedText;
      delete cleanMetadata.queuedAt;

      const result = await ensureTtsAsset({
        sourceType: job.sourceType,
        sourceId: job.sourceId,
        sourceParentId: job.sourceParentId,
        variant: job.variant,
        title: job.title,
        text: queuedText,
        languageCode: job.languageCode,
        voice: job.voice,
        model: job.model,
        forceRegenerate: true,
        metadata: cleanMetadata,
      });

      if (result.asset?.status === 'ready') {
        ready += 1;
      } else if (result.asset?.status === 'failed' || result.error) {
        failed += 1;
      } else {
        skipped += 1;
      }
    } catch (error) {
      job.status = 'failed';
      job.lastError =
        error instanceof Error && error.message.trim()
          ? error.message
          : 'Queued TTS processing failed.';
      job.failureCount += 1;
      await job.save().catch(() => undefined);
      failed += 1;
    }
  }

  return {
    processed: jobs.length,
    ready,
    failed,
    skipped,
  };
}
