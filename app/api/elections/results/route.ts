import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { normalizeElectionResultsData } from '@/lib/elections/results';

const DATA_PATH = path.join(process.cwd(), 'data', 'election-results.json');

export async function GET() {
  try {
    const raw = await fs.readFile(DATA_PATH, 'utf-8');
    const data = normalizeElectionResultsData(JSON.parse(raw));
    const maxAge = data.mode === 'live' ? 30 : 300;
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': `public, s-maxage=${maxAge}, stale-while-revalidate=600`,
      },
    });
  } catch {
    return NextResponse.json(normalizeElectionResultsData(null));
  }
}
