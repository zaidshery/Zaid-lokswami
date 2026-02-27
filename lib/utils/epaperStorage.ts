import fs from 'fs/promises';
import path from 'path';
import {
  deleteCloudinaryAssetByUrl,
  uploadBufferToCloudinary,
} from '@/lib/utils/cloudinary';

export const EPAPER_PDF_MAX_BYTES = 25 * 1024 * 1024;
export const EPAPER_IMAGE_MAX_BYTES = 10 * 1024 * 1024;

const PUBLIC_EPAPER_BASE_DIR = path.resolve(process.cwd(), 'public', 'uploads', 'epapers');
const DEFAULT_STORAGE_UPLOADS_BASE_DIR = path.resolve(process.cwd(), 'storage', 'uploads');
const STORAGE_UPLOADS_BASE_DIR = (() => {
  const configured = String(process.env.EPAPER_STORAGE_UPLOADS_BASE_DIR || '').trim();
  if (!configured) return DEFAULT_STORAGE_UPLOADS_BASE_DIR;
  return path.isAbsolute(configured)
    ? path.resolve(configured)
    : path.resolve(process.cwd(), configured);
})();
const STORAGE_EPAPER_BASE_DIR = path.resolve(STORAGE_UPLOADS_BASE_DIR, 'epapers');
export type EpaperPublicPathPrefix = '/uploads/epapers' | '/api/public/uploads/epapers';

const SAFE_SEGMENT_PATTERN = /^[a-zA-Z0-9._-]+$/;
const SAFE_FILE_NAME_PATTERN = /^[a-zA-Z0-9._-]+\.[a-zA-Z0-9]+$/;
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const SERVABLE_FILE_EXTENSIONS = new Set(['.pdf', '.jpg', '.jpeg', '.png', '.webp']);
const IMAGE_MIME_TO_EXTENSION: Record<string, '.jpg' | '.png' | '.webp'> = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};
const PDF_SIGNATURE = Buffer.from('%PDF-');
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export type EpaperStorageMode = 'public' | 'proxy';

type StorageConfig = {
  mode: EpaperStorageMode;
  fsBaseDir: string;
  publicPathPrefix: EpaperPublicPathPrefix;
};

let storageConfigPromise: Promise<StorageConfig> | null = null;

function sanitizePathSegment(segment: string) {
  const cleaned = segment.trim();
  if (!cleaned || cleaned === '.' || cleaned === '..' || !SAFE_SEGMENT_PATTERN.test(cleaned)) {
    return '';
  }
  return cleaned;
}

function normalizeTargetDirectory(input: string) {
  const normalized = input.replace(/\\/g, '/').trim().replace(/^\/+|\/+$/g, '');
  if (!normalized) return '';

  const parts = normalized.split('/').filter(Boolean);
  if (parts.length === 0) return '';

  const safeParts = parts.map(sanitizePathSegment);
  if (safeParts.some((item) => !item)) {
    throw new Error('Invalid target directory');
  }
  return safeParts.join('/');
}

function normalizeTargetName(input: string) {
  const fileName = input.trim();
  if (!fileName || fileName.includes('/') || fileName.includes('\\')) {
    throw new Error('Invalid target filename');
  }
  if (!SAFE_FILE_NAME_PATTERN.test(fileName)) {
    throw new Error('Invalid target filename');
  }
  return fileName;
}

function isInsideBaseDir(baseDir: string, absolutePath: string) {
  const relative = path.relative(baseDir, absolutePath);
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
}

async function canWriteToPublicUploads() {
  if (process.env.EPAPER_FORCE_STORAGE === '1') return false;

  try {
    return await canWriteToBaseDir(PUBLIC_EPAPER_BASE_DIR);
  } catch {
    return false;
  }
}

async function canWriteToBaseDir(baseDir: string) {
  try {
    await fs.mkdir(baseDir, { recursive: true });
    const probeDir = path.resolve(baseDir, '.epaper-probe');
    const probeFile = path.join(probeDir, `.probe-${Date.now()}.txt`);
    await fs.mkdir(probeDir, { recursive: true });
    await fs.writeFile(probeFile, 'ok');
    await fs.unlink(probeFile).catch(() => undefined);
    await fs.rm(probeDir, { recursive: true, force: true }).catch(() => undefined);
    return true;
  } catch {
    return false;
  }
}

