import { NextRequest, NextResponse } from 'next/server';
import { getAdminSessionFromReq } from '@/lib/auth/admin';
import { canRunGlobalAiOps } from '@/lib/auth/permissions';
import connectDB from '@/lib/db/mongoose';
import TtsAsset from '@/lib/models/TtsAsset';
import TtsAuditEvent from '@/lib/models/TtsAuditEvent';
import type { TtsAssetStatus, TtsSourceType, TtsVariant } from '@/lib/types/tts';

const ALLOWED_STATUSES = new Set<TtsAssetStatus>(['pending', 'ready', 'failed', 'stale']);
const ALLOWED_VARIANTS = new Set<TtsVariant>([
  'breaking_headline',
  'article_full',
  'epaper_story',
]);
const ALLOWED_SOURCE_TYPES = new Set<TtsSourceType>(['article', 'epaperArticle']);

function parseLimit(value: string | null, fallback: number) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'all') {
    return 500;
  }

  const parsed = Number.parseInt(normalized, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(500, Math.max(1, Math.floor(parsed)));
}

function parseOptionalStatus(value: string | null) {
  const normalized = String(value || '').trim();
  return ALLOWED_STATUSES.has(normalized as TtsAssetStatus)
    ? (normalized as TtsAssetStatus)
    : '';
}

function parseOptionalVariant(value: string | null) {
  const normalized = String(value || '').trim();
  return ALLOWED_VARIANTS.has(normalized as TtsVariant) ? (normalized as TtsVariant) : '';
}

function parseOptionalSourceType(value: string | null) {
  const normalized = String(value || '').trim();
  return ALLOWED_SOURCE_TYPES.has(normalized as TtsSourceType)
    ? (normalized as TtsSourceType)
    : '';
}

function parseOptionalId(value: string | null) {
  return String(value || '').trim();
}

function parseOptionalIdList(value: string | null) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 500);
}

export async function GET(req: NextRequest) {
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

    const { searchParams } = new URL(req.url);
    const limit = parseLimit(searchParams.get('limit'), 24);
    const status = parseOptionalStatus(searchParams.get('status'));
    const variant = parseOptionalVariant(searchParams.get('variant'));
    const sourceType = parseOptionalSourceType(searchParams.get('sourceType'));
    const sourceId = parseOptionalId(searchParams.get('sourceId'));
    const sourceIds = parseOptionalIdList(searchParams.get('sourceIds'));
    const sourceParentId = parseOptionalId(searchParams.get('sourceParentId'));

    const filters: Record<string, unknown> = {};
    if (status) filters.status = status;
    if (variant) filters.variant = variant;
    if (sourceType) filters.sourceType = sourceType;
    if (sourceParentId) filters.sourceParentId = sourceParentId;
    if (sourceIds.length > 0) {
      filters.sourceId = { $in: sourceIds };
    } else if (sourceId) {
      filters.sourceId = sourceId;
    }

    const [assets, recentAudits, totalAssets, statusCounts, variantCounts, recentFailures] =
      await Promise.all([
        TtsAsset.find(filters)
          .sort({ updatedAt: -1, _id: -1 })
          .limit(limit)
          .lean(),
        TtsAuditEvent.find({})
          .sort({ createdAt: -1, _id: -1 })
          .limit(12)
          .lean(),
        TtsAsset.countDocuments(filters),
        TtsAsset.aggregate([
          { $match: filters },
          { $group: { _id: '$status', count: { $sum: 1 } } },
        ]),
        TtsAsset.aggregate([
          { $match: filters },
          { $group: { _id: '$variant', count: { $sum: 1 } } },
        ]),
        TtsAsset.find({ ...filters, status: 'failed' })
          .sort({ updatedAt: -1, _id: -1 })
          .limit(5)
          .lean(),
      ]);

    const summary = {
      totalAssets,
      byStatus: {
        pending: 0,
        ready: 0,
        failed: 0,
        stale: 0,
      } as Record<TtsAssetStatus, number>,
      byVariant: {
        breaking_headline: 0,
        article_full: 0,
        epaper_story: 0,
      } as Record<TtsVariant, number>,
      recentFailures: recentFailures.length,
    };

    for (const item of statusCounts) {
      const key = String(item._id || '') as TtsAssetStatus;
      if (key in summary.byStatus) {
        summary.byStatus[key] = Number(item.count || 0);
      }
    }

    for (const item of variantCounts) {
      const key = String(item._id || '') as TtsVariant;
      if (key in summary.byVariant) {
        summary.byVariant[key] = Number(item.count || 0);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        filters: {
          status: status || null,
          variant: variant || null,
          sourceType: sourceType || null,
          sourceId: sourceId || null,
          sourceParentId: sourceParentId || null,
          sourceIds,
          limit,
        },
        summary,
        assets,
        recentAudits,
        recentFailures,
      },
    });
  } catch (error) {
    console.error('Failed to load admin TTS assets:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load TTS assets.' },
      { status: 500 }
    );
  }
}
