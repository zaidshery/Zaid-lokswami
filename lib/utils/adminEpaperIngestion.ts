import 'server-only';

import crypto from 'crypto';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import EPaper from '@/lib/models/EPaper';
import {
  EPAPER_CITY_OPTIONS,
  getCityNameFromSlug,
  normalizeCityName,
  normalizeCitySlug,
} from '@/lib/constants/epaperCities';
import {
  EPAPER_IMAGE_MAX_BYTES,
  EPAPER_PDF_MAX_BYTES,
  getImageDimensions,
  inferPdfPageCount,
  parsePublishDate,
  resolveImageTargetName,
} from '@/lib/utils/epaperStorage';
import {
  deleteDigitalOceanSpacesAssetByPublicId,
  uploadBufferToDigitalOceanSpaces,
} from '@/lib/utils/digitalOceanSpaces';
import {
  isEpaperBackgroundProcessingEnabled,
  queueEpaperPageProcessing,
} from '@/lib/server/epaperProcessingJobs';
import { buildEpaperImageAutomationUpdates } from '@/lib/server/epaperImageAutomation';

type AdminSourceType = 'manual-upload' | 'drive-import' | 'remote-import';

type UploadedAssetRef = { publicId: string; resourceType: 'image' | 'raw' };

type RemoteAssetInput = {
  url: string;
  kind: 'pdf' | 'image';
  fallbackName: string;
  maxBytes: number;
};

type RemoteImportPayload = {
  citySlug: string;
  cityName?: string;
  title: string;
  publishDate: string;
  status?: 'draft' | 'published';
  pageCount?: number;
  pdfUrl: string;
  thumbnailUrl?: string;
  pageImageUrls?: string[];
  sourceLabel?: string;
};

type CreateEPaperInput = {
  citySlug: string;
  cityName?: string;
  title: string;
  publishDateInput: string;
  optionalPageCount?: number;
  statusInput?: string;
  pdfFile: File;
  thumbnailFile?: File;
  pageImageFiles?: File[];
  sourceType?: AdminSourceType;
  sourceLabel?: string;
  sourceUrl?: string;
};

function resolveCityName(citySlug: string, rawCityName: string) {
  const normalizedInputName = normalizeCityName(rawCityName);
  if (normalizedInputName) return normalizedInputName;

  const fromSlug = getCityNameFromSlug(citySlug);
  if (fromSlug) return fromSlug;

  return rawCityName.trim();
}

export function parseOptionalPageCount(value: string) {
  const parsed = Number.parseInt(value.trim(), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 0;
  return Math.floor(parsed);
}

export function isFile(value: FormDataEntryValue | null): value is File {
  return Boolean(value && typeof value === 'object' && 'arrayBuffer' in value);
}

function isPdfFile(file: File) {
  const mime = file.type.trim().toLowerCase();
  const name = file.name.trim().toLowerCase();
  return mime === 'application/pdf' || name.endsWith('.pdf');
}

function isImageFile(file: File) {
  const mime = file.type.trim().toLowerCase();
  const name = file.name.trim().toLowerCase();
  return (
    mime === 'image/jpeg' ||
    mime === 'image/jpg' ||
    mime === 'image/png' ||
    mime === 'image/webp' ||
    name.endsWith('.jpg') ||
    name.endsWith('.jpeg') ||
    name.endsWith('.png') ||
    name.endsWith('.webp')
  );
}

function formatPublishDateFolder(value: Date) {
  const year = value.getUTCFullYear();
  const month = `${value.getUTCMonth() + 1}`.padStart(2, '0');
  const day = `${value.getUTCDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function resolvePdfFormat(fileName: string, uploadFormat: string) {
  const fromUpload = uploadFormat.trim().toLowerCase();
  if (fromUpload) return fromUpload;

  const name = fileName.trim().toLowerCase();
  if (name.endsWith('.pdf')) return 'pdf';
  return 'pdf';
}

function readContentDispositionFileName(headerValue: string) {
  const utf8Match = headerValue.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1]).trim();
  }

  const plainMatch = headerValue.match(/filename="?([^"]+)"?/i);
  if (plainMatch?.[1]) {
    return plainMatch[1].trim();
  }

  return '';
}

function inferFileNameFromUrl(value: string, fallbackName: string) {
  try {
    const parsed = new URL(value);
    const lastSegment = parsed.pathname.split('/').filter(Boolean).pop() || '';
    if (lastSegment) {
      return decodeURIComponent(lastSegment).trim();
    }
  } catch {
    // Ignore malformed URL parsing here; validation happens earlier.
  }

  return fallbackName;
}

function extractGoogleDriveFileId(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '';

  const fileMatch = trimmed.match(/\/file\/d\/([^/]+)/i);
  if (fileMatch?.[1]) {
    return fileMatch[1].trim();
  }

  try {
    const parsed = new URL(trimmed);
    const id = parsed.searchParams.get('id');
    return id ? id.trim() : '';
  } catch {
    return '';
  }
}

function normalizeRemoteSourceUrl(value: string) {
  const trimmed = value.trim();
  if (!/^https?:\/\//i.test(trimmed)) {
    throw new Error('Only absolute http(s) URLs are supported for remote import.');
  }

  const driveFileId = extractGoogleDriveFileId(trimmed);
  if (driveFileId) {
    return {
      sourceUrl: trimmed,
      downloadUrl: `https://drive.google.com/uc?export=download&id=${encodeURIComponent(driveFileId)}`,
      sourceType: 'drive-import' as const,
    };
  }

  return {
    sourceUrl: trimmed,
    downloadUrl: trimmed,
    sourceType: 'remote-import' as const,
  };
}

