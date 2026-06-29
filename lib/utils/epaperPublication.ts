import {
  getCityNameFromSlug,
  normalizeCityName,
  normalizeCitySlug,
} from '@/lib/constants/epaperCities';
import {
  normalizeEPaperPublicationType,
  type EPaperPublicationType,
} from '@/lib/types/epaper';

export const EMAGAZINE_GLOBAL_CITY_SLUG = 'global' as const;
export const EMAGAZINE_GLOBAL_CITY_NAME = 'Lokswami' as const;

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

function pad2(value: number) {
  return String(value).padStart(2, '0');
}

function isValidDateParts(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function parseIssueDateParts(value: unknown) {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return {
      year: value.getUTCFullYear(),
      month: value.getUTCMonth() + 1,
      day: value.getUTCDate(),
    };
  }

  const text = String(value || '').trim();
  if (!text) return null;

  const monthOnly = /^(\d{4})-(\d{2})$/.exec(text);
  if (monthOnly) {
    const year = Number.parseInt(monthOnly[1], 10);
    const month = Number.parseInt(monthOnly[2], 10);
    if (isValidDateParts(year, month, 1)) {
      return { year, month, day: 1 };
    }
    return null;
  }

  const isoDate = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (isoDate) {
    const year = Number.parseInt(isoDate[1], 10);
    const month = Number.parseInt(isoDate[2], 10);
    const day = Number.parseInt(isoDate[3], 10);
    if (isValidDateParts(year, month, day)) {
      return { year, month, day };
    }
    return null;
  }

  const displayDate = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(text);
  if (displayDate) {
    const day = Number.parseInt(displayDate[1], 10);
    const month = Number.parseInt(displayDate[2], 10);
    const year = Number.parseInt(displayDate[3], 10);
    if (isValidDateParts(year, month, day)) {
      return { year, month, day };
    }
    return null;
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return null;
  return {
    year: parsed.getUTCFullYear(),
    month: parsed.getUTCMonth() + 1,
    day: parsed.getUTCDate(),
  };
}

function addUtcMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setUTCMonth(next.getUTCMonth() + months);
  return next;
}

export function resolveEPaperPublicationType(value: unknown): EPaperPublicationType {
  return normalizeEPaperPublicationType(value);
}

export function isMonthlyEPaperPublication(value: unknown) {
  return resolveEPaperPublicationType(value) === 'emagazine';
}

export function normalizePublicationCityScope(input: {
  publicationType: unknown;
  citySlug?: unknown;
  cityName?: unknown;
}) {
  const publicationType = resolveEPaperPublicationType(input.publicationType);
  if (isMonthlyEPaperPublication(publicationType)) {
    return {
      citySlug: EMAGAZINE_GLOBAL_CITY_SLUG,
      cityName: EMAGAZINE_GLOBAL_CITY_NAME,
      isGlobal: true,
    };
  }

  const citySlug = normalizeCitySlug(String(input.citySlug || ''));
  const cityName =
    normalizeCityName(String(input.cityName || '')) ||
    getCityNameFromSlug(citySlug) ||
    String(input.cityName || '').trim();

  return {
    citySlug,
    cityName,
    isGlobal: false,
  };
}

export function shouldUseGlobalPublicationScope(value: unknown) {
  return isMonthlyEPaperPublication(value);
}

export function normalizePublicationIssueDate(
  value: unknown,
  publicationType: unknown
) {
  const parts = parseIssueDateParts(value);
  if (!parts) return '';

  const day = isMonthlyEPaperPublication(publicationType) ? 1 : parts.day;
  return `${parts.year}-${pad2(parts.month)}-${pad2(day)}`;
}

export function normalizePublicationIssueMonth(value: unknown) {
  const parts = parseIssueDateParts(value);
  if (!parts) return '';
  return `${parts.year}-${pad2(parts.month)}`;
}

export function getPublicationIssueDateRange(
  value: unknown,
  publicationType: unknown
) {
  const normalized = normalizePublicationIssueDate(value, publicationType);
  if (!normalized) return null;

  const parts = parseIssueDateParts(normalized);
  if (!parts) return null;

  const start = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  const end = isMonthlyEPaperPublication(publicationType)
    ? addUtcMonths(new Date(Date.UTC(parts.year, parts.month - 1, 1)), 1)
    : new Date(start.getTime() + 24 * 60 * 60 * 1000);

  return { $gte: start, $lt: end };
}

export function formatPublicationIssueLabel(
  value: unknown,
  publicationType: unknown,
  fallback = ''
) {
  const parts = parseIssueDateParts(value);
  if (!parts) return fallback;

  if (isMonthlyEPaperPublication(publicationType)) {
    return `${MONTH_NAMES[parts.month - 1]} ${parts.year}`;
  }

  return `${pad2(parts.day)}/${pad2(parts.month)}/${String(parts.year).slice(-2)}`;
}

export function buildPublicationTypeMongoFilter(value: unknown): Record<string, unknown> {
  const publicationType = resolveEPaperPublicationType(value);
  if (publicationType === 'emagazine') {
    return { publicationType };
  }

  return {
    $or: [
      { publicationType: 'epaper' },
      { publicationType: { $exists: false } },
      { publicationType: '' },
    ],
  };
}

export function getPublicationTypeLabels(value: unknown) {
  const publicationType = resolveEPaperPublicationType(value);
  if (publicationType === 'emagazine') {
    return {
      singular: 'E-Magazine',
      plural: 'E-Magazines',
      lowercase: 'e-magazine',
      desk: 'E-Magazine Desk',
      adminBasePath: '/admin/emagazines',
      publicBasePath: '/main/e-magazine',
      storageFolder: 'emagazines',
      cadence: 'monthly',
      issueLabel: 'Issue Month',
      issueFilterLabel: 'Month',
      issueHelp: 'Magazines are monthly issues. The selected month is stored as the first day of that month.',
      issuePlaceholder: '2026-05',
      issueQueryParam: 'month',
    } as const;
  }

  return {
    singular: 'E-Paper',
    plural: 'E-Papers',
    lowercase: 'e-paper',
    desk: 'E-Paper Desk',
    adminBasePath: '/admin/epapers',
    publicBasePath: '/main/epaper',
    storageFolder: 'epapers',
    cadence: 'daily',
    issueLabel: 'Publish Date',
    issueFilterLabel: 'Date',
    issueHelp: 'Daily editions are published by date.',
    issuePlaceholder: '2026-05-05',
    issueQueryParam: 'date',
  } as const;
}
