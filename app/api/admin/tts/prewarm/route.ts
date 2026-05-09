import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth/admin';
import { canRunGlobalAiOps } from '@/lib/auth/permissions';
import connectDB from '@/lib/db/mongoose';
import Article from '@/lib/models/Article';
import EPaper from '@/lib/models/EPaper';
import EPaperArticle from '@/lib/models/EPaperArticle';
import TtsAuditEvent from '@/lib/models/TtsAuditEvent';
import {
  buildEpaperStoryTtsText,
  ensureTtsAsset,
  getTtsConfig,
} from '@/lib/server/ttsAssets';
import { ensureBreakingTtsForArticle } from '@/lib/server/breakingTts';

type PrewarmScope = 'all' | 'breaking' | 'article' | 'epaper';

function isPrewarmScope(value: unknown): value is PrewarmScope {
  return value === 'all' || value === 'breaking' || value === 'article' || value === 'epaper';
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
      scope?: PrewarmScope;
      forceRegenerate?: boolean;
    };

    const scope: PrewarmScope = isPrewarmScope(body.scope) ? body.scope : 'all';
    const forceRegenerate = Boolean(body.forceRegenerate);
    const config = await getTtsConfig();

    const result = {
      breaking: { processed: 0, ready: 0, failed: 0 },
      article: { processed: 0, ready: 0, failed: 0 },
      epaper: { processed: 0, ready: 0, failed: 0 },
    };

    if (scope === 'all' || scope === 'breaking') {
      const breakingArticles = await Article.find({ isBreaking: true })
        .select('_id title city isBreaking breakingTts')
        .sort({ publishedAt: -1, _id: -1 })
        .limit(config.prewarm.latestBreakingLimit)
        .lean();

      for (const article of breakingArticles) {
        result.breaking.processed += 1;
        const metadata = await ensureBreakingTtsForArticle(article, { forceRegenerate });
        if (metadata?.audioUrl) {
          result.breaking.ready += 1;
        } else {
          result.breaking.failed += 1;
        }
      }
    }

    if (scope === 'all' || scope === 'epaper') {
      const papers = await EPaper.find({ status: 'published' })
        .select('_id title cityName publishDate')
        .sort({ publishDate: -1, _id: -1 })
        .limit(10)
        .lean();
      const paperMap = new Map(
        papers.map((paper) => [
          String(paper._id || ''),
          {
            title: String(paper.title || ''),
            cityName: String(paper.cityName || ''),
            publishDate:
              paper.publishDate instanceof Date
                ? paper.publishDate.toISOString()
                : String(paper.publishDate || ''),
          },
        ])
      );

      const epaperIds = [...paperMap.keys()];
      if (epaperIds.length) {
        const stories = await EPaperArticle.find({ epaperId: { $in: epaperIds } })
          .select('_id epaperId pageNumber title excerpt contentHtml')
          .sort({ updatedAt: -1, _id: -1 })
          .limit(config.prewarm.latestEpaperStoryLimit)
          .lean();

        for (const story of stories) {
          const sourceId = String(story._id || '').trim();
          const sourceParentId = String(story.epaperId || '').trim();
          const text = buildEpaperStoryTtsText({
            title: String(story.title || ''),
            excerpt: String(story.excerpt || ''),
            contentHtml: String(story.contentHtml || ''),
          });

          if (!sourceId || !sourceParentId || !text) {
            continue;
          }

          result.epaper.processed += 1;
          const parent = paperMap.get(sourceParentId);
          const ensured = await ensureTtsAsset({
            sourceType: 'epaperArticle',
            sourceId,
            sourceParentId,
            variant: 'epaper_story',
            title: String(story.title || ''),
            text,
            forceRegenerate,
            actor: admin,
            metadata: {
              source: 'admin-prewarm',
              pageNumber: Number(story.pageNumber || 1),
              paperTitle: parent?.title || '',
              cityName: parent?.cityName || '',
              publishDate: parent?.publishDate || '',
            },
          });

          if (ensured.asset?.status === 'ready' && ensured.asset.audioUrl) {
            result.epaper.ready += 1;
          } else {
            result.epaper.failed += 1;
          }
        }
      }
    }

    await TtsAuditEvent.create({
      action: forceRegenerate ? 'regenerate' : 'generate',
      result: 'success',
      actorId: admin.id,
      actorEmail: admin.email,
      actorRole: admin.role,
      message: 'Ran admin TTS prewarm job.',
      metadata: {
        scope,
        forceRegenerate,
        result,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        scope,
        forceRegenerate,
        result,
      },
    });
  } catch (error) {
    console.error('Failed to prewarm admin TTS assets:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to prewarm TTS assets.' },
      { status: 500 }
    );
  }
}
