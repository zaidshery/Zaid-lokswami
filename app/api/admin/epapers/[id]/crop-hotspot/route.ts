import fs from 'fs/promises';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import sharp from 'sharp';
import { getAdminSessionFromReq } from '@/lib/auth/admin';
import { canViewPage } from '@/lib/auth/permissions';
import connectDB from '@/lib/db/mongoose';
import EPaper from '@/lib/models/EPaper';
import {
  calculateEpaperHotspotCrop,
  type EpaperHotspotCropPaddingMode,
} from '@/lib/utils/epaperHotspotCrop';
import { buildEpaperCropOcrImageSource } from '@/lib/server/epaperOcrPreprocess';
import {
  formatPublishDateFolder,
  resolveEpaperAssetPath,
} from '@/lib/utils/epaperStorage';
import { uploadBufferToDigitalOceanSpaces } from '@/lib/utils/digitalOceanSpaces';

export const runtime = 'nodejs';

type RouteContext = {
  params: Promise<{ id: string }>;
};

type CropHotspot = {
  x: number;
  y: number;
  w: number;
  h: number;
};

function asObject(value: unknown) {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

function parsePageNumber(value: unknown) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 0;
  return Math.floor(parsed);
}

function parseHotspot(value: unknown): CropHotspot {
  const source = asObject(value);
  return {
    x: Number(source.x),
    y: Number(source.y),
    w: Number(source.w),
    h: Number(source.h),
  };
}

function parsePaddingMode(value: unknown): EpaperHotspotCropPaddingMode {
  return value === 'normal' || value === 'loose' ? value : 'tight';
}

function sanitizeFileStem(value: string, fallback: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, '-')
      .replace(/-{2,}/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 70) || fallback
  );
}

async function loadPageImageBuffer(imagePath: string) {
  const value = imagePath.trim();
  if (!value) {
    throw new Error('Page image is missing.');
  }

  const dataUrl = /^data:image\/(?:png|jpe?g|webp);base64,([\s\S]+)$/i.exec(value);
  if (dataUrl) {
    return Buffer.from(dataUrl[1], 'base64');
  }

  if (/^https?:\/\//i.test(value)) {
    const response = await fetch(value, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`Page image fetch failed with status ${response.status}.`);
    }
    return Buffer.from(await response.arrayBuffer());
  }

  const resolved = resolveEpaperAssetPath(value);
  if (!resolved) {
    throw new Error('Page image path is not supported for server-side cropping.');
  }

  return fs.readFile(resolved.absolutePath);
}

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const admin = await getAdminSessionFromReq(req);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (!canViewPage(admin.role, 'epaper_edit')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    await connectDB();
    const { id } = await context.params;
    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, error: 'Invalid e-paper ID' }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const source = asObject(body);
    const pageNumber = parsePageNumber(source.pageNumber);
    const hotspot = parseHotspot(source.hotspot);
    const title = typeof source.title === 'string' ? source.title : '';
    const paddingMode = parsePaddingMode(source.paddingMode);
    const includeOcrSource = Boolean(source.includeOcrSource);

    if (!pageNumber) {
      return NextResponse.json({ success: false, error: 'pageNumber is required' }, { status: 400 });
    }

    const epaper = await EPaper.findById(id)
      .select('_id title citySlug publishDate pages pageCount')
      .lean();
    if (!epaper) {
      return NextResponse.json({ success: false, error: 'E-paper not found' }, { status: 404 });
    }
    if (pageNumber > Number(epaper.pageCount || 0)) {
      return NextResponse.json(
        { success: false, error: `pageNumber must be between 1 and ${epaper.pageCount}` },
        { status: 400 }
      );
    }

    const pages = Array.isArray(epaper.pages) ? epaper.pages : [];
    const page = pages.find((item) => Number(item?.pageNumber || 0) === pageNumber);
    const pageImagePath = String(page?.imagePath || '').trim();
    if (!pageImagePath) {
      return NextResponse.json(
        { success: false, error: `Page ${pageNumber} image is missing` },
        { status: 400 }
      );
    }

    const pageImageBuffer = await loadPageImageBuffer(pageImagePath);
    const metadata = await sharp(pageImageBuffer).metadata();
    const pageWidth = Number(metadata.width || page?.width || 0);
    const pageHeight = Number(metadata.height || page?.height || 0);
    const crop = calculateEpaperHotspotCrop({
      pageWidth,
      pageHeight,
      hotspot,
      paddingMode,
    });

    const cropped = await sharp(pageImageBuffer)
      .extract({
        left: crop.left,
        top: crop.top,
        width: crop.width,
        height: crop.height,
      })
      .webp({ quality: 92 })
      .toBuffer();
    const ocrImage = includeOcrSource
      ? await buildEpaperCropOcrImageSource(pageImageBuffer, crop)
      : null;

    const publishDate =
      epaper.publishDate instanceof Date
        ? epaper.publishDate
        : new Date(String(epaper.publishDate || ''));
    if (Number.isNaN(publishDate.getTime())) {
      return NextResponse.json(
        { success: false, error: 'E-paper publish date is invalid' },
        { status: 400 }
      );
    }

    const citySlug = sanitizeFileStem(String(epaper.citySlug || ''), 'city');
    const dateFolder = formatPublishDateFolder(publishDate);
    const titleStem = sanitizeFileStem(title || String(epaper.title || ''), `page-${pageNumber}-crop`);
    const fileName = `${String(pageNumber).padStart(3, '0')}-${titleStem}.webp`;
    const folder = path.posix.join('lokswami', 'epapers', citySlug, dateFolder, 'clips');
    const uploaded = await uploadBufferToDigitalOceanSpaces(cropped, {
      folder,
      resourceType: 'image',
      originalFilename: fileName,
    });

    return NextResponse.json({
      success: true,
      coverImagePath: uploaded.secureUrl,
      width: crop.width,
      height: crop.height,
      paddingMode,
      data: {
        coverImagePath: uploaded.secureUrl,
        width: crop.width,
        height: crop.height,
        paddingMode,
        crop,
        ocrImageSource: ocrImage?.dataUrl,
        ocrImageWidth: ocrImage?.width,
        ocrImageHeight: ocrImage?.height,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to crop hotspot';
    console.error('Failed to crop e-paper hotspot:', error);
    return NextResponse.json(
      { success: false, error: message },
      { status: /too small|invalid|required|missing|unsupported|inside/i.test(message) ? 400 : 500 }
    );
  }
}
