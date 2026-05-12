import { NextResponse } from 'next/server';
import { Types } from 'mongoose';
import connectDB from '@/lib/db/mongoose';
import Article from '@/lib/models/Article';
import { getAdminSessionFromReq } from '@/lib/auth/admin';
import { canReadContent, canViewPage } from '@/lib/auth/permissions';
import { listArticleActivity } from '@/lib/server/articleActivity';
import { getStoredArticleById } from '@/lib/storage/articlesFile';
import { resolveArticleWorkflow } from '@/lib/workflow/article';

type RouteContext = {
  params: Promise<{ id: string }>;
};

type LeanArticleRecord = Record<string, unknown> & {
  author?: string;
  workflow?: Record<string, unknown> | null;
  publishedAt?: string | Date;
  updatedAt?: string | Date;
  revisions?: unknown[];
};

async function shouldUseFileStore() {
  if (!process.env.MONGODB_URI) return true;

  try {
    await connectDB();
    return false;
  } catch (error) {
    console.error('MongoDB unavailable for article activity route, using file store.', error);
    return true;
  }
}

function buildArticlePermissionRecord(article: {
  author?: unknown;
  workflow?: unknown;
  publishedAt?: unknown;
  updatedAt?: unknown;
}) {
  const workflow = resolveArticleWorkflow({
    workflow:
      typeof article.workflow === 'object' && article.workflow
        ? (article.workflow as Record<string, unknown>)
        : null,
    publishedAt: article.publishedAt,
    updatedAt: article.updatedAt,
  });

  return {
    legacyAuthorName: typeof article.author === 'string' ? article.author : '',
    workflow,
  };
}

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const user = await getAdminSessionFromReq(req);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (!canViewPage(user.role, 'articles')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await context.params;

    if (await shouldUseFileStore()) {
      const article = await getStoredArticleById(id);
      if (!article) {
        return NextResponse.json({ success: false, error: 'Article not found' }, { status: 404 });
      }

      if (!canReadContent(user, buildArticlePermissionRecord(article), { allowViewerRead: true })) {
        return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
      }

      const activity = await listArticleActivity({ articleId: id, article });
      return NextResponse.json({ success: true, data: activity });
    }

    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, error: 'Invalid article ID' }, { status: 400 });
    }

    const article = (await Article.findById(id).lean()) as LeanArticleRecord | null;
    if (!article) {
      return NextResponse.json({ success: false, error: 'Article not found' }, { status: 404 });
    }

    if (!canReadContent(user, buildArticlePermissionRecord(article), { allowViewerRead: true })) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const activity = await listArticleActivity({ articleId: id, article });
    return NextResponse.json({ success: true, data: activity });
  } catch (error) {
    console.error('Error fetching article activity:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch article activity' },
      { status: 500 }
    );
  }
}
