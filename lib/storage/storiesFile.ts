import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

export interface StoredStory {
  _id: string;
  title: string;
  caption: string;
  thumbnail: string;
  mediaType: 'image' | 'video';
  mediaUrl: string;
  linkUrl: string;
  linkLabel: string;
  category: string;
  author: string;
  durationSeconds: number;
  priority: number;
  views: number;
  isPublished: boolean;
  publishedAt: string;
  updatedAt: string;
}

export interface CreateStoryInput {
  title: string;
  caption?: string;
  thumbnail: string;
  mediaType?: 'image' | 'video';
  mediaUrl?: string;
  linkUrl?: string;
  linkLabel?: string;
  category?: string;
  author?: string;
  durationSeconds?: number;
  priority?: number;
  views?: number;
  isPublished?: boolean;
  publishedAt?: string;
}

const dataDir = path.resolve(process.cwd(), 'data');
const dataPath = path.join(dataDir, 'stories.json');

async function readAllStories(): Promise<StoredStory[]> {
  try {
    const raw = await fs.readFile(dataPath, 'utf-8');
    const parsed = JSON.parse(raw || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeAllStories(stories: StoredStory[]) {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(dataPath, JSON.stringify(stories, null, 2), 'utf-8');
}

export async function listStoredStories(params: {
  category?: string | null;
  published?: boolean;
  search?: string;
  sort?: string | null;
  limit: number;
  page: number;
}) {
  const { category, published, search, sort, limit, page } = params;
  const all = await readAllStories();
  let filtered = all;

  if (category && category !== 'all') {
    filtered = filtered.filter((item) => item.category === category);
  }

  if (typeof published === 'boolean') {
    filtered = filtered.filter((item) => item.isPublished === published);
  }

  const normalizedSearch = (search || '').trim().toLowerCase();
  if (normalizedSearch) {
    filtered = filtered.filter(
      (item) =>
        item.title.toLowerCase().includes(normalizedSearch) ||
        item.caption.toLowerCase().includes(normalizedSearch) ||
        item.category.toLowerCase().includes(normalizedSearch)
    );
  }

  if (sort === 'priority') {
    filtered.sort(
      (a, b) =>
        b.priority - a.priority ||
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );
  } else if (sort === 'trending') {
    filtered.sort(
      (a, b) =>
        b.views - a.views ||
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );
  } else {
    filtered.sort(
      (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );
  }

  const start = (page - 1) * limit;
  const data = filtered.slice(start, start + limit);
  return { data, total: filtered.length };
}

export async function listAllStoredStories() {
  return readAllStories();
}

export async function getStoredStoryById(id: string) {
  const all = await readAllStories();
  return all.find((item) => item._id === id) || null;
}

function toBoundedDuration(value: number | undefined) {
  if (!Number.isFinite(value)) return 6;
  return Math.max(2, Math.min(180, Number(value)));
}

export async function createStoredStory(input: CreateStoryInput) {
  const now = new Date().toISOString();
  const all = await readAllStories();

  const story: StoredStory = {
    _id:
      typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    title: input.title,
    caption: input.caption || '',
    thumbnail: input.thumbnail,
    mediaType: input.mediaType === 'video' ? 'video' : 'image',
    mediaUrl: input.mediaUrl || '',
    linkUrl: input.linkUrl || '',
    linkLabel: input.linkLabel || '',
    category: input.category || 'General',
    author: input.author || 'Desk',
    durationSeconds: toBoundedDuration(input.durationSeconds),
    priority: Number.isFinite(input.priority) ? Number(input.priority) : 0,
    views: Number.isFinite(input.views) ? Number(input.views) : 0,
    isPublished: input.isPublished === false ? false : true,
    publishedAt: input.publishedAt || now,
    updatedAt: now,
  };

  all.push(story);
  await writeAllStories(all);
  return story;
}

export async function updateStoredStory(
  id: string,
  updates: Partial<CreateStoryInput> & {
    durationSeconds?: number;
    priority?: number;
    views?: number;
    publishedAt?: string;
  }
) {
  const all = await readAllStories();
  const index = all.findIndex((item) => item._id === id);
  if (index === -1) return null;

  const current = all[index];
  const next: StoredStory = {
    ...current,
    ...updates,
    mediaType: updates.mediaType === 'video' ? 'video' : updates.mediaType === 'image' ? 'image' : current.mediaType,
    durationSeconds:
      updates.durationSeconds !== undefined
        ? toBoundedDuration(updates.durationSeconds)
        : current.durationSeconds,
    priority:
      updates.priority !== undefined && Number.isFinite(updates.priority)
        ? Number(updates.priority)
        : current.priority,
    views:
      updates.views !== undefined && Number.isFinite(updates.views)
        ? Number(updates.views)
        : current.views,
    isPublished:
      updates.isPublished !== undefined
        ? Boolean(updates.isPublished)
        : current.isPublished,
    updatedAt: new Date().toISOString(),
  };

  all[index] = next;
  await writeAllStories(all);
  return next;
}

export async function deleteStoredStory(id: string) {
  const all = await readAllStories();
  const index = all.findIndex((item) => item._id === id);
  if (index === -1) return false;

  all.splice(index, 1);
  await writeAllStories(all);
  return true;
}
