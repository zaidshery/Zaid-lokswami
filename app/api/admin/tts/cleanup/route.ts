import { NextRequest, NextResponse } from 'next/server';
import { getAdminSessionFromReq } from '@/lib/auth/admin';
import { canRunGlobalAiOps } from '@/lib/auth/permissions';
import connectDB from '@/lib/db/mongoose';
import TtsAsset from '@/lib/models/TtsAsset';
import TtsAuditEvent from '@/lib/models/TtsAuditEvent';
import { getTtsConfig } from '@/lib/server/ttsAssets';
import {
  type TtsAssetStatus,
  type TtsSourceType,
  type TtsVariant,
} from '@/lib/types/tts';
import { deleteStoredTtsAsset, hasStoredTtsAsset } from '@/lib/utils/ttsStorage';

const CLEANABLE_STATUSES = new Set<TtsAssetStatus>(['pending', 'failed', 'stale']);
const ALLOWED_VARIANTS = new Set<TtsVariant>([
  'breaking_headline',
  'article_full',
  'epaper_story',
]);
const ALLOWED_SOURCE_TYPES = new Set<TtsSourceType>(['article', 'epaperArticle']);

function parseLimit(value: unknown, fallback: number) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(500, Math.max(1, Math.floor(parsed)));
}

function parseOptionalStatus(value: unknown) {
  const normalized = String(value ?? '').trim();
  if (normalized === 'all') {
    return 'all';
  }

  return CLEANABLE_STATUSES.has(normalized as TtsAssetStatus)
    ? (normalized as TtsAssetStatus)
    : '';
}

function parseOptionalVariant(value: unknown) {
  const normalized = String(value ?? '').trim();
  return ALLOWED_VARIANTS.has(normalized as TtsVariant) ? (normalized as TtsVariant) : '';
}

function parseOptionalSourceType(value: unknown) {
  const normalized = String(value ?? '').trim();
  return ALLOWED_SOURCE_TYPES.has(normalized as TtsSourceType)
    ? (normalized as TtsSourceType)
    : '';
}

function parseOptionalId(value: unknown) {
  return String(value ?? '').trim();
}

function isHttpUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

export async function POST(req: NextRequest) {
  try {
    const admin = await getAdminSessionFromReq(req);
    if (!admin) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }
    if (!canRunGlobalAiOps(admin.role)) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    await connectDB();

    const body = (await req.json().catch(() => ({}))) as {
      status?: TtsAssetStatus | 'all';
      variant?: TtsVariant;
      sourceType?: TtsSourceType;
      sourceId?: string;
      sourceParentId?: string;
      limit?: number;
      dryRun?: boolean;
    };

    const config = await getTtsConfig();
    const retentionDays = Math.max(1, Number(config.retentionDays || 90));
    const limit = parseLimit(body.limit, 100);
    const status = parseOptionalStatus(body.status);
    const variant = parseOptionalVariant(body.variant);
    const sourceType = parseOptionalSourceType(body.sourceType);
    const sourceId = parseOptionalId(body.sourceId);
    const sourceParentId = parseOptionalId(body.sourceParentId);
    const dryRun = Boolean(body.dryRun);
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

    const filters: Record<string, unknown> = {
      updatedAt: { $lte: cutoff },
      status:
        status && status !== 'all'
          ? status
          : {
              $in: Array.from(CLEANABLE_STATUSES),
            },
    };

    if (variant) filters.variant = variant;
    if (sourceType) filters.sourceType = sourceType;
    if (sourceId) filters.sourceId = sourceId;
    if (sourceParentId) filters.sourceParentId = sourceParentId;

    const assets = await TtsAsset.find(filters)
      .sort({ updatedAt: 1, _id: 1 })
      .limit(limit);

    let deletedAssets = 0;
    let deletedFiles = 0;
    let missingFiles = 0;

    for (const asset of assets) {
      const audioUrl = String(asset.audioUrl || '').trim();
      const usesLocalStorage = audioUrl && !isHttpUrl(audioUrl);

      if (usesLocalStorage) {
        if (hasStoredTtsAsset(audioUrl)) {
          deletedFiles += 1;
          if (!dryRun) {
            await deleteStoredTtsAsset(audioUrl).catch(() => undefined);
          }
        } else {
          missingFiles += 1;
        }
      }

      deletedAssets += 1;
      if (!dryRun) {
        await asset.deleteOne();
      }
    }

    await TtsAuditEvent.create({
      action: 'cleanup',
      result: 'success',
      actorId: admin.id,
      actorEmail: admin.email,
      actorRole: admin.role,
      message: dryRun
        ? 'Ran dry-run cleanup for expired TTS assets.'
        : 'Cleaned up expired TTS assets.',
      metadata: {
        dryRun,
        retentionDays,
        cutoff: cutoff.toISOString(),
        filters: {
          status: status || 'all',
          variant: variant || null,
          sourceType: sourceType || null,
          sourceId: sourceId || null,
          sourceParentId: sourceParentId || null,
          limit,
        },
        deletedAssets,
        deletedFiles,
        missingFiles,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        dryRun,
        retentionDays,
        cutoff: cutoff.toISOString(),
        processed: assets.length,
        deletedAssets,
        deletedFiles,
        missingFiles,
      },
    });
  } catch (error) {
    console.error('Failed to clean up admin TTS assets:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to clean up TTS assets.' },
      { status: 500 }
    );
  }
}
