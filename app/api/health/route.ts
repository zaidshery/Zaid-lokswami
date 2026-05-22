import { NextResponse } from 'next/server';
import {
  getMongoAvailabilitySnapshot,
  isMongoAvailable,
} from '@/lib/db/mongoAvailability';

export const dynamic = 'force-dynamic';

export async function GET() {
  const dbConnected = await isMongoAvailable({
    label: 'health check',
    timeoutMs: 1500,
    unavailableTtlMs: 5000,
  });

  if (dbConnected) {
    return NextResponse.json({
      status: 'ok',
      db: 'connected',
    });
  }

  const snapshot = getMongoAvailabilitySnapshot();
  return NextResponse.json(
    {
      status: 'error',
      db: 'unavailable',
      message: snapshot.reason || 'MongoDB is unavailable.',
    },
    { status: 503 }
  );
}
