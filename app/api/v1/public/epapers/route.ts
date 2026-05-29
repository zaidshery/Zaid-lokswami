import { type NextRequest } from 'next/server';
import { mediumPublicCache } from '@/lib/api/cache';
import { GET as getLegacyEPapers } from '@/app/api/epapers/route';

const PUBLIC_EPAPERS_CACHE_HEADERS = mediumPublicCache({
  sMaxAge: 600,
  staleWhileRevalidate: 1800,
});

export async function GET(request: NextRequest) {
  const response = await getLegacyEPapers(request);
  if (response.ok) {
    response.headers.set(
      'Cache-Control',
      PUBLIC_EPAPERS_CACHE_HEADERS['Cache-Control']
    );
  }
  return response;
}
