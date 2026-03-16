export interface SavedEpaperPaperEntry {
  paperId: string;
  title: string;
  cityName: string;
  publishDate: string;
  thumbnailPath: string;
  pageCount: number;
  lastOpenedPage: number;
  saved: boolean;
  offlineReady: boolean;
  savedAt: string;
  updatedAt: string;
}

export interface SavedEpaperStoryEntry {
  storyId: string;
  storyToken: string;
  paperId: string;
  paperTitle: string;
  cityName: string;
  publishDate: string;
  title: string;
  excerpt: string;
  pageNumber: number;
  coverImagePath: string;
  savedAt: string;
  updatedAt: string;
}

export type SavedEpaperPaperInput = Omit<
  SavedEpaperPaperEntry,
  'saved' | 'offlineReady' | 'savedAt' | 'updatedAt'
>;

export type SavedEpaperStoryInput = Omit<SavedEpaperStoryEntry, 'savedAt' | 'updatedAt'>;

type ReaderLibraryState = {
  papers: SavedEpaperPaperEntry[];
  stories: SavedEpaperStoryEntry[];
};

const STORAGE_KEY = 'lokswami_epaper_reader_library_v1';
const MAX_SAVED_PAPERS = 36;
const MAX_SAVED_STORIES = 72;

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function sanitizeText(value: unknown, maxLength = 240) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function sanitizePositiveInteger(value: unknown, fallback = 0) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (Number.isFinite(parsed) && parsed > 0) {
    return Math.floor(parsed);
  }
  return fallback;
}

function sanitizeBoolean(value: unknown) {
  return value === true;
}

function sanitizeIsoDate(value: unknown, fallback: string) {
  if (typeof value === 'string') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }
  return fallback;
}

function sortByUpdatedAtDesc<T extends { updatedAt: string }>(items: T[]) {
  return [...items].sort((left, right) => {
    const leftTime = Date.parse(left.updatedAt);
    const rightTime = Date.parse(right.updatedAt);
    return rightTime - leftTime;
  });
}

function sanitizePaperEntry(
  value: unknown,
  nowIso: string
): SavedEpaperPaperEntry | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const input = value as Partial<SavedEpaperPaperEntry>;
  const paperId = sanitizeText(input.paperId, 80);
  if (!paperId) return null;

  return {
    paperId,
    title: sanitizeText(input.title, 240),
    cityName: sanitizeText(input.cityName, 120),
    publishDate: sanitizeText(input.publishDate, 32),
    thumbnailPath: sanitizeText(input.thumbnailPath, 400),
    pageCount: sanitizePositiveInteger(input.pageCount, 1),
    lastOpenedPage: sanitizePositiveInteger(input.lastOpenedPage, 1),
    saved: sanitizeBoolean(input.saved),
    offlineReady: sanitizeBoolean(input.offlineReady),
    savedAt: sanitizeIsoDate(input.savedAt, nowIso),
    updatedAt: sanitizeIsoDate(input.updatedAt, nowIso),
  };
}

function sanitizeStoryEntry(
  value: unknown,
  nowIso: string
): SavedEpaperStoryEntry | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const input = value as Partial<SavedEpaperStoryEntry>;
  const storyId = sanitizeText(input.storyId, 80);
  const storyToken = sanitizeText(input.storyToken, 120);
  const paperId = sanitizeText(input.paperId, 80);

  if (!storyId || !storyToken || !paperId) {
    return null;
  }

  return {
    storyId,
    storyToken,
    paperId,
    paperTitle: sanitizeText(input.paperTitle, 240),
    cityName: sanitizeText(input.cityName, 120),
    publishDate: sanitizeText(input.publishDate, 32),
    title: sanitizeText(input.title, 240),
    excerpt: sanitizeText(input.excerpt, 800),
    pageNumber: sanitizePositiveInteger(input.pageNumber, 1),
    coverImagePath: sanitizeText(input.coverImagePath, 400),
    savedAt: sanitizeIsoDate(input.savedAt, nowIso),
    updatedAt: sanitizeIsoDate(input.updatedAt, nowIso),
  };
}

function readState(): ReaderLibraryState {
  if (!canUseStorage()) {
    return { papers: [], stories: [] };
  }

  const nowIso = new Date().toISOString();

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { papers: [], stories: [] };
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { papers: [], stories: [] };
    }

    const source = parsed as Partial<ReaderLibraryState>;
    const papers = Array.isArray(source.papers)
      ? source.papers
          .map((entry) => sanitizePaperEntry(entry, nowIso))
          .filter((entry): entry is SavedEpaperPaperEntry => Boolean(entry))
          .filter((entry) => entry.saved || entry.offlineReady)
      : [];
    const stories = Array.isArray(source.stories)
      ? source.stories
          .map((entry) => sanitizeStoryEntry(entry, nowIso))
          .filter((entry): entry is SavedEpaperStoryEntry => Boolean(entry))
      : [];

    return {
      papers: sortByUpdatedAtDesc(papers).slice(0, MAX_SAVED_PAPERS),
      stories: sortByUpdatedAtDesc(stories).slice(0, MAX_SAVED_STORIES),
    };
  } catch {
    return { papers: [], stories: [] };
  }
}

function writeState(next: ReaderLibraryState) {
  if (!canUseStorage()) {
    return;
  }

  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        papers: sortByUpdatedAtDesc(next.papers).slice(0, MAX_SAVED_PAPERS),
        stories: sortByUpdatedAtDesc(next.stories).slice(0, MAX_SAVED_STORIES),
      })
    );
  } catch {
    // Ignore localStorage write failures.
  }
}

