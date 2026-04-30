import {
  GEMINI_TTS_DEFAULT_MODEL,
  GEMINI_TTS_DEFAULT_VOICE,
  GEMINI_TTS_MAX_CHARS_PER_CHUNK,
  GEMINI_TTS_OUTPUT_MIME_TYPE,
  GEMINI_TTS_OUTPUT_SAMPLE_RATE,
  GEMINI_TTS_PROVIDER,
  getGeminiTtsLanguageLabel,
} from '@/lib/constants/tts';

export type GeminiTtsSuccess = {
  mode: 'gemini';
  provider: typeof GEMINI_TTS_PROVIDER;
  model: string;
  voice: string;
  mimeType: typeof GEMINI_TTS_OUTPUT_MIME_TYPE;
  audioBase64: string;
  chunkCount: number;
};

export type GeminiTtsUnavailable = {
  mode: 'unavailable';
  provider: typeof GEMINI_TTS_PROVIDER;
  model: string;
  voice: string;
  reason: string;
  retryAfterSeconds?: number;
};

type GeminiTtsResult = GeminiTtsSuccess | GeminiTtsUnavailable;

type GeminiGenerateContentResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        inlineData?: {
          data?: string;
        };
        inline_data?: {
          data?: string;
        };
      }>;
    };
  }>;
  error?: {
    message?: string;
  };
};

const GEMINI_TTS_ENDPOINT_ROOT = 'https://generativelanguage.googleapis.com/v1beta/models';
const PCM_CHANNELS = 1;
const PCM_SAMPLE_WIDTH_BYTES = 2;
const MIN_QUOTA_COOLDOWN_SECONDS = 60;
const MAX_QUOTA_COOLDOWN_SECONDS = 15 * 60;

let geminiTtsUnavailableUntil = 0;
let geminiTtsUnavailableReason = '';

function getGeminiTtsModel() {
  const envValue = process.env.GEMINI_TTS_MODEL?.trim();
  return envValue || GEMINI_TTS_DEFAULT_MODEL;
}

function getGeminiTtsVoice(requestedVoice?: string) {
  void requestedVoice;
  return GEMINI_TTS_DEFAULT_VOICE;
}

function sanitizeText(value: string) {
  return value.replace(/\r\n?/g, '\n').replace(/\u0000/g, '').trim();
}

function splitLongSegment(segment: string, maxChars: number): string[] {
  if (segment.length <= maxChars) {
    return [segment];
  }

  const smallerParts = segment
    .split(/(?<=[,;:])\s+/)
    .map((item) => item.trim())
    .filter(Boolean);

  if (smallerParts.length > 1) {
    return smallerParts.flatMap((item) => splitLongSegment(item, maxChars));
  }

  const words = segment.split(/\s+/).filter(Boolean);
  const chunks: string[] = [];
  let current = '';

  for (const word of words) {
    if (!current) {
      current = word;
      continue;
    }

    const next = `${current} ${word}`;
    if (next.length <= maxChars) {
      current = next;
      continue;
    }

    chunks.push(current);
    current = word;
  }

  if (current) {
    chunks.push(current);
  }

  return chunks;
}

function chunkTtsText(value: string, maxChars: number) {
  if (value.length <= maxChars) {
    return [value];
  }

  const sentenceLikeParts = value
    .split(/(?<=[.!?।])\s+/)
    .map((item) => item.trim())
    .filter(Boolean);

  if (!sentenceLikeParts.length) {
    return splitLongSegment(value, maxChars);
  }

  const chunks: string[] = [];
  let current = '';

  for (const sentence of sentenceLikeParts) {
    if (sentence.length > maxChars) {
      const splitSentenceParts = splitLongSegment(sentence, maxChars);
      if (current) {
        chunks.push(current);
        current = '';
      }
      chunks.push(...splitSentenceParts);
      continue;
    }

    if (!current) {
      current = sentence;
      continue;
    }

    const next = `${current} ${sentence}`;
    if (next.length <= maxChars) {
      current = next;
      continue;
    }

    chunks.push(current);
    current = sentence;
  }

  if (current) {
    chunks.push(current);
  }

  return chunks;
}

