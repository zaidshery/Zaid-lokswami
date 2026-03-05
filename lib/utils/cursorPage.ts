import { Types, type FilterQuery, type Model } from 'mongoose';

export type CursorPageNextCursor = {
  publishedAt: string;
  id: string;
} | null;

export type CursorPageResult<T> = {
  items: T[];
  limit: number;
  hasMore: boolean;
  nextCursor: CursorPageNextCursor;
};

type CursorInput = {
  date: Date;
  id: string;
} | null;

type CursorCommonOptions = {
  limit?: unknown;
  minLimit?: number;
  maxLimit?: number;
  dateField: string;
  // Use when data might store date under a different field (e.g., publishDate).
  fallbackDateFields?: string[];
  // Use when Mongo field differs from public-mapped dateField.
  mongoDateField?: string;
  cursorPublishedAt?: string | null;
  cursorId?: string | null;
};

type CursorModelOptions<T> = CursorCommonOptions & {
  model: Model<any>;
  mongoFilter?: FilterQuery<any>;
  mongoProjection?: string | Record<string, 0 | 1>;
  arrayItems?: never;
  mapItem?: (item: Record<string, unknown>) => T | null;
};

type CursorArrayOptions<T> = CursorCommonOptions & {
  arrayItems: unknown[];
  model?: never;
  mongoFilter?: never;
  mongoProjection?: never;
  mapItem?: (item: Record<string, unknown>) => T | null;
};

export type CursorPageOptions<T> = CursorModelOptions<T> | CursorArrayOptions<T>;

const DEFAULT_LIMIT = 20;
const DEFAULT_MIN_LIMIT = 5;
const DEFAULT_MAX_LIMIT = 50;

