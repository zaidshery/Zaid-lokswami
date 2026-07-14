export type BreakingTtsUploadedAsset = {
  mediaUrl: string;
  mediaKey: string;
  mediaSizeBytes: number;
  mediaMimeType: string;
  storageProvider: 'do-spaces';
};

export type DirectBreakingTtsUploadResult = {
  asset: BreakingTtsUploadedAsset;
  ttsAsset?: unknown;
  breakingTts?: unknown;
  script?: string;
  version: number;
  updatedAt: string;
};

type UploadOptions = {
  articleId: string;
  file: File;
  expectedVersion: number;
  authHeaders?: Record<string, string>;
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
  data?: DirectBreakingTtsUploadResult;
};

const DIRECT_UPLOAD_CORS_HELP =
  'Direct breaking audio upload to DigitalOcean Spaces was blocked. Add this admin site origin to the Spaces CORS rules and allow PUT, GET, HEAD, and OPTIONS with the Content-Type and x-amz-acl headers.';

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
      reject(new Error('Breaking audio upload was cancelled.'));
    });

    request.send(options.file);
  });
}

export async function uploadBreakingTtsAudioDirect(options: UploadOptions) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.authHeaders || {}),
  };

  const initResponse = await fetch('/api/admin/uploads/breaking-tts/init', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      articleId: options.articleId,
      fileName: options.file.name,
      fileType: options.file.type,
      fileSize: options.file.size,
    }),
  });
  const initPayload = (await initResponse.json().catch(() => ({}))) as UploadTargetResponse;
  const target = initPayload.data;

  if (!initResponse.ok || !initPayload.success || !target?.uploadUrl || !target.mediaKey) {
    throw new Error(initPayload.error || 'Failed to initialize breaking audio upload.');
  }

  await uploadFileToSignedUrl({
    file: options.file,
    uploadUrl: target.uploadUrl,
    uploadHeaders: target.uploadHeaders || {
      'Content-Type': options.file.type || 'application/octet-stream',
    },
  });

  const completeResponse = await fetch('/api/admin/uploads/breaking-tts/complete', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      articleId: options.articleId,
      mediaKey: target.mediaKey,
      expectedVersion: options.expectedVersion,
      expectedSize: options.file.size,
      expectedFileType: options.file.type,
      expectedFileName: options.file.name,
    }),
  });
  const completePayload = (await completeResponse.json().catch(() => ({}))) as UploadCompleteResponse;

  if (!completeResponse.ok || !completePayload.success || !completePayload.data?.asset) {
    throw new Error(completePayload.error || 'Failed to verify breaking audio upload.');
  }

  return completePayload.data;
}
