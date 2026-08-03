import 'server-only';

import { promises as fs } from 'fs';
import path from 'path';
import {
  DEFAULT_ELECTION_RESULTS,
  normalizeElectionResultsData,
  type ElectionResultsData,
} from '@/lib/elections/results';

const DATA_PATH = path.join(process.cwd(), 'data', 'election-results.json');

export async function readElectionResultsData(): Promise<ElectionResultsData> {
  try {
    const raw = await fs.readFile(DATA_PATH, 'utf-8');
    return normalizeElectionResultsData(JSON.parse(raw));
  } catch {
    return normalizeElectionResultsData(DEFAULT_ELECTION_RESULTS);
  }
}

export async function writeElectionResultsData(input: unknown): Promise<ElectionResultsData> {
  const data = normalizeElectionResultsData({
    ...(input && typeof input === 'object' ? input : {}),
    lastUpdated: new Date().toISOString(),
  });
  await fs.mkdir(path.dirname(DATA_PATH), { recursive: true });
  await fs.writeFile(DATA_PATH, JSON.stringify(data, null, 2), 'utf-8');
  return data;
}
