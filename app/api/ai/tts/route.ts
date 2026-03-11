import { NextRequest, NextResponse } from 'next/server';
import { synthesizeBhashiniSpeech } from '@/lib/ai/bhashiniTts';
import {
  isSarvamConfigured,
  isSupportedSarvamLanguage,
  SARVAM_LANGUAGE_OPTIONS,
  synthesizeSarvamSpeech,
} from '@/lib/ai/sarvamTts';
import {
  BHASHINI_LANGUAGE_OPTIONS,
  isSupportedBhashiniLanguage,
} from '@/lib/constants/lokswamiAi';

function isBhashiniConfigured() {
  return Boolean(process.env.BHASHINI_TTS_API_URL?.trim());
}

function getConfiguredTtsProvider() {
  if (isSarvamConfigured()) return 'sarvam' as const;
  if (isBhashiniConfigured()) return 'bhashini' as const;
  return null;
}

export async function GET() {
  const provider = getConfiguredTtsProvider();

  return NextResponse.json({
    success: true,
    data: {
      bhashiniConfigured: Boolean(provider),
      provider,
      supportedLanguages:
        provider === 'sarvam' ? SARVAM_LANGUAGE_OPTIONS : BHASHINI_LANGUAGE_OPTIONS,
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

    const provider = getConfiguredTtsProvider();

    if (!provider) {
      return NextResponse.json(
        { success: false, error: 'No server TTS provider is configured.' },
        { status: 501 }
      );
    }

    const maxLength = provider === 'sarvam' ? 2500 : 3500;
    if (text.length > maxLength) {
      return NextResponse.json(
        {
          success: false,
          error: `Text is too long for TTS. Keep it under ${maxLength} characters.`,
        },
        { status: 400 }
      );
    }

    const isSupportedLanguage =
      provider === 'sarvam'
        ? isSupportedSarvamLanguage(languageCode)
        : isSupportedBhashiniLanguage(languageCode);

    if (!isSupportedLanguage) {
      return NextResponse.json(
        {
          success: false,
          error:
            provider === 'sarvam'
              ? 'Unsupported language code for Sarvam TTS.'
              : 'Unsupported language code for Bhashini TTS.',
        },
        { status: 400 }
      );
    }

    const synthesized =
      provider === 'sarvam'
        ? await synthesizeSarvamSpeech({
            text,
            languageCode,
            voice,
          })
        : await synthesizeBhashiniSpeech({
            text,
            languageCode,
            voice,
          });

    if (synthesized.mode === 'unavailable') {
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
