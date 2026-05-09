import { NextRequest, NextResponse } from 'next/server';
import {
  getGeminiTtsActiveCooldown,
  getGeminiTtsRuntimeConfig,
  getGeminiTtsUnavailableStatus,
  isGeminiTtsConfigured,
  synthesizeGeminiSpeech,
} from '@/lib/ai/geminiTts';
import {
  GEMINI_TTS_LANGUAGE_OPTIONS,
  GEMINI_TTS_MAX_TOTAL_CHARS,
  GEMINI_TTS_PROVIDER,
  GEMINI_TTS_VOICE_OPTIONS,
} from '@/lib/constants/tts';

const TTS_UNAVAILABLE_LOG_COOLDOWN_MS = 60_000;
let lastUnavailableLogKey = '';
let lastUnavailableLogAt = 0;

function logTtsUnavailable(reason: string) {
  const normalizedReason = reason.replace(/\s+/g, ' ').trim() || 'Unknown TTS error.';
  const status = getGeminiTtsUnavailableStatus(normalizedReason);
  const logKey = `${status}:${normalizedReason}`;
  const now = Date.now();

  if (
    logKey === lastUnavailableLogKey &&
    now - lastUnavailableLogAt < TTS_UNAVAILABLE_LOG_COOLDOWN_MS
  ) {
    return;
  }

  lastUnavailableLogKey = logKey;
  lastUnavailableLogAt = now;
  console.error('AI tts unavailable:', normalizedReason);
}

export async function GET() {
  const runtime = getGeminiTtsRuntimeConfig();
  const cooldown = getGeminiTtsActiveCooldown();
  const apiConfigured = isGeminiTtsConfigured();

  return NextResponse.json({
    success: true,
    data: {
      configured: apiConfigured && !cooldown,
      apiConfigured,
      temporarilyUnavailable: Boolean(cooldown),
      ...(cooldown?.retryAfterSeconds
        ? { retryAfterSeconds: cooldown.retryAfterSeconds }
        : {}),
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
      logTtsUnavailable('Gemini TTS is not configured. Set GEMINI_API_KEY.');
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
      logTtsUnavailable(synthesized.reason);
      const status = getGeminiTtsUnavailableStatus(synthesized.reason);
      const headers =
        synthesized.retryAfterSeconds && status === 429
          ? { 'Retry-After': String(synthesized.retryAfterSeconds) }
          : undefined;
      return NextResponse.json(
        {
          success: false,
          error: synthesized.reason,
          ...(synthesized.retryAfterSeconds
            ? { retryAfterSeconds: synthesized.retryAfterSeconds }
            : {}),
        },
        { status, headers }
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
