import { NextRequest, NextResponse } from 'next/server';
import { getAdminSessionFromReq } from '@/lib/auth/admin';
import { promises as fs } from 'fs';
import path from 'path';
import {
  DEFAULT_ELECTION_RESULTS,
  type ElectionResultsData,
  normalizeElectionResultsData,
} from '@/lib/elections/results';

const DATA_PATH = path.join(process.cwd(), 'data', 'election-results.json');

async function readData(): Promise<ElectionResultsData> {
  try {
    const raw = await fs.readFile(DATA_PATH, 'utf-8');
    return normalizeElectionResultsData(JSON.parse(raw));
  } catch {
    return normalizeElectionResultsData(DEFAULT_ELECTION_RESULTS);
  }
}

export async function GET(req: NextRequest) {
  const user = await getAdminSessionFromReq(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json(await readData());
}

export async function POST(req: NextRequest) {
  const user = await getAdminSessionFromReq(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const data = normalizeElectionResultsData({
    ...(body && typeof body === 'object' ? body : {}),
    lastUpdated: new Date().toISOString(),
  });

  await fs.mkdir(path.dirname(DATA_PATH), { recursive: true });
  await fs.writeFile(DATA_PATH, JSON.stringify(data, null, 2), 'utf-8');

  return NextResponse.json({ success: true, lastUpdated: data.lastUpdated });
}
