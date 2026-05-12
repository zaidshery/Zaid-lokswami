import 'server-only';

import crypto from 'crypto';
import fsSync from 'fs';
import fs from 'fs/promises';
import path from 'path';
import connectDB from '@/lib/db/mongoose';
import TtsAsset from '@/lib/models/TtsAsset';
import { buildBreakingHeadlineTtsText } from '@/lib/server/ttsAssets';
import {
  detectBreakingTtsLanguage,
  normalizeBreakingTtsMetadata,
  type BreakingTtsMetadata,
} from '@/lib/types/breaking';
import { deleteStoredTtsAsset, hasStoredTtsAsset } from '@/lib/utils/ttsStorage';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type BreakingAudioPublicPathPrefix =
  | '/uploads/breaking-audio'
  | '/api/public/uploads/breaking-audio';

type BreakingAudioStorageConfig = {
  mode: 'public' | 'proxy';
  fsBaseDir: string;
  publicPathPrefix: BreakingAudioPublicPathPrefix;
};

type BreakingArticleLike = {
  id: string;
  title: string;
  city?: string;
  isBreaking: boolean;
  breakingTts: BreakingTtsMetadata | null;
};

// ---------------------------------------------------------------------------
// Storage configuration
// ---------------------------------------------------------------------------

const DEFAULT_STORAGE_UPLOADS_BASE_DIR = path.resolve(process.cwd(), 'storage', 'uploads');
const STORAGE_UPLOADS_BASE_DIR = (() => {
  const configured = String(process.env.EPAPER_STORAGE_UPLOADS_BASE_DIR || '').trim();
  if (!configured) return DEFAULT_STORAGE_UPLOADS_BASE_DIR;
  return path.isAbsolute(configured)
    ? path.resolve(configured)
    : path.resolve(process.cwd(), configured);
})();
const PUBLIC_BREAKING_AUDIO_BASE_DIR = path.resolve(
  process.cwd(),
  'public',
  'uploads',
  'breaking-audio'
);
const STORAGE_BREAKING_AUDIO_BASE_DIR = path.resolve(
  STORAGE_UPLOADS_BASE_DIR,
  'breaking-audio'
);
const SAFE_SEGMENT_PATTERN = /^[a-zA-Z0-9._-]+$/;

let storageConfigPromise: Promise<BreakingAudioStorageConfig> | null = null;

function shouldForceStorage() {
  return process.env.EPAPER_FORCE_STORAGE === '1';
}

function canAttemptSharedBreakingTts() {
  return Boolean(process.env.MONGODB_URI?.trim());
}

function sanitizePathSegment(segment: string) {
  const cleaned = segment.trim();
  if (!cleaned || cleaned === '.' || cleaned === '..' || !SAFE_SEGMENT_PATTERN.test(cleaned)) {
    return '';
  }
  return cleaned;
}

function safeArticleSegment(articleId: string) {
  const normalized = articleId.trim().replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  return sanitizePathSegment(normalized) || crypto.createHash('sha1').update(articleId).digest('hex');
}

function isInsideBaseDir(baseDir: string, absolutePath: string) {
  const relative = path.relative(baseDir, absolutePath);
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
}

async function canWriteToBaseDir(baseDir: string) {
  try {
    await fs.mkdir(baseDir, { recursive: true });
    const probeDir = path.resolve(baseDir, '.breaking-audio-probe');
    const probeFile = path.join(probeDir, `.probe-${Date.now()}.txt`);
    await fs.mkdir(probeDir, { recursive: true });
    await fs.writeFile(probeFile, 'ok', 'utf-8');
    await fs.unlink(probeFile).catch(() => undefined);
    await fs.rm(probeDir, { recursive: true, force: true }).catch(() => undefined);
    return true;
  } catch {
    return false;
  }
}

async function canWriteToPublicBreakingAudio() {
  if (shouldForceStorage()) return false;

  try {
    return await canWriteToBaseDir(PUBLIC_BREAKING_AUDIO_BASE_DIR);
  } catch {
    return false;
  }
}

async function getBreakingAudioStorageConfig(): Promise<BreakingAudioStorageConfig> {
  if (!storageConfigPromise) {
    storageConfigPromise = (async () => {
      if (await canWriteToPublicBreakingAudio()) {
        return {
          mode: 'public',
          fsBaseDir: PUBLIC_BREAKING_AUDIO_BASE_DIR,
          publicPathPrefix: '/uploads/breaking-audio',
        };
      }

      if (await canWriteToBaseDir(STORAGE_BREAKING_AUDIO_BASE_DIR)) {
        return {
          mode: 'proxy',
          fsBaseDir: STORAGE_BREAKING_AUDIO_BASE_DIR,
          publicPathPrefix: '/api/public/uploads/breaking-audio',
        };
      }

      throw new Error(
        'No writable breaking-audio storage directory available. Set EPAPER_STORAGE_UPLOADS_BASE_DIR to a writable path.'
      );
    })();
  }

  return storageConfigPromise;
}

