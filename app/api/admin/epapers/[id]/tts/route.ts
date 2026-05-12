import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { getAdminSession } from '@/lib/auth/admin';
import connectDB from '@/lib/db/mongoose';
import EPaper from '@/lib/models/EPaper';
import EPaperArticle from '@/lib/models/EPaperArticle';
import TtsAuditEvent from '@/lib/models/TtsAuditEvent';
import { buildEpaperStoryTtsText } from '@/lib/server/ttsAssets';

type RouteContext = {
  params: Promise<{ id: string }>;
};

function parsePageNumber(value: unknown) {
  const parsed = Number.parseInt(String(value || ''), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 0;
  return Math.floor(parsed);
}

// Auto-TTS generation has been removed. This endpoint now returns a message
// explaining that audio must be uploaded manually via the e-paper asset upload.

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const admin = await getAdminSession();
    if (!admin) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    await connectDB();

    const { id } = await context.params;
    const epaperId = id.trim();
    if (!Types.ObjectId.isValid(epaperId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid e-paper ID' },
        { status: 400 }
      );
    }

    const epaper = await EPaper.findById(epaperId).select('_id title cityName publishDate');
    if (!epaper) {
      return NextResponse.json(
        { success: false, error: 'E-paper not found' },
        { status: 404 }
      );
    }

    const body = (await req.json().catch(() => ({}))) as {
      pageNumber?: number;
    };
    const pageNumber = parsePageNumber(body.pageNumber);

    const stories = await EPaperArticle.find({
      epaperId,
      ...(pageNumber ? { pageNumber } : {}),
    }).select('_id epaperId pageNumber title excerpt contentHtml');

    const result = {
      processed: stories.length,
      ready: 0,
      failed: 0,
      skipped: 0,
      message: 'Auto-TTS generation is disabled. Upload audio files manually for each story via the e-paper editor.',
    };

    // Count how many stories have text content (eligible for manual upload)
    for (const story of stories) {
      const text = buildEpaperStoryTtsText({
        title: String(story.title || ''),
        excerpt: String(story.excerpt || ''),
        contentHtml: String(story.contentHtml || ''),
      });
      if (text) {
        result.skipped += 1;
      } else {
        result.failed += 1;
      }
    }

    await TtsAuditEvent.create({
      action: 'generate',
      result: 'skipped',
      actorId: admin.id,
      actorEmail: admin.email,
      actorRole: admin.role,
      message: 'Admin e-paper bulk TTS requested but auto-generation is disabled.',
      metadata: {
        epaperId,
        pageNumber: pageNumber || null,
        result,
      },
    });

    return NextResponse.json(
      {
        success: false,
        error: result.message,
        data: result,
      },
      { status: 405 }
    );
  } catch (error) {
    console.error('Failed to run admin e-paper TTS job:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process e-paper audio request.' },
      { status: 500 }
    );
  }
}