export async function getEpaperStorageConfig(): Promise<StorageConfig> {
  if (!storageConfigPromise) {
    storageConfigPromise = (async () => {
      if (await canWriteToPublicUploads()) {
        return {
          mode: 'public',
          fsBaseDir: PUBLIC_EPAPER_BASE_DIR,
          publicPathPrefix: '/uploads/epapers',
        };
      }

      if (await canWriteToBaseDir(STORAGE_EPAPER_BASE_DIR)) {
        return {
          mode: 'proxy',
          fsBaseDir: STORAGE_EPAPER_BASE_DIR,
          publicPathPrefix: '/api/public/uploads/epapers',
        };
      }

      throw new Error(
        'No writable e-paper storage directory available. Set EPAPER_STORAGE_UPLOADS_BASE_DIR to a writable path.'
      );
    })();
  }

  return storageConfigPromise;
}

function detectFileExtension(file: File) {
  const mime = file.type.trim().toLowerCase();
  const fromMime = IMAGE_MIME_TO_EXTENSION[mime];
  if (fromMime) return fromMime;

  const fromName = path.extname(file.name || '').toLowerCase();
  if (IMAGE_EXTENSIONS.has(fromName)) return fromName as '.jpg' | '.jpeg' | '.png' | '.webp';
  return '';
}

function hasPdfSignature(buffer: Buffer) {
  if (buffer.length < PDF_SIGNATURE.length) return false;
  return buffer.subarray(0, PDF_SIGNATURE.length).equals(PDF_SIGNATURE);
}

function hasJpegSignature(buffer: Buffer) {
  return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
}

function hasPngSignature(buffer: Buffer) {
  if (buffer.length < PNG_SIGNATURE.length) return false;
  return buffer.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE);
}

function hasWebpSignature(buffer: Buffer) {
  if (buffer.length < 12) return false;
  return (
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  );
}

function detectImageSignature(buffer: Buffer): '.jpg' | '.png' | '.webp' | '' {
  if (hasJpegSignature(buffer)) return '.jpg';
  if (hasPngSignature(buffer)) return '.png';
  if (hasWebpSignature(buffer)) return '.webp';
  return '';
}

export function resolveImageTargetName(
  kind: 'thumbnail' | 'page' | 'cover',
  file: File,
  pageNumber?: number
) {
  const extension = detectFileExtension(file) || '.jpg';

  if (kind === 'thumbnail') return `thumb${extension}`;
  if (kind === 'cover') return `cover${extension}`;

  const resolvedPage = Number.isFinite(pageNumber) && Number(pageNumber) > 0 ? Math.floor(Number(pageNumber)) : 1;
  return `${resolvedPage}${extension}`;
}

function validatePdfFile(file: File, buffer: Buffer) {
  if (file.size > EPAPER_PDF_MAX_BYTES) {
    throw new Error('PDF size exceeds 25MB');
  }

  const mime = file.type.trim().toLowerCase();
  const extension = path.extname(file.name || '').toLowerCase();
  const isPdf = mime === 'application/pdf' || extension === '.pdf';
  if (!isPdf) {
    throw new Error('Only PDF files are allowed');
  }

  if (!hasPdfSignature(buffer)) {
    throw new Error('PDF file signature is invalid');
  }
}

function validateImageFile(file: File, buffer: Buffer) {
  if (file.size > EPAPER_IMAGE_MAX_BYTES) {
    throw new Error('Image size exceeds 10MB');
  }

  const mime = file.type.trim().toLowerCase();
  const extension = path.extname(file.name || '').toLowerCase();
  const isAllowedMime = mime in IMAGE_MIME_TO_EXTENSION;
  const isAllowedExtension = IMAGE_EXTENSIONS.has(extension);

  if (!isAllowedMime && !isAllowedExtension) {
    throw new Error('Only JPG, PNG, or WEBP images are allowed');
  }

  if (!detectImageSignature(buffer)) {
    throw new Error('Image signature is invalid');
  }
}

function validateByTargetName(file: File, fileName: string, buffer: Buffer) {
  const extension = path.extname(fileName).toLowerCase();

  if (extension === '.pdf') {
    validatePdfFile(file, buffer);
    return;
  }

  if (IMAGE_EXTENSIONS.has(extension)) {
    validateImageFile(file, buffer);
    return;
  }

  throw new Error('Unsupported target file extension');
}

export async function saveUpload(file: File, targetDir: string, targetName: string) {
  const safeDir = normalizeTargetDirectory(targetDir);
  const safeName = normalizeTargetName(targetName);
  const buffer = Buffer.from(await file.arrayBuffer());
  if (!buffer.length) {
    throw new Error('Uploaded file is empty');
  }
  validateByTargetName(file, safeName, buffer);

  const extension = path.extname(safeName).toLowerCase();
  const folder = safeDir ? `lokswami/epapers/${safeDir}` : 'lokswami/epapers';
  const uploaded = await uploadBufferToCloudinary(buffer, {
    folder,
    resourceType: extension === '.pdf' ? 'raw' : 'image',
    originalFilename: safeName,
  });

  return uploaded.secureUrl;
}

