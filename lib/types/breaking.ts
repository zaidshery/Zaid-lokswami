export type BreakingNewsItem = {
  id: string;
  title: string;
  city?: string;
  category?: string;
  createdAt?: string;
  href?: string;
  priority?: number;
};

export function normalizeBreakingNewsItem(source: unknown): BreakingNewsItem | null {
  if (!source || typeof source !== 'object') return null;
  const item = source as Record<string, unknown>;

  const id = String(item.id ?? item._id ?? '').trim();
  const title = String(item.title ?? '').trim();
  if (!id || !title) return null;

  const city = typeof item.city === 'string' ? item.city.trim() : '';
  const category = typeof item.category === 'string' ? item.category.trim() : '';
  const createdAt = typeof item.createdAt === 'string' ? item.createdAt.trim() : '';
  const href = typeof item.href === 'string' ? item.href.trim() : '';
  const priorityRaw = Number(item.priority);

  return {
    id,
    title,
    city: city || undefined,
    category: category || undefined,
    createdAt: createdAt || undefined,
    href: href || undefined,
    priority: Number.isFinite(priorityRaw) ? priorityRaw : undefined,
  };
}

export function sortBreakingNewsItems(items: BreakingNewsItem[]) {
  return [...items].sort((a, b) => {
    const ap = Number.isFinite(a.priority) ? Number(a.priority) : 0;
    const bp = Number.isFinite(b.priority) ? Number(b.priority) : 0;
    if (bp !== ap) return bp - ap;

    const at = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return bt - at;
  });
}
