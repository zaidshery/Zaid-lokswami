import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongoose';
import Article from '@/lib/models/Article';
import { getAdminSession } from '@/lib/auth/admin';
import {
  createStoredArticle,
  listStoredArticles,
} from '@/lib/storage/articlesFile';
import { resolveArticleOgImageUrl } from '@/lib/utils/articleMedia';
const FILE_STORE_UNBOUNDED_LIMIT = Number.MAX_SAFE_INTEGER;

type NormalizedSeo = {
  metaTitle: string;
  metaDescription: string;
  ogImage: string;
  canonicalUrl: string;
};

function parsePositiveInt(value: string | null, fallback: number) {
  const parsed = Number.parseInt(value || '', 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return parsed;
}

function parseListLimit(value: string | null, fallback: number) {
  const normalized = (value || '').trim().toLowerCase();
  if (normalized === 'all') return null;

  const parsed = Number.parseInt(normalized, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return parsed;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : '';
}

function normalizeSeo(input: unknown): NormalizedSeo {
  const source = typeof input === 'object' && input ? (input as Record<string, unknown>) : {};
  return {
    metaTitle: typeof source.metaTitle === 'string' ? source.metaTitle.trim() : '',
    metaDescription:
      typeof source.metaDescription === 'string' ? source.metaDescription.trim() : '',
    ogImage: typeof source.ogImage === 'string' ? source.ogImage.trim() : '',
    canonicalUrl: typeof source.canonicalUrl === 'string' ? source.canonicalUrl.trim() : '',
  };
}

function isValidAbsoluteHttpUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

async function shouldUseFileStore() {
  if (!process.env.MONGODB_URI) {
    return true;
  }

  try {
    await connectDB();
    return false;
  } catch (error) {
    console.error('MongoDB unavailable for articles route, using file store.', error);
    return true;
  }
}

function normalizeArticleInput(body: unknown) {
  const source = typeof body === 'object' && body ? (body as Record<string, unknown>) : {};
  const image = typeof source.image === 'string' ? source.image.trim() : '';
  const seo = normalizeSeo(source.seo);
  if (!seo.ogImage && image) {
    seo.ogImage = resolveArticleOgImageUrl({ image });
  }

  return {
    title: typeof source.title === 'string' ? source.title.trim() : '',
    summary: typeof source.summary === 'string' ? source.summary.trim() : '',
    content: typeof source.content === 'string' ? source.content.trim() : '',
    image,
    category: typeof source.category === 'string' ? source.category.trim() : '',
    author: typeof source.author === 'string' ? source.author.trim() : '',
    isBreaking: Boolean(source.isBreaking),
    isTrending: Boolean(source.isTrending),
    seo,
  };
}

function validateArticleInput(input: ReturnType<typeof normalizeArticleInput>) {
  if (
    !input.title ||
    !input.summary ||
    !input.content ||
    !input.image ||
    !input.category ||
    !input.author
  ) {
    return 'Missing required fields';
  }

  if (input.title.length > 200) {
    return 'Title is too long (max 200 characters)';
  }

  if (input.summary.length > 500) {
    return 'Summary is too long (max 500 characters)';
  }

  if (input.seo.metaTitle && input.seo.metaTitle.length > 160) {
    return 'SEO title is too long (max 160 characters)';
  }

  if (input.seo.metaDescription && input.seo.metaDescription.length > 320) {
    return 'SEO description is too long (max 320 characters)';
  }

  if (input.seo.canonicalUrl && !isValidAbsoluteHttpUrl(input.seo.canonicalUrl)) {
    return 'Canonical URL must be a valid absolute URL';
  }

  if (input.seo.ogImage && !isValidAbsoluteHttpUrl(input.seo.ogImage) && !input.seo.ogImage.startsWith('/')) {
    return 'OG image must be an absolute URL or local path';
  }

  return null;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category');
    const limit = parseListLimit(searchParams.get('limit'), 10);
    const page = parsePositiveInt(searchParams.get('page'), 1);
    const isUnbounded = limit === null;
    const effectivePage = isUnbounded ? 1 : page;
    const effectiveLimit = isUnbounded ? FILE_STORE_UNBOUNDED_LIMIT : limit;
    const fileResult = await listStoredArticles({
      category,
      limit: effectiveLimit,
      page: effectivePage,
    });

    const createFileResponse = () =>
      NextResponse.json({
        success: true,
        data: fileResult.data,
        pagination: {
          total: fileResult.total,
          page: effectivePage,
          limit: isUnbounded ? fileResult.total : effectiveLimit,
          pages: isUnbounded ? 1 : Math.ceil(fileResult.total / effectiveLimit),
        },
      });

    if (await shouldUseFileStore()) {
      return createFileResponse();
    }

    const query: Record<string, unknown> = {};
    if (category && category !== 'all') {
      query.category = category;
    }

    const total = await Article.countDocuments(query);
    if (total === 0 && fileResult.total > 0) {
      return createFileResponse();
    }

    const skip = (effectivePage - 1) * effectiveLimit;
    let articlesQuery = Article.find(query).sort({ publishedAt: -1 }).skip(skip);
    if (!isUnbounded) {
      articlesQuery = articlesQuery.limit(effectiveLimit);
    }
    const articles = await articlesQuery.lean();

    return NextResponse.json({
      success: true,
      data: articles,
      pagination: {
        total,
        page: effectivePage,
        limit: isUnbounded ? total : effectiveLimit,
        pages: isUnbounded ? 1 : Math.ceil(total / effectiveLimit),
      },
    });
  } catch (error) {
    console.error('Error fetching articles:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch articles' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAdminSession();
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const input = normalizeArticleInput(body);
    const validationError = validateArticleInput(input);

    if (validationError) {
      return NextResponse.json(
        { success: false, error: validationError },
        { status: 400 }
      );
    }

    const useFileStore = await shouldUseFileStore();

    if (useFileStore) {
      const stored = await createStoredArticle(input);
      return NextResponse.json({ success: true, data: stored }, { status: 201 });
    }

    const article = new Article({
      ...input,
      views: 0,
      publishedAt: new Date(),
      updatedAt: new Date(),
    });

    await article.save();
    return NextResponse.json({ success: true, data: article }, { status: 201 });
  } catch (error: unknown) {
    console.error('Error creating article:', error);
    const message =
      process.env.NODE_ENV !== 'production'
        ? getErrorMessage(error) || 'Failed to create article'
        : 'Failed to create article';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

