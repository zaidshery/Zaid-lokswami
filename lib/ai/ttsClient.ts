import type { TtsLanguageOption, TtsVoiceOption } from '@/lib/constants/tts';

export type TtsStatusData = {
  configured: boolean;
  apiConfigured?: boolean;
  temporarilyUnavailable?: boolean;
  retryAfterSeconds?: number;
  provider: 'gemini' | null;
  model: string;
  defaultVoice: string;
  supportedLanguages: TtsLanguageOption[];
  voices: TtsVoiceOption[];
  maxCharacters: number;
};

export type TtsAudioData = {
  provider: 'gemini' | 'manual';
  model: string;
  voice: string;
  mimeType: string;
  audioBase64?: string;
  chunkCount: number;
  audioUrl?: string;
};

type TtsStatusResponse = {
  success?: boolean;
  data?: Partial<TtsStatusData>;
  error?: string;
};

type TtsAudioResponse = {
  success?: boolean;
  data?: Partial<TtsAudioData>;
  error?: string;
  retryAfterSeconds?: number;
};

export class TtsRequestError extends Error {
  status: number;
  retryAfterSeconds?: number;

  constructor(message: string, options: { status: number; retryAfterSeconds?: number }) {
    super(message);
    this.name = 'TtsRequestError';
    this.status = options.status;
    this.retryAfterSeconds = options.retryAfterSeconds;
  }
}

export async function fetchTtsStatus() {
  const response = await fetch('/api/ai/tts', {
    method: 'GET',
    cache: 'no-store',
  });
  const payload = (await response.json().catch(() => ({}))) as TtsStatusResponse;

  if (!response.ok || !payload.success || !payload.data) {
    throw new Error(payload.error || 'TTS status is unavailable.');
  }

  return payload.data as TtsStatusData;
}

export async function requestTtsAudio(input: {
  text: string;
  languageCode?: string;
  voice?: string;
}) {
  const response = await fetch('/api/ai/tts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
  const payload = (await response.json().catch(() => ({}))) as TtsAudioResponse;

  if (!response.ok || !payload.success || !payload.data) {
    throw new TtsRequestError(payload.error || 'Unable to generate audio.', {
      status: response.status,
      retryAfterSeconds:
        typeof payload.retryAfterSeconds === 'number'
          ? payload.retryAfterSeconds
          : undefined,
    });
  }

  return payload.data as TtsAudioData;
}

export async function requestArticleTtsAudio(
  articleId: string,
  input?: {
    languageCode?: string;
    voice?: string;
  }
) {
  const response = await fetch(`/api/articles/${encodeURIComponent(articleId)}/tts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input || {}),
  });
  const payload = (await response.json().catch(() => ({}))) as TtsAudioResponse;

  if (!response.ok || !payload.success || !payload.data) {
    throw new Error(payload.error || 'Unable to load article audio.');
  }

  return payload.data as TtsAudioData;
}

export async function requestEpaperStoryTtsAudio(
  paperId: string,
  storyId: string,
  input?: {
    languageCode?: string;
    voice?: string;
  }
) {
  const response = await fetch(
    `/api/epapers/${encodeURIComponent(paperId)}/articles/${encodeURIComponent(storyId)}/tts`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input || {}),
    }
  );
  const payload = (await response.json().catch(() => ({}))) as TtsAudioResponse;

  if (!response.ok || !payload.success || !payload.data) {
    throw new Error(payload.error || 'Unable to generate e-paper story audio.');
  }

  return payload.data as TtsAudioData;
}

export function buildTtsAudioSource(payload: {
  audioUrl?: string;
  audioBase64?: string;
  mimeType?: string;
}) {
  const audioUrl = typeof payload.audioUrl === 'string' ? payload.audioUrl.trim() : '';
  if (audioUrl) {
    return audioUrl;
  }

  const audioBase64 =
    typeof payload.audioBase64 === 'string' ? payload.audioBase64.trim() : '';
  if (!audioBase64) {
    return '';
  }

  const mimeType =
    typeof payload.mimeType === 'string' && payload.mimeType.trim()
      ? payload.mimeType.trim()
      : 'audio/wav';

  return `data:${mimeType};base64,${audioBase64}`;
}