function isLegacyBreakingAudioPath(assetPath: string) {
  const trimmed = assetPath.trim();
  return (
    trimmed.startsWith('/uploads/breaking-audio/') ||
    trimmed.startsWith('/api/public/uploads/breaking-audio/')
  );
}

function isSharedBreakingAudioPath(assetPath: string) {
  const trimmed = assetPath.trim();
  return (
    trimmed.startsWith('/uploads/tts/') ||
    trimmed.startsWith('/api/public/uploads/tts/')
  );
}

function resolveStoredBreakingAudioAbsolutePath(assetPath: string) {
  const trimmed = assetPath.trim();
  if (!trimmed) return '';

  const relativePublic = trimmed.startsWith('/uploads/breaking-audio/')
    ? trimmed.slice('/uploads/breaking-audio/'.length)
    : '';
  const relativeProxy = trimmed.startsWith('/api/public/uploads/breaking-audio/')
    ? trimmed.slice('/api/public/uploads/breaking-audio/'.length)
    : '';

  if (relativePublic && shouldForceStorage()) {
    return '';
  }

  const relativePath = (relativePublic || relativeProxy).replace(/\\/g, '/').replace(/^\/+/, '');
  if (!relativePath) return '';

  const parts = relativePath.split('/').filter(Boolean);
  if (!parts.length || parts.some((part) => !sanitizePathSegment(part))) {
    return '';
  }

  if (relativePublic) {
    const absolutePath = path.resolve(PUBLIC_BREAKING_AUDIO_BASE_DIR, ...parts);
    return isInsideBaseDir(PUBLIC_BREAKING_AUDIO_BASE_DIR, absolutePath) ? absolutePath : '';
  }

  const absolutePath = path.resolve(STORAGE_BREAKING_AUDIO_BASE_DIR, ...parts);
  return isInsideBaseDir(STORAGE_BREAKING_AUDIO_BASE_DIR, absolutePath) ? absolutePath : '';
}

function hasStoredBreakingAudio(assetPath: string) {
  const absolutePath = resolveStoredBreakingAudioAbsolutePath(assetPath);
  return absolutePath ? fsSync.existsSync(absolutePath) : false;
}

function hasStoredBreakingAudioAsset(assetPath: string) {
  if (isSharedBreakingAudioPath(assetPath)) {
    return hasStoredTtsAsset(assetPath);
  }

  if (isLegacyBreakingAudioPath(assetPath)) {
    return hasStoredBreakingAudio(assetPath);
  }

  return true;
}

function normalizeBreakingArticle(source: unknown): BreakingArticleLike | null {
  if (!source || typeof source !== 'object') return null;
  const item = source as Record<string, unknown>;

  const id = String(item._id || item.id || '').trim();
  const title = String(item.title || '').trim();
  if (!id || !title) return null;

  return {
    id,
    title,
    city: typeof item.city === 'string' ? item.city.trim() || undefined : undefined,
    isBreaking: Boolean(item.isBreaking),
    breakingTts: normalizeBreakingTtsMetadata(item.breakingTts),
  };
}

// ---------------------------------------------------------------------------
// Breaking TTS text hash (language detection only — no Gemini)
// ---------------------------------------------------------------------------

function buildBreakingTtsExpectation(article: Pick<BreakingArticleLike, 'title' | 'city'>) {
  const spokenText = buildBreakingHeadlineTtsText({
    title: article.title,
    city: article.city,
  });
  // Use stable defaults since Gemini synthesis is removed
  const languageCode = detectBreakingTtsLanguage(spokenText, 'hi');
  const voice = 'manual';
  const model = 'manual';
  const textHash = crypto
    .createHash('sha1')
    .update(JSON.stringify({ text: spokenText, languageCode }))
    .digest('hex');

  return {
    spokenText,
    languageCode,
    voice,
    model,
    textHash,
    mimeType: 'audio/wav',
  };
}

function toBreakingLanguageCode(value: string) {
  return value === 'en-IN' ? 'en-IN' : 'hi-IN';
}

// ---------------------------------------------------------------------------
// Deletion helpers
// ---------------------------------------------------------------------------

