import { NextRequest, NextResponse } from 'next/server';
import { sanitizeCspReportPayload, writeCspReport } from '@/lib/security/cspReport';

export async function POST(request: NextRequest) {
  const rawBody = await request.text().catch(() => '');
  let payload: unknown = {};

  if (rawBody.trim()) {
    try {
      payload = JSON.parse(rawBody);
    } catch {
      payload = { raw: rawBody };
    }
  }

  await writeCspReport(sanitizeCspReportPayload(payload, request));
  return new NextResponse(null, { status: 204 });
}