export type ResolvedEpaperAssetPath = {
  mode: EpaperStorageMode;
  relativePath: string;
  absolutePath: string;
  publicPathPrefix: EpaperPublicPathPrefix;
  fsBaseDir: string;
};

export function buildEpaperAssetPath(
  publicPathPrefix: EpaperPublicPathPrefix,
  relativePath: string
) {
  const normalized = relativePath.replace(/\\/g, '/').replace(/^\/+/, '');
  return `${publicPathPrefix}/${normalized}`.replace(/\\/g, '/');
}

export function resolveEpaperAssetPath(assetPath: string): ResolvedEpaperAssetPath | null {
  const value = assetPath.trim();
  if (!value) return null;

  let mode: EpaperStorageMode | null = null;
  let relativePath = '';
  let publicPathPrefix: EpaperPublicPathPrefix | null = null;
  let fsBaseDir = '';

  if (value.startsWith('/uploads/epapers/')) {
    mode = 'public';
    publicPathPrefix = '/uploads/epapers';
    fsBaseDir = PUBLIC_EPAPER_BASE_DIR;
    relativePath = value.slice('/uploads/epapers/'.length);
  } else if (value.startsWith('/api/public/uploads/epapers/')) {
    mode = 'proxy';
    publicPathPrefix = '/api/public/uploads/epapers';
    fsBaseDir = STORAGE_EPAPER_BASE_DIR;
    relativePath = value.slice('/api/public/uploads/epapers/'.length);
  } else {
    return null;
  }

  if (!isSafeRelativeAssetPath(relativePath)) return null;
  const absolutePath = path.resolve(fsBaseDir, ...relativePath.split('/'));
  if (!isInsideBaseDir(fsBaseDir, absolutePath)) return null;

  return {
    mode,
    relativePath: relativePath.replace(/\\/g, '/'),
    absolutePath,
    publicPathPrefix,
    fsBaseDir,
  };
}

function isLikelyHttpUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function isSafeRelativeAssetPath(relativePath: string) {
  if (!relativePath) return false;

  const normalized = relativePath.replace(/\\/g, '/');
  const parts = normalized.split('/').filter(Boolean);
  if (parts.length === 0) return false;

  return parts.every((part) => Boolean(sanitizePathSegment(part)));
}

export function isAllowedAssetPath(assetPath: string) {
  if (isLikelyHttpUrl(assetPath.trim())) return true;
  return Boolean(resolveEpaperAssetPath(assetPath));
}

export function normalizeAssetPath(assetPath: string) {
  const resolved = resolveEpaperAssetPath(assetPath);
  return resolved ? resolved.relativePath : '';
}

export async function deleteAssetFile(assetPath: string) {
  if (isLikelyHttpUrl(assetPath.trim())) {
    await deleteCloudinaryAssetByUrl(assetPath).catch(() => undefined);
    return;
  }

  const relativePath = normalizeAssetPath(assetPath);
  if (!relativePath) return;

  const candidates = [
    path.resolve(PUBLIC_EPAPER_BASE_DIR, ...relativePath.split('/')),
    path.resolve(STORAGE_EPAPER_BASE_DIR, ...relativePath.split('/')),
  ];

  for (const candidate of candidates) {
    const isInPublic = isInsideBaseDir(PUBLIC_EPAPER_BASE_DIR, candidate);
    const isInStorage = isInsideBaseDir(STORAGE_EPAPER_BASE_DIR, candidate);
    if (!isInPublic && !isInStorage) continue;

    await fs.unlink(candidate).catch(() => undefined);
  }
}

export async function deleteEpaperDirectory(citySlug: string, publishDateFolder: string) {
  const safeCity = sanitizePathSegment(citySlug.toLowerCase());
  const safeDate = sanitizePathSegment(publishDateFolder);
  if (!safeCity || !safeDate) return;

  const relative = `${safeCity}/${safeDate}`;
  const targets = [
    path.resolve(PUBLIC_EPAPER_BASE_DIR, ...relative.split('/')),
    path.resolve(STORAGE_EPAPER_BASE_DIR, ...relative.split('/')),
  ];

  await Promise.all(
    targets.map(async (target) => {
      const isInPublic = isInsideBaseDir(PUBLIC_EPAPER_BASE_DIR, target);
      const isInStorage = isInsideBaseDir(STORAGE_EPAPER_BASE_DIR, target);
      if (!isInPublic && !isInStorage) return;
      await fs.rm(target, { recursive: true, force: true }).catch(() => undefined);
    })
  );
}

