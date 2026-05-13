import { NextResponse } from 'next/server';
import { TTS_LANGUAGE_OPTIONS, TTS_VOICE_OPTIONS } from '@/lib/constants/tts';

export async function GET() {
  return NextResponse.json({
    success: true,
    data: {
      provider: 'manual',
      configured: false,
      supportedLanguages: TTS_LANGUAGE_OPTIONS,
      voices: TTS_VOICE_OPTIONS,
      articleListenMode: 'manual-upload',
      disclosure:
        'Paid AI TTS previews are disabled. Upload article and e-paper audio manually.',
    },
  });
}

export async function POST() {
  return NextResponse.json(
    {
      success: false,
      error: 'Paid AI TTS preview is disabled. Upload audio manually for published content.',
    },
    { status: 410 }
  );
}
