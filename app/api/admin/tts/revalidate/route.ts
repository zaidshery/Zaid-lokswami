import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { getAdminSessionFromReq } from '@/lib/auth/admin';
import { canRunGlobalAiOps } from '@/lib/auth/permissions';
import connectDB from '@/lib/db/mongoose';
import TtsAsset from '@/lib/models/TtsAsset';
import TtsAuditEvent from '@/lib/models/TtsAuditEvent';
import { hasStoredTtsAsset } from '@/lib/utils/ttsStorage';

function parseLimit(value: unknown, fallback: number) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(200, Math.max(1, Math.floor(parsed)));
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
      assetIds?: string[];
      status?: 'ready' | 'stale' | 'failed' | 'pending' | 'all';
      limit?: number;
    };

    const limit = parseLimit(body.limit, 50);
    const validIds = Array.isArray(body.assetIds)
      ? body.assetIds.filter((item) => Types.ObjectId.isValid(String(item || '').trim()))
      : [];

    const query: Record<string, unknown> = {};
    if (validIds.length) {
      query._id = { $in: validIds };
    } else if (body.status && body.status !== 'all') {
      query.status = body.status;
    }

    const assets = await TtsAsset.find(query)
      .sort({ updatedAt: -1, _id: -1 })
      .limit(validIds.length ? validIds.length : limit);

    const now = new Date();
    let ready = 0;
    let stale = 0;
    let unchanged = 0;

    for (const asset of assets) {
      const isRemote = /^https?:\/\//i.test(asset.audioUrl || '');
      const exists = isRemote ? true : Boolean(asset.audioUrl && hasStoredTtsAsset(asset.audioUrl));

      asset.lastVerifiedAt = now;

      if (!asset.audioUrl || !exists) {
        asset.status = 'stale';
        asset.lastError = 'Stored TTS asset file is missing.';
        stale += 1;
      } else if (asset.status === 'stale') {
        asset.status = 'ready';
        asset.lastError = '';
        ready += 1;
      } else {
        unchanged += 1;
      }

      await asset.save();
    }

    await TtsAuditEvent.create({
      action: 'revalidate',
      result: 'success',
      actorId: admin.id,
      actorEmail: admin.email,
      actorRole: admin.role,
      message: 'Revalidated TTS asset storage presence.',
      metadata: {
        requestedIds: validIds.length,
        processed: assets.length,
        ready,
        stale,
        unchanged,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        processed: assets.length,
        ready,
        stale,
        unchanged,
      },
    });
  } catch (error) {
    console.error('Failed to revalidate admin TTS assets:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to revalidate TTS assets.' },
      { status: 500 }
    );
  }
}