export async function deleteEpaperDirectoryByAssetPath(assetPath: string) {
  if (isLikelyHttpUrl(assetPath.trim())) {
    await deleteCloudinaryAssetByUrl(assetPath).catch(() => undefined);
    return;
  }

  const resolved = resolveEpaperAssetPath(assetPath);
  if (!resolved) return;

  const relativeDir = path.posix.dirname(resolved.relativePath);
  if (!relativeDir || relativeDir === '.' || relativeDir === '..') return;

  const target = path.resolve(resolved.fsBaseDir, ...relativeDir.split('/'));
  if (!isInsideBaseDir(resolved.fsBaseDir, target)) return;
  await fs.rm(target, { recursive: true, force: true }).catch(() => undefined);
}

export function formatPublishDateFolder(value: Date) {
  const year = value.getUTCFullYear();
  const month = `${value.getUTCMonth() + 1}`.padStart(2, '0');
  const day = `${value.getUTCDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parsePublishDate(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const dmy = /^(\d{2})[-/](\d{2})[-/](\d{4})$/.exec(trimmed);
  if (dmy) {
    const day = Number.parseInt(dmy[1], 10);
    const month = Number.parseInt(dmy[2], 10);
    const year = Number.parseInt(dmy[3], 10);
    if (
      Number.isFinite(day) &&
      Number.isFinite(month) &&
      Number.isFinite(year) &&
      day >= 1 &&
      day <= 31 &&
      month >= 1 &&
      month <= 12
    ) {
      return new Date(Date.UTC(year, month - 1, day));
    }
  }

  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? `${trimmed}T00:00:00.000Z` : trimmed;
  const parsed = new Date(dateOnly);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()));
}

function parseImageDimensionsFromBuffer(buffer: Buffer, extension: string) {
  const ext = extension.toLowerCase();

  if (ext === '.png' && buffer.length >= 24) {
    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);
    return width > 0 && height > 0 ? { width, height } : null;
  }

  if ((ext === '.jpg' || ext === '.jpeg') && buffer.length >= 4) {
    let offset = 2;
    while (offset + 4 < buffer.length) {
      if (buffer[offset] !== 0xff) break;
      const marker = buffer[offset + 1];
      if (offset + 3 >= buffer.length) break;
      const markerLength = buffer.readUInt16BE(offset + 2);
      if (markerLength < 2) break;
      if (offset + markerLength + 1 >= buffer.length) break;

      const isSofMarker =
        marker === 0xc0 ||
        marker === 0xc1 ||
        marker === 0xc2 ||
        marker === 0xc3 ||
        marker === 0xc5 ||
        marker === 0xc6 ||
        marker === 0xc7 ||
        marker === 0xc9 ||
        marker === 0xca ||
        marker === 0xcb ||
        marker === 0xcd ||
        marker === 0xce ||
        marker === 0xcf;
      if (isSofMarker && offset + 8 < buffer.length) {
        const height = buffer.readUInt16BE(offset + 5);
        const width = buffer.readUInt16BE(offset + 7);
        return width > 0 && height > 0 ? { width, height } : null;
      }

      offset += markerLength + 2;
    }
  }

  return null;
}

export async function getImageDimensions(file: File) {
  const extension = detectFileExtension(file);
  const buffer = Buffer.from(await file.arrayBuffer());
  return parseImageDimensionsFromBuffer(buffer, extension || path.extname(file.name || ''));
}

export async function getImageDimensionsFromPath(filePath: string) {
  const extension = path.extname(filePath).toLowerCase();
  const buffer = await fs.readFile(filePath);
  return parseImageDimensionsFromBuffer(buffer, extension);
}

export function isSafeProxyPathSegments(segments: string[]) {
  if (!Array.isArray(segments) || segments.length === 0) return false;
  return segments.every((segment) => Boolean(sanitizePathSegment(segment)));
}

export function resolveStorageProxyPath(segments: string[]) {
  if (!isSafeProxyPathSegments(segments)) return null;
  if (segments[0] !== 'epapers') return null;
  const absolutePath = path.resolve(STORAGE_UPLOADS_BASE_DIR, ...segments);
  const relative = path.relative(STORAGE_UPLOADS_BASE_DIR, absolutePath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    return null;
  }
  return absolutePath;
}

export function getFileMimeType(filePath: string) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === '.pdf') return 'application/pdf';
  if (extension === '.png') return 'image/png';
  if (extension === '.webp') return 'image/webp';
  if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg';
  return 'application/octet-stream';
}

export function isServableUploadFilePath(filePath: string) {
  const extension = path.extname(filePath).toLowerCase();
  return SERVABLE_FILE_EXTENSIONS.has(extension);
}

export async function inferPdfPageCount(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());
  if (!buffer.length) return 0;

  const text = buffer.toString('latin1');
  const matches = text.match(/\/Type\s*\/Page\b/g);
  return matches ? matches.length : 0;
}
