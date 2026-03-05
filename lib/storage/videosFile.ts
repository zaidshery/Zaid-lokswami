import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

export interface StoredVideo {
  _id: string;
  title: string;
  description: string;
  thumbnail: string;
  videoUrl: string;
  duration: number;
  category: string;
  isShort: boolean;
  isPublished: boolean;
  shortsRank: number;
  views: number;
  createdAt: string;
  publishedAt: string;
  updatedAt: string;
}

export interface CreateVideoInput {
  title: string;
  description: string;
  thumbnail: string;
  videoUrl: string;
  duration: number;
  category: string;
  isShort?: boolean;
  isPublished?: boolean;
  shortsRank?: number;
  views?: number;
  createdAt?: string;
  publishedAt?: string;
}

const dataDir = path.resolve(process.cwd(), 'data');
const dataPath = path.join(dataDir, 'videos.json');

async function readAllVideos(): Promise<StoredVideo[]> {
  try {
    const raw = await fs.readFile(dataPath, 'utf-8');
    const parsed = JSON.parse(raw || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeAllVideos(videos: StoredVideo[]) {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(dataPath, JSON.stringify(videos, null, 2), 'utf-8');
}

export async function listStoredVideos(params: {
  category?: string | null;
  type?: string | null;
  published?: boolean;
  search?: string;
  sort?: string | null;
  limit: number;
  page: number;
}) {
  const { category, type, published, search, sort, limit, page } = params;
  const all = await readAllVideos();

  let filtered = all;

  if (category && category !== 'all') {
    filtered = filtered.filter((item) => item.category === category);
  }

  if (type === 'shorts') {
    filtered = filtered.filter((item) => item.isShort);
  } else if (type === 'standard') {
    filtered = filtered.filter((item) => !item.isShort);
  }

  if (typeof published === 'boolean') {
    filtered = filtered.filter((item) => item.isPublished === published);
  }

  const normalizedSearch = (search || '').trim().toLowerCase();
  if (normalizedSearch) {
    filtered = filtered.filter(
      (item) =>
        item.title.toLowerCase().includes(normalizedSearch) ||
        item.description.toLowerCase().includes(normalizedSearch)
    );
  }

  if (sort === 'trending') {
    filtered.sort(
      (a, b) =>
        b.views - a.views ||
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );
  } else if (sort === 'shorts' || type === 'shorts') {
    filtered.sort(
      (a, b) =>
        b.shortsRank - a.shortsRank ||
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

export async function listAllStoredVideos() {
  const all = await readAllVideos();
  return all.map((item) => ({
    ...item,
    createdAt: item.createdAt || item.publishedAt || new Date().toISOString(),
  }));
}

export async function getStoredVideoById(id: string) {
  const all = await readAllVideos();
  return all.find((item) => item._id === id) || null;
}

export async function createStoredVideo(input: CreateVideoInput) {
  const now = new Date().toISOString();
  const all = await readAllVideos();

  const video: StoredVideo = {
    _id:
      typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    title: input.title,
    description: input.description,
    thumbnail: input.thumbnail,
    videoUrl: input.videoUrl,
    duration: input.duration,
    category: input.category,
    isShort: Boolean(input.isShort),
    isPublished: input.isPublished === false ? false : true,
    shortsRank: Number.isFinite(input.shortsRank) ? Number(input.shortsRank) : 0,
    views: Number.isFinite(input.views) ? Number(input.views) : 0,
    createdAt: input.createdAt || input.publishedAt || now,
    publishedAt: input.publishedAt || now,
    updatedAt: now,
  };

  all.push(video);
  await writeAllVideos(all);
  return video;
}

export async function updateStoredVideo(
  id: string,
  updates: Partial<CreateVideoInput> & {
    publishedAt?: string;
    updatedAt?: string;
  }
) {
  const all = await readAllVideos();
  const index = all.findIndex((item) => item._id === id);
  if (index === -1) return null;

  const current = all[index];
  const next: StoredVideo = {
    ...current,
    ...updates,
    isShort:
      updates.isShort !== undefined ? Boolean(updates.isShort) : current.isShort,
    isPublished:
      updates.isPublished !== undefined
        ? Boolean(updates.isPublished)
        : current.isPublished,
    shortsRank:
      updates.shortsRank !== undefined && Number.isFinite(updates.shortsRank)
        ? Number(updates.shortsRank)
        : current.shortsRank,
    views:
      updates.views !== undefined && Number.isFinite(updates.views)
        ? Number(updates.views)
        : current.views,
    updatedAt: new Date().toISOString(),
  };

  all[index] = next;
  await writeAllVideos(all);
  return next;
}

export async function deleteStoredVideo(id: string) {
  const all = await readAllVideos();
  const index = all.findIndex((item) => item._id === id);
  if (index === -1) return false;

  all.splice(index, 1);
  await writeAllVideos(all);
  return true;
}
