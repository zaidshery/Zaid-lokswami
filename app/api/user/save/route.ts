import { Types } from 'mongoose';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import connectDB from '@/lib/db/mongoose';
import User from '@/lib/models/User';
import Article from '@/lib/models/Article';
import { resolveArticleEditorialFlags } from '@/lib/content/articleEditorial';

type SessionIdentity = {
  userId: string;
  email: string;
};

type LeanSavedUser = {
  _id: Types.ObjectId;
  savedArticles?: Types.ObjectId[];
};

type LeanSavedArticle = {
  _id: Types.ObjectId;
  title?: string;
  summary?: string;
  image?: string;
  category?: string;
  author?: string;
  publishedAt?: Date | string;
  isBreaking?: boolean;
  isTrending?: boolean;
  editorial?: unknown;
};

function getSessionIdentity() {
  return auth().then((session) => {
    const sessionUser = session?.user;
    const email = sessionUser?.email?.trim().toLowerCase() || '';
    const userId = (sessionUser?.userId || sessionUser?.id || '').trim();

    if (!sessionUser || !email) {
      return null;
    }

    const identity: SessionIdentity = { userId, email };
    return identity;
  });
}

function toUserQuery(identity: SessionIdentity) {
  return Types.ObjectId.isValid(identity.userId)
    ? { _id: identity.userId }
    : { email: identity.email };
}

function normalizeSavedArticleIds(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as string[];
  }

  return value
    .map((entry) => String(entry))
    .filter((entry) => Types.ObjectId.isValid(entry));
}

function normalizePublishedAt(value: unknown) {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'string') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  return '';
}

function toSavedArticleDTO(article: LeanSavedArticle) {
  const activeFlags = resolveArticleEditorialFlags(article);
  return {
    id: article._id.toString(),
    title: String(article.title || '').trim(),
    summary: String(article.summary || '').trim(),
    image: String(article.image || '').trim(),
    category: String(article.category || '').trim(),
    author: String(article.author || '').trim(),
    publishedAt: normalizePublishedAt(article.publishedAt),
    isBreaking: activeFlags.isBreaking,
    isTrending: activeFlags.isTrending,
  };
}

export async function GET() {
  try {
    const identity = await getSessionIdentity();
    if (!identity) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    await connectDB();

    const user = await User.findOne(toUserQuery(identity))
      .select('_id savedArticles')
      .lean<LeanSavedUser | null>();

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    const savedArticleIds = normalizeSavedArticleIds(user.savedArticles);
    if (!savedArticleIds.length) {
      return NextResponse.json({
        success: true,
        data: {
          savedArticleIds: [],
          savedArticles: [],
          count: 0,
        },
      });
    }

    const articles = await Article.find({
      _id: { $in: savedArticleIds.map((id) => new Types.ObjectId(id)) },
    })
      .select(
        '_id title summary image category author publishedAt isBreaking isTrending editorial'
      )
      .lean<LeanSavedArticle[]>();

    const articleById = new Map<string, LeanSavedArticle>(
      articles.map((article) => [article._id.toString(), article])
    );

    const savedArticles = savedArticleIds
      .map((id) => articleById.get(id))
      .filter((article): article is LeanSavedArticle => Boolean(article))
      .map((article) => toSavedArticleDTO(article));

    return NextResponse.json({
      success: true,
      data: {
        savedArticleIds,
        savedArticles,
        count: savedArticles.length,
      },
    });
  } catch (error) {
    console.error('Failed to list saved articles:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list saved articles' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const identity = await getSessionIdentity();
    if (!identity) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid request payload' },
        { status: 400 }
      );
    }

    const articleId = String(body.articleId || '').trim();
    if (!articleId || !Types.ObjectId.isValid(articleId)) {
      return NextResponse.json(
        { success: false, error: 'Valid articleId is required' },
        { status: 400 }
      );
    }

    await connectDB();

    const targetId = new Types.ObjectId(articleId);
    const articleExists = await Article.exists({ _id: targetId });

    if (!articleExists) {
      return NextResponse.json(
        { success: false, error: 'Article not found' },
        { status: 404 }
      );
    }

    const user = await User.findOne(toUserQuery(identity))
      .select('_id savedArticles')
      .lean<LeanSavedUser | null>();

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    const isAlreadySaved = normalizeSavedArticleIds(user.savedArticles).includes(articleId);
    const now = new Date();

    const updateQuery = toUserQuery(identity);
    const update = isAlreadySaved
      ? {
          $pull: { savedArticles: targetId },
          $set: { lastActiveAt: now },
        }
      : {
          $addToSet: { savedArticles: targetId },
          $set: { lastActiveAt: now },
        };

    const updatedUser = await User.findOneAndUpdate(updateQuery, update, {
      new: true,
      projection: { _id: 1, savedArticles: 1 },
    }).lean<LeanSavedUser | null>();

    if (!updatedUser) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    const savedArticleIds = normalizeSavedArticleIds(updatedUser.savedArticles);

    return NextResponse.json({
      success: true,
      data: {
        articleId,
        saved: !isAlreadySaved,
        savedArticleIds,
        count: savedArticleIds.length,
      },
    });
  } catch (error) {
    console.error('Failed to toggle saved article:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to toggle saved article' },
      { status: 500 }
    );
  }
}
