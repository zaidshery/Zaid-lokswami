import { NextResponse } from 'next/server';
import { readElectionResultsData } from '@/lib/elections/storage';

export async function GET() {
  try {
    const data = await readElectionResultsData();
    const maxAge = data.mode === 'live' ? 30 : 300;
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': `public, s-maxage=${maxAge}, stale-while-revalidate=600`,
      },
    });
  } catch {
    return NextResponse.json({ error: 'Election results are temporarily unavailable.' }, { status: 503 });
  }
}
