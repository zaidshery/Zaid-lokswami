import { extractYouTubeVideoId } from '@/lib/utils/youtube';

export type PankhidaStatus = 'upcoming' | 'live' | 'ended';

export type PankhidaConfig = {
  status: PankhidaStatus;
  youtubeUrl: string;
  description: string;
  updatedAt: string;
};

export const DEFAULT_PANKHIDA_CONFIG: PankhidaConfig = {
  status: 'upcoming',
  youtubeUrl: '',
  description: '',
  updatedAt: '',
};

export function normalizePankhidaConfig(input: unknown): PankhidaConfig {
  const value = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  const status = value.status === 'live' || value.status === 'ended' ? value.status : 'upcoming';
  const youtubeUrl = typeof value.youtubeUrl === 'string' ? value.youtubeUrl.trim() : '';
  return {
    status,
    youtubeUrl,
    description: typeof value.description === 'string' ? value.description.trim().slice(0, 1000) : '',
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : '',
  };
}

export function validatePankhidaConfig(input: PankhidaConfig): string | null {
  if (input.youtubeUrl && !extractYouTubeVideoId(input.youtubeUrl)) {
    return 'Enter a valid YouTube video or live stream URL.';
  }
  return null;
}
