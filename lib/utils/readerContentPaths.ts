export function buildStoryReaderPath(storyId?: string) {
  const normalizedId = String(storyId || '').trim();
  if (!normalizedId) return '/main/stories';

  return `/main/stories?story=${encodeURIComponent(normalizedId)}`;
}

export function buildVideoReaderPath(videoId?: string) {
  const normalizedId = String(videoId || '').trim();
  if (!normalizedId) return '/main/videos';

  return `/main/videos?video=${encodeURIComponent(normalizedId)}`;
}
