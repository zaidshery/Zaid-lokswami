import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongoose';
import EPaper from '@/lib/models/EPaper';
import { verifyAdminToken } from '@/lib/auth/adminToken';
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

function resolveCityName(citySlug: string, rawCityName: string) {
  const normalizedInputName = normalizeCityName(rawCityName);
  if (normalizedInputName) return normalizedInputName;

  const fromSlug = getCityNameFromSlug(citySlug);
  if (fromSlug) return fromSlug;

  return rawCityName.trim();
}

function parseOptionalPageCount(value: string) {
  const parsed = Number.parseInt(value.trim(), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 0;
  return Math.floor(parsed);
}

function isFile(value: FormDataEntryValue | null): value is File {
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

function mapEpaper(epaper: unknown) {
  const source =
    typeof epaper === 'object' && epaper !== null ? (epaper as Record<string, unknown>) : {};
  const publishDate = new Date(String(source.publishDate || ''));
  return {
    _id: String(source._id),
    citySlug: String(source.citySlug || ''),
    cityName: String(source.cityName || ''),
    title: String(source.title || ''),
    publishDate: Number.isNaN(publishDate.getTime()) ? '' : publishDate.toISOString().slice(0, 10),
    pdfPath: String(source.pdfPath || ''),
    thumbnailPath: String(source.thumbnailPath || ''),
    pageCount: Number(source.pageCount || 0),
    pages: Array.isArray(source.pages) ? source.pages : [],
    status: source.status === 'published' ? 'published' : 'draft',
    createdAt: source.createdAt,
    updatedAt: source.updatedAt,
  };
}

export async function POST(req: NextRequest) {
  const uploadedAssetRefs: Array<{ publicId: string; resourceType: 'image' | 'raw' }> = [];

  try {
    const admin = verifyAdminToken(req);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const formData = await req.formData();

    const citySlug = normalizeCitySlug(String(formData.get('citySlug') || ''));
    const rawCityName = String(formData.get('cityName') || '').trim();
    const title = String(formData.get('title') || '').trim();
    const publishDateInput = String(formData.get('publishDate') || '').trim();
    const optionalPageCount = parseOptionalPageCount(String(formData.get('pageCount') || ''));
    const statusInput = String(formData.get('status') || '').trim().toLowerCase();

    const pdf = formData.get('pdf');
    const thumbnail = formData.get('thumbnail');
    const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });
    const pageImageFiles = formData
      .getAll('pageImages')
      .filter(isFile)
      .filter((file) => file.size > 0)
      .sort((a, b) => collator.compare(a.name || '', b.name || ''));

    if (!citySlug) {
      return NextResponse.json(
        { success: false, error: 'citySlug is required and must be valid' },
        { status: 400 }
      );
    }
    if (!title) {
      return NextResponse.json({ success: false, error: 'title is required' }, { status: 400 });
    }
    if (!publishDateInput) {
      return NextResponse.json(
        { success: false, error: 'publishDate is required' },
        { status: 400 }
      );
    }
    if (!isFile(pdf) || pdf.size <= 0) {
      return NextResponse.json(
        { success: false, error: 'PDF file is required' },
        { status: 400 }
      );
    }
    if (!isFile(thumbnail) || thumbnail.size <= 0) {
      return NextResponse.json(
        { success: false, error: 'Thumbnail file is required' },
        { status: 400 }
      );
    }
    if (!isPdfFile(pdf)) {
      return NextResponse.json(
        { success: false, error: 'E-paper file must be PDF' },
        { status: 400 }
      );
    }
    if (pdf.size > EPAPER_PDF_MAX_BYTES) {
      return NextResponse.json(
        { success: false, error: 'E-paper PDF size must be less than 25MB' },
        { status: 400 }
      );
    }
    if (!isImageFile(thumbnail)) {
      return NextResponse.json(
        { success: false, error: 'Thumbnail must be JPG, PNG, or WEBP' },
        { status: 400 }
      );
    }
    if (thumbnail.size > EPAPER_IMAGE_MAX_BYTES) {
      return NextResponse.json(
        { success: false, error: 'Thumbnail size must be less than 10MB' },
        { status: 400 }
      );
    }
    for (const pageImage of pageImageFiles) {
      if (!isImageFile(pageImage)) {
        return NextResponse.json(
          { success: false, error: 'Page images must be JPG, PNG, or WEBP' },
          { status: 400 }
        );
      }
      if (pageImage.size > EPAPER_IMAGE_MAX_BYTES) {
        return NextResponse.json(
          { success: false, error: 'Each page image must be less than 10MB' },
          { status: 400 }
        );
      }
    }

    const publishDate = parsePublishDate(publishDateInput);
    if (!publishDate) {
      return NextResponse.json(
        {
          success: false,
          error: 'publishDate must be valid (YYYY-MM-DD or DD-MM-YYYY)',
        },
        { status: 400 }
      );
    }

    const cityName = resolveCityName(citySlug, rawCityName);
    if (!cityName) {
      return NextResponse.json(
        {
          success: false,
          error: `cityName is required for "${citySlug}". Known slugs: ${EPAPER_CITY_OPTIONS.map((item) => item.slug).join(', ')}`,
        },
        { status: 400 }
      );
    }

    const existing = await EPaper.findOne({
      citySlug,
      publishDate,
    })
      .select('_id')
      .lean();
    if (existing) {
      return NextResponse.json(
        {
          success: false,
          error: `E-paper already exists for ${citySlug} on ${publishDate.toISOString().slice(0, 10)}`,
        },
        { status: 409 }
      );
    }

    const publishDateFolder = formatPublishDateFolder(publishDate);
    const baseFolder = `lokswami/epapers/${citySlug}/${publishDateFolder}`;

    const inferredPageCount = await inferPdfPageCount(pdf);
    const pageCount = Math.max(
      pageImageFiles.length,
      optionalPageCount,
      inferredPageCount > 0 ? inferredPageCount : 0
    );

    if (pageCount < 1) {
      return NextResponse.json(
        {
          success: false,
          error: 'Could not infer PDF page count. Please upload page images or provide pageCount.',
        },
        { status: 400 }
      );
    }
    if (pageCount > 1000) {
      return NextResponse.json(
        { success: false, error: 'pageCount is too high (max 1000)' },
        { status: 400 }
      );
    }

    const pdfUpload = await uploadBufferToCloudinary(Buffer.from(await pdf.arrayBuffer()), {
      folder: baseFolder,
      resourceType: 'raw',
      originalFilename: pdf.name || 'epaper.pdf',
    });
    uploadedAssetRefs.push({ publicId: pdfUpload.publicId, resourceType: 'raw' });

    const thumbnailUpload = await uploadBufferToCloudinary(
      Buffer.from(await thumbnail.arrayBuffer()),
      {
        folder: baseFolder,
        resourceType: 'image',
        originalFilename: resolveImageTargetName('thumbnail', thumbnail),
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
      thumbnailPath: thumbnailUpload.secureUrl,
      pageCount,
      pages,
      status: statusInput === 'published' ? 'published' : 'draft',
    });

    return NextResponse.json(
      {
        success: true,
        message: 'E-paper uploaded successfully',
        warning: pageImageFiles.length === 0 ? 'Add page images to enable hotspot drawing' : null,
        data: mapEpaper(epaper.toObject()),
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    await Promise.all(
      uploadedAssetRefs.map((asset) =>
        deleteCloudinaryAssetByPublicId(asset.publicId, asset.resourceType).catch(() => undefined)
      )
    );

    const duplicateCode =
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: unknown }).code === 11000;
    if (duplicateCode) {
      return NextResponse.json(
        { success: false, error: 'An e-paper for this city/date already exists' },
        { status: 409 }
      );
    }

    console.error('Failed to upload e-paper:', error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error && error.message.trim() && process.env.NODE_ENV !== 'production'
            ? `Failed to upload e-paper: ${error.message}`
            : 'Failed to upload e-paper',
      },
      { status: 500 }
    );
  }
}
