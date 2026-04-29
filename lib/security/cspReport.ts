import { appendFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import type { NextRequest } from 'next/server';
import { getClientIp } from '@/lib/security/ipUtils';

export type CspReportEntry = {
  timestamp: string;
  documentUri: string;
  violatedDirective: string;
  effectiveDirective: string;
  blockedUri: string;
  sourceFile: string;
  lineNumber: number | null;
  columnNumber: number | null;
  disposition: string;
  ip: string;
  userAgent: string;
};

const MAX_FIELD_LENGTH = 1000;

function truncate(value: unknown) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (text.length <= MAX_FIELD_LENGTH) return text;
  return `${text.slice(0, MAX_FIELD_LENGTH)}...[truncated]`;
}

function getNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function getReportDir() {
  return path.resolve(
    process.cwd(),
    process.env.CSP_REPORT_LOG_DIR?.trim() || 'storage/logs/security'
  );
}

function getReportPath(timestamp: Date) {
  return path.join(getReportDir(), `${timestamp.toISOString().slice(0, 10)}-csp-reports.jsonl`);
}

export function sanitizeCspReportPayload(
  payload: unknown,
  request?: NextRequest,
  timestamp = new Date()
): CspReportEntry {
  const objectPayload =
    payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
  const report =
    objectPayload['csp-report'] && typeof objectPayload['csp-report'] === 'object'
      ? (objectPayload['csp-report'] as Record<string, unknown>)
      : objectPayload;

  return {
    timestamp: timestamp.toISOString(),
    documentUri: truncate(report['document-uri']),
    violatedDirective: truncate(report['violated-directive']),
    effectiveDirective: truncate(report['effective-directive']),
    blockedUri: truncate(report['blocked-uri']),
    sourceFile: truncate(report['source-file']),
    lineNumber: getNumber(report['line-number']),
    columnNumber: getNumber(report['column-number']),
    disposition: truncate(report.disposition),
    ip: request ? getClientIp(request) : 'unknown',
    userAgent: request ? truncate(request.headers.get('user-agent')) || 'unknown' : 'unknown',
  };
}

export async function writeCspReport(entry: CspReportEntry) {
  if (process.env.DISABLE_CSP_REPORT_LOG === '1' || process.env.DISABLE_CSP_REPORT_LOG === 'true') {
    return;
  }

  try {
    const timestamp = new Date(entry.timestamp);
    const filePath = getReportPath(Number.isNaN(timestamp.getTime()) ? new Date() : timestamp);
    await mkdir(path.dirname(filePath), { recursive: true });
    await appendFile(filePath, `${JSON.stringify(entry)}\n`, 'utf8');
  } catch (error) {
    console.error('Failed to write CSP report:', error);
  }
}

