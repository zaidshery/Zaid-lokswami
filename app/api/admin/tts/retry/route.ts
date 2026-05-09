import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { getAdminSession } from '@/lib/auth/admin';
import { canRunGlobalAiOps } from '@/lib/auth/permissions';
import connectDB from '@/lib/db/mongoose';
import Article from '@/lib/models/Article';
import EPaper from '@/lib/models/EPaper';
import EPaperArticle from '@/lib/models/EPaperArticle';
import TtsAsset from '@/lib/models/TtsAsset';
import TtsAuditEvent from '@/lib/models/TtsAuditEvent';
import { ensureBreakingTtsForArticle } from '@/lib/server/breakingTts';
import {
  buildEpaperStoryTtsText,
  ensureTtsAsset,
} from '@/lib/server/ttsAssets';
import type { TtsAssetStatus, TtsSourceType, TtsVariant } from '@/lib/types/tts';

const ALLOWED_STATUSES = new Set<TtsAssetStatus>(['pending', 'ready', 'failed', 'stale']);
const ALLOWED_VARIANTS = new Set<TtsVariant>([
  'breaking_headline',
  'article_full',
  'epaper_story',
]);
const ALLOWED_SOURCE_TYPES = new Set<TtsSourceType>(['article', 'epaperArticle']);

function parseLimit(value: unknown, fallback: number) {
  const parsed = Number.parseInt(String(value || ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(100, Math.max(1, Math.floor(parsed)));
}

function parseOptionalStatus(value: unknown) {
  const normalized = String(value || '').trim();
  return ALLOWED_STATUSES.has(normalized as TtsAssetStatus)
    ? (normalized as TtsAssetStatus)
    : '';
}

function parseOptionalVariant(value: unknown) {
  const normalized = String(value || '').trim();
  return ALLOWED_VARIANTS.has(normalized as TtsVariant)
    ? (normalized as TtsVariant)
    : '';
}

function parseOptionalSourceType(value: unknown) {
  const normalized = String(value || '').trim();
  return ALLOWED_SOURCE_TYPES.has(normalized as TtsSourceType)
    ? (normalized as TtsSourceType)
    : '';
}

function parseOptionalId(value: unknown) {
  return String(value || '').trim();
}

function parseOptionalIds(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .slice(0, 100);
}

export async function POST(req: NextRequest) {
  try {
    const admin = await getAdminSession();
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
      assetIds?: string[];
      status?: TtsAssetStatus;
      variant?: TtsVariant;
      sourceType?: TtsSourceType;
      sourceId?: string;
      sourceParentId?: string;
      limit?: number;
    };

    const assetIds = parseOptionalIds(body.assetIds);
    const status = parseOptionalStatus(body.status);
    const variant = parseOptionalVariant(body.variant);
    const sourceType = parseOptionalSourceType(body.sourceType);
    const sourceId = parseOptionalId(body.sourceId);
    const sourceParentId = parseOptionalId(body.sourceParentId);
    const limit = parseLimit(body.limit, 25);

    const filters: Record<string, unknown> = {};
    if (assetIds.length) {
      filters._id = {
        $in: assetIds.filter((id) => Types.ObjectId.isValid(id)).map((id) => new Types.ObjectId(id)),
      };
    } else {
      if (status) filters.status = status;
      if (variant) filters.variant = variant;
      if (sourceType) filters.sourceType = sourceType;
      if (sourceId) filters.sourceId = sourceId;
      if (sourceParentId) filters.sourceParentId = sourceParentId;
    }

    const assets = await TtsAsset.find(filters)
      .sort({ updatedAt: -1, _id: -1 })
      .limit(assetIds.length ? assetIds.length : limit);

    const result = {
      processed: 0,
      ready: 0,
      failed: 0,
      skipped: 0,
    };

    for (const asset of assets) {
      result.processed += 1;

      if (asset.sourceType === 'article' && asset.variant === 'breaking_headline') {
        const article = await Article.findById(asset.sourceId).select(
          '_id title city isBreaking breakingTts'
        );

        if (!article || !article.isBreaking) {
          result.failed += 1;
          continue;
        }

        const ensured = await ensureBreakingTtsForArticle(article.toObject(), {
          forceRegenerate: true,
        });
        if (ensured?.audioUrl) {
          result.ready += 1;
        } else {
          result.failed += 1;
        }
        continue;
      }

      if (asset.sourceType === 'article' && asset.variant === 'article_full') {
        result.skipped += 1;
        continue;
      }

      if (asset.sourceType === 'epaperArticle' && asset.variant === 'epaper_story') {
        const story = await EPaperArticle.findById(asset.sourceId).select(
          '_id epaperId pageNumber title excerpt contentHtml'
        );

        if (!story) {
          result.failed += 1;
          continue;
        }

        const paper = await EPaper.findById(String(story.epaperId || '')).select(
          '_id title cityName publishDate'
        );
        const text = buildEpaperStoryTtsText({
          title: String(story.title || ''),
          excerpt: String(story.excerpt || ''),
          contentHtml: String(story.contentHtml || ''),
        });

        if (!text) {
          result.skipped += 1;
          continue;
        }

        const ensured = await ensureTtsAsset({
          sourceType: 'epaperArticle',
          sourceId: String(story._id),
          sourceParentId: String(story.epaperId || ''),
          variant: 'epaper_story',
          title: String(story.title || paper?.title || ''),
          text,
          languageCode: asset.languageCode,
          voice: asset.voice,
          model: asset.model,
          forceRegenerate: true,
          actor: admin,
          metadata: {
            source: 'admin-retry',
            retriedAssetId: asset._id.toString(),
            pageNumber: Number(story.pageNumber || 1),
            paperTitle: String(paper?.title || ''),
            cityName: String(paper?.cityName || ''),
            publishDate:
              paper?.publishDate instanceof Date
                ? paper.publishDate.toISOString()
                : String(paper?.publishDate || ''),
          },
        });

        if (ensured.asset?.status === 'ready' && ensured.asset.audioUrl) {
          result.ready += 1;
        } else {
          result.failed += 1;
        }
        continue;
      }

      result.skipped += 1;
    }

    await TtsAuditEvent.create({
      action: 'regenerate',
      result: 'success',
      actorId: admin.id,
      actorEmail: admin.email,
      actorRole: admin.role,
      message: 'Ran admin TTS retry job.',
      metadata: {
        filters: {
          assetIds,
          status,
          variant,
          sourceType,
          sourceId,
          sourceParentId,
          limit,
        },
        result,
      },
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Failed to retry admin TTS assets:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to retry TTS assets.' },
      { status: 500 }
    );
  }
}
