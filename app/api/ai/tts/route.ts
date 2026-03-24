import { NextRequest, NextResponse } from 'next/server';
import {
  getGeminiTtsRuntimeConfig,
  isGeminiTtsConfigured,
  synthesizeGeminiSpeech,
} from '@/lib/ai/geminiTts';
import {
  GEMINI_TTS_LANGUAGE_OPTIONS,
  GEMINI_TTS_MAX_TOTAL_CHARS,
  GEMINI_TTS_PROVIDER,
  GEMINI_TTS_VOICE_OPTIONS,
} from '@/lib/constants/tts';

export async function GET() {
  const runtime = getGeminiTtsRuntimeConfig();

  return NextResponse.json({
    success: true,
    data: {
      configured: isGeminiTtsConfigured(),
      provider: GEMINI_TTS_PROVIDER,
      model: runtime.model,
      defaultVoice: runtime.defaultVoice,
      supportedLanguages: GEMINI_TTS_LANGUAGE_OPTIONS,
      voices: GEMINI_TTS_VOICE_OPTIONS,
      maxCharacters: GEMINI_TTS_MAX_TOTAL_CHARS,
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      text?: string;
      languageCode?: string;
      voice?: string;
    };

    const text = typeof body.text === 'string' ? body.text.trim() : '';
    const languageCode =
      typeof body.languageCode === 'string' ? body.languageCode.trim() : 'hi-IN';
    const voice = typeof body.voice === 'string' ? body.voice.trim() : '';

    if (!text) {
      return NextResponse.json(
        { success: false, error: 'Text is required for TTS.' },
        { status: 400 }
      );
    }

    if (!isGeminiTtsConfigured()) {
      console.error('AI tts unavailable: Gemini TTS is not configured. Set GEMINI_API_KEY.');
      return NextResponse.json(
        { success: false, error: 'Gemini TTS is not configured. Set GEMINI_API_KEY.' },
        { status: 501 }
      );
    }

    if (text.length > GEMINI_TTS_MAX_TOTAL_CHARS) {
      return NextResponse.json(
        {
          success: false,
          error: `Text is too long for Gemini TTS. Keep it under ${GEMINI_TTS_MAX_TOTAL_CHARS} characters.`,
        },
        { status: 400 }
      );
    }

    const synthesized = await synthesizeGeminiSpeech({
      text,
      languageCode,
      voice,
    });

    if (synthesized.mode === 'unavailable') {
      console.error('AI tts unavailable:', synthesized.reason);
      return NextResponse.json(
        { success: false, error: synthesized.reason },
        { status: 501 }
      );
    }

    return NextResponse.json({
      success: true,
      data: synthesized,
    });
  } catch (error) {
    console.error('AI tts route failed:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to synthesize speech.' },
      { status: 500 }
    );
  }
}
