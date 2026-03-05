import { v2 as cloudinary, type UploadApiOptions, type UploadApiResponse } from 'cloudinary';

type CloudinaryResourceType = 'image' | 'video' | 'raw' | 'auto';

type UploadBufferOptions = {
  folder?: string;
  publicId?: string;
  resourceType?: CloudinaryResourceType;
  overwrite?: boolean;
  originalFilename?: string;
};

export type UploadedCloudinaryAsset = {
  secureUrl: string;
  url: string;
  publicId: string;
  resourceType: string;
  bytes: number;
  width?: number;
  height?: number;
  format?: string;
};

type ParsedCloudinaryAsset = {
  publicId: string;
  resourceType: Exclude<CloudinaryResourceType, 'auto'>;
};

type SignedRawUploadUrlOptions = {
  publicId: string;
  format?: string;
};

let cloudinaryConfigured = false;

function ensureCloudinaryConfigured() {
  if (cloudinaryConfigured) return;

  const cloudName = String(process.env.CLOUDINARY_CLOUD_NAME || '').trim();
  const apiKey = String(process.env.CLOUDINARY_API_KEY || '').trim();
  const apiSecret = String(process.env.CLOUDINARY_API_SECRET || '').trim();

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error('Cloudinary environment variables are missing');
  }

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  });

  cloudinaryConfigured = true;
}

function normalizeFolder(input: string) {
  return input
    .replace(/\\/g, '/')
    .trim()
    .replace(/^\/+|\/+$/g, '')
    .replace(/\/{2,}/g, '/');
}

function normalizePublicId(input: string) {
  return input
    .replace(/\\/g, '/')
    .trim()
    .replace(/^\/+|\/+$/g, '')
    .replace(/\/{2,}/g, '/');
}

function toUploadedAsset(result: UploadApiResponse): UploadedCloudinaryAsset {
  return {
    secureUrl: String(result.secure_url || ''),
    url: String(result.url || ''),
    publicId: String(result.public_id || ''),
    resourceType: String(result.resource_type || ''),
    bytes: Number(result.bytes || 0),
    width: Number.isFinite(Number(result.width)) ? Number(result.width) : undefined,
    height: Number.isFinite(Number(result.height)) ? Number(result.height) : undefined,
    format: typeof result.format === 'string' ? result.format : undefined,
  };
}

export async function uploadBufferToCloudinary(
  buffer: Buffer,
  options: UploadBufferOptions = {}
): Promise<UploadedCloudinaryAsset> {
  if (!buffer.length) {
    throw new Error('Upload buffer is empty');
  }

  ensureCloudinaryConfigured();

  const uploadOptions: UploadApiOptions = {
    resource_type: options.resourceType || 'auto',
    overwrite: options.overwrite ?? false,
    invalidate: true,
  };

  if (options.folder) {
    const folder = normalizeFolder(options.folder);
    if (!folder) {
      throw new Error('Invalid Cloudinary folder');
    }
    uploadOptions.folder = folder;
  }

  if (options.publicId) {
    const publicId = normalizePublicId(options.publicId);
    if (!publicId) {
      throw new Error('Invalid Cloudinary public ID');
    }
    uploadOptions.public_id = publicId;
    uploadOptions.unique_filename = false;
  } else {
    uploadOptions.unique_filename = true;
  }

  if (options.originalFilename) {
    uploadOptions.filename_override = options.originalFilename.trim();
    uploadOptions.use_filename = true;
  }

  return new Promise<UploadedCloudinaryAsset>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(uploadOptions, (error, result) => {
      if (error) {
        reject(error);
        return;
      }
      if (!result) {
        reject(new Error('Cloudinary upload failed'));
        return;
      }
      resolve(toUploadedAsset(result));
    });

    stream.end(buffer);
  });
}

export async function deleteCloudinaryAssetByPublicId(
  publicId: string,
  resourceType: Exclude<CloudinaryResourceType, 'auto'> = 'image'
) {
  const normalized = normalizePublicId(publicId);
  if (!normalized) return;

  ensureCloudinaryConfigured();
  await cloudinary.uploader.destroy(normalized, {
    resource_type: resourceType,
    invalidate: true,
  });
}

export function parseCloudinaryAssetFromUrl(value: string): ParsedCloudinaryAsset | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }

  if (!parsed.hostname.endsWith('res.cloudinary.com')) {
    return null;
  }

  const match = parsed.pathname.match(/\/(image|video|raw)\/upload\/(?:v\d+\/)?(.+)$/);
  if (!match) {
    return null;
  }

  const resourceType = match[1] as ParsedCloudinaryAsset['resourceType'];
  const rawId = decodeURIComponent(match[2] || '').replace(/^\/+|\/+$/g, '');
  if (!rawId) {
    return null;
  }

  const publicId = rawId.replace(/\.[^/.]+$/, '');
  if (!publicId) {
    return null;
  }

  return {
    publicId,
    resourceType,
  };
}

export async function deleteCloudinaryAssetByUrl(value: string) {
  const parsed = parseCloudinaryAssetFromUrl(value);
  if (!parsed) return;
  await deleteCloudinaryAssetByPublicId(parsed.publicId, parsed.resourceType);
}

function normalizeDeliveryFormat(value: string) {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return '';
  return trimmed.replace(/[^a-z0-9]/g, '');
}

export function buildSignedCloudinaryRawUploadUrl(options: SignedRawUploadUrlOptions) {
  const publicId = normalizePublicId(options.publicId || '');
  if (!publicId) {
    throw new Error('Invalid Cloudinary public ID');
  }

  const format = normalizeDeliveryFormat(options.format || '');
  ensureCloudinaryConfigured();

  return cloudinary.url(publicId, {
    resource_type: 'raw',
    type: 'upload',
    sign_url: true,
    secure: true,
    ...(format ? { format } : {}),
  });
}
