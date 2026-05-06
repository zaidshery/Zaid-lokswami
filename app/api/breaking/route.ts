import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongoose';
import Article from '@/lib/models/Article';
import { resolveReusableBreakingTts } from '@/lib/server/breakingTts';
import { listAllStoredArticles } from '@/lib/storage/articlesFile';
import { buildArticlePublicPath } from '@/lib/seo/articleSeo';

const DEFAULT_LIMIT = 10;
const MIN_LIMIT = 1;
const MAX_LIMIT = 25;

type BreakingItem = {
  id: string;
  title: string;
  category?: string;
  createdAt?: string;
  href: string;
  priority: number;
  ttsAudioUrl?: string;
  ttsReady?: boolean;
};

function parseLimit(value: string | null) {
  const parsed = Number.parseInt(value || '', 10);
  if (!Number.isFinite(parsed)) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.max(MIN_LIMIT, parsed));
}

function normalizeTimestamp(value: unknown) {
  const parsed = new Date(
    typeof value === 'string' || typeof value === 'number' || value instanceof Date
      ? value
      : Date.now()
  );
  if (Number.isNaN(parsed.getTime())) {
    return new Date(0).toISOString();
  }
  return parsed.toISOString();
}

function normalizeBreakingItem(source: unknown): BreakingItem | null {
  const input =
    typeof source === 'object' && source ? (source as Record<string, unknown>) : null;
  if (!input) return null;

  const id = String(input._id || input.id || '').trim();
  const title = String(input.title || '').trim();

  if (!id || !title) {
    return null;
  }

  const category = String(input.category || '').trim();
  const views =
    typeof input.views === 'number' ? input.views : Number.parseInt(String(input.views ?? 0), 10);
  const reusableTts = resolveReusableBreakingTts({
    _id: id,
    title,
    category,
    isBreaking: true,
    breakingTts: input.breakingTts,
  });

  return {
    id,
    title,
    category: category || undefined,
    createdAt: normalizeTimestamp(input.publishedAt || input.createdAt),
    href: buildArticlePublicPath({ id, slug: String(input.slug || '') }),
    priority: Math.max(1, Number.isFinite(views) ? views : 1),
    ...(reusableTts
      ? {
          ttsAudioUrl: reusableTts.audioUrl,
          ttsReady: true,
        }
      : {}),
  };
}

function compareBreakingItems(a: BreakingItem, b: BreakingItem) {
  if (b.priority !== a.priority) {
    return b.priority - a.priority;
  }

  return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
}

async function shouldUseFileStore() {
  if (!process.env.MONGODB_URI) {
    return true;
  }

  try {
    await connectDB();
    return false;
  } catch (error) {
    console.error('MongoDB unavailable for breaking route, using file store.', error);
    return true;
  }
}

async function listFromMongo(limit: number) {
  const docs = await Article.find({ isBreaking: true })
    .select('_id slug title category publishedAt views breakingTts')
    .sort({ publishedAt: -1, _id: -1 })
    .limit(limit)
    .lean();

  return docs
    .map((item) => normalizeBreakingItem(item))
    .filter((item): item is BreakingItem => Boolean(item))
    .sort(compareBreakingItems)
    .slice(0, limit);
}

async function listFromFileStore(limit: number) {
  const stored = await listAllStoredArticles();

  return stored
    .filter((item) => item.isBreaking)
    .map((item) => normalizeBreakingItem(item))
    .filter((item): item is BreakingItem => Boolean(item))
    .sort(compareBreakingItems)
    .slice(0, limit);
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseLimit(searchParams.get('limit'));
    const useFileStore = await shouldUseFileStore();
    const items = useFileStore
      ? await listFromFileStore(limit)
      : await listFromMongo(limit);

    return NextResponse.json({
      success: true,
      items,
      total: items.length,
    });
  } catch (error) {
    console.error('Failed to load breaking items:', error);
    return NextResponse.json(
      {
        success: false,
        items: [],
        total: 0,
      },
      { status: 500 }
    );
  }
}
