import { NextResponse } from 'next/server';

// Gemini TTS synthesis has been removed.
// Article audio is now uploaded manually via DigitalOcean Spaces.
// See: /api/admin/uploads/article-tts/init and /complete

export async function GET() {
  return NextResponse.json(
    {
      success: false,
      error: 'Gemini TTS has been removed. Upload audio files manually from the article editor.',
    },
    { status: 410 }
  );
}

export async function POST() {
  return NextResponse.json(
    {
      success: false,
      error: 'Gemini TTS has been removed. Upload audio files manually from the article editor.',
    },
    { status: 410 }
  );
}
