import type { VisualStory } from '@/lib/content/visualStories';
import { mapLiveStoriesToVisualStories } from '@/lib/content/visualStories';

type ApiStoryResponse = {
  success?: boolean;
  data?: unknown;
};

export async function fetchLiveStories(limit = 20): Promise<VisualStory[]> {
  try {
    const res = await fetch(`/api/stories/latest?limit=${limit}`);
    if (!res.ok) return [];

    const payload = (await res.json()) as ApiStoryResponse;
    const rows =
      payload && Array.isArray((payload as { items?: unknown }).items)
        ? (payload as { items: unknown[] }).items
        : Array.isArray(payload?.data)
          ? payload.data
          : [];
    return mapLiveStoriesToVisualStories(
      rows as Parameters<typeof mapLiveStoriesToVisualStories>[0],
      limit
    );
  } catch {
    return [];
  }
}
