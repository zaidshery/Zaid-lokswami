import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import connectDB from '@/lib/db/mongoose';
import EPaper from '@/lib/models/EPaper';
import { verifyAdminToken } from '@/lib/auth/adminToken';
import {
  EPAPER_IMAGE_MAX_BYTES,
  formatPublishDateFolder,
  getImageDimensions,
  isAllowedAssetPath,
  resolveImageTargetName,
} from '@/lib/utils/epaperStorage';
import {
  deleteCloudinaryAssetByUrl,
  uploadBufferToCloudinary,
} from '@/lib/utils/cloudinary';

type RouteContext = {
  params: Promise<{ id: string }>;
};

function isFile(value: FormDataEntryValue | null): value is File {
  return Boolean(value && typeof value === 'object' && 'arrayBuffer' in value);
}

function parsePageNumber(value: unknown) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 0;
  return Math.floor(parsed);
}

function parseOptionalDimension(value: unknown) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return undefined;
  return Math.floor(parsed);
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

function mapPages(
  currentPages: Array<{ pageNumber: number; imagePath?: string; width?: number; height?: number }>,
  pageCount: number
) {
  const byPage = new Map<number, (typeof currentPages)[number]>();
  for (const page of currentPages) {
    if (!Number.isFinite(page.pageNumber) || page.pageNumber < 1) continue;
    byPage.set(page.pageNumber, page);
  }

  return Array.from({ length: pageCount }, (_, index) => {
    const pageNumber = index + 1;
    const existing = byPage.get(pageNumber);
    return {
      pageNumber,
      imagePath: existing?.imagePath || '',
      width: existing?.width,
      height: existing?.height,
    };
  });
}

function updateSinglePage(
  pages: ReturnType<typeof mapPages>,
  pageNumber: number,
  updates: { imagePath?: string; width?: number; height?: number }
) {
  const next = pages.slice();
  const target = next.find((page) => page.pageNumber === pageNumber);
  if (!target) return next;

  if (updates.imagePath !== undefined) target.imagePath = updates.imagePath;
  if (updates.width !== undefined) target.width = updates.width;
  if (updates.height !== undefined) target.height = updates.height;

  return next;
}