async function markSharedBreakingAudioDeleted(assetPath: string) {
  if (!isSharedBreakingAudioPath(assetPath) || !canAttemptSharedBreakingTts()) {
    return;
  }

  try {
    await connectDB();
    await TtsAsset.updateMany(
      {
        audioUrl: assetPath,
        sourceType: 'article',
        variant: 'breaking_headline',
      },
      {
        $set: {
          status: 'stale',
          lastError: 'Breaking voice cache file deleted.',
          lastVerifiedAt: new Date(),
        },
      }
    );
  } catch (error) {
    console.error('Failed to mark shared breaking audio as deleted:', error);
  }
}

async function deleteLegacyBreakingAudio(assetPath: string) {
  const trimmed = assetPath.trim();
  if (!trimmed) return;

  const relativePublic = trimmed.startsWith('/uploads/breaking-audio/')
    ? trimmed.slice('/uploads/breaking-audio/'.length)
    : '';
  const relativeProxy = trimmed.startsWith('/api/public/uploads/breaking-audio/')
    ? trimmed.slice('/api/public/uploads/breaking-audio/'.length)
    : '';
  const relativePath = (relativePublic || relativeProxy).replace(/\\/g, '/').replace(/^\/+/, '');
  if (!relativePath) return;

  const parts = relativePath.split('/').filter(Boolean);
  if (!parts.length || parts.some((part) => !sanitizePathSegment(part))) {
    return;
  }

  const candidates = [
    path.resolve(PUBLIC_BREAKING_AUDIO_BASE_DIR, ...parts),
    path.resolve(STORAGE_BREAKING_AUDIO_BASE_DIR, ...parts),
  ];

  await Promise.all(
    candidates.map(async (candidate) => {
      const inPublic = isInsideBaseDir(PUBLIC_BREAKING_AUDIO_BASE_DIR, candidate);
      const inStorage = isInsideBaseDir(STORAGE_BREAKING_AUDIO_BASE_DIR, candidate);
      if (!inPublic && !inStorage) return;
      await fs.unlink(candidate).catch(() => undefined);
    })
  );
}

export async function deleteStoredBreakingAudio(assetPath: string) {
  const trimmed = assetPath.trim();
  if (!trimmed) return;

  if (isSharedBreakingAudioPath(trimmed)) {
    await deleteStoredTtsAsset(trimmed).catch(() => undefined);
    await markSharedBreakingAudioDeleted(trimmed);
    return;
  }

  if (isLegacyBreakingAudioPath(trimmed)) {
    await deleteLegacyBreakingAudio(trimmed);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Resolves a reusable breaking TTS audio record from the article's stored metadata.
 * Returns the metadata if the stored audio file still exists, otherwise null.
 *
 * Note: Auto-synthesis via Gemini has been removed. Breaking audio must be
 * uploaded manually or regenerated via the article breaking-tts admin endpoint.
 */
export function resolveReusableBreakingTts(article: unknown): BreakingTtsMetadata | null {
  const normalized = normalizeBreakingArticle(article);
  if (!normalized?.breakingTts) return null;

  const expected = buildBreakingTtsExpectation(normalized);
  const metadata = normalized.breakingTts;

  if (!metadata.audioUrl) {
    return null;
  }

  if (!hasStoredBreakingAudioAsset(metadata.audioUrl)) {
    return null;
  }

  return metadata;
}

/**
 * Saves manually-uploaded breaking audio metadata to the article record.
 * Used when an admin uploads a breaking audio file directly.
 */
export async function saveBreakingTtsMetadata(input: {
  articleId: string;
  audioUrl: string;
  mimeType?: string;
}): Promise<BreakingTtsMetadata> {
  const expected = buildBreakingTtsExpectation({ title: input.articleId });
  return {
    audioUrl: input.audioUrl,
    textHash: expected.textHash,
    languageCode: toBreakingLanguageCode(expected.languageCode),
    voice: 'manual',
    model: 'manual',
    mimeType: input.mimeType || 'audio/wav',
    generatedAt: new Date().toISOString(),
  } satisfies BreakingTtsMetadata;
}

/**
 * ensureBreakingTtsForArticle — kept as stub to avoid breaking imports.
 * Without Gemini synthesis, this only returns the existing reusable asset if present.
 * Breaking audio must be manually uploaded by the newsroom.
 */
export async function ensureBreakingTtsForArticle(
  article: unknown,
  _options?: { forceRegenerate?: boolean }
): Promise<BreakingTtsMetadata | null> {
  // Without Gemini synthesis, we can only return what is already stored.
  // The admin must upload breaking audio manually.
  return resolveReusableBreakingTts(article);
}

// ---------------------------------------------------------------------------
// Storage config probe (used by diagnostics)
// ---------------------------------------------------------------------------

export async function probeBreakingAudioStorage() {
  try {
    const config = await getBreakingAudioStorageConfig();
    return { ok: true, mode: config.mode };
  } catch (error) {
    return { ok: false, mode: 'unknown', error: String(error) };
  }
}
