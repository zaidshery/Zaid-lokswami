import { NextResponse } from 'next/server';
import { getOpenApiDocument } from '@/lib/api/openapi';

export async function GET() {
  return NextResponse.json(getOpenApiDocument(), {
    headers: {
      'Cache-Control': 'public, max-age=0, s-maxage=300, stale-while-revalidate=900',
    },
  });
}

