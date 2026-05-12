import { NextResponse } from 'next/server';

// TTS prewarm has been removed. Gemini TTS synthesis is no longer used.
// Audio files must be uploaded manually via DigitalOcean Spaces.

export async function POST() {
  return NextResponse.json(
    {
      success: false,
      error: 'TTS prewarm has been removed. Audio is uploaded manually.',
    },
    { status: 410 }
  );
}
