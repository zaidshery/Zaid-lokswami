export const TTS_SOURCE_TYPES = ['article', 'epaperArticle'] as const;
export const TTS_VARIANTS = [
  'breaking_headline',
  'article_full',
  'epaper_story',
] as const;
export const TTS_ASSET_STATUSES = ['pending', 'processing', 'ready', 'failed', 'stale'] as const;
export const TTS_STORAGE_MODES = ['public', 'proxy', 'spaces'] as const;
export const TTS_PROVIDERS = ['manual'] as const;
export const TTS_AUDIT_ACTIONS = [
  'generate',
  'regenerate',
  'delete',
  'cleanup',
  'revalidate',
  'mark_stale',
  'config_update',
] as const;
export const TTS_AUDIT_RESULTS = ['success', 'failure'] as const;

export type TtsSourceType = (typeof TTS_SOURCE_TYPES)[number];
export type TtsVariant = (typeof TTS_VARIANTS)[number];
export type TtsAssetStatus = (typeof TTS_ASSET_STATUSES)[number];
export type TtsStorageMode = (typeof TTS_STORAGE_MODES)[number];
export type TtsProvider = (typeof TTS_PROVIDERS)[number];
export type TtsAuditAction = (typeof TTS_AUDIT_ACTIONS)[number];
export type TtsAuditResult = (typeof TTS_AUDIT_RESULTS)[number];

export type TtsSurfaceKey = 'breaking' | 'article' | 'epaper';

export type TtsSurfaceConfig = {
  enabled: boolean;
  autoGenerate: boolean;
  defaultLanguageCode: string;
  defaultVoice: string;
};

export type TtsConfigShape = {
  key: 'default';
  provider: 'manual';
  regenerateMissingFiles: boolean;
  retentionDays: number;
  forceStorage: boolean;
  surfaces: Record<TtsSurfaceKey, TtsSurfaceConfig>;
  prewarm: {
    latestBreakingLimit: number;
    latestArticleLimit: number;
    latestEpaperStoryLimit: number;
  };
};

export function variantToSurfaceKey(variant: TtsVariant): TtsSurfaceKey {
  if (variant === 'breaking_headline') {
    return 'breaking';
  }

  if (variant === 'article_full') {
    return 'article';
  }

  return 'epaper';
}
