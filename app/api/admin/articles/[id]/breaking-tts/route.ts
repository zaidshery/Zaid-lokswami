import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import connectDB from '@/lib/db/mongoose';
import { getAdminSession } from '@/lib/auth/admin';
import { canEditContent, canViewPage } from '@/lib/auth/permissions';
import Article from '@/lib/models/Article';
import { resolveArticleWorkflow } from '@/lib/workflow/article';
import {
  ensureBreakingTtsForArticle,
  resolveReusableBreakingTts,
} from '@/lib/server/breakingTts';
import { getStoredArticleById, updateStoredArticle } from '@/lib/storage/articlesFile';

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function shouldUseFileStore() {
  if (!process.env.MONGODB_URI) {
    return true;
  }

  try {
    await connectDB();
    return false;
  } catch (error) {
    console.error('MongoDB unavailable for breaking TTS route, using file store.', error);
    return true;
  }
}

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const user = await getAdminSession();
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (!canViewPage(user.role, 'article_edit')) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    const { id } = await context.params;
    const forceRegenerate = req.nextUrl.searchParams.get('force') !== '0';

    if (await shouldUseFileStore()) {
      const article = await getStoredArticleById(id);
      if (!article) {
        return NextResponse.json(
          { success: false, error: 'Article not found' },
          { status: 404 }
        );
      }
      if (
        !canEditContent(user, {
          legacyAuthorName: article.author,
          workflow: resolveArticleWorkflow(article),
        })
      ) {
        return NextResponse.json(
          { success: false, error: 'Forbidden' },
          { status: 403 }
        );
      }

      if (!article.isBreaking) {
        return NextResponse.json(
          { success: false, error: 'Only breaking articles can generate voice cache.' },
          { status: 400 }
        );
      }

      const breakingTts = await ensureBreakingTtsForArticle(article, { forceRegenerate });
      if (!breakingTts) {
        return NextResponse.json(
          { success: false, error: 'Unable to generate breaking voice cache right now.' },
          { status: 502 }
        );
      }

      const updated = await updateStoredArticle(
        id,
        { breakingTts },
        { skipRevision: true }
      );

      return NextResponse.json({
        success: true,
        data: {
          ready: true,
          breakingTts: updated?.breakingTts ?? breakingTts,
        },
      });
    }

    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, error: 'Invalid article ID' },
        { status: 400 }
      );
    }

    const article = await Article.findById(id);
    if (!article) {
      return NextResponse.json(
        { success: false, error: 'Article not found' },
        { status: 404 }
      );
    }
    if (
      !canEditContent(user, {
        legacyAuthorName: article.author,
        workflow: resolveArticleWorkflow({
          workflow: article.workflow,
          updatedAt: article.updatedAt,
          publishedAt: article.publishedAt,
        }),
      })
    ) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    if (!article.isBreaking) {
      return NextResponse.json(
        { success: false, error: 'Only breaking articles can generate voice cache.' },
        { status: 400 }
      );
    }

    const breakingTts = await ensureBreakingTtsForArticle(article.toObject(), {
      forceRegenerate,
    });

    if (!breakingTts) {
      return NextResponse.json(
        { success: false, error: 'Unable to generate breaking voice cache right now.' },
        { status: 502 }
      );
    }

    article.breakingTts = {
      ...breakingTts,
      generatedAt: new Date(breakingTts.generatedAt),
    };
    await article.save();

    return NextResponse.json({
      success: true,
      data: {
        ready: Boolean(resolveReusableBreakingTts(article.toObject())),
        breakingTts,
      },
    });
  } catch (error) {
    console.error('Failed to regenerate breaking TTS cache:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to regenerate breaking voice cache' },
      { status: 500 }
    );
  }
}