function buildPrompt(text: string, languageCode: string) {
  const languageLabel = getGeminiTtsLanguageLabel(languageCode);

  return [
    'You are the Lokswami audio desk.',
    `Read the following news text exactly as written in natural ${languageLabel} when appropriate.`,
    'Keep the delivery calm, clear, trustworthy, and suitable for a newsroom bulletin.',
    'Do not add any introduction, explanation, summary, or extra words.',
    'Preserve names, numbers, punctuation, and sentence order.',
    'Transcript:',
    text,
  ].join('\n');
}

function getInlineAudioBase64(payload: GeminiGenerateContentResponse) {
  const parts = payload.candidates?.[0]?.content?.parts || [];

  for (const part of parts) {
    const direct = part.inlineData?.data?.trim();
    if (direct) {
      return direct;
    }

    const legacy = part.inline_data?.data?.trim();
    if (legacy) {
      return legacy;
    }
  }

  return '';
}

function buildWavBufferFromPcm(pcmData: Buffer) {
  const header = Buffer.alloc(44);
  const byteRate = GEMINI_TTS_OUTPUT_SAMPLE_RATE * PCM_CHANNELS * PCM_SAMPLE_WIDTH_BYTES;
  const blockAlign = PCM_CHANNELS * PCM_SAMPLE_WIDTH_BYTES;

  header.write('RIFF', 0, 4, 'ascii');
  header.writeUInt32LE(36 + pcmData.length, 4);
  header.write('WAVE', 8, 4, 'ascii');
  header.write('fmt ', 12, 4, 'ascii');
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(PCM_CHANNELS, 22);
  header.writeUInt32LE(GEMINI_TTS_OUTPUT_SAMPLE_RATE, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(PCM_SAMPLE_WIDTH_BYTES * 8, 34);
  header.write('data', 36, 4, 'ascii');
  header.writeUInt32LE(pcmData.length, 40);

  return Buffer.concat([header, pcmData]);
}

function createSilenceBuffer(milliseconds: number) {
  const frameCount = Math.max(
    1,
    Math.round((GEMINI_TTS_OUTPUT_SAMPLE_RATE * milliseconds) / 1000)
  );
  return Buffer.alloc(frameCount * PCM_CHANNELS * PCM_SAMPLE_WIDTH_BYTES);
}

function isLikelyQuotaOrRateLimitError(message: string) {
  return /quota|rate.?limit|resource exhausted|too many requests/i.test(message);
}

function getRetryAfterSecondsFromMessage(message: string) {
  const match = message.match(/retry in\s+([0-9]+(?:\.[0-9]+)?)s/i);
  if (!match) {
    return MIN_QUOTA_COOLDOWN_SECONDS;
  }

  const parsed = Math.ceil(Number(match[1]));
  if (!Number.isFinite(parsed)) {
    return MIN_QUOTA_COOLDOWN_SECONDS;
  }

  return Math.max(
    MIN_QUOTA_COOLDOWN_SECONDS,
    Math.min(parsed, MAX_QUOTA_COOLDOWN_SECONDS)
  );
}

function rememberGeminiTtsCooldown(message: string) {
  if (!isLikelyQuotaOrRateLimitError(message)) {
    return;
  }

  const retryAfterSeconds = getRetryAfterSecondsFromMessage(message);
  geminiTtsUnavailableUntil = Date.now() + retryAfterSeconds * 1000;
  geminiTtsUnavailableReason = message;
}

function getActiveGeminiTtsCooldown() {
  const remainingMs = geminiTtsUnavailableUntil - Date.now();
  if (remainingMs <= 0) {
    return null;
  }

  return {
    reason: geminiTtsUnavailableReason || 'Gemini TTS quota is temporarily exhausted.',
    retryAfterSeconds: Math.ceil(remainingMs / 1000),
  };
}

export function getGeminiTtsUnavailableStatus(reason: string) {
  return isLikelyQuotaOrRateLimitError(reason) ? 429 : 501;
}

async function synthesizeGeminiChunk(input: {
  apiKey: string;
  model: string;
  voice: string;
  prompt: string;
}) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await fetch(
      `${GEMINI_TTS_ENDPOINT_ROOT}/${encodeURIComponent(input.model)}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': input.apiKey,
        },
        body: JSON.stringify({
          model: input.model,
          contents: [
            {
              parts: [
                {
                  text: input.prompt,
                },
              ],
            },
          ],
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: input.voice,
                },
              },
            },
          },
        }),
      }
    );

    const payload = (await response.json().catch(() => ({}))) as GeminiGenerateContentResponse;
    if (!response.ok) {
      const message = payload.error?.message || `Gemini TTS request failed (${response.status}).`;
      rememberGeminiTtsCooldown(message);
      throw new Error(message);
    }

    const audioBase64 = getInlineAudioBase64(payload);
    if (audioBase64) {
      return Buffer.from(audioBase64, 'base64');
    }
  }

  throw new Error('Gemini TTS returned no audio data.');
}

export function isGeminiTtsConfigured() {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

export function getGeminiTtsRuntimeConfig() {
  return {
    provider: GEMINI_TTS_PROVIDER,
    model: getGeminiTtsModel(),
    defaultVoice: getGeminiTtsVoice(),
    sampleRate: GEMINI_TTS_OUTPUT_SAMPLE_RATE,
  };
}

export async function synthesizeGeminiSpeech(input: {
  text: string;
  languageCode?: string;
  voice?: string;
}): Promise<GeminiTtsResult> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  const model = getGeminiTtsModel();
  const voice = getGeminiTtsVoice(input.voice);

  if (!apiKey) {
    return {
      mode: 'unavailable',
      provider: GEMINI_TTS_PROVIDER,
      model,
      voice,
      reason: 'GEMINI_API_KEY is not configured.',
    };
  }

  const sanitizedText = sanitizeText(input.text || '');
  if (!sanitizedText) {
    return {
      mode: 'unavailable',
      provider: GEMINI_TTS_PROVIDER,
      model,
      voice,
      reason: 'Text is required for Gemini TTS.',
    };
  }

  const languageCode = (input.languageCode || 'hi-IN').trim() || 'hi-IN';
  const activeCooldown = getActiveGeminiTtsCooldown();
  if (activeCooldown) {
    return {
      mode: 'unavailable',
      provider: GEMINI_TTS_PROVIDER,
      model,
      voice,
      reason: activeCooldown.reason,
      retryAfterSeconds: activeCooldown.retryAfterSeconds,
    };
  }

  const chunks = chunkTtsText(sanitizedText, GEMINI_TTS_MAX_CHARS_PER_CHUNK);
  const pcmBuffers: Buffer[] = [];
  const silence = createSilenceBuffer(140);

  try {
    for (const [index, chunk] of chunks.entries()) {
      if (index > 0) {
        pcmBuffers.push(silence);
      }

      const pcmChunk = await synthesizeGeminiChunk({
        apiKey,
        model,
        voice,
        prompt: buildPrompt(chunk, languageCode),
      });

      pcmBuffers.push(pcmChunk);
    }

    const wavBuffer = buildWavBufferFromPcm(Buffer.concat(pcmBuffers));

    return {
      mode: 'gemini',
      provider: GEMINI_TTS_PROVIDER,
      model,
      voice,
      mimeType: GEMINI_TTS_OUTPUT_MIME_TYPE,
      audioBase64: wavBuffer.toString('base64'),
      chunkCount: chunks.length,
    };
  } catch (error) {
    return {
      mode: 'unavailable',
      provider: GEMINI_TTS_PROVIDER,
      model,
      voice,
      reason: error instanceof Error ? error.message : 'Gemini TTS request failed.',
    };
  }
}
