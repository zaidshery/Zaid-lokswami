import { NextRequest, NextResponse } from 'next/server';
import { publicJsonCacheHeaders } from '@/lib/api/cache';
import { listPublicEpaperFeed } from '@/lib/server/publicEpaperFeed';
import { parsePublicEpaperFilters } from '@/lib/utils/publicEpaperFilters';

const EPAPERS_CACHE_HEADERS = publicJsonCacheHeaders({
  sMaxAge: 600,
  staleWhileRevalidate: 1800,
});

export async function GET(req: NextRequest) {
  try {
    // Developer note:
    // First: /api/epapers/latest?limit=20
    // Next:  /api/epapers/latest?limit=20&cursorPublishedAt=...&cursorId=...
    const { searchParams } = new URL(req.url);
    const filterResult = parsePublicEpaperFilters(searchParams);
    if ('error' in filterResult) {
      return NextResponse.json(
        {
          items: [],
          limit: 20,
          hasMore: false,
          nextCursor: null,
          error: filterResult.error,
        },
        { status: 400 }
      );
    }
    const { filters } = filterResult;

    const limit = searchParams.get('limit');
    const cursorPublishedAt = searchParams.get('cursorPublishedAt');
    const cursorId = searchParams.get('cursorId');

    const result = await listPublicEpaperFeed({
      filters,
      limit,
      cursorPublishedAt,
      cursorId,
    });
    return NextResponse.json(result, { headers: EPAPERS_CACHE_HEADERS });
  } catch (error) {
    console.error('Failed to fetch public e-papers latest feed:', error);
    return NextResponse.json(
      { items: [], limit: 20, hasMore: false, nextCursor: null },
      { status: 500 }
    );
  }
}
