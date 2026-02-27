import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import connectDB from '@/lib/db/mongoose';
import EPaper from '@/lib/models/EPaper';
import EPaperArticle from '@/lib/models/EPaperArticle';
import { verifyAdminToken } from '@/lib/auth/adminToken';
import {
  normalizeHotspot,
  resolveUniqueSlug,
  validateHotspot,
} from '@/lib/utils/epaperArticles';
import { isAllowedAssetPath } from '@/lib/utils/epaperStorage';

type RouteContext = {
  params: Promise<{ id: string }>;
};

function parsePageNumber(value: string | null) {
  const parsed = Number.parseInt(String(value || ''), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 0;
  return Math.floor(parsed);
}

function asObject(value: unknown) {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

function mapArticle(article: unknown) {
  const source = asObject(article);
  const hotspot = asObject(source.hotspot);
  return {
    _id: String(source._id || ''),
    epaperId: String(source.epaperId || ''),
    pageNumber: Number(source.pageNumber || 1),
    title: String(source.title || ''),
    slug: String(source.slug || ''),
    excerpt: String(source.excerpt || ''),
    contentHtml: String(source.contentHtml || ''),
    coverImagePath: String(source.coverImagePath || ''),
    hotspot: {
      x: Number(hotspot.x || 0),
      y: Number(hotspot.y || 0),
      w: Number(hotspot.w || 0),
      h: Number(hotspot.h || 0),
    },
    createdAt: source.createdAt,
    updatedAt: source.updatedAt,
  };
}

function isLikelyHttpUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const admin = verifyAdminToken(req);
    if (!admin) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    await connectDB();
    const { id } = await context.params;

    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, error: 'Invalid e-paper ID' },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(req.url);
    const pageNumber = parsePageNumber(searchParams.get('pageNumber'));
    const query: Record<string, unknown> = { epaperId: id };
    if (pageNumber) query.pageNumber = pageNumber;

    const records = await EPaperArticle.find(query)
      .sort({ pageNumber: 1, createdAt: 1 })
      .lean();

    return NextResponse.json({
      success: true,
      data: records.map(mapArticle),
    });
  } catch (error) {
    console.error('Failed to list e-paper articles:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list articles' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const admin = verifyAdminToken(req);
    if (!admin) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    await connectDB();
    const { id } = await context.params;

    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, error: 'Invalid e-paper ID' },
        { status: 400 }
      );
    }

    const epaper = await EPaper.findById(id).select('_id pageCount').lean();
    if (!epaper) {
      return NextResponse.json(
        { success: false, error: 'E-paper not found' },
        { status: 404 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const source = typeof body === 'object' && body ? (body as Record<string, unknown>) : {};

    const pageNumber = parsePageNumber(
      source.pageNumber !== undefined ? String(source.pageNumber) : null
    );
    const title = typeof source.title === 'string' ? source.title.trim() : '';
    const slugInput = typeof source.slug === 'string' ? source.slug.trim() : '';
    const excerpt = typeof source.excerpt === 'string' ? source.excerpt.trim() : '';
    const contentHtml =
      typeof source.contentHtml === 'string' ? source.contentHtml.trim() : '';
    const coverImagePath =
      typeof source.coverImagePath === 'string' ? source.coverImagePath.trim() : '';
    const hotspot = normalizeHotspot(source.hotspot);

    if (!pageNumber) {
      return NextResponse.json(
        { success: false, error: 'pageNumber is required' },
        { status: 400 }
      );
    }
    if (pageNumber > Number(epaper.pageCount || 0)) {
      return NextResponse.json(
        { success: false, error: `pageNumber must be between 1 and ${epaper.pageCount}` },
        { status: 400 }
      );
    }
    if (!title) {
      return NextResponse.json(
        { success: false, error: 'title is required' },
        { status: 400 }
      );
    }
    if (title.length > 220) {
      return NextResponse.json(
        { success: false, error: 'title is too long (max 220 chars)' },
        { status: 400 }
      );
    }
    if (excerpt.length > 1000) {
      return NextResponse.json(
        { success: false, error: 'excerpt is too long (max 1000 chars)' },
        { status: 400 }
      );
    }
    if (coverImagePath) {
      const validCoverPath =
        coverImagePath.startsWith('/') ? isAllowedAssetPath(coverImagePath) : isLikelyHttpUrl(coverImagePath);
      if (!validCoverPath) {
        return NextResponse.json(
          {
            success: false,
            error: 'coverImagePath must be a valid legacy upload path or an http(s) URL',
          },
          { status: 400 }
        );
      }
    }

    const hotspotError = validateHotspot(hotspot);
    if (hotspotError) {
      return NextResponse.json(
        { success: false, error: hotspotError },
        { status: 400 }
      );
    }

    const slug = await resolveUniqueSlug(slugInput || title, async (candidate) => {
      const existing = await EPaperArticle.exists({ epaperId: id, slug: candidate });
      return Boolean(existing);
    });

    const created = await EPaperArticle.create({
      epaperId: id,
      pageNumber,
      title,
      slug,
      excerpt,
      contentHtml,
      coverImagePath,
      hotspot,
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Article created successfully',
        data: mapArticle(created.toObject()),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Failed to create e-paper article:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create article' },
      { status: 500 }
    );
  }
}