function isBlockedIpv4(address: string) {
  const parts = address.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) {
    return true;
  }
  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

export function isProtectedRemoteAddress(address: string) {
  const normalized = address.trim().toLowerCase().replace(/^\[|\]$/g, '');
  const version = isIP(normalized);
  if (version === 4) return isBlockedIpv4(normalized);
  if (version !== 6) return true;

  if (normalized.startsWith('::ffff:')) {
    return isBlockedIpv4(normalized.slice('::ffff:'.length));
  }
  return (
    normalized === '::' ||
    normalized === '::1' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    /^fe[89ab]/.test(normalized) ||
    normalized.startsWith('ff') ||
    normalized.startsWith('2001:db8:')
  );
}

export function isProtectedRemoteHostname(hostname: string) {
  const normalized = hostname.toLowerCase().replace(/\.$/, '');
  return (
    !normalized ||
    normalized === 'localhost' ||
    normalized.endsWith('.localhost') ||
    normalized === 'metadata' ||
    normalized === 'metadata.google.internal'
  );
}

async function assertSafeRemoteUrl(value: string) {
  const parsed = new URL(value);
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Only absolute http(s) URLs are supported for remote import.');
  }
  if (parsed.username || parsed.password) {
    throw new Error('Remote import URLs cannot contain credentials.');
  }

  const hostname = parsed.hostname.toLowerCase().replace(/\.$/, '');
  if (isProtectedRemoteHostname(hostname)) {
    throw new Error('Remote import URL resolves to a protected host.');
  }

  const literalVersion = isIP(hostname);
  const addresses = literalVersion
    ? [{ address: hostname }]
    : await lookup(hostname, { all: true, verbatim: true });
  if (
    !addresses.length ||
    addresses.some((entry) => isProtectedRemoteAddress(entry.address))
  ) {
    throw new Error('Remote import URL resolves to a private or protected address.');
  }

  return parsed;
}

async function readLimitedResponse(response: Response, maxBytes: number) {
  const declaredSize = Number(response.headers.get('content-length') || 0);
  if (declaredSize > maxBytes) {
    throw new Error('Remote file is larger than the allowed limit.');
  }
  if (!response.body) {
    throw new Error('Remote file download was empty.');
  }

  const chunks: Uint8Array[] = [];
  let total = 0;
  const reader = response.body.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error('Remote file is larger than the allowed limit.');
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)), total);
}

function hasExpectedSignature(buffer: Buffer, kind: RemoteAssetInput['kind']) {
  if (kind === 'pdf') {
    return buffer.length >= 5 && buffer.subarray(0, 5).toString('ascii') === '%PDF-';
  }
  const isJpeg =
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff;
  const isPng =
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    );
  const isWebp =
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP';
  return isJpeg || isPng || isWebp;
}

