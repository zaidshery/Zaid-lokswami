import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminToken } from '@/lib/auth/adminToken';
import { uploadBufferToCloudinary } from '@/lib/utils/cloudinary';

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
  resourceType: 'image' | 'raw';
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
      errorType: 'Video thumbnail must be JPG, JPEG, PNG, or WEBP',
      errorSize: 'Video thumbnail size must be less than 10MB',
      folder: 'lokswami/videos/thumbnails',
      resourceType: 'image',
      isAllowed: isImage,
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

export async function POST(req: NextRequest) {
  try {
    const user = verifyAdminToken(req);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file');
    const purpose = parseUploadPurpose(formData.get('purpose'));

    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 });
    }

    const rule = getUploadRule(purpose);
    if (!rule.isAllowed(file)) {
      return NextResponse.json({ success: false, error: rule.errorType }, { status: 400 });
    }
    if (file.size > rule.maxSizeBytes) {
      return NextResponse.json({ success: false, error: rule.errorSize }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const uploaded = await uploadBufferToCloudinary(buffer, {
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
          filename: file.name,
          size: uploaded.bytes || file.size,
          type: file.type,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error uploading file:', error);
    return NextResponse.json({ success: false, error: 'Failed to upload file' }, { status: 500 });
  }
}