function upsertPaperEntry(
  current: SavedEpaperPaperEntry[],
  input: SavedEpaperPaperInput,
  updater: (existing: SavedEpaperPaperEntry | null, nowIso: string) => SavedEpaperPaperEntry | null
) {
  const nowIso = new Date().toISOString();
  const existing = current.find((entry) => entry.paperId === input.paperId) || null;
  const nextEntry = updater(existing, nowIso);
  const remainder = current.filter((entry) => entry.paperId !== input.paperId);
  const next = nextEntry ? [nextEntry, ...remainder] : remainder;
  return sortByUpdatedAtDesc(next).slice(0, MAX_SAVED_PAPERS);
}

export function readSavedEpaperPapers() {
  return readState().papers;
}

export function readSavedEpaperStories() {
  return readState().stories;
}

export function toggleSavedEpaperPaper(input: SavedEpaperPaperInput) {
  const state = readState();
  let nextSaved = false;

  const papers = upsertPaperEntry(state.papers, input, (existing, nowIso) => {
    nextSaved = !existing?.saved;
    const nextEntry: SavedEpaperPaperEntry = {
      paperId: sanitizeText(input.paperId, 80),
      title: sanitizeText(input.title, 240),
      cityName: sanitizeText(input.cityName, 120),
      publishDate: sanitizeText(input.publishDate, 32),
      thumbnailPath: sanitizeText(input.thumbnailPath, 400),
      pageCount: sanitizePositiveInteger(input.pageCount, 1),
      lastOpenedPage: sanitizePositiveInteger(
        input.lastOpenedPage,
        existing?.lastOpenedPage || 1
      ),
      saved: nextSaved,
      offlineReady: existing?.offlineReady || false,
      savedAt: existing?.savedAt || nowIso,
      updatedAt: nowIso,
    };

    if (!nextEntry.saved && !nextEntry.offlineReady) {
      return null;
    }

    return nextEntry;
  });

  const nextState = { ...state, papers };
  writeState(nextState);
  return { saved: nextSaved, papers };
}

export function setSavedEpaperPaperOfflineReady(
  input: SavedEpaperPaperInput,
  offlineReady: boolean
) {
  const state = readState();

  const papers = upsertPaperEntry(state.papers, input, (existing, nowIso) => {
    const nextEntry: SavedEpaperPaperEntry = {
      paperId: sanitizeText(input.paperId, 80),
      title: sanitizeText(input.title, 240),
      cityName: sanitizeText(input.cityName, 120),
      publishDate: sanitizeText(input.publishDate, 32),
      thumbnailPath: sanitizeText(input.thumbnailPath, 400),
      pageCount: sanitizePositiveInteger(input.pageCount, 1),
      lastOpenedPage: sanitizePositiveInteger(
        input.lastOpenedPage,
        existing?.lastOpenedPage || 1
      ),
      saved: existing?.saved || false,
      offlineReady,
      savedAt: existing?.savedAt || nowIso,
      updatedAt: nowIso,
    };

    if (!nextEntry.saved && !nextEntry.offlineReady) {
      return null;
    }

    return nextEntry;
  });

  const nextState = { ...state, papers };
  writeState(nextState);
  return { papers };
}

export function updateSavedEpaperPaperLastPage(paperId: string, pageNumber: number) {
  const normalizedPaperId = sanitizeText(paperId, 80);
  if (!normalizedPaperId) {
    return readState().papers;
  }

  const state = readState();
  const nextPage = sanitizePositiveInteger(pageNumber, 1);
  const nowIso = new Date().toISOString();
  const papers = state.papers.map((entry) =>
    entry.paperId === normalizedPaperId
      ? {
          ...entry,
          lastOpenedPage: nextPage,
          updatedAt: nowIso,
        }
      : entry
  );

  const nextState = { ...state, papers };
  writeState(nextState);
  return sortByUpdatedAtDesc(papers);
}

export function toggleSavedEpaperStory(input: SavedEpaperStoryInput) {
  const state = readState();
  const nowIso = new Date().toISOString();
  const storyId = sanitizeText(input.storyId, 80);
  const existing = state.stories.find((entry) => entry.storyId === storyId);

  let stories: SavedEpaperStoryEntry[];
  let saved = false;

  if (existing) {
    stories = state.stories.filter((entry) => entry.storyId !== storyId);
  } else {
    saved = true;
    stories = sortByUpdatedAtDesc([
      {
        storyId,
        storyToken: sanitizeText(input.storyToken, 120),
        paperId: sanitizeText(input.paperId, 80),
        paperTitle: sanitizeText(input.paperTitle, 240),
        cityName: sanitizeText(input.cityName, 120),
        publishDate: sanitizeText(input.publishDate, 32),
        title: sanitizeText(input.title, 240),
        excerpt: sanitizeText(input.excerpt, 800),
        pageNumber: sanitizePositiveInteger(input.pageNumber, 1),
        coverImagePath: sanitizeText(input.coverImagePath, 400),
        savedAt: nowIso,
        updatedAt: nowIso,
      },
      ...state.stories,
    ]).slice(0, MAX_SAVED_STORIES);
  }

  const nextState = { ...state, stories };
  writeState(nextState);
  return { saved, stories };
}
