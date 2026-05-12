import { NextResponse } from 'next/server';

// Auto-TTS synthesis has been removed from this platform.
// Article audio is uploaded manually via DigitalOcean Spaces.
// E-paper story audio must be uploaded manually via the epaper asset upload endpoint.

export async function POST() {
  return NextResponse.json(
    {
      success: false,
      error: 'Auto-TTS retry is no longer supported. Upload audio files manually.',
    },
    { status: 405 }
  );
}
