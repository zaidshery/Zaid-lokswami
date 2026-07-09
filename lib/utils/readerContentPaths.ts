export function buildVideoReaderPath(videoId?: string) {
  const normalizedId = String(videoId || '').trim();
  if (!normalizedId) return '/main/videos';

  return `/main/videos?video=${encodeURIComponent(normalizedId)}`;
}
