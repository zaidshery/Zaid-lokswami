import { NextRequest, NextResponse } from 'next/server';
import { getAdminSessionFromReq } from '@/lib/auth/admin';
import { isReporterDeskRole } from '@/lib/auth/roles';
import { uploadBufferToDigitalOceanSpaces } from '@/lib/utils/digitalOceanSpaces';
import sharp from 'sharp';
import path from 'path';

export const runtime = 'nodejs';

type UploadPurpose =
  | 'image'
  | 'story-thumbnail'
  | 'video-thumbnail'
  | 'epaper-thumbnail'
  | 'epaper-paper';

type UploadRule = {
  maxSizeBytes: number;
  errorType: string;
  errorSize: string;
  folder: string;
  resourceType: 'image' | 'raw' | 'auto';
  isAllowed: (file: File) => boolean;
};

function parseUploadPurpose(value: FormDataEntryValue | null): UploadPurpose {
  if (value === 'story-thumbnail') return 'story-thumbnail';
  if (value === 'video-thumbnail') return 'video-thumbnail';
  if (value === 'epaper-thumbnail') return 'epaper-thumbnail';
  if (value === 'epaper-paper') return 'epaper-paper';
  return 'image';
}

function bytesFromMb(mb: number) {
  return mb * 1024 * 1024;
}

function isPdf(file: File) {
  const mime = file.type.trim().toLowerCase();
  const name = file.name.trim().toLowerCase();
  return mime === 'application/pdf' || name.endsWith('.pdf');
}

function isImage(file: File) {
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

function isImageOrPdf(file: File) {
  return isImage(file) || isPdf(file);
}

function getUploadRule(purpose: UploadPurpose): UploadRule {
  if (purpose === 'epaper-paper') {
    return {
      maxSizeBytes: bytesFromMb(25),
      errorType: 'E-paper file must be a PDF',
      errorSize: 'E-paper PDF size must be less than 25MB',
      folder: 'lokswami/epapers/papers',
      resourceType: 'raw',
      isAllowed: isPdf,
    };
  }

  if (purpose === 'epaper-thumbnail') {
    return {
      maxSizeBytes: bytesFromMb(10),
      errorType: 'Thumbnail must be JPG, JPEG, PNG, or WEBP',
      errorSize: 'Thumbnail size must be less than 10MB',
      folder: 'lokswami/epapers/thumbnails',
      resourceType: 'image',
      isAllowed: isImage,
    };
  }

  if (purpose === 'video-thumbnail') {
    return {
      maxSizeBytes: bytesFromMb(10),
      errorType: 'Video thumbnail must be JPG, JPEG, PNG, WEBP, or PDF',
      errorSize: 'Video thumbnail size must be less than 10MB',
      folder: 'lokswami/videos/thumbnails',
      resourceType: 'auto',
      isAllowed: isImageOrPdf,
    };
  }

  if (purpose === 'story-thumbnail') {
    return {
      maxSizeBytes: bytesFromMb(10),
      errorType: 'Story thumbnail must be JPG, JPEG, PNG, or WEBP',
      errorSize: 'Story thumbnail size must be less than 10MB',
      folder: 'lokswami/stories/thumbnails',
      resourceType: 'image',
      isAllowed: isImage,
    };
  }

  return {
    maxSizeBytes: bytesFromMb(5),
    errorType: 'Only JPG, JPEG, PNG, or WEBP image files are allowed',
    errorSize: 'Image size must be less than 5MB',
    folder: 'lokswami/images',
    resourceType: 'image',
    isAllowed: isImage,
  };
}

function canUseUploadPurpose(role: string | null | undefined, purpose: UploadPurpose) {
  if (!isReporterDeskRole(role)) {
    return true;
  }

  return purpose === 'image' || purpose === 'story-thumbnail';
}

function isRetriableBodyReadError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /disturbed|locked|already read|body/i.test(message);
}

async function readUploadFormData(req: NextRequest) {
  try {
    return await req.formData();
  } catch (error) {
    if (!isRetriableBodyReadError(error) || typeof req.clone !== 'function') {
      throw error;
    }

    return req.clone().formData();
  }
}

function parseFocalPoint(value: FormDataEntryValue | null) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 50;
  return Math.min(100, Math.max(0, parsed));
}

function replaceImageExtension(filename: string, suffix: string, extension: 'webp' | 'avif') {
  const stem = path.parse(filename || 'article-image').name || 'article-image';
  return `${stem}-${suffix}.${extension}`;
}

function resolveFocalCrop(input: {
  width: number;
  height: number;
  targetAspect: number;
  focalPointX: number;
  focalPointY: number;
}) {
  const sourceAspect = input.width / input.height;
  if (sourceAspect > input.targetAspect) {
    const width = Math.max(1, Math.round(input.height * input.targetAspect));
    const available = Math.max(0, input.width - width);
    return {
      left: Math.round(available * (input.focalPointX / 100)),
      top: 0,
      width,
      height: input.height,
    };
  }
  const height = Math.max(1, Math.round(input.width / input.targetAspect));
  const available = Math.max(0, input.height - height);
  return {
    left: 0,
    top: Math.round(available * (input.focalPointY / 100)),
    width: input.width,
    height,
  };
}