export async function PUT(req: NextRequest, context: RouteContext) {
  try {
    const admin = verifyAdminToken(req);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();
    const { id } = await context.params;

    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, error: 'Invalid e-paper ID' }, { status: 400 });
    }

    const epaper = await EPaper.findById(id).lean();
    if (!epaper) {
      return NextResponse.json({ success: false, error: 'E-paper not found' }, { status: 404 });
    }

    const contentType = req.headers.get('content-type') || '';
    const publishDate = new Date(epaper.publishDate);
    const publishDateFolder = formatPublishDateFolder(publishDate);
    const basePageFolder = `lokswami/epapers/${epaper.citySlug}/${publishDateFolder}/pages`;

    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData();
      const pageNumber = parsePageNumber(form.get('pageNumber'));
      const imagePathValue = String(form.get('imagePath') || '').trim();
      const imageFile = form.get('image');

      if (!pageNumber) {
        return NextResponse.json({ success: false, error: 'pageNumber is required' }, { status: 400 });
      }
      if (pageNumber > 1000) {
        return NextResponse.json(
          { success: false, error: 'pageNumber must be <= 1000' },
          { status: 400 }
        );
      }

      let imagePath = '';
      let width = parseOptionalDimension(form.get('width'));
      let height = parseOptionalDimension(form.get('height'));

      if (isFile(imageFile) && imageFile.size > 0) {
        if (!isImageFile(imageFile)) {
          return NextResponse.json(
            { success: false, error: 'Page image must be JPG, PNG, or WEBP' },
            { status: 400 }
          );
        }
        if (imageFile.size > EPAPER_IMAGE_MAX_BYTES) {
          return NextResponse.json(
            { success: false, error: 'Page image must be under 10MB' },
            { status: 400 }
          );
        }

        const uploaded = await uploadBufferToCloudinary(Buffer.from(await imageFile.arrayBuffer()), {
          folder: basePageFolder,
          resourceType: 'image',
          originalFilename: resolveImageTargetName('page', imageFile, pageNumber),
        });
        imagePath = uploaded.secureUrl;

        const dimensions = await getImageDimensions(imageFile);
        if (!width) width = dimensions?.width;
        if (!height) height = dimensions?.height;
      } else if (imagePathValue) {
        if (!isAllowedAssetPath(imagePathValue)) {
          return NextResponse.json(
            { success: false, error: 'Invalid imagePath value' },
            { status: 400 }
          );
        }
        imagePath = imagePathValue;
      } else {
        return NextResponse.json(
          { success: false, error: 'Provide image file or imagePath' },
          { status: 400 }
        );
      }

      const nextPageCount = Math.max(pageNumber, Number(epaper.pageCount || 0), 1);
      let pages = mapPages(Array.isArray(epaper.pages) ? epaper.pages : [], nextPageCount);
      const previous = pages.find((item) => item.pageNumber === pageNumber)?.imagePath || '';
      pages = updateSinglePage(pages, pageNumber, { imagePath, width, height });

      const updated = await EPaper.findByIdAndUpdate(
        id,
        {
          pageCount: nextPageCount,
          pages,
        },
        { new: true, runValidators: true }
      ).lean();

      if (previous && previous !== imagePath) {
        await deleteCloudinaryAssetByUrl(previous).catch(() => undefined);
      }

      return NextResponse.json({
        success: true,
        message: 'Page image updated',
        data: updated,
      });
    }

    const body = await req.json().catch(() => ({}));
    const source = typeof body === 'object' && body ? (body as Record<string, unknown>) : {};
    const updates = Array.isArray(source.pages) ? source.pages : [];

    if (updates.length === 0) {
      return NextResponse.json({ success: false, error: 'pages[] is required' }, { status: 400 });
    }

    let nextPageCount = Number(epaper.pageCount || 0);
    let pages = mapPages(Array.isArray(epaper.pages) ? epaper.pages : [], Math.max(nextPageCount, 1));

    for (const item of updates) {
      const entry = typeof item === 'object' && item ? (item as Record<string, unknown>) : {};
      const pageNumber = parsePageNumber(entry.pageNumber);
      const imagePath = typeof entry.imagePath === 'string' ? entry.imagePath.trim() : '';
      const width = parseOptionalDimension(entry.width);
      const height = parseOptionalDimension(entry.height);

      if (!pageNumber) {
        return NextResponse.json(
          { success: false, error: 'Each page update needs valid pageNumber' },
          { status: 400 }
        );
      }
      if (pageNumber > 1000) {
        return NextResponse.json(
          { success: false, error: 'pageNumber must be <= 1000' },
          { status: 400 }
        );
      }
      if (imagePath && !isAllowedAssetPath(imagePath)) {
        return NextResponse.json(
          { success: false, error: `Invalid imagePath for page ${pageNumber}` },
          { status: 400 }
        );
      }

      if (pageNumber > nextPageCount) {
        nextPageCount = pageNumber;
        pages = mapPages(pages, nextPageCount);
      }
      pages = updateSinglePage(pages, pageNumber, {
        imagePath: imagePath || '',
        width,
        height,
      });
    }

    const updated = await EPaper.findByIdAndUpdate(
      id,
      {
        pageCount: nextPageCount,
        pages,
      },
      { new: true, runValidators: true }
    ).lean();

    return NextResponse.json({
      success: true,
      message: 'Page images updated',
      data: updated,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '';
    if (
      message.includes('Only JPG, PNG, or WEBP images are allowed') ||
      message.includes('Image size exceeds 10MB') ||
      message.includes('Image signature is invalid')
    ) {
      return NextResponse.json(
        {
          success: false,
          error: 'Page image must be JPG/PNG/WEBP, under 10MB, and a valid image file',
        },
        { status: 400 }
      );
    }

    console.error('Failed to update e-paper pages:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update page images' },
      { status: 500 }
    );
  }
}
