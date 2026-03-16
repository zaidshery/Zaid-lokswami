import {
  isEPaperCitySlug,
  type EPaperCitySlug,
} from '@/lib/constants/epaperCities';

export type EPaperCityFilter = EPaperCitySlug | 'all';

export type PublicEpaperMetadata = {
  title?: unknown;
  cityName?: unknown;
  citySlug?: unknown;
  publishDate?: unknown;
};

export type PublicEpaperFilterState = {
  citySlug: EPaperCitySlug | '';
  date: string;
  parsedDate: Date | null;
  month: string;
  monthStart: Date | null;
  monthEnd: Date | null;
  query: string;
  queryDate: Date | null;
  queryDateEnd: Date | null;
  queryMonth: string;
  queryMonthStart: Date | null;
  queryMonthEnd: Date | null;
};

function addUtcDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function addUtcMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setUTCMonth(next.getUTCMonth() + months);
  return next;
}

function parsePublishDate(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const dmy = /^(\d{2})[-/](\d{2})[-/](\d{4})$/.exec(trimmed);
  if (dmy) {
    const day = Number.parseInt(dmy[1], 10);
    const month = Number.parseInt(dmy[2], 10);
    const year = Number.parseInt(dmy[3], 10);
    if (
      Number.isFinite(day) &&
      Number.isFinite(month) &&
      Number.isFinite(year) &&
      day >= 1 &&
      day <= 31 &&
      month >= 1 &&
      month <= 12
    ) {
      return new Date(Date.UTC(year, month - 1, day));
    }
  }

  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? `${trimmed}T00:00:00.000Z` : trimmed;
  const parsed = new Date(dateOnly);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()));
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function normalizeMetadataQuery(value: string) {
  return value.trim().replace(/\s+/g, ' ').slice(0, 80);
}

export function parseArchiveMonth(value: string) {
  const month = value.trim();
  if (!/^\d{4}-\d{2}$/.test(month)) return '';

  const [yearPart, monthPart] = month.split('-');
  const year = Number.parseInt(yearPart, 10);
  const monthNumber = Number.parseInt(monthPart, 10);
  if (!Number.isFinite(year) || !Number.isFinite(monthNumber)) return '';
  if (monthNumber < 1 || monthNumber > 12) return '';
  return `${yearPart}-${monthPart}`;
}

export function resolveArchiveMonthRange(month: string) {
  const normalized = parseArchiveMonth(month);
  if (!normalized) return null;

  const [yearPart, monthPart] = normalized.split('-');
  const year = Number.parseInt(yearPart, 10);
  const monthIndex = Number.parseInt(monthPart, 10) - 1;
  const start = new Date(Date.UTC(year, monthIndex, 1));
  const end = addUtcMonths(start, 1);
  return { start, end };
}

export function resolvePublicEpaperCityFilter(value: string): EPaperCityFilter {
  const normalized = value.trim().toLowerCase();
  if (!normalized || normalized === 'all') return 'all';
  return isEPaperCitySlug(normalized) ? normalized : 'all';
}

export function parsePublicEpaperFilters(searchParams: URLSearchParams) {
  const cityValue = (searchParams.get('citySlug') || '').trim().toLowerCase();
  const date = (searchParams.get('date') || '').trim();
  const month = parseArchiveMonth(searchParams.get('month') || '');
  const query = normalizeMetadataQuery(searchParams.get('query') || searchParams.get('q') || '');

  if (cityValue && !isEPaperCitySlug(cityValue)) {
    return { error: 'Invalid citySlug' } as const;
  }

  let parsedDate: Date | null = null;
  if (date) {
    parsedDate = parsePublishDate(date);
    if (!parsedDate) {
      return { error: 'Invalid date. Use YYYY-MM-DD.' } as const;
    }
  }

  const monthRange = resolveArchiveMonthRange(month);
  if ((searchParams.get('month') || '').trim() && !monthRange) {
    return { error: 'Invalid month. Use YYYY-MM.' } as const;
  }

  const queryDate = /^\d{4}-\d{2}-\d{2}$/.test(query) ? parsePublishDate(query) : null;
  const queryMonth = queryDate ? '' : parseArchiveMonth(query);
  const queryMonthRange = queryMonth ? resolveArchiveMonthRange(queryMonth) : null;

  return {
    filters: {
      citySlug: cityValue as EPaperCitySlug | '',
      date,
      parsedDate,
      month,
      monthStart: monthRange?.start || null,
      monthEnd: monthRange?.end || null,
      query,
      queryDate,
      queryDateEnd: queryDate ? addUtcDays(queryDate, 1) : null,
      queryMonth,
      queryMonthStart: queryMonthRange?.start || null,
      queryMonthEnd: queryMonthRange?.end || null,
    } satisfies PublicEpaperFilterState,
  } as const;
}

export function buildPublicEpaperMongoQuery(
  filters: PublicEpaperFilterState,
  base: Record<string, unknown> = {}
) {
  const query: Record<string, unknown> = { ...base };

  if (filters.citySlug) {
    query.citySlug = filters.citySlug;
  }

  if (filters.parsedDate) {
    query.publishDate = {
      $gte: filters.parsedDate,
      $lt: addUtcDays(filters.parsedDate, 1),
    };
  } else if (filters.monthStart && filters.monthEnd) {
    query.publishDate = {
      $gte: filters.monthStart,
      $lt: filters.monthEnd,
    };
  }

  if (!filters.query) {
    return query;
  }

  const regex = new RegExp(escapeRegex(filters.query), 'i');
  const metadataClauses: Record<string, unknown>[] = [
    { title: regex },
    { cityName: regex },
    { citySlug: regex },
  ];

  if (filters.queryDate && filters.queryDateEnd) {
    metadataClauses.push({
      publishDate: {
        $gte: filters.queryDate,
        $lt: filters.queryDateEnd,
      },
    });
  } else if (filters.queryMonthStart && filters.queryMonthEnd) {
    metadataClauses.push({
      publishDate: {
        $gte: filters.queryMonthStart,
        $lt: filters.queryMonthEnd,
      },
    });
  }

  if (!Object.keys(query).length) {
    return { $or: metadataClauses };
  }

  return {
    $and: [query, { $or: metadataClauses }],
  };
}

export function matchesPublicEpaperMetadata(
  item: PublicEpaperMetadata,
  query: string
) {
  const normalized = normalizeMetadataQuery(query).toLowerCase();
  if (!normalized) return true;

  const title = String(item.title || '').toLowerCase();
  const cityName = String(item.cityName || '').toLowerCase();
  const citySlug = String(item.citySlug || '').toLowerCase();
  const publishDate = String(item.publishDate || '').trim();

  if (
    title.includes(normalized) ||
    cityName.includes(normalized) ||
    citySlug.includes(normalized)
  ) {
    return true;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return publishDate === normalized;
  }

  const month = parseArchiveMonth(normalized);
  if (month) {
    return publishDate.startsWith(`${month}-`);
  }

  return false;
}
