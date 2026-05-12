import { NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { publicJsonCacheHeaders } from '@/lib/api/cache';
import connectDB from '@/lib/db/mongoose';
import { isPubliclyPublishedArticle } from '@/lib/content/articlePublication';
import Article from '@/lib/models/Article';
import { getStoredArticleByIdOrSlug } from '@/lib/storage/articlesFile';
import { normalizeArticleSlug } from '@/lib/seo/articleSeo';

type RouteContext = {
  params: Promise<{ id: string }>;
};

const ARTICLE_DETAIL_CACHE_HEADERS = publicJsonCacheHeaders({
  sMaxAge: 120,
  staleWhileRevalidate: 600,
});

async function shouldUseFileStore() {
  if (!process.env.MONGODB_URI) {
    return true;
  }

  try {
    await connectDB();
    return false;
  } catch (error) {
    console.error('MongoDB unavailable for public article detail, using file store.', error);
    return true;
  }
}

export async function GET(_: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const articleId = decodeURIComponent(id).trim();

    if (!articleId) {
      return NextResponse.json(
        { success: false, error: 'Invalid article ID' },
        { status: 400 }
      );
    }

    if (await shouldUseFileStore()) {
      const stored = await getStoredArticleByIdOrSlug(articleId);
      if (!stored || !isPubliclyPublishedArticle(stored)) {
        return NextResponse.json(
          { success: false, error: 'Article not found' },
          { status: 404 }
        );
      }

      return NextResponse.json(
        { success: true, data: stored },
        { headers: ARTICLE_DETAIL_CACHE_HEADERS }
      );
    }

    const slug = normalizeArticleSlug(articleId);
    const article = Types.ObjectId.isValid(articleId)
      ? await Article.findById(articleId).lean()
      : slug
        ? await Article.findOne({ $or: [{ slug }, { previousSlugs: slug }] }).lean()
        : null;
    if (!article || !isPubliclyPublishedArticle(article)) {
      return NextResponse.json(
        { success: false, error: 'Article not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { success: true, data: article },
      { headers: ARTICLE_DETAIL_CACHE_HEADERS }
    );
  } catch (error) {
    console.error('Failed to load public article detail:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch article' },
      { status: 500 }
    );
  }
}