async function fetchRemoteAsset(input: RemoteAssetInput) {
  const normalized = normalizeRemoteSourceUrl(input.url);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);

  try {
    let currentUrl = normalized.downloadUrl;
    let response: Response | null = null;
    for (let redirectCount = 0; redirectCount <= 5; redirectCount += 1) {
      await assertSafeRemoteUrl(currentUrl);
      response = await fetch(currentUrl, {
        cache: 'no-store',
        redirect: 'manual',
        signal: controller.signal,
      });
      if (![301, 302, 303, 307, 308].includes(response.status)) break;
      const location = response.headers.get('location');
      if (!location || redirectCount === 5) {
        throw new Error('Remote download exceeded the redirect limit.');
      }
      currentUrl = new URL(location, currentUrl).toString();
    }

    if (!response) {
      throw new Error('Remote download did not return a response.');
    }
    if (!response.ok) {
      throw new Error(`Remote download failed with status ${response.status}.`);
    }

    const buffer = await readLimitedResponse(response, input.maxBytes);
    if (!buffer.length) {
      throw new Error('Remote file download was empty.');
    }
    if (!hasExpectedSignature(buffer, input.kind)) {
      throw new Error(
        input.kind === 'pdf'
          ? 'Remote file is not a valid PDF.'
          : 'Remote file is not a supported JPG, PNG, or WEBP image.'
      );
    }

    const contentDisposition = response.headers.get('content-disposition') || '';
    const contentType = response.headers.get('content-type') || '';
    const fileName =
      readContentDispositionFileName(contentDisposition) ||
      inferFileNameFromUrl(input.url, input.fallbackName);

    const file = new File([buffer], fileName, {
      type: contentType || (input.kind === 'pdf' ? 'application/pdf' : 'image/jpeg'),
    });

    return {
      file,
      buffer,
      sourceType: normalized.sourceType,
      sourceUrl: normalized.sourceUrl,
    };
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Remote file download timed out.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function createAdminEpaperFromFiles(input: CreateEPaperInput) {
  const uploadedAssetRefs: UploadedAssetRef[] = [];

  try {
    const citySlug = normalizeCitySlug(String(input.citySlug || ''));
    const rawCityName = String(input.cityName || '').trim();
    const title = String(input.title || '').trim();
    const publishDateInput = String(input.publishDateInput || '').trim();
    const optionalPageCount = Math.max(0, Number(input.optionalPageCount || 0));
    const statusInput = String(input.statusInput || '').trim().toLowerCase();
    const pageImageFiles = Array.isArray(input.pageImageFiles)
      ? input.pageImageFiles.filter((file) => file.size > 0)
      : [];

    if (!citySlug) {
      throw new Error('citySlug is required and must be valid');
    }
    if (!title) {
      throw new Error('title is required');
    }
    if (!publishDateInput) {
      throw new Error('publishDate is required');
    }
    if (!isPdfFile(input.pdfFile)) {
      throw new Error('E-paper file must be PDF');
    }
    if (input.pdfFile.size > EPAPER_PDF_MAX_BYTES) {
      throw new Error('E-paper PDF size must be less than 25MB');
    }
    if (input.thumbnailFile && !isImageFile(input.thumbnailFile)) {
      throw new Error('Thumbnail must be JPG, PNG, or WEBP');
    }
    if (input.thumbnailFile && input.thumbnailFile.size > EPAPER_IMAGE_MAX_BYTES) {
      throw new Error('Thumbnail size must be less than 10MB');
    }

    for (const pageImage of pageImageFiles) {
      if (!isImageFile(pageImage)) {
        throw new Error('Page images must be JPG, PNG, or WEBP');
      }
      if (pageImage.size > EPAPER_IMAGE_MAX_BYTES) {
        throw new Error('Each page image must be less than 10MB');
      }
    }
    const thumbnailBuffer = input.thumbnailFile
      ? Buffer.from(await input.thumbnailFile.arrayBuffer())
      : null;
    if (thumbnailBuffer && !hasExpectedSignature(thumbnailBuffer, 'image')) {
      throw new Error('Thumbnail has an invalid image signature.');
    }
    const pageImageBuffers = await Promise.all(
      pageImageFiles.map(async (file) => Buffer.from(await file.arrayBuffer()))
    );
    if (
      pageImageBuffers.some((buffer) => !hasExpectedSignature(buffer, 'image'))
    ) {
      throw new Error('A page image has an invalid image signature.');
    }

    const publishDate = parsePublishDate(publishDateInput);
    if (!publishDate) {
      throw new Error('publishDate must be valid (YYYY-MM-DD or DD-MM-YYYY)');
    }

    const cityName = resolveCityName(citySlug, rawCityName);
    if (!cityName) {
      throw new Error(
        `cityName is required for "${citySlug}". Known slugs: ${EPAPER_CITY_OPTIONS.map((item) => item.slug).join(', ')}`
      );
    }

    const existing = await EPaper.findOne({
      citySlug,
      publishDate,
      isCurrentRevision: true,
    })
      .select('_id')
      .lean();
    if (existing) {
      throw new Error(
        `E-paper already exists for ${citySlug} on ${publishDate.toISOString().slice(0, 10)}`
      );
    }

    const publishDateFolder = formatPublishDateFolder(publishDate);
    const baseFolder = `lokswami/epapers/${citySlug}/${publishDateFolder}`;

    const inferredPageCount = await inferPdfPageCount(input.pdfFile);
    const pageCount = Math.max(
      pageImageFiles.length,
      optionalPageCount,
      inferredPageCount > 0 ? inferredPageCount : 0
    );

    if (pageCount < 1) {
      throw new Error(
        'Could not infer PDF page count. Please upload page images or provide pageCount.'
      );
    }
    if (pageCount > 1000) {
      throw new Error('pageCount is too high (max 1000)');
    }
    if (statusInput && statusInput !== 'draft') {
      throw new Error('Imported editions must start as drafts.');
    }

    const pdfBuffer = Buffer.from(await input.pdfFile.arrayBuffer());
    if (!hasExpectedSignature(pdfBuffer, 'pdf')) {
      throw new Error('E-paper file has an invalid PDF signature.');
    }
    const pdfUpload = await uploadBufferToDigitalOceanSpaces(
      pdfBuffer,
      {
        folder: baseFolder,
        resourceType: 'raw',
        originalFilename: input.pdfFile.name || 'epaper.pdf',
      }
    );
    uploadedAssetRefs.push({ publicId: pdfUpload.publicId, resourceType: 'raw' });

    const thumbnailUpload = input.thumbnailFile
      ? await uploadBufferToDigitalOceanSpaces(
          thumbnailBuffer as Buffer,
          {
            folder: baseFolder,
            resourceType: 'image',
            originalFilename: resolveImageTargetName('thumbnail', input.thumbnailFile),
          }
        )
      : null;
    if (thumbnailUpload) {
      uploadedAssetRefs.push({
        publicId: thumbnailUpload.publicId,
        resourceType: 'image',
      });
    }

    const pages: Array<{
      pageNumber: number;
      imagePath?: string;
      width?: number;
      height?: number;
      pageType: 'editorial';
      processingStatus: 'pending' | 'ready';
      reviewStatus: 'pending';
    }> = Array.from({ length: pageCount }, (_, index) => ({
      pageNumber: index + 1,
      pageType: 'editorial',
      processingStatus: 'pending',
      reviewStatus: 'pending',
    }));

    for (let index = 0; index < pageImageFiles.length; index += 1) {
      const file = pageImageFiles[index];
      const pageNumber = index + 1;
      const uploadedPage = await uploadBufferToDigitalOceanSpaces(pageImageBuffers[index], {
        folder: `${baseFolder}/pages`,
        resourceType: 'image',
        originalFilename: resolveImageTargetName('page', file, pageNumber),
      });
      uploadedAssetRefs.push({ publicId: uploadedPage.publicId, resourceType: 'image' });

      const dimensions = await getImageDimensions(file);
      pages[index] = {
        pageNumber,
        imagePath: uploadedPage.secureUrl,
        width: dimensions?.width,
        height: dimensions?.height,
        pageType: 'editorial',
        processingStatus: 'ready',
        reviewStatus: 'pending',
      };
    }

    const automationUpdates = buildEpaperImageAutomationUpdates({
      pageCount,
      pages,
      currentThumbnailPath: thumbnailUpload?.secureUrl || '',
      currentProductionStatus: 'draft_upload',
      currentStatus: 'draft',
    });
    const epaper = await EPaper.create({
      citySlug,
      cityName,
      title,
      publishDate,
      pdfPath: pdfUpload.secureUrl,
      pdfPublicId: pdfUpload.publicId,
      pdfFormat: resolvePdfFormat(
        input.pdfFile.name || 'epaper.pdf',
        String(pdfUpload.format || '')
      ),
      thumbnailPath:
        automationUpdates.thumbnailPath || thumbnailUpload?.secureUrl || '',
      pageCount,
      pages,
      status: 'draft',
      familyId: crypto.randomUUID(),
      revisionNumber: 1,
      isCurrentRevision: true,
      productionStatus: automationUpdates.productionStatus || 'draft_upload',
      sourceType: input.sourceType || 'manual-upload',
      sourceLabel: String(input.sourceLabel || '').trim(),
      sourceUrl: String(input.sourceUrl || '').trim(),
    });

    const missingPageNumbers = pages
      .filter((page) => !String(page.imagePath || '').trim())
      .map((page) => page.pageNumber);
    let processingWarning = '';
    if (missingPageNumbers.length > 0) {
      try {
        if (!isEpaperBackgroundProcessingEnabled(citySlug)) {
          throw new Error('Background PDF processing is not enabled for this city.');
        }
        await queueEpaperPageProcessing({
          epaperId: String(epaper._id),
          pageNumbers: missingPageNumbers,
        });
      } catch (error) {
        processingWarning =
          error instanceof Error
            ? `Background conversion could not be queued: ${error.message}`
            : 'Background conversion could not be queued.';
      }
    }

    return {
      epaper,
      warning:
        processingWarning ||
        (missingPageNumbers.length > 0
          ? 'Missing pages were queued for background conversion.'
          : null),
    };
  } catch (error) {
    await Promise.all(
      uploadedAssetRefs.map((asset) =>
        deleteDigitalOceanSpacesAssetByPublicId(asset.publicId, asset.resourceType).catch(
          () => undefined
        )
      )
    );
    throw error;
  }
}

export async function createAdminEpaperFromRemoteImport(input: RemoteImportPayload) {
  const pdfAsset = await fetchRemoteAsset({
    url: input.pdfUrl,
    kind: 'pdf',
    fallbackName: 'epaper.pdf',
    maxBytes: EPAPER_PDF_MAX_BYTES,
  });
  const thumbnailAsset = input.thumbnailUrl?.trim()
    ? await fetchRemoteAsset({
        url: input.thumbnailUrl,
        kind: 'image',
        fallbackName: 'thumbnail.jpg',
        maxBytes: EPAPER_IMAGE_MAX_BYTES,
      })
    : null;

  const pageImageUrls = Array.isArray(input.pageImageUrls)
    ? input.pageImageUrls.map((value) => String(value || '').trim()).filter(Boolean)
    : [];

  const pageImageFiles: File[] = [];
  for (let index = 0; index < pageImageUrls.length; index += 1) {
    const pageAsset = await fetchRemoteAsset({
      url: pageImageUrls[index],
      kind: 'image',
      fallbackName: `page-${index + 1}.jpg`,
      maxBytes: EPAPER_IMAGE_MAX_BYTES,
    });
    pageImageFiles.push(pageAsset.file);
  }

  const sourceType = pdfAsset.sourceType;
  const sourceUrl = pdfAsset.sourceUrl;
  const sourceLabel =
    String(input.sourceLabel || '').trim() ||
    (sourceType === 'drive-import' ? 'Google Drive import' : 'Remote import');

  return createAdminEpaperFromFiles({
    citySlug: input.citySlug,
    cityName: input.cityName,
    title: input.title,
    publishDateInput: input.publishDate,
    optionalPageCount: input.pageCount,
    statusInput: input.status || 'draft',
    pdfFile: pdfAsset.file,
    thumbnailFile: thumbnailAsset?.file,
    pageImageFiles,
    sourceType,
    sourceLabel,
    sourceUrl,
  });
}

export function mapAdminEpaper(epaper: unknown) {
  const source =
    typeof epaper === 'object' && epaper !== null ? (epaper as Record<string, unknown>) : {};
  const publishDate = new Date(String(source.publishDate || ''));
  return {
    _id: String(source._id || ''),
    citySlug: String(source.citySlug || ''),
    cityName: String(source.cityName || ''),
    title: String(source.title || ''),
    publishDate: Number.isNaN(publishDate.getTime()) ? '' : publishDate.toISOString().slice(0, 10),
    pdfPath: String(source.pdfPath || ''),
    pdfPublicId: String(source.pdfPublicId || ''),
    pdfFormat: String(source.pdfFormat || ''),
    thumbnailPath: String(source.thumbnailPath || ''),
    pageCount: Number(source.pageCount || 0),
    pages: Array.isArray(source.pages) ? source.pages : [],
    status: source.status === 'published' ? 'published' : 'draft',
    sourceType: String(source.sourceType || ''),
    sourceLabel: String(source.sourceLabel || ''),
    sourceUrl: String(source.sourceUrl || ''),
    createdAt: source.createdAt,
    updatedAt: source.updatedAt,
  };
}
