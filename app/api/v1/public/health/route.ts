import { NextResponse } from 'next/server';
import { getMongoAvailabilitySnapshot } from '@/lib/db/mongoAvailability';

export const dynamic = 'force-dynamic';

export async function GET() {
  const mongo = getMongoAvailabilitySnapshot();

  return NextResponse.json({
    success: true,
    status: 'ok',
    service: 'lokswami-public-api',
    generatedAt: new Date().toISOString(),
    dependencies: {
      mongo: mongo.status || 'not_checked',
      mongoCheckedAt: mongo.checkedAt,
    },
  });
}
