export type SarvamTtsSuccess = {
  mode: 'sarvam';
  audioBase64?: string;
  mimeType?: string;
};

export type SarvamTtsUnavailable = {
  mode: 'unavailable';
  reason: string;
};

type SarvamTtsResult = SarvamTtsSuccess | SarvamTtsUnavailable;

type UnknownJson = Record<string, unknown>;

type SarvamLanguageOption = {
  code: string;
  label: string;
};

export const SARVAM_LANGUAGE_OPTIONS: SarvamLanguageOption[] = [
  { code: 'en-IN', label: 'English' },
  { code: 'hi-IN', label: 'Hindi' },
  { code: 'bn-IN', label: 'Bengali' },
  { code: 'ta-IN', label: 'Tamil' },
  { code: 'te-IN', label: 'Telugu' },
  { code: 'kn-IN', label: 'Kannada' },
  { code: 'ml-IN', label: 'Malayalam' },
  { code: 'mr-IN', label: 'Marathi' },
  { code: 'gu-IN', label: 'Gujarati' },
  { code: 'pa-IN', label: 'Punjabi' },
  { code: 'od-IN', label: 'Odia' },
];

function asString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.map(asString).filter(Boolean) : [];
}

function parseNumberEnv(value: string | undefined, fallback: number) {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getAudioMimeType(codec: string) {
  const normalized = codec.trim().toLowerCase();

  if (normalized === 'mp3') return 'audio/mpeg';
  if (normalized === 'wav') return 'audio/wav';
  if (normalized === 'opus') return 'audio/ogg; codecs=opus';
  if (normalized === 'pcm') return 'audio/wav';

  return 'audio/wav';
}

function extractCombinedAudioBase64(payload: unknown) {
  if (!payload || typeof payload !== 'object') {
    return '';
  }

  const record = payload as UnknownJson;
  const directAudios = asStringArray(record.audios);
  if (directAudios.length) {
    return directAudios.join('');
  }

  const data = record.data;
  if (!data || typeof data !== 'object') {
    return '';
  }

  return asStringArray((data as UnknownJson).audios).join('');
}

export function isSupportedSarvamLanguage(code: string) {
  return SARVAM_LANGUAGE_OPTIONS.some((item) => item.code === code);
}

export function isSarvamConfigured() {
  return Boolean(process.env.SARVAM_API_KEY?.trim());
}

export async function synthesizeSarvamSpeech(params: {
  text: string;
  languageCode: string;
  voice?: string;
}): Promise<SarvamTtsResult> {
  const apiKey = process.env.SARVAM_API_KEY?.trim();
  const endpoint =
    process.env.SARVAM_TTS_API_URL?.trim() || 'https://api.sarvam.ai/text-to-speech';

  if (!apiKey) {
    return {
      mode: 'unavailable',
      reason: 'SARVAM_API_KEY is not configured.',
    };
  }

  const model = process.env.SARVAM_TTS_MODEL?.trim() || 'bulbul:v3';
  const speaker = params.voice || process.env.SARVAM_TTS_SPEAKER?.trim() || 'Shreya';
  const languageCode = params.languageCode || process.env.SARVAM_TTS_LANGUAGE?.trim() || 'hi-IN';
  const codec = process.env.SARVAM_TTS_OUTPUT_CODEC?.trim() || 'wav';
  const sampleRate = parseNumberEnv(process.env.SARVAM_TTS_SAMPLE_RATE, 24000);
  const pace = parseNumberEnv(process.env.SARVAM_TTS_PACE, 1);
  const temperature = parseNumberEnv(process.env.SARVAM_TTS_TEMPERATURE, 0.3);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-subscription-key': apiKey,
      },
      body: JSON.stringify({
        text: params.text,
        target_language_code: languageCode,
        model,
        speaker,
        speech_sample_rate: sampleRate,
        output_audio_codec: codec,
        pace,
        temperature,
      }),
    });

    if (!response.ok) {
      const details = await response.text().catch(() => '');
      return {
        mode: 'unavailable',
        reason: `Sarvam request failed (${response.status}) ${details}`.trim(),
      };
    }

    const payload = (await response.json().catch(() => ({}))) as unknown;
    const audioBase64 = extractCombinedAudioBase64(payload);

    if (!audioBase64) {
      return {
        mode: 'unavailable',
        reason: 'Sarvam response did not include any audio data.',
      };
    }

    return {
      mode: 'sarvam',
      audioBase64,
      mimeType: getAudioMimeType(codec),
    };
  } catch (error) {
    return {
      mode: 'unavailable',
      reason: `Sarvam request failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}
