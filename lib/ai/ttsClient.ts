import type { TtsLanguageOption, TtsVoiceOption } from '@/lib/constants/tts';

export type TtsStatusData = {
  configured: boolean;
  provider: 'manual' | null;
  supportedLanguages: TtsLanguageOption[];
  voices: TtsVoiceOption[];
};

export type TtsAudioData = {
  provider: 'manual';
  model: string;
  voice: string;
  mimeType: string;
  audioUrl: string;
  chunkCount: number;
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
};

export async function fetchTtsStatus() {
  const response = await fetch('/api/admin/tts/settings', {
    method: 'GET',
    cache: 'no-store',
  });
  const payload = (await response.json().catch(() => ({}))) as TtsStatusResponse;

  if (!response.ok || !payload.success || !payload.data) {
    throw new Error(payload.error || 'TTS status is unavailable.');
  }

  return payload.data as TtsStatusData;
}

export async function requestArticleTtsAudio(
  articleId: string
) {
  const response = await fetch(`/api/articles/${encodeURIComponent(articleId)}/tts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  const payload = (await response.json().catch(() => ({}))) as TtsAudioResponse;

  if (!response.ok || !payload.success || !payload.data) {
    throw new Error(payload.error || 'Unable to load article audio.');
  }

  return payload.data as TtsAudioData;
}

export async function requestEpaperStoryTtsAudio(
  paperId: string,
  storyId: string
) {
  const response = await fetch(
    `/api/epapers/${encodeURIComponent(paperId)}/articles/${encodeURIComponent(storyId)}/tts`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );
  const payload = (await response.json().catch(() => ({}))) as TtsAudioResponse;

  if (!response.ok || !payload.success || !payload.data) {
    throw new Error(payload.error || 'Unable to load e-paper story audio.');
  }

  return payload.data as TtsAudioData;
}

export function buildTtsAudioSource(payload: {
  audioUrl?: string;
}) {
  return typeof payload.audioUrl === 'string' ? payload.audioUrl.trim() : '';
}