function asRecord(value: unknown) {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

function resolveValue(source: Record<string, unknown>, key: string) {
  if (!key.trim()) return undefined;
  return source[key];
}

function resolveId(source: Record<string, unknown>) {
  const rawId = source._id ?? source.id;
  if (typeof rawId === 'string') return rawId.trim();
  if (rawId && typeof rawId === 'object' && 'toString' in rawId) {
    const value = String(rawId);
    return value.trim();
  }
  return '';
}

function resolveDate(source: Record<string, unknown>, fields: string[]) {
  for (const field of fields) {
    const raw = resolveValue(source, field);
    if (!raw) continue;
    const parsed = new Date(
      raw instanceof Date || typeof raw === 'string' || typeof raw === 'number'
        ? raw
        : String(raw)
    );
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  return null;
}

function parseCursor(cursorPublishedAt?: string | null, cursorId?: string | null): CursorInput {
  const dateValue = (cursorPublishedAt || '').trim();
  const idValue = (cursorId || '').trim();

  // If one cursor field is missing, ignore cursor and return first page.
  if (!dateValue || !idValue) return null;

  const parsedDate = new Date(dateValue);
  if (Number.isNaN(parsedDate.getTime())) return null;

  return {
    date: parsedDate,
    id: idValue,
  };
}

export function resolveCursorLimit(
  value: unknown,
  config?: { fallback?: number; min?: number; max?: number }
) {
  const fallback = config?.fallback ?? DEFAULT_LIMIT;
  const min = config?.min ?? DEFAULT_MIN_LIMIT;
  const max = config?.max ?? DEFAULT_MAX_LIMIT;
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function buildDateFieldPriority(options: CursorCommonOptions) {
  const fields = [
    options.dateField,
    ...(options.fallbackDateFields || []),
    options.mongoDateField || '',
  ]
    .map((field) => field.trim())
    .filter(Boolean);

  return Array.from(new Set(fields));
}

function buildNextCursor(
  items: Record<string, unknown>[],
  hasMore: boolean,
  dateFields: string[]
): CursorPageNextCursor {
  if (!hasMore || !items.length) return null;
  const last = items[items.length - 1];
  const id = resolveId(last);
  const date = resolveDate(last, dateFields);
  if (!id || !date) return null;
  return {
    publishedAt: date.toISOString(),
    id,
  };
}

function mapOutputItems<T>(
  records: Record<string, unknown>[],
  mapper?: (item: Record<string, unknown>) => T | null
) {
  if (!mapper) {
    return records as unknown as T[];
  }

  return records
    .map((item) => mapper(item))
    .filter((item): item is T => Boolean(item));
}

function compareRecordsDescByDateAndId(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
  dateFields: string[]
) {
  const aDate = resolveDate(a, dateFields);
  const bDate = resolveDate(b, dateFields);
  const aTime = aDate ? aDate.getTime() : 0;
  const bTime = bDate ? bDate.getTime() : 0;

  if (aTime !== bTime) return bTime - aTime;

  const aId = resolveId(a);
  const bId = resolveId(b);
  return bId.localeCompare(aId);
}

function isOlderThanCursor(
  item: Record<string, unknown>,
  cursor: CursorInput,
  dateFields: string[]
) {
  if (!cursor) return true;

  const itemDate = resolveDate(item, dateFields);
  if (!itemDate) return false;

  const itemTime = itemDate.getTime();
  const cursorTime = cursor.date.getTime();
  if (itemTime < cursorTime) return true;
  if (itemTime > cursorTime) return false;

  const itemId = resolveId(item);
  return Boolean(itemId) && itemId < cursor.id;
}

async function fromMongo<T>(
  options: CursorModelOptions<T>,
  limit: number,
  cursor: CursorInput,
  dateFields: string[]
) {
  const mongoDateField = (options.mongoDateField || options.dateField).trim();
  let query: Record<string, unknown> = {
    ...(asRecord(options.mongoFilter) as Record<string, unknown>),
  };

  if (cursor && Types.ObjectId.isValid(cursor.id)) {
    const cursorClause: Record<string, unknown> = {
      $or: [
        { [mongoDateField]: { $lt: cursor.date } },
        {
          [mongoDateField]: cursor.date,
          _id: { $lt: new Types.ObjectId(cursor.id) },
        },
      ],
    };

    if (Object.keys(query).length) {
      query = { $and: [query, cursorClause] };
    } else {
      query = cursorClause;
    }
  }

  const sortQuery: Record<string, 1 | -1> = {
    [mongoDateField]: -1,
    _id: -1,
  };

  const rows = await options.model
    .find(query, options.mongoProjection)
    .sort(sortQuery)
    .limit(limit + 1)
    .lean();

  const normalized = rows.map((item) => asRecord(item));
  const hasMore = normalized.length > limit;
  const pageRows = normalized.slice(0, limit);
  const nextCursor = buildNextCursor(pageRows, hasMore, dateFields);
  const items = mapOutputItems(pageRows, options.mapItem);

  return {
    items,
    limit,
    hasMore,
    nextCursor,
  } satisfies CursorPageResult<T>;
}

async function fromArray<T>(
  options: CursorArrayOptions<T>,
  limit: number,
  cursor: CursorInput,
  dateFields: string[]
) {
  const source = options.arrayItems.map((item) => asRecord(item));
  const sorted = source.sort((a, b) => compareRecordsDescByDateAndId(a, b, dateFields));
  const filtered = sorted.filter((item) => isOlderThanCursor(item, cursor, dateFields));
  const bounded = filtered.slice(0, limit + 1);

  const hasMore = bounded.length > limit;
  const pageRows = bounded.slice(0, limit);
  const nextCursor = buildNextCursor(pageRows, hasMore, dateFields);
  const items = mapOutputItems(pageRows, options.mapItem);

  return {
    items,
    limit,
    hasMore,
    nextCursor,
  } satisfies CursorPageResult<T>;
}

export async function cursorPage<T>(
  options: CursorPageOptions<T>
): Promise<CursorPageResult<T>> {
  const limit = resolveCursorLimit(options.limit, {
    fallback: DEFAULT_LIMIT,
    min: options.minLimit ?? DEFAULT_MIN_LIMIT,
    max: options.maxLimit ?? DEFAULT_MAX_LIMIT,
  });
  const cursor = parseCursor(options.cursorPublishedAt, options.cursorId);
  const dateFields = buildDateFieldPriority(options);

  if ('model' in options && options.model) {
    return fromMongo(options, limit, cursor, dateFields);
  }

  return fromArray(options, limit, cursor, dateFields);
}
