import { Types } from 'mongoose';
import { getCitySlugFromName } from '@/lib/constants/epaperCities';
import { isMongoAvailable } from '@/lib/db/mongoAvailability';
import EPaper from '@/lib/models/EPaper';
import {
  getStoredEPaperById,
  listAllStoredEPapers,
  type StoredEPaper,
} from '@/lib/storage/epapersFile';
import { resolveEpaperCoverImagePath } from '@/lib/utils/epaperCover';

export type PublicEpaperMetadata = {
  id: string;
  citySlug: string;
  cityName: string;
  title: string;
  publishDate: string;
  thumbnailPath: string;
  pageCount: number;
};

type PublicEpaperMetadataQuery = {
  id?: string;
  citySlug?: string;
  publishDate?: string;
};

function asObject(value: unknown) {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

function firstNonEmptyString(...values: unknown[]) {
  for (const value of values) {
    const text = String(value || '').trim();
    if (text) return text;
  }
  return '';
}

function toDateLabel(value: unknown) {
  const parsed = new Date(
    value instanceof Date || typeof value === 'string' || typeof value === 'number'
      ? value
      : ''
  );
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(0, 10);
}

function toPositiveInt(value: unknown, fallback = 1) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function normalizePages(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => asObject(entry))
    .map((entry) => ({
      pageNumber: toPositiveInt(entry.pageNumber, 0),
      imagePath: String(entry.imagePath || '').trim(),
    }))
    .filter((entry) => entry.pageNumber > 0);
}

function mapMongoEpaper(input: unknown): PublicEpaperMetadata | null {
  const source = asObject(input);
  const id = firstNonEmptyString(source._id, source.id);
  if (!id) return null;

  const pages = normalizePages(source.pages);
  const publishDate = toDateLabel(source.publishDate);

  return {
    id,
    citySlug: String(source.citySlug || '').trim().toLowerCase(),
    cityName: String(source.cityName || '').trim(),
    title: String(source.title || '').trim(),
    publishDate,
    thumbnailPath: resolveEpaperCoverImagePath({
      thumbnailPath: source.thumbnailPath,
      thumbnail: source.thumbnail,
      pages,
    }),
    pageCount: Math.max(toPositiveInt(source.pageCount), pages.length, 1),
  };
}

function mapStoredEpaper(input: StoredEPaper): PublicEpaperMetadata {
  return {
    id: String(input._id || '').trim(),
    citySlug: getCitySlugFromName(input.city),
    cityName: String(input.city || '').trim(),
    title: String(input.title || '').trim(),
    publishDate: String(input.publishDate || '').trim() || toDateLabel(input.publishedAt),
    thumbnailPath: firstNonEmptyString(
      (input as unknown as Record<string, unknown>).thumbnailPath,
      input.thumbnail
    ),
    pageCount: Math.max(toPositiveInt(input.pages), 1),
  };
}

function getDateRange(dateLabel: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateLabel)) return null;
  const start = new Date(`${dateLabel}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime())) return null;
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { $gte: start, $lt: end };
}

async function getMongoEpaperMetadata(query: PublicEpaperMetadataQuery) {
  if (!(await isMongoAvailable({ label: 'public e-paper metadata lookup' }))) {
    return null;
  }

  try {
    if (query.id?.trim()) {
      if (!Types.ObjectId.isValid(query.id)) return null;
      const record = await EPaper.findOne({ _id: query.id, status: 'published' })
        .select('_id citySlug cityName title publishDate thumbnailPath thumbnail pageCount pages')
        .lean();
      return mapMongoEpaper(record);
    }

    const mongoQuery: Record<string, unknown> = { status: 'published' };
    if (query.citySlug?.trim()) mongoQuery.citySlug = query.citySlug.trim().toLowerCase();
    const dateRange = query.publishDate ? getDateRange(query.publishDate) : null;
    if (dateRange) mongoQuery.publishDate = dateRange;

    const record = await EPaper.findOne(mongoQuery)
      .select('_id citySlug cityName title publishDate thumbnailPath thumbnail pageCount pages')
      .sort({ publishDate: -1, _id: -1 })
      .lean();
    return mapMongoEpaper(record);
  } catch (error) {
    console.error('Failed to load public e-paper metadata from MongoDB, falling back.', error);
    return null;
  }
}

async function getStoredEpaperMetadata(query: PublicEpaperMetadataQuery) {
  if (query.id?.trim()) {
    const record = await getStoredEPaperById(query.id.trim());
    return record ? mapStoredEpaper(record) : null;
  }

  const records = await listAllStoredEPapers();
  const filtered = records
    .filter((item) => {
      const mapped = mapStoredEpaper(item);
      if (query.citySlug?.trim() && mapped.citySlug !== query.citySlug.trim().toLowerCase()) {
        return false;
      }
      if (query.publishDate?.trim() && mapped.publishDate !== query.publishDate.trim()) {
        return false;
      }
      return true;
    })
    .sort((left, right) => right.publishDate.localeCompare(left.publishDate));

  return filtered[0] ? mapStoredEpaper(filtered[0]) : null;
}

export async function getPublicEpaperForMetadata(query: PublicEpaperMetadataQuery) {
  const normalizedQuery = {
    id: query.id?.trim() || '',
    citySlug: query.citySlug?.trim().toLowerCase() || '',
    publishDate: query.publishDate?.trim() || '',
  };

  const mongoRecord = await getMongoEpaperMetadata(normalizedQuery);
  if (mongoRecord) return mongoRecord;

  return getStoredEpaperMetadata(normalizedQuery);
}
