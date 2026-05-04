import { NextRequest, NextResponse } from 'next/server';
import { getAdminSessionFromReq } from '@/lib/auth/admin';
import { promises as fs } from 'fs';
import path from 'path';

const DATA_PATH = path.join(process.cwd(), 'data', 'election-results.json');

const DEFAULT: ElectionResultsData = {
  lastUpdated: null,
  states: {
    wb:         { name: 'West Bengal',  totalSeats: 294, parties: [] },
    kerala:     { name: 'Kerala',       totalSeats: 140, parties: [] },
    tn:         { name: 'Tamil Nadu',   totalSeats: 234, parties: [] },
    assam:      { name: 'Assam',        totalSeats: 126, parties: [] },
    puducherry: { name: 'Puducherry',   totalSeats: 30,  parties: [] },
  },
};

export type Party = {
  name: string;
  color: string;
  won: number;
  leading: number;
};

export type StateResult = {
  name: string;
  totalSeats: number;
  parties: Party[];
};

export type ElectionResultsData = {
  lastUpdated: string | null;
  states: Record<string, StateResult>;
};

async function readData(): Promise<ElectionResultsData> {
  try {
    const raw = await fs.readFile(DATA_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return DEFAULT;
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

  const body = await req.json() as ElectionResultsData;
  const data: ElectionResultsData = { ...body, lastUpdated: new Date().toISOString() };

  await fs.mkdir(path.dirname(DATA_PATH), { recursive: true });
  await fs.writeFile(DATA_PATH, JSON.stringify(data, null, 2), 'utf-8');

  return NextResponse.json({ success: true, lastUpdated: data.lastUpdated });
}
