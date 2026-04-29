import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { RequestLogEntry } from '@/lib/security/requestLogger';

export type RequestLogRouteSummary = {
  path: string;
  count: number;
  failures: number;
  averageDuration: number;
  maxDuration: number;
};

export type RequestLogSummary = {
  total: number;
  failedAuth: number;
  rateLimited: number;
  validationFailures: number;
  slowRequests: number;
  slowestRoutes: RequestLogRouteSummary[];
  recent: RequestLogEntry[];
};

function getLogDir() {
  return path.resolve(
    process.cwd(),
    process.env.REQUEST_LOG_DIR?.trim() || 'storage/logs/security'
  );
}

function parseJsonLine(line: string): RequestLogEntry | null {
  try {
    const parsed = JSON.parse(line) as Partial<RequestLogEntry>;
    if (!parsed.timestamp || !parsed.method || !parsed.path) return null;
    return {
      timestamp: String(parsed.timestamp),
      method: String(parsed.method),
      path: String(parsed.path),
      status: Number(parsed.status || 0),
      duration: Number(parsed.duration || 0),
      userId: parsed.userId ?? null,
      userEmail: parsed.userEmail ?? null,
      userRole: parsed.userRole ?? null,
      ip: String(parsed.ip || 'unknown'),
      userAgent: String(parsed.userAgent || 'unknown'),
    };
  } catch {
    return null;
  }
}

async function readRecentLogEntries(maxFiles: number) {
  try {
    const dir = getLogDir();
    const files = (await readdir(dir))
      .filter((file) => file.endsWith('-api-requests.jsonl'))
      .sort()
      .reverse()
      .slice(0, maxFiles);

    const entries: RequestLogEntry[] = [];
    for (const file of files) {
      const content = await readFile(path.join(dir, file), 'utf8');
      for (const line of content.split('\n')) {
        const entry = line.trim() ? parseJsonLine(line) : null;
        if (entry) entries.push(entry);
      }
    }

    return entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  } catch {
    return [];
  }
}

function summarizeRoutes(entries: RequestLogEntry[]): RequestLogRouteSummary[] {
  const routes = new Map<string, { count: number; failures: number; totalDuration: number; maxDuration: number }>();

  for (const entry of entries) {
    const pathOnly = entry.path.split('?')[0] || '/';
    const current =
      routes.get(pathOnly) || { count: 0, failures: 0, totalDuration: 0, maxDuration: 0 };
    current.count += 1;
    current.failures += entry.status >= 400 ? 1 : 0;
    current.totalDuration += entry.duration;
    current.maxDuration = Math.max(current.maxDuration, entry.duration);
    routes.set(pathOnly, current);
  }

  return Array.from(routes.entries())
    .map(([routePath, value]) => ({
      path: routePath,
      count: value.count,
      failures: value.failures,
      averageDuration: value.count ? Math.round(value.totalDuration / value.count) : 0,
      maxDuration: value.maxDuration,
    }))
    .sort((a, b) => b.maxDuration - a.maxDuration)
    .slice(0, 8);
}

export async function getRequestLogSummary(input: { maxFiles?: number; limit?: number; slowMs?: number } = {}) {
  const maxFiles = Math.max(1, Math.min(input.maxFiles ?? 3, 14));
  const limit = Math.max(1, Math.min(input.limit ?? 500, 5000));
  const slowMs = Math.max(100, input.slowMs ?? 1000);
  const entries = (await readRecentLogEntries(maxFiles)).slice(0, limit);

  return {
    total: entries.length,
    failedAuth: entries.filter((entry) => entry.status === 401 || entry.status === 403).length,
    rateLimited: entries.filter((entry) => entry.status === 429).length,
    validationFailures: entries.filter((entry) => entry.status === 400).length,
    slowRequests: entries.filter((entry) => entry.duration >= slowMs).length,
    slowestRoutes: summarizeRoutes(entries),
    recent: entries.slice(0, 20),
  } satisfies RequestLogSummary;
}

