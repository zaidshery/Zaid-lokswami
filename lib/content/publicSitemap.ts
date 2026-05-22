import { getCitySlugFromName } from '@/lib/constants/epaperCities';
import { isMongoAvailable } from '@/lib/db/mongoAvailability';
import EPaper from '@/lib/models/EPaper';
import { listAllStoredEPapers } from '@/lib/storage/epapersFile';

export type PublicEPaperSitemapItem = {
  id: string;
  citySlug: string;
  publishDate: string;
  updatedAt: string;
};

function stringifyId(value: unknown) {
  if (typeof value === 'string') return value.trim();
  if (value && typeof value === 'object' && 'toString' in value) {
    return String(value).trim();
  }
  return '';
}

function toIsoDate(value: unknown, fallback = new Date()) {
  const parsed = new Date(
    value instanceof Date || typeof value === 'string' || typeof value === 'number'
      ? value
      : fallback
  );
  return Number.isNaN(parsed.getTime()) ? fallback.toISOString() : parsed.toISOString();
}

function toDateLabel(value: unknown) {
  const parsed = new Date(
    value instanceof Date || typeof value === 'string' || typeof value === 'number'
      ? value
      : ''
  );
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
}

function normalizeMongoEPaper(input: unknown): PublicEPaperSitemapItem | null {
  const source = typeof input === 'object' && input ? (input as Record<string, unknown>) : null;
  if (!source) return null;

  const id = stringifyId(source._id) || stringifyId(source.id);
  const citySlug = String(source.citySlug || '').trim().toLowerCase();
  const publishDate = toDateLabel(source.publishDate);
  if (!id || !citySlug || !publishDate) return null;

  return {
    id,
    citySlug,
    publishDate,
    updatedAt: toIsoDate(source.updatedAt || source.publishDate),
  };
}

export async function listEPapersForSitemap(limit = 1000) {
  if (await isMongoAvailable({ label: 'sitemap e-paper lookup' })) {
    try {
      const records = await EPaper.find({ status: 'published' })
        .select('_id citySlug publishDate updatedAt')
        .sort({ publishDate: -1, _id: -1 })
        .limit(limit)
        .lean();

      const normalized = records
        .map((item) => normalizeMongoEPaper(item))
        .filter((item): item is PublicEPaperSitemapItem => Boolean(item));

      if (normalized.length) return normalized;
    } catch (error) {
      console.error('Failed to load sitemap e-papers from MongoDB, falling back.', error);
    }
  }

  const fallback = await listAllStoredEPapers();
  return fallback
    .map((paper): PublicEPaperSitemapItem | null => {
      const id = stringifyId(paper._id);
      const citySlug = String(getCitySlugFromName(paper.city));
      const publishDate = paper.publishDate || toDateLabel(paper.publishedAt);
      if (!id || !citySlug || !publishDate) return null;

      return {
        id,
        citySlug,
        publishDate,
        updatedAt: toIsoDate(paper.updatedAt || paper.publishedAt || publishDate),
      } satisfies PublicEPaperSitemapItem;
    })
    .filter((item): item is PublicEPaperSitemapItem => Boolean(item))
    .sort((left, right) => right.publishDate.localeCompare(left.publishDate))
    .slice(0, limit);
}