async function uploadOptimizedArticleImage(input: {
  buffer: Buffer;
  filename: string;
  folder: string;
  focalPointX: number;
  focalPointY: number;
}) {
  const normalized = await sharp(input.buffer).rotate().toBuffer();
  const metadata = await sharp(normalized).metadata();
  const width = metadata.width || 0;
  const height = metadata.height || 0;
  if (!width || !height) throw new Error('Could not read image dimensions');

  const primaryBuffer = await sharp(normalized)
    .resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 88, effort: 4 })
    .toBuffer();
  const avifBuffer = await sharp(normalized)
    .resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true })
    .avif({ quality: 64, effort: 4 })
    .toBuffer();

  const cropSpecs = [
    { key: 'landscape16x9' as const, suffix: '16x9', width: 1600, height: 900 },
    { key: 'standard4x3' as const, suffix: '4x3', width: 1200, height: 900 },
    { key: 'square1x1' as const, suffix: '1x1', width: 1080, height: 1080 },
  ];
  const cropUploads = await Promise.all(
    cropSpecs.map(async (spec) => {
      const crop = resolveFocalCrop({
        width,
        height,
        targetAspect: spec.width / spec.height,
        focalPointX: input.focalPointX,
        focalPointY: input.focalPointY,
      });
      const buffer = await sharp(normalized)
        .extract(crop)
        .resize(spec.width, spec.height)
        .webp({ quality: 86, effort: 4 })
        .toBuffer();
      const uploaded = await uploadBufferToDigitalOceanSpaces(buffer, {
        folder: input.folder,
        resourceType: 'image',
        originalFilename: replaceImageExtension(input.filename, spec.suffix, 'webp'),
      });
      return [spec.key, uploaded.secureUrl] as const;
    })
  );
  const [primary, avif] = await Promise.all([
    uploadBufferToDigitalOceanSpaces(primaryBuffer, {
      folder: input.folder,
      resourceType: 'image',
      originalFilename: replaceImageExtension(input.filename, 'optimized', 'webp'),
    }),
    uploadBufferToDigitalOceanSpaces(avifBuffer, {
      folder: input.folder,
      resourceType: 'image',
      originalFilename: replaceImageExtension(input.filename, 'optimized', 'avif'),
    }),
  ]);

  return {
    primary,
    width,
    height,
    variants: {
      ...Object.fromEntries(cropUploads),
      webp: primary.secureUrl,
      avif: avif.secureUrl,
    },
  };
}


export async function POST(req: NextRequest) {
  try {
    // Read form data FIRST before any other async operations that might touch the request
    // This is the most reliable way to avoid "Response body object should not be disturbed or locked" in Next.js 15
    let formData: FormData;
    try {
      formData = await readUploadFormData(req);
    } catch (error) {
      console.error('Failed to read upload form data:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to process request body' },
        { status: 400 }
      );
    }

    const user = await getAdminSessionFromReq(req);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const file = formData.get('file');
    const purpose = parseUploadPurpose(formData.get('purpose'));

    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 });
    }

    if (!canUseUploadPurpose(user.role, purpose)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Reporters can only upload image assets from this workspace.',
        },
        { status: 403 }
      );
    }

    const rule = getUploadRule(purpose);
    if (!rule.isAllowed(file)) {
      return NextResponse.json({ success: false, error: rule.errorType }, { status: 400 });
    }
    if (file.size > rule.maxSizeBytes) {
      return NextResponse.json({ success: false, error: rule.errorSize }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const optimizeArticleImage =
      purpose === 'image' && formData.get('optimizeArticleImage') === 'true';
    if (optimizeArticleImage) {
      const optimized = await uploadOptimizedArticleImage({
        buffer,
        filename: file.name || 'article-image',
        folder: rule.folder,
        focalPointX: parseFocalPoint(formData.get('focalPointX')),
        focalPointY: parseFocalPoint(formData.get('focalPointY')),
      });
      return NextResponse.json(
        {
          success: true,
          message: 'Article image optimized and uploaded successfully',
          data: {
            url: optimized.primary.secureUrl,
            secureUrl: optimized.primary.secureUrl,
            publicId: optimized.primary.publicId,
            resourceType: optimized.primary.resourceType,
            storageProvider: 'do-spaces',
            filename: replaceImageExtension(file.name, 'optimized', 'webp'),
            size: optimized.primary.bytes,
            type: 'image/webp',
            width: optimized.width,
            height: optimized.height,
            format: 'webp',
            variants: optimized.variants,
          },
        },
        { status: 201 }
      );
    }
    const uploaded = await uploadBufferToDigitalOceanSpaces(buffer, {
      folder: rule.folder,
      resourceType: rule.resourceType,
      originalFilename: file.name || undefined,
    });

    return NextResponse.json(
      {
        success: true,
        message: 'File uploaded successfully',
        data: {
          url: uploaded.secureUrl,
          secureUrl: uploaded.secureUrl,
          publicId: uploaded.publicId,
          resourceType: uploaded.resourceType,
          storageProvider: 'do-spaces',
          filename: file.name,
          size: uploaded.bytes || file.size,
          type: file.type,
        },
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    const name = error instanceof Error ? error.name : 'Error';
    console.error('CRITICAL: Upload handler failed:', {
      message,
      stack,
      name
    });
    return NextResponse.json(
      { success: false, error: 'Failed to upload file' },
      { status: 500 }
    );
  }
}
