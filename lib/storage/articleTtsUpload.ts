import crypto from 'crypto';
import path from 'path';
import {
  buildDigitalOceanSpacesPublicUrl,
  createDigitalOceanSpacesBrowserUploadTarget,
  verifyDigitalOceanSpacesUploadedObject,
} from '@/lib/utils/digitalOceanSpaces';

export const ARTICLE_TTS_STORAGE_PROVIDER = 'do-spaces' as const;
export const ARTICLE_TTS_UPLOAD_EXPIRY_SECONDS = 10 * 60;
export const ARTICLE_TTS_MIN_BYTES = 1;
export const ARTICLE_TTS_UPLOAD_MAX_BYTES = 50 * 1024 * 1024;

export type ArticleTtsUploadInitInput = {
  articleId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
};

export type ArticleTtsUploadedAsset = {
  mediaUrl: string;
  mediaKey: string;
  mediaSizeBytes: number;
  mediaMimeType: string;
  storageProvider: typeof ARTICLE_TTS_STORAGE_PROVIDER;
};

const AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.m4a']);
const AUDIO_CONTENT_TYPES = new Set([
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/mp4',
  'audio/x-m4a',
  'application/octet-stream',
]);

const CONTENT_TYPES_BY_EXTENSION: Record<string, string> = {
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
};

function sanitizePathSegment(value: string, fallback: string) {
  const sanitized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');

  return sanitized || fallback;
}

function sanitizeFileStem(fileName: string, fallback: string) {
  const parsed = path.parse(fileName.trim());
  return sanitizePathSegment(parsed.name || fallback, fallback).slice(0, 80);
}

function normalizeExtension(fileName: string) {
  return path.extname(fileName.trim()).toLowerCase();
}

function normalizeContentType(fileName: string, fileType: string) {
  const fromType = fileType.trim().toLowerCase();
  if (fromType) return fromType;
  return CONTENT_TYPES_BY_EXTENSION[normalizeExtension(fileName)] || 'application/octet-stream';
}

function buildTimestamp(now = new Date()) {
  const date = now.toISOString().replace(/[-:]/g, '').replace(/\..+$/, 'Z');
  return `${date}-${crypto.randomUUID().slice(0, 8)}`;
}

function extensionForAudio(fileName: string) {
  const extension = normalizeExtension(fileName);
  return AUDIO_EXTENSIONS.has(extension) ? extension : '.mp3';
}

export function parseArticleTtsAssetSize(value: unknown) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function validateArticleTtsUploadSelection(input: ArticleTtsUploadInitInput) {
  const articleId = String(input.articleId || '').trim();
  const fileName = String(input.fileName || '').trim();
  const fileType = String(input.fileType || '').trim().toLowerCase();
  const fileSize = Number(input.fileSize || 0);

  if (!articleId) {
    return 'articleId is required for article audio uploads.';
  }
  if (!fileName) {
    return 'File name is required.';
  }
  if (!Number.isFinite(fileSize) || fileSize < ARTICLE_TTS_MIN_BYTES) {
    return 'File size is invalid.';
  }

  const extension = normalizeExtension(fileName);
  if (!AUDIO_EXTENSIONS.has(extension)) {
    return 'Article audio must be MP3, WAV, or M4A.';
  }
  if (fileType && !AUDIO_CONTENT_TYPES.has(fileType) && !fileType.startsWith('audio/')) {
    return 'Article audio must be MP3, WAV, or M4A.';
  }
  if (fileSize > ARTICLE_TTS_UPLOAD_MAX_BYTES) {
    return 'Article audio must be 50MB or smaller.';
  }

  return null;
}

export function buildArticleTtsObjectKey(input: ArticleTtsUploadInitInput) {
  const validationError = validateArticleTtsUploadSelection(input);
  if (validationError) {
    throw new Error(validationError);
  }

  const articleSegment = sanitizePathSegment(String(input.articleId || ''), 'article');
  const stem = sanitizeFileStem(input.fileName, 'listen');
  const uniqueName = `${buildTimestamp()}-${stem}${extensionForAudio(input.fileName)}`;
  return `lokswami/tts/article/${articleSegment}/manual/${uniqueName}`;
}

export function assertValidArticleTtsAssetKey(mediaKey: string) {
  const key = mediaKey.trim();
  if (!key) {
    throw new Error('Uploaded article audio key is required.');
  }

  if (!/^lokswami\/tts\/article\/[^/]+\/manual\/[^/]+\.(mp3|wav|m4a)$/i.test(key)) {
    throw new Error('Uploaded article audio key is invalid.');
  }
}

export function createArticleTtsUploadTarget(input: ArticleTtsUploadInitInput) {
  const key = buildArticleTtsObjectKey(input);
  const contentType = normalizeContentType(input.fileName, input.fileType);
  const target = createDigitalOceanSpacesBrowserUploadTarget({
    key,
    contentType,
    expiresSeconds: ARTICLE_TTS_UPLOAD_EXPIRY_SECONDS,
  });

  return {
    mediaKey: target.publicId,
    mediaUrl: target.secureUrl,
    uploadUrl: target.uploadUrl,
    uploadHeaders: target.uploadHeaders,
    expiresAt: target.expiresAt,
  };
}

function isContentTypeAllowed(contentType: string) {
  const normalized = contentType.trim().toLowerCase();
  return !normalized || AUDIO_CONTENT_TYPES.has(normalized) || normalized.startsWith('audio/');
}

export async function verifyArticleTtsUpload(input: {
  mediaKey: string;
  expectedSize?: number;
  expectedFileType?: string;
  expectedFileName?: string;
}) {
  assertValidArticleTtsAssetKey(input.mediaKey);

  const expectedSize = parseArticleTtsAssetSize(input.expectedSize);
  const expectedFileName = String(input.expectedFileName || input.mediaKey.split('/').pop() || '');
  const selectionError = validateArticleTtsUploadSelection({
    articleId: 'article',
    fileName: expectedFileName,
    fileType: String(input.expectedFileType || ''),
    fileSize: expectedSize || ARTICLE_TTS_MIN_BYTES,
  });
  if (selectionError) {
    throw new Error(selectionError);
  }

  const verified = await verifyDigitalOceanSpacesUploadedObject({ key: input.mediaKey });
  if (!verified.bytes || verified.bytes < ARTICLE_TTS_MIN_BYTES) {
    throw new Error('Uploaded article audio size is invalid.');
  }
  if (expectedSize && Math.abs(verified.bytes - expectedSize) > 1024) {
    throw new Error('Uploaded article audio size does not match the selected file.');
  }
  if (!isContentTypeAllowed(verified.contentType)) {
    throw new Error('Uploaded article audio content type is invalid.');
  }

  return {
    mediaUrl: buildDigitalOceanSpacesPublicUrl(input.mediaKey),
    mediaKey: verified.publicId,
    mediaSizeBytes: verified.bytes,
    mediaMimeType:
      verified.contentType ||
      normalizeContentType(expectedFileName, String(input.expectedFileType || '')),
    storageProvider: ARTICLE_TTS_STORAGE_PROVIDER,
  } satisfies ArticleTtsUploadedAsset;
}
