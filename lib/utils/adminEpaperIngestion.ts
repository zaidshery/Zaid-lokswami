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
  deleteCloudinaryAssetByPublicId,
  uploadBufferToCloudinary,
} from '@/lib/utils/cloudinary';

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
  thumbnailUrl: string;
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
  thumbnailFile: File;
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

async function fetchRemoteAsset(input: RemoteAssetInput) {
  const normalized = normalizeRemoteSourceUrl(input.url);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);

  try {
    const response = await fetch(normalized.downloadUrl, {
      cache: 'no-store',
      redirect: 'follow',
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Remote download failed with status ${response.status}.`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    if (!buffer.length) {
      throw new Error('Remote file download was empty.');
    }
    if (buffer.byteLength > input.maxBytes) {
      throw new Error(
        `${input.kind === 'pdf' ? 'PDF' : 'Image'} is larger than the allowed limit.`
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
    if (!isImageFile(input.thumbnailFile)) {
      throw new Error('Thumbnail must be JPG, PNG, or WEBP');
    }
    if (input.thumbnailFile.size > EPAPER_IMAGE_MAX_BYTES) {
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

    const pdfUpload = await uploadBufferToCloudinary(
      Buffer.from(await input.pdfFile.arrayBuffer()),
      {
        folder: baseFolder,
        resourceType: 'raw',
        originalFilename: input.pdfFile.name || 'epaper.pdf',
      }
    );
    uploadedAssetRefs.push({ publicId: pdfUpload.publicId, resourceType: 'raw' });

    const thumbnailUpload = await uploadBufferToCloudinary(
      Buffer.from(await input.thumbnailFile.arrayBuffer()),
      {
        folder: baseFolder,
        resourceType: 'image',
        originalFilename: resolveImageTargetName('thumbnail', input.thumbnailFile),
      }
    );
    uploadedAssetRefs.push({ publicId: thumbnailUpload.publicId, resourceType: 'image' });

    const pages: Array<{
      pageNumber: number;
      imagePath?: string;
      width?: number;
      height?: number;
    }> = Array.from({ length: pageCount }, (_, index) => ({
      pageNumber: index + 1,
    }));

    for (let index = 0; index < pageImageFiles.length; index += 1) {
      const file = pageImageFiles[index];
      const pageNumber = index + 1;
      const uploadedPage = await uploadBufferToCloudinary(Buffer.from(await file.arrayBuffer()), {
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
      };
    }

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
      thumbnailPath: thumbnailUpload.secureUrl,
      pageCount,
      pages,
      status: statusInput === 'published' ? 'published' : 'draft',
      sourceType: input.sourceType || 'manual-upload',
      sourceLabel: String(input.sourceLabel || '').trim(),
      sourceUrl: String(input.sourceUrl || '').trim(),
    });

    return {
      epaper,
      warning:
        pageImageFiles.length === 0 ? 'Add page images to enable hotspot drawing' : null,
    };
  } catch (error) {
    await Promise.all(
      uploadedAssetRefs.map((asset) =>
        deleteCloudinaryAssetByPublicId(asset.publicId, asset.resourceType).catch(
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
  const thumbnailAsset = await fetchRemoteAsset({
    url: input.thumbnailUrl,
    kind: 'image',
    fallbackName: 'thumbnail.jpg',
    maxBytes: EPAPER_IMAGE_MAX_BYTES,
  });

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
    thumbnailFile: thumbnailAsset.file,
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
