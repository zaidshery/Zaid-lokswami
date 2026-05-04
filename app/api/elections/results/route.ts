import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const DATA_PATH = path.join(process.cwd(), 'data', 'election-results.json');

export async function GET() {
  try {
    const raw = await fs.readFile(DATA_PATH, 'utf-8');
    return NextResponse.json(JSON.parse(raw), {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch {
    return NextResponse.json({ states: {}, lastUpdated: null });
  }
}
