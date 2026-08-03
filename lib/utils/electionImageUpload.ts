import { getAuthHeader } from '@/lib/auth/clientToken';

type UploadPayload = {
  success?: boolean;
  error?: string;
  data?: { url?: string; secureUrl?: string };
};

const MAX_ELECTION_IMAGE_BYTES = 5 * 1024 * 1024;
const ELECTION_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export async function uploadElectionImage(file: File) {
  if (!ELECTION_IMAGE_TYPES.has(file.type.toLowerCase())) {
    throw new Error('Choose a JPG, PNG, or WEBP image.');
  }
  if (file.size > MAX_ELECTION_IMAGE_BYTES) {
    throw new Error('Image must be 5MB or smaller.');
  }

  const body = new FormData();
  body.append('file', file);
  body.append('purpose', 'image');

  const response = await fetch('/api/admin/upload', {
    method: 'POST',
    headers: { ...getAuthHeader() },
    body,
  });
  const payload = (await response.json().catch(() => ({}))) as UploadPayload;
  if (!response.ok || !payload.success) {
    throw new Error(payload.error || 'Election image upload failed.');
  }

  const url = String(payload.data?.secureUrl || payload.data?.url || '').trim();
  if (!url) throw new Error('Election image upload returned no image path.');
  return url;
}
