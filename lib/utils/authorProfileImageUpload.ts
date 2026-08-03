import { getAuthHeader } from '@/lib/auth/clientToken';

type UploadResponse = {
  success?: boolean;
  error?: string;
  data?: {
    url?: string;
    secureUrl?: string;
  };
};

export async function uploadAuthorProfileImage(file: File) {
  if (!file.type.startsWith('image/')) {
    throw new Error('Choose an image file for the profile photo.');
  }

  const body = new FormData();
  body.append('file', file);
  body.append('purpose', 'image');

  const response = await fetch('/api/admin/upload', {
    method: 'POST',
    headers: { ...getAuthHeader() },
    body,
  });
  const payload = (await response.json().catch(() => ({}))) as UploadResponse;
  if (!response.ok || !payload.success) {
    throw new Error(payload.error || 'Failed to upload profile photo');
  }

  const url = String(payload.data?.secureUrl || payload.data?.url || '').trim();
  if (!url) {
    throw new Error('Profile photo upload returned no image path.');
  }

  return url;
}
