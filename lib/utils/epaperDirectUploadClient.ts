export type EpaperAssetKind =
  | 'epaper_pdf'
  | 'epaper_thumbnail'
  | 'epaper_page_image'
  | 'epaper_story_audio';

export type EpaperUploadedAsset = {
  kind: EpaperAssetKind;
  mediaUrl: string;
  mediaKey: string;
  mediaSizeBytes: number;
  mediaMimeType: string;
  storageProvider: 'do-spaces';
};

export type DirectEpaperUploadResult = {
  asset: EpaperUploadedAsset;
  ttsAsset?: unknown;
};

type UploadOptions = {
  kind: EpaperAssetKind;
  file: File;
  authHeaders?: Record<string, string>;
  citySlug?: string;
  publishDate?: string;
  pageNumber?: number;
  epaperId?: string;
  articleId?: string;
};

type UploadTargetResponse = {
  success?: boolean;
  error?: string;
  data?: {
    mediaKey?: string;
    uploadUrl?: string;
    uploadHeaders?: Record<string, string>;
  };
};

type UploadCompleteResponse = {
  success?: boolean;
  error?: string;
  data?: DirectEpaperUploadResult;
};

const DIRECT_UPLOAD_CORS_HELP =
  'Direct e-paper upload to DigitalOcean Spaces was blocked. Add this admin site origin to the Spaces CORS rules and allow PUT, GET, and HEAD with the Content-Type header.';

export async function getImageDimensionsFromFile(file: File) {
  if (typeof window === 'undefined') return null;

  return new Promise<{ width: number; height: number } | null>((resolve) => {
    const url = window.URL.createObjectURL(file);
    const image = new window.Image();
    image.onload = () => {
      const width = Number(image.naturalWidth || image.width || 0);
      const height = Number(image.naturalHeight || image.height || 0);
      window.URL.revokeObjectURL(url);
      resolve(width > 0 && height > 0 ? { width, height } : null);
    };
    image.onerror = () => {
      window.URL.revokeObjectURL(url);
      resolve(null);
    };
    image.src = url;
  });
}

function uploadFileToSignedUrl(options: {
  file: File;
  uploadUrl: string;
  uploadHeaders?: Record<string, string>;
}) {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('PUT', options.uploadUrl);

    Object.entries(options.uploadHeaders || {}).forEach(([key, value]) => {
      request.setRequestHeader(key, value);
    });

    request.addEventListener('load', () => {
      if (request.status >= 200 && request.status < 300) {
        resolve();
        return;
      }

      if (request.status === 0) {
        reject(new Error(DIRECT_UPLOAD_CORS_HELP));
        return;
      }

      const detail = String(request.responseText || '').trim();
      reject(
        new Error(
          detail
            ? `DigitalOcean upload failed (${request.status}): ${detail.slice(0, 180)}`
            : `DigitalOcean upload failed (${request.status}).`
        )
      );
    });

    request.addEventListener('error', () => {
      reject(new Error(DIRECT_UPLOAD_CORS_HELP));
    });

    request.addEventListener('abort', () => {
      reject(new Error('E-paper asset upload was cancelled.'));
    });

    request.send(options.file);
  });
}

export async function uploadEpaperAssetDirect(options: UploadOptions) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.authHeaders || {}),
  };

  const initResponse = await fetch('/api/admin/uploads/epaper-asset/init', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      kind: options.kind,
      fileName: options.file.name,
      fileType: options.file.type,
      fileSize: options.file.size,
      citySlug: options.citySlug,
      publishDate: options.publishDate,
      pageNumber: options.pageNumber,
      articleId: options.articleId,
    }),
  });
  const initPayload = (await initResponse.json().catch(() => ({}))) as UploadTargetResponse;
  const target = initPayload.data;

  if (!initResponse.ok || !initPayload.success || !target?.uploadUrl || !target.mediaKey) {
    throw new Error(initPayload.error || 'Failed to initialize e-paper asset upload.');
  }

  await uploadFileToSignedUrl({
    file: options.file,
    uploadUrl: target.uploadUrl,
    uploadHeaders: target.uploadHeaders || {
      'Content-Type': options.file.type || 'application/octet-stream',
    },
  });

  const completeResponse = await fetch('/api/admin/uploads/epaper-asset/complete', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      kind: options.kind,
      mediaKey: target.mediaKey,
      expectedSize: options.file.size,
      expectedFileType: options.file.type,
      expectedFileName: options.file.name,
      epaperId: options.epaperId,
      articleId: options.articleId,
    }),
  });
  const completePayload = (await completeResponse.json().catch(() => ({}))) as UploadCompleteResponse;

  if (!completeResponse.ok || !completePayload.success || !completePayload.data?.asset) {
    throw new Error(completePayload.error || 'Failed to verify e-paper asset upload.');
  }

  return completePayload.data;
}
