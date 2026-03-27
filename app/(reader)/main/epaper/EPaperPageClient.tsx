'use client';

import Image from 'next/image';
import {
  type TouchEvent as ReactTouchEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  Bookmark,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  Loader2,
  MoreHorizontal,
  Minus,
  Newspaper,
  PauseCircle,
  Plus,
  Printer,
  Type,
  Share2,
  Volume2,
  X,
} from 'lucide-react';
import DateInputField from '@/components/ui/DateInputField';
import {
  EPAPER_CITY_OPTIONS,
} from '@/lib/constants/epaperCities';
import { useAppStore } from '@/lib/store/appStore';
import {
  buildArticleWhatsAppShareUrl,
  toAbsoluteShareUrl,
} from '@/lib/utils/articleShare';
import { formatUiDate } from '@/lib/utils/dateFormat';
import {
  readSavedEpaperPapers,
  readSavedEpaperStories,
  setSavedEpaperPaperOfflineReady,
  toggleSavedEpaperPaper,
  toggleSavedEpaperStory,
  updateSavedEpaperPaperLastPage,
  type SavedEpaperPaperEntry,
  type SavedEpaperPaperInput,
  type SavedEpaperStoryEntry,
} from '@/lib/utils/epaperReaderLibrary';
import { renderPdfPagePreviewFromUrl } from '@/lib/utils/pdfThumbnailClient';
import {
  type EPaperCityFilter,
} from '@/lib/utils/publicEpaperFilters';
import type { EPaperArticleRecord, EPaperRecord } from '@/lib/types/epaper';
import { buildTtsAudioSource, requestTtsAudio } from '@/lib/ai/ttsClient';

export type PublicCursor = {
  publishedAt: string;
  id: string;
};

export type PublicEPaperListItem = {
  _id: string;
  citySlug: string;
  cityName: string;
  title: string;
  publishDate: string;
  thumbnailPath: string;
  pdfPath: string;
  status: 'published';
  pageCount: number;
  pagesWithImage?: number;
  editionDate?: string;
  publishedAt?: string;
};

type LatestListResponse = {
  items?: PublicEPaperListItem[];
  limit?: number;
  hasMore?: boolean;
  nextCursor?: PublicCursor | null;
  error?: string;
};

type DetailResponse = {
  success: boolean;
  error?: string;
  data?: EPaperRecord & { articles: EPaperArticleRecord[] };
};

type EPaperPageClientProps = {
  initialItems: PublicEPaperListItem[];
  initialLimit: number;
  initialHasMore: boolean;
  initialNextCursor: PublicCursor | null;
  initialCity: EPaperCityFilter;
  initialPublishDate: string;
};

const COPY = {
  en: {
    title: 'Interactive E-Paper',
    subtitle: 'Tap on highlighted areas to read mapped stories.',
    publishDate: 'Publish date',
    clearDate: 'Clear',
    city: 'City',
    allCities: 'All editions',
    pages: 'pages',
    editions: 'editions',
    stories: 'stories',
    noThumbnail: 'No thumbnail',
    noPaper: 'No published e-paper available right now.',
    noPaperFiltered: 'No e-paper matched these archive filters.',
    openPdf: 'Open PDF',
    shareWhatsApp: 'Share',
    shareStory: 'Share story',
    whatsApp: 'WhatsApp',
    pinchToZoom: 'Pinch or double-tap to zoom',
    pageMissingPrefix: 'Page image missing: rendering fallback from PDF for page',
    noPreview: 'No preview available for this page.',
    noArticle: 'No article content available.',
    noReadableText: 'Readable text is not available for this story yet.',
    textMode: 'Text mode',
    storyMode: 'Visual mode',
    textSize: 'Text size',
    readerTextReady: 'Text extracted',
    readerTextExcerpt: 'OCR excerpt only',
    readerTextFallback: 'Context fallback only',
    readerTextExcerptHelp:
      'This story currently has only a short OCR-derived excerpt. The page image remains the source view.',
    readerTextFallbackHelp:
      'Detailed story text is not available yet. Use the mapped page view for the original layout.',
    storyPreview: 'Text preview',
    openTextStory: 'Read in text mode',
    listen: 'Listen',
    stopListening: 'Stop',
    listening: 'Preparing audio...',
    audioUnavailable: 'Audio playback is unavailable right now.',
    articleReader: 'Story reader',
    openVisualStory: 'Open visual story view',
    story: 'Story',
    storyImage: 'Story image',
    previous: 'Previous page',
    next: 'Next page',
    zoomOut: 'Zoom out',
    zoomIn: 'Zoom in',
    imageZoomOut: 'Zoom out image',
    imageZoomIn: 'Zoom in image',
    close: 'Close viewer',
    page: 'Page',
    quickJump: 'Quick jump',
    pageStrip: 'Page strip',
    pageOverview: 'Page overview',
    pageStories: 'Page stories',
    editionContents: 'Edition contents',
    pagesTab: 'Pages',
    contentsTab: 'Contents',
    currentPage: 'Current page',
    moreActions: 'More',
    readerTools: 'Reader tools',
    spreadView: 'Spread view',
    singleView: 'Single page',
    openPage: 'Open page',
    tapPageToFocus: 'Tap a page to focus it',
    showPagesRail: 'Show pages',
    hidePagesRail: 'Hide pages',
    showContentsRail: 'Show contents',
    hideContentsRail: 'Hide contents',
    noStoriesEdition: 'No mapped stories in this edition yet.',
    storiesOnPage: 'Stories on this page',
    noStories: 'No mapped stories on this page.',
    showingDate: 'Showing date',
    archiveSummary: 'Archive',
    resultsLoaded: 'loaded',
    moreAvailable: 'More editions available',
    loadMore: 'Load more',
    noMore: 'No more editions',
    saveIssue: 'Save issue',
    savedIssue: 'Issue saved',
    saveStory: 'Save story',
    savedStory: 'Story saved',
    downloadPdf: 'Download PDF',
    downloadText: 'Download text',
    printStory: 'Print story',
    keepOffline: 'Keep offline',
    offlineReady: 'Available offline',
    offlineSaving: 'Preparing offline...',
    savedLibrary: 'Saved for later',
    savedLibraryHint: 'Quickly reopen saved issues and story highlights.',
    savedIssues: 'Saved issues',
    savedStories: 'Saved stories',
    openSaved: 'Open',
    openStory: 'Open story',
    issueSavedNotice: 'Issue saved for later.',
    issueRemovedNotice: 'Issue removed from saved list.',
    storySavedNotice: 'Story saved for later.',
    storyRemovedNotice: 'Story removed from saved list.',
    offlineReadyNotice: 'This edition is ready for offline reading.',
    offlinePartialNotice: 'Offline copy saved, but a few assets could not be cached.',
    offlineUnsupported: 'Offline saving is not supported in this browser.',
    offlineCachedNotice: 'Loaded this edition from your offline cache.',
    printBlocked: 'Allow pop-ups in this browser to print the story.',
    textDownloadUnavailable: 'Readable text is required to download this story.',
  },
  hi: {
    title: '\u0907\u0902\u091f\u0930\u090f\u0915\u094d\u091f\u093f\u0935 \u0908-\u092a\u0947\u092a\u0930',
    subtitle:
      '\u0939\u093e\u0907\u0932\u093e\u0907\u091f \u0915\u093f\u090f \u0917\u090f \u090f\u0930\u093f\u092f\u093e \u092a\u0930 \u091f\u0948\u092a \u0915\u0930\u0915\u0947 \u0938\u094d\u091f\u094b\u0930\u0940 \u092a\u0922\u093c\u0947\u0902\u0964',
    publishDate: 'Publish date',
    clearDate: 'Clear',
    city: '\u0936\u0939\u0930',
    allCities: '\u0938\u092d\u0940 \u0938\u0902\u0938\u094d\u0915\u0930\u0923',
    pages: '\u092a\u0947\u091c',
    editions: '\u0938\u0902\u0938\u094d\u0915\u0930\u0923',
    stories: '\u0938\u094d\u091f\u094b\u0930\u0940',
    noThumbnail:
      '\u0925\u0902\u092c\u0928\u0947\u0932 \u0909\u092a\u0932\u092c\u094d\u0927 \u0928\u0939\u0940\u0902',
    noPaper:
      '\u0905\u092d\u0940 \u0915\u094b\u0908 \u092a\u094d\u0930\u0915\u093e\u0936\u093f\u0924 \u0908-\u092a\u0947\u092a\u0930 \u0909\u092a\u0932\u092c\u094d\u0927 \u0928\u0939\u0940\u0902 \u0939\u0948\u0964',
    noPaperFiltered:
      '\u0907\u0928 \u0906\u0930\u094d\u0915\u093e\u0907\u0935 \u092b\u093f\u0932\u094d\u091f\u0930\u094d\u0938 \u0938\u0947 \u0915\u094b\u0908 \u0908-\u092a\u0947\u092a\u0930 \u0928\u0939\u0940\u0902 \u092e\u093f\u0932\u093e\u0964',
    openPdf: 'PDF \u0916\u094b\u0932\u0947\u0902',
    shareWhatsApp: '\u0936\u0947\u092f\u0930',
    shareStory: '\u0938\u094d\u091f\u094b\u0930\u0940 \u0936\u0947\u092f\u0930 \u0915\u0930\u0947\u0902',
    whatsApp: 'WhatsApp',
    pinchToZoom: '\u091a\u0941\u091f\u0915\u0940 \u092f\u093e \u0921\u092c\u0932-\u091f\u0948\u092a \u0938\u0947 \u091c\u0942\u092e \u0915\u0930\u0947\u0902',
    pageMissingPrefix:
      '\u092a\u0947\u091c \u0907\u092e\u0947\u091c \u092e\u093f\u0938\u093f\u0902\u0917 \u0939\u0948: \u092a\u0947\u091c \u0915\u0947 \u0932\u093f\u090f PDF \u092b\u0949\u0932\u092c\u0948\u0915 \u0930\u0947\u0902\u0921\u0930 \u0939\u094b \u0930\u0939\u093e \u0939\u0948',
    noPreview:
      '\u0907\u0938 \u092a\u0947\u091c \u0915\u093e \u092a\u094d\u0930\u0940\u0935\u094d\u092f\u0942 \u0909\u092a\u0932\u092c\u094d\u0927 \u0928\u0939\u0940\u0902 \u0939\u0948\u0964',
    noArticle:
      '\u0907\u0938 \u0938\u094d\u091f\u094b\u0930\u0940 \u0915\u0940 \u0938\u093e\u092e\u0917\u094d\u0930\u0940 \u0909\u092a\u0932\u092c\u094d\u0927 \u0928\u0939\u0940\u0902 \u0939\u0948\u0964',
    noReadableText:
      '\u0907\u0938 \u0938\u094d\u091f\u094b\u0930\u0940 \u0915\u093e \u092a\u0922\u093c\u0928\u0947 \u0932\u093e\u092f\u0915 \u091f\u0947\u0915\u094d\u0938\u094d\u091f \u0905\u092d\u0940 \u0909\u092a\u0932\u092c\u094d\u0927 \u0928\u0939\u0940\u0902 \u0939\u0948\u0964',
    textMode: '\u091f\u0947\u0915\u094d\u0938\u094d\u091f \u092e\u094b\u0921',
    storyMode: '\u0935\u093f\u091c\u0941\u0905\u0932 \u092e\u094b\u0921',
    textSize: '\u091f\u0947\u0915\u094d\u0938\u094d\u091f \u0938\u093e\u0907\u091c',
    readerTextReady: '\u092a\u0920\u0928\u0947 \u092f\u094b\u0917\u094d\u092f \u091f\u0947\u0915\u094d\u0938\u094d\u091f \u0909\u092a\u0932\u092c\u094d\u0927',
    readerTextExcerpt: '\u0915\u0947\u0935\u0932 OCR \u0905\u0902\u0936',
    readerTextFallback: '\u0915\u0947\u0935\u0932 \u0938\u0902\u0926\u0930\u094d\u092d \u092b\u0949\u0932\u092c\u0948\u0915',
    readerTextExcerptHelp:
      '\u0907\u0938 \u0938\u094d\u091f\u094b\u0930\u0940 \u0915\u0947 \u0932\u093f\u090f \u0905\u092d\u0940 \u0938\u093f\u0930\u094d\u092b \u091b\u094b\u091f\u093e OCR \u0905\u0902\u0936 \u0909\u092a\u0932\u092c\u094d\u0927 \u0939\u0948\u0964 \u092a\u0947\u091c \u0907\u092e\u0947\u091c \u0939\u0940 \u0905\u0938\u0932 \u0935\u094d\u092f\u0942 \u0939\u0948\u0964',
    readerTextFallbackHelp:
      '\u0907\u0938 \u0938\u094d\u091f\u094b\u0930\u0940 \u0915\u093e \u0935\u093f\u0938\u094d\u0924\u0943\u0924 \u091f\u0947\u0915\u094d\u0938\u094d\u091f \u0905\u092d\u0940 \u0909\u092a\u0932\u092c\u094d\u0927 \u0928\u0939\u0940\u0902 \u0939\u0948\u0964 \u0905\u0938\u0932 \u0932\u0947\u0906\u0909\u091f \u0915\u0947 \u0932\u093f\u090f \u092e\u0948\u092a \u0915\u093f\u090f \u0917\u090f \u092a\u0947\u091c \u0935\u094d\u092f\u0942 \u0915\u093e \u0909\u092a\u092f\u094b\u0917 \u0915\u0930\u0947\u0902\u0964',
    storyPreview: '\u091f\u0947\u0915\u094d\u0938\u094d\u091f \u092a\u094d\u0930\u0940\u0935\u094d\u092f\u0942',
    openTextStory: '\u091f\u0947\u0915\u094d\u0938\u094d\u091f \u092e\u094b\u0921 \u092e\u0947\u0902 \u092a\u0922\u093c\u0947\u0902',
    listen: '\u0938\u0941\u0928\u0947\u0902',
    stopListening: '\u0930\u094b\u0915\u0947\u0902',
    listening: '\u0911\u0921\u093f\u092f\u094b \u0924\u0948\u092f\u093e\u0930 \u0939\u094b \u0930\u0939\u093e \u0939\u0948...',
    audioUnavailable:
      '\u0905\u092d\u0940 \u0911\u0921\u093f\u092f\u094b \u092a\u094d\u0932\u0947\u092c\u0948\u0915 \u0909\u092a\u0932\u092c\u094d\u0927 \u0928\u0939\u0940\u0902 \u0939\u0948\u0964',
    articleReader: '\u0938\u094d\u091f\u094b\u0930\u0940 \u0930\u0940\u0921\u0930',
    openVisualStory: '\u0935\u093f\u091c\u0941\u0905\u0932 \u0938\u094d\u091f\u094b\u0930\u0940 \u0935\u094d\u092f\u0942',
    story: '\u0938\u094d\u091f\u094b\u0930\u0940',
    storyImage: '\u0938\u094d\u091f\u094b\u0930\u0940 \u0907\u092e\u0947\u091c',
    previous: 'Previous page',
    next: 'Next page',
    zoomOut: 'Zoom out',
    zoomIn: 'Zoom in',
    imageZoomOut: '\u0907\u092e\u0947\u091c \u091c\u0942\u092e \u0918\u091f\u093e\u090f\u0902',
    imageZoomIn: '\u0907\u092e\u0947\u091c \u091c\u0942\u092e \u092c\u0922\u093c\u093e\u090f\u0902',
    close: 'Close viewer',
    page: '\u092a\u0947\u091c',
    quickJump: '\u091c\u0932\u094d\u0926\u0940 \u091c\u093e\u090f\u0902',
    pageStrip: '\u092a\u0947\u091c \u0938\u094d\u091f\u094d\u0930\u093f\u092a',
    pageOverview: '\u092a\u0947\u091c \u0938\u093e\u0930\u093e\u0902\u0936',
    pageStories: '\u0907\u0938 \u092a\u0947\u091c \u0915\u0940 \u0938\u094d\u091f\u094b\u0930\u0940',
    editionContents: '\u0908-\u092a\u0947\u092a\u0930 \u0938\u093e\u092e\u0917\u094d\u0930\u0940',
    pagesTab: '\u092a\u0947\u091c',
    contentsTab: '\u0938\u093e\u092e\u0917\u094d\u0930\u0940',
    currentPage: '\u0935\u0930\u094d\u0924\u092e\u093e\u0928 \u092a\u0947\u091c',
    moreActions: '\u0914\u0930 \u0935\u093f\u0915\u0932\u094d\u092a',
    readerTools: '\u0930\u0940\u0921\u0930 \u091f\u0942\u0932\u094d\u0938',
    spreadView: '\u0938\u094d\u092a\u094d\u0930\u0947\u0921 \u0935\u094d\u092f\u0942',
    singleView: '\u090f\u0915 \u092a\u0947\u091c',
    openPage: '\u092a\u0947\u091c \u0916\u094b\u0932\u0947\u0902',
    tapPageToFocus: '\u0915\u093f\u0938\u0940 \u092a\u0947\u091c \u092a\u0930 \u091f\u0948\u092a \u0915\u0930\u0915\u0947 \u0909\u0938\u0947 \u0916\u094b\u0932\u0947\u0902',
    showPagesRail: '\u092a\u0947\u091c \u0926\u093f\u0916\u093e\u090f\u0901',
    hidePagesRail: '\u092a\u0947\u091c \u091b\u0941\u092a\u093e\u090f\u0901',
    showContentsRail: '\u0938\u093e\u092e\u0917\u094d\u0930\u0940 \u0926\u093f\u0916\u093e\u090f\u0901',
    hideContentsRail: '\u0938\u093e\u092e\u0917\u094d\u0930\u0940 \u091b\u0941\u092a\u093e\u090f\u0901',
    noStoriesEdition:
      '\u0907\u0938 \u0908-\u092a\u0947\u092a\u0930 \u092e\u0947\u0902 \u0905\u092d\u0940 \u0915\u094b\u0908 \u092e\u0948\u092a \u0938\u094d\u091f\u094b\u0930\u0940 \u0928\u0939\u0940\u0902 \u0939\u0948\u0964',
    storiesOnPage: 'Stories on this page',
    noStories: 'No mapped stories on this page.',
    showingDate: 'Showing date',
    archiveSummary: '\u0906\u0930\u094d\u0915\u093e\u0907\u0935',
    resultsLoaded: '\u0932\u094b\u0921 \u0939\u0941\u090f',
    moreAvailable: '\u0914\u0930 \u0938\u0902\u0938\u094d\u0915\u0930\u0923 \u0909\u092a\u0932\u092c\u094d\u0927 \u0939\u0948\u0902',
    loadMore: '\u0914\u0930 \u0932\u094b\u0921 \u0915\u0930\u0947\u0902',
    noMore: '\u0914\u0930 \u0938\u0902\u0938\u094d\u0915\u0930\u0923 \u0928\u0939\u0940\u0902 \u0939\u0948\u0902',
    saveIssue: '\u0907\u0936\u094d\u092f\u0942 \u0938\u0947\u0935 \u0915\u0930\u0947\u0902',
    savedIssue: '\u0907\u0936\u094d\u092f\u0942 \u0938\u0947\u0935 \u0939\u0948',
    saveStory: '\u0938\u094d\u091f\u094b\u0930\u0940 \u0938\u0947\u0935 \u0915\u0930\u0947\u0902',
    savedStory: '\u0938\u094d\u091f\u094b\u0930\u0940 \u0938\u0947\u0935 \u0939\u0948',
    downloadPdf: 'PDF \u0921\u093e\u0909\u0928\u0932\u094b\u0921',
    downloadText: '\u091f\u0947\u0915\u094d\u0938\u094d\u091f \u0921\u093e\u0909\u0928\u0932\u094b\u0921',
    printStory: '\u0938\u094d\u091f\u094b\u0930\u0940 \u092a\u094d\u0930\u093f\u0902\u091f',
    keepOffline: '\u0911\u092b\u0932\u093e\u0907\u0928 \u0930\u0916\u0947\u0902',
    offlineReady: '\u0911\u092b\u0932\u093e\u0907\u0928 \u0924\u0948\u092f\u093e\u0930',
    offlineSaving: '\u0911\u092b\u0932\u093e\u0907\u0928 \u0924\u0948\u092f\u093e\u0930 \u0939\u094b \u0930\u0939\u093e \u0939\u0948...',
    savedLibrary: '\u0938\u0947\u0935 \u0915\u093f\u090f \u0917\u090f',
    savedLibraryHint:
      '\u0938\u0947\u0935 \u0915\u0940 \u0917\u0908 \u0908-\u092a\u0947\u092a\u0930 \u0914\u0930 \u0938\u094d\u091f\u094b\u0930\u0940 \u092b\u093f\u0930 \u0916\u094b\u0932\u0947\u0902\u0964',
    savedIssues: '\u0938\u0947\u0935 \u0907\u0936\u094d\u092f\u0942',
    savedStories: '\u0938\u0947\u0935 \u0938\u094d\u091f\u094b\u0930\u0940',
    openSaved: '\u0916\u094b\u0932\u0947\u0902',
    openStory: '\u0938\u094d\u091f\u094b\u0930\u0940 \u0916\u094b\u0932\u0947\u0902',
    issueSavedNotice: '\u0907\u0936\u094d\u092f\u0942 \u092c\u093e\u0926 \u0915\u0947 \u0932\u093f\u090f \u0938\u0947\u0935 \u0939\u094b \u0917\u092f\u093e\u0964',
    issueRemovedNotice: '\u0907\u0936\u094d\u092f\u0942 \u0938\u0947\u0935 \u0938\u0942\u091a\u0940 \u0938\u0947 \u0939\u091f \u0917\u092f\u093e\u0964',
    storySavedNotice: '\u0938\u094d\u091f\u094b\u0930\u0940 \u092c\u093e\u0926 \u0915\u0947 \u0932\u093f\u090f \u0938\u0947\u0935 \u0939\u094b \u0917\u0908\u0964',
    storyRemovedNotice: '\u0938\u094d\u091f\u094b\u0930\u0940 \u0938\u0947\u0935 \u0938\u0942\u091a\u0940 \u0938\u0947 \u0939\u091f \u0917\u0908\u0964',
    offlineReadyNotice:
      '\u092f\u0939 \u0938\u0902\u0938\u094d\u0915\u0930\u0923 \u0905\u092c \u0911\u092b\u0932\u093e\u0907\u0928 \u092a\u0922\u093c\u0928\u0947 \u0915\u0947 \u0932\u093f\u090f \u0924\u0948\u092f\u093e\u0930 \u0939\u0948\u0964',
    offlinePartialNotice:
      '\u0915\u0941\u091b \u090f\u0938\u0947\u091f \u0928\u0939\u0940\u0902 \u0938\u0947\u0935 \u0939\u094b \u092a\u093e\u090f, \u092b\u093f\u0930 \u092d\u0940 \u0911\u092b\u0932\u093e\u0907\u0928 \u0915\u0949\u092a\u0940 \u0924\u0948\u092f\u093e\u0930 \u0939\u0948\u0964',
    offlineUnsupported:
      '\u0907\u0938 \u092c\u094d\u0930\u093e\u0909\u091c\u0930 \u092e\u0947\u0902 \u0911\u092b\u0932\u093e\u0907\u0928 \u0938\u0947\u0935 \u0938\u092e\u0930\u094d\u0925\u093f\u0924 \u0928\u0939\u0940\u0902 \u0939\u0948\u0964',
    offlineCachedNotice:
      '\u092f\u0939 \u0938\u0902\u0938\u094d\u0915\u0930\u0923 \u0906\u092a\u0915\u0947 \u0921\u093f\u0935\u093e\u0907\u0938 \u0915\u0948\u0936 \u0938\u0947 \u0916\u094b\u0932\u093e \u0917\u092f\u093e\u0964',
    printBlocked:
      '\u0907\u0938 \u0938\u094d\u091f\u094b\u0930\u0940 \u0915\u094b \u092a\u094d\u0930\u093f\u0902\u091f \u0915\u0930\u0928\u0947 \u0915\u0947 \u0932\u093f\u090f \u092a\u0949\u092a-\u0905\u092a \u0905\u0928\u0941\u092e\u0924\u093f \u0926\u0947\u0902\u0964',
    textDownloadUnavailable:
      '\u0907\u0938 \u0938\u094d\u091f\u094b\u0930\u0940 \u0915\u094b \u0921\u093e\u0909\u0928\u0932\u094b\u0921 \u0915\u0930\u0928\u0947 \u0915\u0947 \u0932\u093f\u090f \u092a\u0922\u093c\u0928\u0947 \u0932\u093e\u092f\u0915 \u091f\u0947\u0915\u094d\u0938\u094d\u091f \u091c\u0930\u0942\u0930\u0940 \u0939\u0948\u0964',
  },
} as const;

const EPAPER_LAST_PAGE_STORAGE_KEY = 'lokswami_epaper_last_page_v1';
const EPAPER_OFFLINE_CACHE_NAME = 'lokswami-epaper-offline-v1';
const MIN_PREVIEW_ZOOM = 1;
const MAX_PREVIEW_ZOOM = 2.2;
const PREVIEW_ZOOM_STEP = 0.2;
const MIN_ARTICLE_IMAGE_ZOOM = 1;
const MAX_ARTICLE_IMAGE_ZOOM = 3;
const ARTICLE_IMAGE_ZOOM_STEP = 0.25;
const ARTICLE_DOUBLE_TAP_ZOOM = 2;
const ARTICLE_DOUBLE_TAP_DELAY_MS = 280;
const ARTICLE_DOUBLE_TAP_MOVE_PX = 28;
const PAGE_SWIPE_TRIGGER_PX = 72;
const PAGE_SWIPE_VERTICAL_LIMIT_PX = 64;

type ArticlePinchState = {
  startDistance: number;
  startZoom: number;
  isPinching: boolean;
};

type ArticleTapState = {
  lastTapAt: number;
  lastTapX: number;
  lastTapY: number;
};

type TouchPointLike = {
  clientX: number;
  clientY: number;
};

type TouchListLike = {
  length: number;
  [index: number]: TouchPointLike;
};

type PageSwipeState = {
  startX: number;
  startY: number;
  tracking: boolean;
};

type ReaderSidebarView = 'pages' | 'contents';
type ArticleReaderMode = 'story' | 'text';
type ReaderActionNotice = {
  tone: 'success' | 'error' | 'info';
  message: string;
};
type ReaderPageSummary = {
  pageNumber: number;
  imagePath: string;
  width: number;
  height: number;
  articles: EPaperArticleRecord[];
  storyCount: number;
};

function clampPage(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getTouchDistance(touches: TouchListLike) {
  if (touches.length < 2) return 0;
  const first = touches[0];
  const second = touches[1];
  const dx = first.clientX - second.clientX;
  const dy = first.clientY - second.clientY;
  return Math.hypot(dx, dy);
}

function toPlainText(html: string) {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function splitTextParagraphs(value: string) {
  return value
    .split(/\n{2,}/)
    .map((item) => item.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function toErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message.trim() ? error.message : fallback;
}

function isAbortError(error: unknown) {
  if (error instanceof DOMException && error.name === 'AbortError') return true;
  if (error instanceof Error && error.name === 'AbortError') return true;
  if (typeof error === 'object' && error !== null && 'name' in error) {
    return (error as { name?: unknown }).name === 'AbortError';
  }
  return false;
}

function buildEpaperPdfProxyUrl(epaperId: string) {
  const id = epaperId.trim();
  if (!id) return '';
  return `/api/public/epapers/${encodeURIComponent(id)}/pdf`;
}

function slugifyDownloadName(value: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return normalized || 'lokswami-epaper';
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function triggerTextDownload(filename: string, content: string) {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => {
    window.URL.revokeObjectURL(url);
  }, 0);
}

async function readCachedJson<T>(requestPath: string): Promise<T | null> {
  if (typeof window === 'undefined' || !('caches' in window)) {
    return null;
  }

  try {
    const requestUrl = toAbsoluteShareUrl(requestPath, window.location.origin);
    const response = await caches.match(requestUrl);
    if (!response) {
      return null;
    }

    return (await response.json()) as T;
  } catch {
    return null;
  }
}

async function cacheUrlsForOffline(urls: string[]) {
  if (typeof window === 'undefined' || !('caches' in window)) {
    throw new Error('offline-unsupported');
  }

  const cache = await caches.open(EPAPER_OFFLINE_CACHE_NAME);
  let cachedCount = 0;
  let failedCount = 0;

  for (const rawUrl of urls) {
    const normalized = String(rawUrl || '').trim();
    if (!normalized) continue;

    const requestUrl = toAbsoluteShareUrl(normalized, window.location.origin);

    try {
      const response = await fetch(requestUrl, {
        cache: 'no-store',
        credentials: 'same-origin',
      });

      if (!response.ok) {
        failedCount += 1;
        continue;
      }

      await cache.put(requestUrl, response.clone());
      cachedCount += 1;
    } catch {
      failedCount += 1;
    }
  }

  return { cachedCount, failedCount };
}

function buildSavedPaperInput(
  paper: PublicEPaperListItem | (EPaperRecord & { articles: EPaperArticleRecord[] }),
  lastOpenedPage: number
): SavedEpaperPaperInput {
  return {
    paperId: paper._id,
    title: paper.title,
    cityName: paper.cityName,
    publishDate: paper.publishDate,
    thumbnailPath: paper.thumbnailPath,
    pageCount: Math.max(1, Number(paper.pageCount || 1)),
    lastOpenedPage: Math.max(1, Number(lastOpenedPage || 1)),
  };
}

function buildSavedStoryInput(
  paper: EPaperRecord & { articles: EPaperArticleRecord[] },
  story: EPaperArticleRecord
) {
  return {
    storyId: story._id,
    storyToken: String(story.slug || story._id || '').trim(),
    paperId: paper._id,
    paperTitle: paper.title,
    cityName: paper.cityName,
    publishDate: paper.publishDate,
    title: story.title,
    excerpt: String(story.excerpt || '').trim(),
    pageNumber: Math.max(1, Number(story.pageNumber || 1)),
    coverImagePath: String(story.coverImagePath || '').trim(),
  };
}

function buildStoryTextDownload(
  paper: EPaperRecord & { articles: EPaperArticleRecord[] },
  story: EPaperArticleRecord,
  readableText: string
) {
  const lines = [
    story.title || paper.title,
    `${paper.cityName} | ${formatUiDate(paper.publishDate, paper.publishDate)}`,
    `Page ${story.pageNumber || 1}`,
    '',
    readableText.trim(),
  ].filter(Boolean);

  return lines.join('\n');
}

function buildStoryPrintHtml(options: {
  title: string;
  metaLine: string;
  excerpt: string;
  contentHtml: string;
  paragraphs: string[];
}) {
  const paragraphHtml = options.paragraphs.length
    ? options.paragraphs
        .map(
          (paragraph) =>
            `<p style="margin:0 0 1rem;font-size:1rem;line-height:1.9;">${escapeHtml(paragraph)}</p>`
        )
        .join('')
    : '';

  const bodyHtml = options.contentHtml
    ? `<article>${options.contentHtml}</article>`
    : paragraphHtml || `<p>${escapeHtml(options.excerpt)}</p>`;

  return `<!doctype html>
<html lang="hi">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(options.title)}</title>
  </head>
  <body style="margin:0;background:#ffffff;color:#111827;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
    <main style="max-width:760px;margin:0 auto;padding:2rem 1.25rem 3rem;">
      <p style="margin:0 0 0.75rem;color:#b91c1c;font-size:0.75rem;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">Lokswami e-paper</p>
      <h1 style="margin:0 0 0.75rem;font-size:2rem;line-height:1.2;">${escapeHtml(options.title)}</h1>
      <p style="margin:0 0 1.25rem;color:#6b7280;font-size:0.95rem;">${escapeHtml(options.metaLine)}</p>
      ${
        options.excerpt
          ? `<p style="margin:0 0 1.25rem;font-size:1.05rem;line-height:1.8;font-weight:600;color:#374151;">${escapeHtml(options.excerpt)}</p>`
          : ''
      }
      <section style="font-size:1rem;line-height:1.9;">${bodyHtml}</section>
    </main>
  </body>
</html>`;
}

function readSavedPagesFromStorage() {
  if (typeof window === 'undefined') return {} as Record<string, number>;
  try {
    const raw = window.localStorage.getItem(EPAPER_LAST_PAGE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};

    const cleaned: Record<string, number> = {};
    for (const [paperId, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (!paperId.trim()) continue;
      const page = Number.parseInt(String(value), 10);
      if (Number.isFinite(page) && page > 0) {
        cleaned[paperId] = Math.floor(page);
      }
    }
    return cleaned;
  } catch {
    return {};
  }
}

function getSavedPageForPaper(paperId: string) {
  if (!paperId.trim()) return 0;
  const pages = readSavedPagesFromStorage();
  const saved = pages[paperId];
  return Number.isFinite(saved) && saved > 0 ? Math.floor(saved) : 0;
}

function saveLastPageForPaper(paperId: string, pageNumber: number) {
  if (typeof window === 'undefined') return;
  if (!paperId.trim()) return;
  const safePage = Number.isFinite(pageNumber) && pageNumber > 0 ? Math.floor(pageNumber) : 1;
  try {
    const all = readSavedPagesFromStorage();
    all[paperId] = safePage;
    window.localStorage.setItem(EPAPER_LAST_PAGE_STORAGE_KEY, JSON.stringify(all));
  } catch {
    // Ignore localStorage write errors.
  }
}

function mergeUniquePapers(
  current: PublicEPaperListItem[],
  incoming: PublicEPaperListItem[]
) {
  const seen = new Set<string>();
  const merged: PublicEPaperListItem[] = [];

  [...current, ...incoming].forEach((item) => {
    const key = String(item._id || '').trim();
    if (!key || seen.has(key)) return;
    seen.add(key);
    merged.push(item);
  });

  return merged;
}

function buildReaderSearchParams(options: {
  city: EPaperCityFilter;
  publishDate: string;
  paperId?: string;
  page?: number;
  story?: string;
}) {
  const params = new URLSearchParams();

  if (options.city !== 'all') {
    params.set('city', options.city);
  }

  if (options.publishDate) {
    params.set('date', options.publishDate);
  }

  const paperId = String(options.paperId || '').trim();
  if (paperId) {
    params.set('paper', paperId);
  }

  const page = Number.parseInt(String(options.page ?? ''), 10);
  if (Number.isFinite(page) && page > 0) {
    params.set('page', String(Math.floor(page)));
  }

  const story = String(options.story || '').trim();
  if (story) {
    params.set('story', story);
  }

  return params;
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      aria-hidden="true"
      className={className}
      fill="currentColor"
    >
      <path d="M16.04 3C8.82 3 2.99 8.82 3 16.02c0 2.3.6 4.55 1.74 6.53L3 29l6.63-1.72a12.95 12.95 0 0 0 6.4 1.63H16c7.2 0 13.03-5.82 13.04-13.02A13.01 13.01 0 0 0 16.04 3zm0 23.72h-.01a10.84 10.84 0 0 1-5.52-1.5l-.4-.24-3.94 1.02 1.05-3.84-.26-.4a10.86 10.86 0 1 1 9.08 4.96zm5.95-8.12c-.33-.17-1.95-.96-2.25-1.07-.3-.11-.52-.17-.74.17-.22.33-.85 1.07-1.05 1.29-.19.22-.39.25-.72.08-.33-.17-1.38-.51-2.64-1.62-.98-.88-1.64-1.97-1.84-2.3-.19-.33-.02-.51.15-.68.15-.15.33-.39.5-.58.17-.19.22-.33.33-.55.11-.22.06-.41-.03-.58-.08-.17-.74-1.79-1.01-2.45-.26-.64-.53-.55-.74-.56h-.63c-.22 0-.58.08-.88.41-.3.33-1.16 1.13-1.16 2.75 0 1.62 1.19 3.19 1.35 3.41.17.22 2.34 3.57 5.68 5 .79.34 1.41.54 1.89.69.79.25 1.5.22 2.07.13.63-.09 1.95-.8 2.23-1.57.27-.77.27-1.43.19-1.57-.08-.14-.3-.22-.63-.38z" />
    </svg>
  );
}

export default function EPaperPageClient({
  initialItems,
  initialLimit,
  initialHasMore,
  initialNextCursor,
  initialCity,
  initialPublishDate,
}: EPaperPageClientProps) {
  const language = useAppStore((state) => state.language);
  const setEpaperReaderOpen = useAppStore((state) => state.setEpaperReaderOpen);
  const prefersReducedMotion = useReducedMotion();
  const t = COPY[language];
  const [selectedCity, setSelectedCity] = useState<EPaperCityFilter>(initialCity);
  const [selectedPublishDate, setSelectedPublishDate] = useState(initialPublishDate);
  const [epapers, setEpapers] = useState<PublicEPaperListItem[]>(
    Array.isArray(initialItems) ? initialItems : []
  );
  const [loadingList, setLoadingList] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreList, setHasMoreList] = useState(initialHasMore);
  const [nextCursor, setNextCursor] = useState<PublicCursor | null>(initialNextCursor);
  const [listLimit] = useState(
    Number.isFinite(initialLimit) && initialLimit > 0 ? initialLimit : 20
  );
  const [hasInitializedListEffect, setHasInitializedListEffect] = useState(false);
  const [error, setError] = useState('');
  const [readerSidebarView, setReaderSidebarView] = useState<ReaderSidebarView>('pages');
  const [readerDisplayMode, setReaderDisplayMode] = useState<'single' | 'spread'>('single');
  const [isDesktopPageRailVisible, setIsDesktopPageRailVisible] = useState(true);
  const [isDesktopContextRailVisible, setIsDesktopContextRailVisible] = useState(true);

  const [activePaper, setActivePaper] = useState<(EPaperRecord & { articles: EPaperArticleRecord[] }) | null>(null);
  const [activePage, setActivePage] = useState(1);
  const [activeArticle, setActiveArticle] = useState<EPaperArticleRecord | null>(null);
  const [articleReaderMode, setArticleReaderMode] = useState<ArticleReaderMode>('story');
  const [articleTextScale, setArticleTextScale] = useState(1);
  const [isPreparingArticleListen, setIsPreparingArticleListen] = useState(false);
  const [isPlayingArticleAudio, setIsPlayingArticleAudio] = useState(false);
  const [articleListenError, setArticleListenError] = useState('');
  const [pendingStorySlug, setPendingStorySlug] = useState('');
  const [savedPapers, setSavedPapers] = useState<SavedEpaperPaperEntry[]>([]);
  const [savedStories, setSavedStories] = useState<SavedEpaperStoryEntry[]>([]);
  const [readerNotice, setReaderNotice] = useState<ReaderActionNotice | null>(null);
  const [isSavingIssue, setIsSavingIssue] = useState(false);
  const [isSavingStory, setIsSavingStory] = useState(false);
  const [isPreparingOfflinePaper, setIsPreparingOfflinePaper] = useState(false);

  const [pdfFallbackPreview, setPdfFallbackPreview] = useState('');
  const [loadingFallback, setLoadingFallback] = useState(false);
  const [fallbackError, setFallbackError] = useState('');
  const [previewZoom, setPreviewZoom] = useState(1);
  const [articleImageZoom, setArticleImageZoom] = useState(1);
  const [pageTurnDirection, setPageTurnDirection] = useState(0);
  const [isCoarsePointer, setIsCoarsePointer] = useState(false);

  const [pendingPaperId, setPendingPaperId] = useState('');
  const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);
  const loadMoreLockRef = useRef(false);
  const articleActionMenuRef = useRef<HTMLDetailsElement | null>(null);
  const articlePinchStateRef = useRef<ArticlePinchState>({
    startDistance: 0,
    startZoom: 1,
    isPinching: false,
  });
  const previewPinchStateRef = useRef<ArticlePinchState>({
    startDistance: 0,
    startZoom: 1,
    isPinching: false,
  });
  const articleTapStateRef = useRef<ArticleTapState>({
    lastTapAt: 0,
    lastTapX: 0,
    lastTapY: 0,
  });
  const pageSwipeStateRef = useRef<PageSwipeState>({
    startX: 0,
    startY: 0,
    tracking: false,
  });
  const articleAudioRef = useRef<HTMLAudioElement | null>(null);
  const hasArchiveFilters = selectedCity !== 'all' || Boolean(selectedPublishDate);
  const syncSavedLibrary = useCallback(() => {
    setSavedPapers(readSavedEpaperPapers());
    setSavedStories(readSavedEpaperStories());
  }, []);
  const showReaderNotice = useCallback((tone: ReaderActionNotice['tone'], message: string) => {
    setReaderNotice({ tone, message });
  }, []);

  const buildListQueryParams = useCallback(
    (cursor?: PublicCursor | null) => {
      const query = new URLSearchParams({
        limit: String(listLimit),
      });

      if (selectedCity !== 'all') {
        query.set('citySlug', selectedCity);
      }
      if (selectedPublishDate) {
        query.set('date', selectedPublishDate);
      }
      if (cursor?.publishedAt && cursor.id) {
        query.set('cursorPublishedAt', cursor.publishedAt);
        query.set('cursorId', cursor.id);
      }

      return query;
    },
    [listLimit, selectedCity, selectedPublishDate]
  );

  const onPublishDateChange = useCallback((nextValue: string) => {
    setSelectedPublishDate(nextValue);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paper = (params.get('paper') || '').trim();
    const page = Number.parseInt(params.get('page') || '', 10);
    const story = (params.get('story') || '').trim();

    if (paper) {
      setPendingPaperId(paper);
    }

    if (Number.isFinite(page) && page > 0) {
      setActivePage(Math.floor(page));
    }

    if (story) {
      setPendingStorySlug(story);
    }
  }, []);

  useEffect(() => {
    syncSavedLibrary();

    const handleStorage = (event: StorageEvent) => {
      if (event.storageArea !== window.localStorage) return;
      syncSavedLibrary();
    };

    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('storage', handleStorage);
    };
  }, [syncSavedLibrary]);

  useEffect(() => {
    if (!readerNotice) return;
    const timeoutId = window.setTimeout(() => {
      setReaderNotice(null);
    }, 4200);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [readerNotice]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;

    const mediaQuery = window.matchMedia('(pointer: coarse)');
    const updatePointerMode = () => setIsCoarsePointer(mediaQuery.matches);
    updatePointerMode();

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', updatePointerMode);
      return () => mediaQuery.removeEventListener('change', updatePointerMode);
    }

    mediaQuery.addListener(updatePointerMode);
    return () => mediaQuery.removeListener(updatePointerMode);
  }, []);

  useEffect(() => {
    setEpaperReaderOpen(Boolean(activePaper));
  }, [activePaper, setEpaperReaderOpen]);

  useEffect(() => {
    return () => {
      setEpaperReaderOpen(false);
    };
  }, [setEpaperReaderOpen]);

  useEffect(() => {
    if (!hasInitializedListEffect) {
      setHasInitializedListEffect(true);
      return;
    }

    let cancelled = false;

    const loadFilteredFirstPage = async () => {
      setLoadingList(true);
      setError('');
      try {
        const response = await fetch(`/api/epapers/latest?${buildListQueryParams().toString()}`, {
          cache: 'no-store',
        });
        const payload = (await response.json()) as LatestListResponse;
        if (!response.ok) {
          throw new Error(payload.error || 'Failed to load e-papers');
        }
        if (cancelled) return;

        const items = Array.isArray(payload.items) ? payload.items : [];
        setEpapers(items);
        setHasMoreList(Boolean(payload.hasMore));
        setNextCursor(
          payload.nextCursor &&
            typeof payload.nextCursor.publishedAt === 'string' &&
            typeof payload.nextCursor.id === 'string'
            ? payload.nextCursor
            : null
        );
      } catch (err: unknown) {
        if (cancelled || isAbortError(err)) return;
        setError(toErrorMessage(err, 'Failed to load e-papers'));
        setEpapers([]);
        setHasMoreList(false);
        setNextCursor(null);
      } finally {
        if (!cancelled) {
          setLoadingList(false);
        }
      }
    };

    void loadFilteredFirstPage();
    return () => {
      cancelled = true;
    };
  }, [
    hasInitializedListEffect,
    buildListQueryParams,
  ]);

  const loadMorePapers = useCallback(async () => {
    if (loadMoreLockRef.current || isLoadingMore || !hasMoreList) return;

    loadMoreLockRef.current = true;
    setIsLoadingMore(true);
    setError('');
    try {
      const response = await fetch(`/api/epapers/latest?${buildListQueryParams(nextCursor).toString()}`, {
        cache: 'no-store',
      });
      const payload = (await response.json()) as LatestListResponse;
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to load more e-papers');
      }

      const incoming = Array.isArray(payload.items) ? payload.items : [];
      if (incoming.length) {
        setEpapers((current) => mergeUniquePapers(current, incoming));
      }
      setHasMoreList(Boolean(payload.hasMore));
      setNextCursor(
        payload.nextCursor &&
          typeof payload.nextCursor.publishedAt === 'string' &&
          typeof payload.nextCursor.id === 'string'
          ? payload.nextCursor
          : null
      );
    } catch (err: unknown) {
      if (!isAbortError(err)) {
        setError(toErrorMessage(err, 'Failed to load more e-papers'));
      }
    } finally {
      setIsLoadingMore(false);
      loadMoreLockRef.current = false;
    }
  }, [buildListQueryParams, hasMoreList, isLoadingMore, nextCursor]);

  useEffect(() => {
    const sentinel = loadMoreSentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const firstEntry = entries[0];
        if (!firstEntry?.isIntersecting) return;
        if (activePaper) return;
        if (loadMoreLockRef.current || isLoadingMore || !hasMoreList) return;
        void loadMorePapers();
      },
      {
        root: null,
        rootMargin: '320px 0px',
        threshold: 0.01,
      }
    );

    observer.observe(sentinel);
    return () => {
      observer.disconnect();
    };
  }, [activePaper, hasMoreList, isLoadingMore, loadMorePapers]);

  const openPaper = useCallback(async (paperId: string, initialPage?: number) => {
    setError('');
    try {
      let payload: DetailResponse | null = null;

      try {
        const response = await fetch(`/api/epapers/${paperId}`);
        const parsed = (await response.json()) as DetailResponse;
        if (!response.ok || !parsed.success || !parsed.data) {
          throw new Error(parsed.error || 'Failed to open e-paper');
        }
        payload = parsed;
      } catch (networkError) {
        const cachedPayload = await readCachedJson<DetailResponse>(`/api/epapers/${paperId}`);
        if (!cachedPayload?.success || !cachedPayload.data) {
          throw networkError;
        }
        payload = cachedPayload;
        showReaderNotice('info', t.offlineCachedNotice);
      }

      if (!payload?.data) {
        throw new Error('Failed to open e-paper');
      }

      const explicitInitialPage =
        Number.isFinite(initialPage) && Number(initialPage) > 0 ? Math.floor(Number(initialPage)) : 0;
      const savedPage = explicitInitialPage ? 0 : getSavedPageForPaper(paperId);
      const savedPaperEntry = savedPapers.find((item) => item.paperId === paperId);
      const pageToOpen =
        explicitInitialPage ||
        savedPage ||
        (savedPaperEntry?.lastOpenedPage ? Math.floor(savedPaperEntry.lastOpenedPage) : 0) ||
        1;

      setActivePaper(payload.data);
      setPageTurnDirection(0);
      setActivePage(
        clampPage(pageToOpen, 1, Math.max(1, Number(payload.data.pageCount || 1)))
      );
      setActiveArticle(null);
      setPreviewZoom(1);
      setPdfFallbackPreview('');
      setFallbackError('');
    } catch (err: unknown) {
      setError(toErrorMessage(err, 'Failed to open e-paper'));
    }
  }, [savedPapers, showReaderNotice, t.offlineCachedNotice]);

  useEffect(() => {
    if (!pendingPaperId) return;
    if (loadingList) return;
    const exists = epapers.some((item) => item._id === pendingPaperId);
    if (exists) {
      void openPaper(pendingPaperId, activePage);
      setPendingPaperId('');
      return;
    }

    void openPaper(pendingPaperId, activePage);
    setPendingPaperId('');
  }, [pendingPaperId, epapers, loadingList, activePage, openPaper]);

  useEffect(() => {
    if (!activePaper) return;
    const maxPages = Math.max(1, Number(activePaper.pageCount || 1));
    const resolvedPage = clampPage(activePage, 1, maxPages);
    saveLastPageForPaper(activePaper._id, resolvedPage);
    setSavedPapers(updateSavedEpaperPaperLastPage(activePaper._id, resolvedPage));
  }, [activePaper, activePage]);

  useEffect(() => {
    setArticleImageZoom(1);
    setArticleReaderMode('story');
    setArticleTextScale(1);
    setArticleListenError('');
    articleTapStateRef.current = {
      lastTapAt: 0,
      lastTapX: 0,
      lastTapY: 0,
    };
  }, [activeArticle?._id]);

  useEffect(() => {
    if (!activePaper) return;
    setReaderSidebarView('pages');
    setIsDesktopPageRailVisible(true);
    setIsDesktopContextRailVisible(true);
  }, [activePaper]);

  const activePageImage = useMemo(() => {
    if (!activePaper) return '';
    const page = activePaper.pages.find((item) => item.pageNumber === activePage);
    return String(page?.imagePath || '');
  }, [activePaper, activePage]);

  const pageArticles = useMemo(() => {
    if (!activePaper) return [];
    return activePaper.articles.filter((item) => item.pageNumber === activePage);
  }, [activePaper, activePage]);

  const goToRelativePage = useCallback(
    (delta: number) => {
      if (!activePaper || !delta) return;
      const maxPages = Math.max(1, Number(activePaper.pageCount || 1));
      const step = readerDisplayMode === 'spread' && maxPages > 1 ? 2 : 1;

      setActivePage((current) => {
        const nextPage = clampPage(current + delta * step, 1, maxPages);
        if (nextPage !== current) {
          setPageTurnDirection(delta > 0 ? 1 : -1);
          setActiveArticle(null);
        }
        return nextPage;
      });
    },
    [activePaper, readerDisplayMode]
  );

  const navigateToPage = useCallback(
    (nextPage: number) => {
      if (!activePaper) return;
      const maxPages = Math.max(1, Number(activePaper.pageCount || 1));

      setActivePage((current) => {
        const resolvedPage = clampPage(nextPage, 1, maxPages);
        if (resolvedPage !== current) {
          setPageTurnDirection(resolvedPage > current ? 1 : -1);
          setActiveArticle(null);
        }
        return resolvedPage;
      });
    },
    [activePaper]
  );

  const zoomPreviewOut = useCallback(() => {
    setPreviewZoom((current) =>
      Math.max(MIN_PREVIEW_ZOOM, Number((current - PREVIEW_ZOOM_STEP).toFixed(2)))
    );
  }, []);

  const zoomPreviewIn = useCallback(() => {
    setPreviewZoom((current) =>
      Math.min(MAX_PREVIEW_ZOOM, Number((current + PREVIEW_ZOOM_STEP).toFixed(2)))
    );
  }, []);

  useEffect(() => {
    if (!activePaper || !pendingStorySlug) return;

    const matchedArticle = activePaper.articles.find(
      (item) => item.slug === pendingStorySlug || item._id === pendingStorySlug
    );

    if (!matchedArticle) return;

    navigateToPage(matchedArticle.pageNumber);
    setActiveArticle(matchedArticle);
    setPendingStorySlug('');
  }, [activePaper, pendingStorySlug, navigateToPage]);

  useEffect(() => {
    if (!activePaper) return;
    if (readerDisplayMode !== 'spread') return;
    if (activePaper.pageCount <= 1) {
      setReaderDisplayMode('single');
      return;
    }

    const maxStartPage = Math.max(1, activePaper.pageCount - 1);
    if (activePage > maxStartPage) {
      setActivePage(maxStartPage);
    }
  }, [activePage, activePaper, readerDisplayMode]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const effectivePaperId = activePaper?._id || pendingPaperId;
    const effectiveStoryToken = String(
      activeArticle?.slug || activeArticle?._id || pendingStorySlug || ''
    ).trim();
    const effectivePage = effectivePaperId ? activePage : 0;
    const params = buildReaderSearchParams({
      city: selectedCity,
      publishDate: selectedPublishDate,
      paperId: effectivePaperId,
      page: effectivePage,
      story: effectiveStoryToken,
    });
    const nextUrl = params.toString()
      ? `${window.location.pathname}?${params.toString()}`
      : window.location.pathname;

    window.history.replaceState(window.history.state, '', nextUrl);
  }, [
    activeArticle?._id,
    activeArticle?.slug,
    activePage,
    activePaper?._id,
    pendingPaperId,
    pendingStorySlug,
    selectedCity,
    selectedPublishDate,
  ]);

  const activePageMeta = useMemo(() => {
    if (!activePaper) return null;
    return activePaper.pages.find((item) => item.pageNumber === activePage) || null;
  }, [activePaper, activePage]);
  const pageSummaries = useMemo(() => {
    if (!activePaper) return [] as ReaderPageSummary[];

    const pageMetaByNumber = new Map(
      activePaper.pages.map((item) => [
        item.pageNumber,
        {
          imagePath: String(item.imagePath || ''),
          width: Number(item.width || 0) || 1200,
          height: Number(item.height || 0) || 1600,
        },
      ])
    );
    const articlesByPage = new Map<number, EPaperArticleRecord[]>();
    activePaper.articles.forEach((article) => {
      const pageNumber = Number(article.pageNumber || 0);
      if (!pageNumber) return;
      const current = articlesByPage.get(pageNumber) || [];
      current.push(article);
      articlesByPage.set(pageNumber, current);
    });

    return Array.from({ length: Math.max(1, activePaper.pageCount) }, (_, index) => {
      const pageNumber = index + 1;
      const meta = pageMetaByNumber.get(pageNumber);
      const articles = articlesByPage.get(pageNumber) || [];

      return {
        pageNumber,
        imagePath: meta?.imagePath || '',
        width: meta?.width || 1200,
        height: meta?.height || 1600,
        articles,
        storyCount: articles.length,
      };
    });
  }, [activePaper]);
  const editionArticlesByPage = useMemo(
    () => pageSummaries.filter((item) => item.storyCount > 0),
    [pageSummaries]
  );
  const canUseSpreadMode = Boolean(activePaper && activePaper.pageCount > 1);
  const shouldShowSpreadMode = canUseSpreadMode && readerDisplayMode === 'spread';
  const spreadCompanionPage = useMemo(() => {
    if (!shouldShowSpreadMode) return null;
    return pageSummaries.find((item) => item.pageNumber === activePage + 1) || null;
  }, [activePage, pageSummaries, shouldShowSpreadMode]);
  const previewSrc = activePageImage || pdfFallbackPreview;
  const previewIsDataUrl = previewSrc.startsWith('data:');
  const previewWidth = activePageMeta?.width || 1200;
  const previewHeight = activePageMeta?.height || 1600;
  const maxReaderPage = Math.max(1, Number(activePaper?.pageCount || 1));
  const maxSpreadStartPage = Math.max(1, maxReaderPage - 1);
  const canGoPreviousPage = activePage > 1;
  const canGoNextPage = shouldShowSpreadMode
    ? activePage < maxSpreadStartPage
    : activePage < maxReaderPage;
  const pdfProxyUrl = useMemo(() => {
    if (!activePaper) return '';
    return buildEpaperPdfProxyUrl(String(activePaper._id || ''));
  }, [activePaper]);
  const pdfUrlForOpen = pdfProxyUrl;
  const activePaperLibraryInput = useMemo(
    () => (activePaper ? buildSavedPaperInput(activePaper, activePage) : null),
    [activePaper, activePage]
  );
  const isActivePaperSaved = Boolean(
    activePaper && savedPapers.some((entry) => entry.paperId === activePaper._id && entry.saved)
  );
  const isActivePaperOfflineReady = Boolean(
    activePaper &&
      savedPapers.some((entry) => entry.paperId === activePaper._id && entry.offlineReady)
  );
  const activeArticleSavedToken = String(activeArticle?._id || '').trim();
  const isActiveArticleSaved = Boolean(
    activeArticleSavedToken &&
      savedStories.some((entry) => entry.storyId === activeArticleSavedToken)
  );
  const savedPaperCards = useMemo(() => savedPapers.slice(0, 6), [savedPapers]);
  const savedStoryCards = useMemo(() => savedStories.slice(0, 8), [savedStories]);

  useEffect(() => {
    let cancelled = false;
    const loadFallback = async () => {
      if (!activePaper) return;
      if (activePageImage) {
        setPdfFallbackPreview('');
        setFallbackError('');
        setLoadingFallback(false);
        return;
      }

      setLoadingFallback(true);
      setFallbackError('');
      try {
        if (!pdfProxyUrl) {
          throw new Error('PDF URL is missing');
        }
        const rendered = await renderPdfPagePreviewFromUrl(pdfProxyUrl, {
          page: activePage,
          targetWidth: 1600,
        });
        if (cancelled) return;
        setPdfFallbackPreview(rendered.dataUrl);
      } catch (err: unknown) {
        if (cancelled) return;
        setPdfFallbackPreview('');
        setFallbackError(toErrorMessage(err, 'Failed to render PDF page'));
      } finally {
        if (!cancelled) setLoadingFallback(false);
      }
    };

    void loadFallback();
    return () => {
      cancelled = true;
    };
  }, [activePaper, activePage, activePageImage, pdfProxyUrl]);

  useEffect(() => {
    if (!activePaper) return;

    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setActivePaper(null);
        setActiveArticle(null);
        return;
      }

      if (event.key === 'ArrowLeft') {
        goToRelativePage(-1);
      }

      if (event.key === 'ArrowRight') {
        goToRelativePage(1);
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeydown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeydown);
    };
  }, [activePaper, goToRelativePage]);

  const openPdfInNewTab = () => {
    if (!pdfUrlForOpen) return;
    const opened = window.open(pdfUrlForOpen, '_blank', 'noopener,noreferrer');
    if (!opened) {
      window.location.href = pdfUrlForOpen;
    }
  };

  const shareActivePaperOnWhatsApp = async () => {
    if (!activePaper) return;

    const params = buildReaderSearchParams({
      city: selectedCity,
      publishDate: selectedPublishDate,
      paperId: activePaper._id,
      page: activePage,
    });

    const shareUrl = `${window.location.origin}/main/epaper?${params.toString()}`;
    const shareText = `${activePaper.title}\n${shareUrl}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: activePaper.title,
          text: shareText,
          url: shareUrl,
        });
        return;
      } catch (error: unknown) {
        if (isAbortError(error)) return;
      }
    }

    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
    const opened = window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
    if (!opened) {
      window.location.href = whatsappUrl;
    }
  };

  const buildActiveArticleShareUrl = () => {
    if (!activePaper || !activeArticle) return '';

    const storyToken = String(activeArticle.slug || activeArticle._id || '').trim();
    const params = buildReaderSearchParams({
      city: selectedCity,
      publishDate: selectedPublishDate,
      paperId: activePaper._id,
      page: activeArticle.pageNumber || activePage,
      story: storyToken,
    });

    return `${window.location.origin}/main/epaper?${params.toString()}`;
  };

  const shareActiveArticleOnWhatsApp = async () => {
    if (!activePaper || !activeArticle) return;

    const shareUrl = buildActiveArticleShareUrl();
    const imageUrl = activeArticle.coverImagePath
      ? toAbsoluteShareUrl(activeArticle.coverImagePath, window.location.origin)
      : '';
    const whatsappUrl = buildArticleWhatsAppShareUrl({
      title: activeArticle.title || activePaper.title,
      articleUrl: shareUrl,
      imageUrl,
    });

    const opened = window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
    if (!opened) {
      window.location.href = whatsappUrl;
    }
  };

  const shareActiveArticle = async () => {
    if (!activePaper || !activeArticle) return;

    const shareUrl = buildActiveArticleShareUrl();
    const shareText = activeArticle.title || activePaper.title;

    if (navigator.share) {
      try {
        await navigator.share({
          title: activeArticle.title || activePaper.title,
          text: shareText,
          url: shareUrl || undefined,
        });
        return;
      } catch (error: unknown) {
        if (isAbortError(error)) return;
      }
    }

    await shareActiveArticleOnWhatsApp();
  };

  const handleIssueSaveToggle = useCallback(() => {
    if (!activePaperLibraryInput) return;

    setIsSavingIssue(true);
    try {
      const result = toggleSavedEpaperPaper(activePaperLibraryInput);
      setSavedPapers(result.papers);
      showReaderNotice(
        'success',
        result.saved ? t.issueSavedNotice : t.issueRemovedNotice
      );
    } finally {
      setIsSavingIssue(false);
    }
  }, [activePaperLibraryInput, showReaderNotice, t.issueRemovedNotice, t.issueSavedNotice]);

  const handleOfflinePaperSave = useCallback(async () => {
    if (!activePaper || !activePaperLibraryInput || isPreparingOfflinePaper) return;

    if (typeof window === 'undefined' || !('caches' in window)) {
      showReaderNotice('error', t.offlineUnsupported);
      return;
    }

    setIsPreparingOfflinePaper(true);
    try {
      const urlSet = new Set<string>();
      urlSet.add('/main/epaper');
      urlSet.add(
        `/main/epaper?${buildReaderSearchParams({
          city: selectedCity,
          publishDate: selectedPublishDate,
          paperId: activePaper._id,
          page: activePage,
        }).toString()}`
      );
      urlSet.add(`/api/epapers/${activePaper._id}`);
      urlSet.add(`/api/public/epapers/${activePaper._id}/pdf`);

      if (activePaper.thumbnailPath) {
        urlSet.add(activePaper.thumbnailPath);
      }

      activePaper.pages.forEach((page) => {
        if (page.imagePath) {
          urlSet.add(page.imagePath);
        }
      });

      activePaper.articles.forEach((story) => {
        if (story.coverImagePath) {
          urlSet.add(story.coverImagePath);
        }
      });

      const result = await cacheUrlsForOffline(Array.from(urlSet));
      if (result.cachedCount <= 0) {
        throw new Error('offline-cache-empty');
      }
      const nextState = setSavedEpaperPaperOfflineReady(activePaperLibraryInput, true);
      setSavedPapers(nextState.papers);

      showReaderNotice(
        result.failedCount > 0 ? 'info' : 'success',
        result.failedCount > 0 ? t.offlinePartialNotice : t.offlineReadyNotice
      );
    } catch (error) {
      const message =
        error instanceof Error &&
        (error.message === 'offline-unsupported' || error.message === 'offline-cache-empty')
          ? t.offlineUnsupported
          : t.offlineUnsupported;
      showReaderNotice('error', message);
    } finally {
      setIsPreparingOfflinePaper(false);
    }
  }, [
    activePage,
    activePaper,
    activePaperLibraryInput,
    isPreparingOfflinePaper,
    selectedCity,
    selectedPublishDate,
    showReaderNotice,
    t.offlinePartialNotice,
    t.offlineReadyNotice,
    t.offlineUnsupported,
  ]);

  const handlePdfDownload = useCallback(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined' || !pdfUrlForOpen) {
      return;
    }

    const anchor = document.createElement('a');
    anchor.href = pdfUrlForOpen;
    anchor.download = `${slugifyDownloadName(activePaper?.title || 'lokswami-epaper')}.pdf`;
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }, [activePaper?.title, pdfUrlForOpen]);

  const handleOpenSavedPaper = useCallback(
    (paper: SavedEpaperPaperEntry) => {
      void openPaper(paper.paperId, paper.lastOpenedPage || 1);
    },
    [openPaper]
  );

  const handleOpenSavedStory = useCallback(
    (story: SavedEpaperStoryEntry) => {
      setPendingStorySlug(story.storyToken);
      void openPaper(story.paperId, story.pageNumber || 1);
    },
    [openPaper]
  );

  const stopArticleListening = useCallback((suppressState = false) => {
    if (articleAudioRef.current) {
      articleAudioRef.current.pause();
      articleAudioRef.current.currentTime = 0;
      articleAudioRef.current = null;
    }

    if (!suppressState) {
      setIsPreparingArticleListen(false);
      setIsPlayingArticleAudio(false);
    }
  }, []);
  const closeArticleActionMenu = useCallback(() => {
    articleActionMenuRef.current?.removeAttribute('open');
  }, []);

  useEffect(() => {
    if (!activeArticle) {
      stopArticleListening(true);
      setIsPreparingArticleListen(false);
      setIsPlayingArticleAudio(false);
      setArticleListenError('');
    }
  }, [activeArticle, stopArticleListening]);

  useEffect(() => {
    return () => {
      stopArticleListening(true);
    };
  }, [stopArticleListening]);

  const activeArticleHasImage = Boolean(activeArticle?.coverImagePath?.trim());
  const activeArticleHasContent = Boolean(activeArticle?.contentHtml?.trim());
  const activeArticleHasExcerpt = Boolean(activeArticle?.excerpt?.trim());
  const activeArticlePlainText = useMemo(() => {
    if (!activeArticle || !activePaper) return '';

    const contentText = activeArticle.contentHtml ? toPlainText(activeArticle.contentHtml) : '';
    if (contentText) return contentText.slice(0, 8000);

    const excerptText = String(activeArticle.excerpt || '').trim();
    if (excerptText) return excerptText.slice(0, 2400);

    const context = [
      activeArticle.title || t.story,
      `${activePaper.cityName} e-paper`,
      `${t.page} ${activeArticle.pageNumber || activePage}`,
      activePaper.publishDate
        ? formatUiDate(activePaper.publishDate, activePaper.publishDate)
        : '',
    ]
      .filter(Boolean)
      .join('. ');
    return context.trim();
  }, [activeArticle, activePage, activePaper, t.page, t.story]);
  const activeArticleParagraphs = useMemo(
    () => splitTextParagraphs(activeArticlePlainText),
    [activeArticlePlainText]
  );
  const activeArticleReadableTextState = activeArticleHasContent
    ? 'full'
    : activeArticleHasExcerpt
      ? 'excerpt'
      : activeArticlePlainText
        ? 'fallback'
        : 'none';
  const activeArticleTextBadgeLabel =
    activeArticleReadableTextState === 'full'
      ? t.readerTextReady
      : activeArticleReadableTextState === 'excerpt'
        ? t.readerTextExcerpt
        : t.readerTextFallback;
  const activeArticleTextHelp =
    activeArticleReadableTextState === 'excerpt'
      ? t.readerTextExcerptHelp
      : activeArticleReadableTextState === 'fallback'
        ? t.readerTextFallbackHelp
        : '';
  const activeArticlePreviewText = useMemo(() => {
    if (activeArticleHasExcerpt) {
      return String(activeArticle?.excerpt || '').trim();
    }

    return activeArticleParagraphs.slice(0, 2).join(' ').trim();
  }, [activeArticle?.excerpt, activeArticleHasExcerpt, activeArticleParagraphs]);
  const shouldShowStoryReaderStopAction = isPreparingArticleListen || isPlayingArticleAudio;
  const activeArticleListenSourceText = useMemo(() => {
    if (!activeArticle || !activePaper) return '';
    const parts = [
      String(activeArticle.title || activePaper.title || '').trim(),
      activeArticlePlainText,
    ]
      .filter(Boolean)
      .join('. ');
    return parts.slice(0, 2400);
  }, [activeArticle, activeArticlePlainText, activePaper]);
  const handleStorySaveToggle = useCallback(() => {
    if (!activePaper || !activeArticle) return;

    setIsSavingStory(true);
    try {
      const result = toggleSavedEpaperStory(buildSavedStoryInput(activePaper, activeArticle));
      setSavedStories(result.stories);
      showReaderNotice(
        'success',
        result.saved ? t.storySavedNotice : t.storyRemovedNotice
      );
    } finally {
      setIsSavingStory(false);
    }
  }, [
    activeArticle,
    activePaper,
    showReaderNotice,
    t.storyRemovedNotice,
    t.storySavedNotice,
  ]);
  const handleStoryTextDownload = useCallback(() => {
    if (!activePaper || !activeArticle) return;
    if (!activeArticlePlainText.trim()) {
      showReaderNotice('error', t.textDownloadUnavailable);
      return;
    }

    const filename = `${slugifyDownloadName(activeArticle.title || activePaper.title)}.txt`;
    const content = buildStoryTextDownload(activePaper, activeArticle, activeArticlePlainText);
    triggerTextDownload(filename, content);
  }, [
    activeArticle,
    activeArticlePlainText,
    activePaper,
    showReaderNotice,
    t.textDownloadUnavailable,
  ]);
  const handleStoryPrint = useCallback(() => {
    if (typeof window === 'undefined' || !activePaper || !activeArticle) return;

    const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=960,height=720');
    if (!printWindow) {
      showReaderNotice('error', t.printBlocked);
      return;
    }

    const metaLine = [
      activePaper.cityName,
      formatUiDate(activePaper.publishDate, activePaper.publishDate),
      `${t.page} ${activeArticle.pageNumber || activePage}`,
    ]
      .filter(Boolean)
      .join(' | ');

    const html = buildStoryPrintHtml({
      title: activeArticle.title || activePaper.title,
      metaLine,
      excerpt: String(activeArticle.excerpt || '').trim(),
      contentHtml: activeArticle.contentHtml || '',
      paragraphs: activeArticleHasContent ? [] : activeArticleParagraphs,
    });

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    window.setTimeout(() => {
      printWindow.print();
    }, 180);
  }, [
    activeArticle,
    activeArticleHasContent,
    activeArticleParagraphs,
    activePage,
    activePaper,
    showReaderNotice,
    t.page,
    t.printBlocked,
  ]);
  const handleArticleListen = useCallback(async () => {
    const sourceText = activeArticleListenSourceText.trim();
    if (!sourceText) {
      setArticleListenError(t.noReadableText);
      return;
    }

    setArticleListenError('');
    setIsPreparingArticleListen(true);
    stopArticleListening(true);

    try {
      const payload = await requestTtsAudio({
        text: sourceText,
        languageCode: 'hi-IN',
      });
      const src = buildTtsAudioSource(payload);

      if (!src) {
        throw new Error('Gemini TTS returned no audio payload.');
      }

      const audio = new Audio(src);
      articleAudioRef.current = audio;
      audio.onended = () => {
        setIsPlayingArticleAudio(false);
      };
      audio.onerror = () => {
        setIsPlayingArticleAudio(false);
        setArticleListenError(t.audioUnavailable);
      };

      await audio.play();
      setIsPlayingArticleAudio(true);
    } catch (error) {
      setArticleListenError(toErrorMessage(error, t.audioUnavailable));
    } finally {
      setIsPreparingArticleListen(false);
    }
  }, [activeArticleListenSourceText, stopArticleListening, t.audioUnavailable, t.noReadableText]);
  const shouldShowNoArticleState =
    Boolean(activeArticle) &&
    !activeArticleHasImage &&
    !activeArticleHasContent &&
    !activeArticleHasExcerpt;
  const hasReadableArticleText = activeArticleReadableTextState !== 'none';

  const pageTurnVariants = useMemo(
    () => ({
      enter: (direction: number) =>
        prefersReducedMotion
          ? { opacity: 0 }
          : {
              opacity: 0,
              x: direction >= 0 ? 72 : -72,
              scale: 0.985,
              rotateY: direction >= 0 ? -8 : 8,
              filter: 'blur(4px)',
            },
      center: prefersReducedMotion
        ? {
            opacity: 1,
            transition: { duration: 0.16 },
          }
        : {
            opacity: 1,
            x: 0,
            scale: 1,
            rotateY: 0,
            filter: 'blur(0px)',
            transition: {
              type: 'spring',
              stiffness: 220,
              damping: 28,
              mass: 0.9,
            },
          },
      exit: (direction: number) =>
        prefersReducedMotion
          ? { opacity: 0 }
          : {
              opacity: 0,
              x: direction >= 0 ? -52 : 52,
              scale: 0.99,
              rotateY: direction >= 0 ? 6 : -6,
              filter: 'blur(3px)',
              transition: {
                duration: 0.18,
                ease: [0.22, 1, 0.36, 1],
              },
            },
    }),
    [prefersReducedMotion]
  );

  const toggleArticleImageZoom = () => {
    setArticleImageZoom((current) =>
      current > MIN_ARTICLE_IMAGE_ZOOM + 0.05
        ? MIN_ARTICLE_IMAGE_ZOOM
        : Math.min(MAX_ARTICLE_IMAGE_ZOOM, ARTICLE_DOUBLE_TAP_ZOOM)
    );
  };

  const onArticleImageTouchStart = (event: ReactTouchEvent<HTMLDivElement>) => {
    if (event.touches.length !== 2) return;
    const distance = getTouchDistance(event.touches);
    if (!distance) return;

    articlePinchStateRef.current = {
      startDistance: distance,
      startZoom: articleImageZoom,
      isPinching: true,
    };
  };

  const onArticleImageTouchMove = (event: ReactTouchEvent<HTMLDivElement>) => {
    if (event.touches.length !== 2 || !articlePinchStateRef.current.isPinching) return;

    const distance = getTouchDistance(event.touches);
    if (!distance || articlePinchStateRef.current.startDistance <= 0) return;

    event.preventDefault();

    const nextZoom = Math.min(
      MAX_ARTICLE_IMAGE_ZOOM,
      Math.max(
        MIN_ARTICLE_IMAGE_ZOOM,
        Number(
          (
            articlePinchStateRef.current.startZoom *
            (distance / articlePinchStateRef.current.startDistance)
          ).toFixed(2)
        )
      )
    );

    setArticleImageZoom(nextZoom);
  };

  const onArticleImageTouchEnd = (event: ReactTouchEvent<HTMLDivElement>) => {
    if (!event.changedTouches.length) {
      articlePinchStateRef.current = {
        startDistance: 0,
        startZoom: articleImageZoom,
        isPinching: false,
      };
      return;
    }

    if (articlePinchStateRef.current.isPinching) {
      articlePinchStateRef.current = {
        startDistance: 0,
        startZoom: articleImageZoom,
        isPinching: false,
      };
      articleTapStateRef.current = {
        lastTapAt: 0,
        lastTapX: 0,
        lastTapY: 0,
      };
      return;
    }

    if (event.changedTouches.length === 1) {
      const touch = event.changedTouches[0];
      const now = Date.now();
      const deltaTime = now - articleTapStateRef.current.lastTapAt;
      const deltaX = touch.clientX - articleTapStateRef.current.lastTapX;
      const deltaY = touch.clientY - articleTapStateRef.current.lastTapY;
      const moveDistance = Math.hypot(deltaX, deltaY);

      if (
        deltaTime > 0 &&
        deltaTime <= ARTICLE_DOUBLE_TAP_DELAY_MS &&
        moveDistance <= ARTICLE_DOUBLE_TAP_MOVE_PX
      ) {
        event.preventDefault();
        toggleArticleImageZoom();
        articleTapStateRef.current = {
          lastTapAt: 0,
          lastTapX: 0,
          lastTapY: 0,
        };
      } else {
        articleTapStateRef.current = {
          lastTapAt: now,
          lastTapX: touch.clientX,
          lastTapY: touch.clientY,
        };
      }
    }

    articlePinchStateRef.current = {
      startDistance: 0,
      startZoom: articleImageZoom,
      isPinching: false,
    };
  };

  const onPreviewTouchStart = (event: ReactTouchEvent<HTMLDivElement>) => {
    if (!isCoarsePointer || activeArticle) return;

    if (event.touches.length === 2) {
      const distance = getTouchDistance(event.touches);
      if (!distance) return;

      previewPinchStateRef.current = {
        startDistance: distance,
        startZoom: previewZoom,
        isPinching: true,
      };
      pageSwipeStateRef.current.tracking = false;
      return;
    }

    if (event.touches.length !== 1 || previewPinchStateRef.current.isPinching) return;

    const touch = event.touches[0];
    pageSwipeStateRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      tracking: true,
    };
  };

  const onPreviewTouchMove = (event: ReactTouchEvent<HTMLDivElement>) => {
    if (!isCoarsePointer || activeArticle) return;

    if (event.touches.length === 2) {
      if (!previewPinchStateRef.current.isPinching) {
        const distance = getTouchDistance(event.touches);
        if (!distance) return;

        previewPinchStateRef.current = {
          startDistance: distance,
          startZoom: previewZoom,
          isPinching: true,
        };
      }

      const distance = getTouchDistance(event.touches);
      if (!distance || previewPinchStateRef.current.startDistance <= 0) return;

      event.preventDefault();
      pageSwipeStateRef.current.tracking = false;

      const nextZoom = Math.min(
        MAX_PREVIEW_ZOOM,
        Math.max(
          MIN_PREVIEW_ZOOM,
          Number(
            (
              previewPinchStateRef.current.startZoom *
              (distance / previewPinchStateRef.current.startDistance)
            ).toFixed(2)
          )
        )
      );

      setPreviewZoom(nextZoom);
    }
  };

  const onPreviewTouchEnd = (event: ReactTouchEvent<HTMLDivElement>) => {
    if (previewPinchStateRef.current.isPinching) {
      if (event.touches.length < 2) {
        previewPinchStateRef.current = {
          startDistance: 0,
          startZoom: previewZoom,
          isPinching: false,
        };
      }
      pageSwipeStateRef.current.tracking = false;
      return;
    }

    if (!pageSwipeStateRef.current.tracking || event.changedTouches.length !== 1) {
      pageSwipeStateRef.current.tracking = false;
      return;
    }

    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - pageSwipeStateRef.current.startX;
    const deltaY = touch.clientY - pageSwipeStateRef.current.startY;

    pageSwipeStateRef.current.tracking = false;

    if (
      Math.abs(deltaX) < PAGE_SWIPE_TRIGGER_PX ||
      Math.abs(deltaY) > PAGE_SWIPE_VERTICAL_LIMIT_PX
    ) {
      return;
    }

    if (deltaX < 0) {
      goToRelativePage(1);
      return;
    }

    goToRelativePage(-1);
  };

  const onPreviewTouchCancel = () => {
    previewPinchStateRef.current = {
      startDistance: 0,
      startZoom: previewZoom,
      isPinching: false,
    };
    pageSwipeStateRef.current.tracking = false;
  };

  const selectedCityLabel =
    selectedCity === 'all'
      ? t.allCities
      : EPAPER_CITY_OPTIONS.find((city) => city.slug === selectedCity)?.name || selectedCity;
  const emptyStateMessage = hasArchiveFilters ? t.noPaperFiltered : t.noPaper;
  const readerPageLabel = shouldShowSpreadMode && spreadCompanionPage
    ? `${activePage}-${spreadCompanionPage.pageNumber} / ${maxReaderPage}`
    : `${activePage} / ${maxReaderPage}`;
  const activePaperStoryCount = activePaper?.articles.length || 0;
  const previewHeightOffset = isCoarsePointer
    ? shouldShowSpreadMode
      ? 228
      : 196
    : shouldShowSpreadMode
      ? 290
      : 250;
  const previewMaxHeight = `calc((100dvh - ${previewHeightOffset}px) * ${previewZoom})`;
  const desktopReaderGridClassName =
    isDesktopPageRailVisible && isDesktopContextRailVisible
      ? 'xl:grid-cols-[13rem_minmax(0,1fr)_22rem]'
      : isDesktopPageRailVisible
        ? 'xl:grid-cols-[13rem_minmax(0,1fr)]'
        : isDesktopContextRailVisible
          ? 'xl:grid-cols-[minmax(0,1fr)_22rem]'
          : 'grid-cols-1';
  const readerStageBorderClassName = [
    isDesktopPageRailVisible
      ? 'xl:border-l xl:border-gray-200 dark:xl:border-zinc-800'
      : '',
    isDesktopContextRailVisible
      ? 'xl:border-r xl:border-gray-200 dark:xl:border-zinc-800'
      : '',
  ]
    .filter(Boolean)
    .join(' ');
  const readerStageWidthClassName =
    !isDesktopPageRailVisible && !isDesktopContextRailVisible
      ? shouldShowSpreadMode
        ? 'max-w-[1360px]'
        : 'max-w-[1120px]'
      : !isDesktopPageRailVisible || !isDesktopContextRailVisible
        ? shouldShowSpreadMode
          ? 'max-w-[1280px]'
          : 'max-w-[1060px]'
        : shouldShowSpreadMode
          ? 'max-w-[1180px]'
          : 'max-w-[980px]';
  const readerSidebarSummary =
    readerSidebarView === 'pages'
      ? `${t.currentPage}: ${readerPageLabel}`
      : activePaper
        ? `${activePaper.pageCount} ${t.pages} • ${activePaperStoryCount} ${t.stories}`
        : '';

  return (
    <div className="relative pb-2 md:pb-4">
      <div className="pointer-events-none absolute -top-10 right-3 h-44 w-44 rounded-full bg-orange-200/30 blur-3xl dark:bg-orange-900/12 sm:-top-12 sm:right-6 sm:h-56 sm:w-56" />
      <div className="pointer-events-none absolute top-[24rem] -left-12 h-52 w-52 rounded-full bg-cyan-200/28 blur-3xl dark:bg-cyan-900/12 sm:top-[27rem] sm:h-64 sm:w-64" />

      {readerNotice ? (
        <div className="pointer-events-none fixed inset-x-0 top-20 z-[120] flex justify-center px-3">
          <div
            className={`pointer-events-auto inline-flex max-w-xl items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold shadow-lg backdrop-blur ${
              readerNotice.tone === 'success'
                ? 'border-emerald-300 bg-emerald-50/95 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/90 dark:text-emerald-200'
                : readerNotice.tone === 'error'
                  ? 'border-red-300 bg-red-50/95 text-red-700 dark:border-red-900 dark:bg-red-950/90 dark:text-red-200'
                  : 'border-primary-200 bg-primary-50/95 text-primary-800 dark:border-primary-800 dark:bg-primary-950/90 dark:text-primary-200'
            }`}
          >
            {readerNotice.tone === 'success' ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : null}
            <span>{readerNotice.message}</span>
          </div>
        </div>
      ) : null}

      <section className="cnp-surface p-3.5 sm:p-4 md:p-5">
        <div className="mb-4 border-b border-zinc-200/80 pb-4 dark:border-zinc-800">
          <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
            <label className="block min-w-0">
              <span className="sr-only">{t.city}</span>
              <select
                value={selectedCity}
                onChange={(event) => setSelectedCity(event.target.value as EPaperCityFilter)}
                aria-label={t.city}
                className="h-10 w-full rounded-xl border border-gray-300 bg-white px-3 text-[13px] outline-none transition focus:border-primary-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-primary-400 sm:h-11 sm:text-sm"
              >
                <option value="all">{t.allCities}</option>
                {EPAPER_CITY_OPTIONS.map((city) => (
                  <option key={city.slug} value={city.slug}>
                    {city.name}
                  </option>
                ))}
              </select>
            </label>

            <DateInputField
              value={selectedPublishDate}
              onChange={onPublishDateChange}
              onClear={() => setSelectedPublishDate('')}
              clearLabel={t.clearDate}
              ariaLabel={t.publishDate}
              className="h-10 w-full rounded-xl border border-gray-300 bg-white px-3 text-[13px] outline-none focus:border-primary-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-primary-400 sm:h-11 sm:text-sm"
            />
          </div>
        </div>

        {error ? (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </div>
        ) : null}

        {hasArchiveFilters ? (
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {selectedCity !== 'all' ? (
              <span className="inline-flex items-center rounded-full border border-zinc-300 bg-white px-3 py-1 text-xs font-semibold text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
                {selectedCityLabel}
              </span>
            ) : null}

            {selectedPublishDate ? (
              <span className="inline-flex items-center rounded-full border border-primary-200 bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-700 dark:border-primary-800 dark:bg-primary-950/40 dark:text-primary-300">
                {t.showingDate}: {formatUiDate(selectedPublishDate, selectedPublishDate)}
              </span>
            ) : null}
          </div>
        ) : null}

        {savedPaperCards.length || savedStoryCards.length ? (
          <div className="mb-4 rounded-2xl border border-zinc-200 bg-white/85 p-3.5 dark:border-zinc-800 dark:bg-zinc-900/75 sm:p-4">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-sm font-extrabold text-zinc-900 dark:text-zinc-100 sm:text-base">
                  {t.savedLibrary}
                </h2>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  {t.savedLibraryHint}
                </p>
              </div>
            </div>

            {savedPaperCards.length ? (
              <div className="mt-4">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  {t.savedIssues}
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {savedPaperCards.map((paper) => (
                    <button
                      key={`saved-paper-${paper.paperId}`}
                      type="button"
                      onClick={() => handleOpenSavedPaper(paper)}
                      className="flex items-start gap-3 rounded-2xl border border-zinc-200 bg-white p-3 text-left transition hover:border-primary-300 hover:bg-primary-50/50 dark:border-zinc-700 dark:bg-zinc-950/70 dark:hover:border-primary-700 dark:hover:bg-primary-950/20"
                    >
                      <div className="relative h-20 w-16 overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-800">
                        {paper.thumbnailPath ? (
                          <Image
                            src={paper.thumbnailPath}
                            alt={paper.title}
                            fill
                            unoptimized
                            className="object-cover"
                            sizes="64px"
                          />
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {paper.saved ? (
                            <span className="inline-flex items-center rounded-full border border-primary-200 bg-primary-50 px-2 py-0.5 text-[10px] font-semibold text-primary-700 dark:border-primary-800 dark:bg-primary-950/40 dark:text-primary-300">
                              {t.savedIssue}
                            </span>
                          ) : null}
                          {paper.offlineReady ? (
                            <span className="inline-flex items-center rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                              {t.offlineReady}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 line-clamp-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                          {paper.title}
                        </p>
                        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                          {paper.cityName} | {formatUiDate(paper.publishDate, paper.publishDate)}
                        </p>
                        <p className="mt-1 text-xs font-medium text-zinc-600 dark:text-zinc-300">
                          {t.page} {paper.lastOpenedPage}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {savedStoryCards.length ? (
              <div className={`${savedPaperCards.length ? 'mt-4' : 'mt-3'}`}>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  {t.savedStories}
                </p>
                <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
                  {savedStoryCards.map((story) => (
                    <button
                      key={`saved-story-${story.storyId}`}
                      type="button"
                      onClick={() => handleOpenSavedStory(story)}
                      className="flex items-start gap-3 rounded-xl border border-zinc-200 bg-white px-3 py-3 text-left transition hover:border-primary-300 hover:bg-primary-50/60 dark:border-zinc-700 dark:bg-zinc-950/70 dark:hover:border-primary-700 dark:hover:bg-primary-950/20"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                          {story.title}
                        </p>
                        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                          {story.paperTitle} | {t.page} {story.pageNumber}
                        </p>
                        {story.excerpt ? (
                          <p className="mt-1 line-clamp-2 text-xs text-zinc-600 dark:text-zinc-300">
                            {story.excerpt}
                          </p>
                        ) : null}
                      </div>
                      <span className="inline-flex shrink-0 items-center rounded-full border border-zinc-300 px-2.5 py-1 text-[11px] font-semibold text-zinc-700 dark:border-zinc-700 dark:text-zinc-200">
                        {t.openStory}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {loadingList ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-7 w-7 animate-spin text-primary-600" />
          </div>
        ) : epapers.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white px-5 py-10 text-center dark:border-zinc-800 dark:bg-zinc-900 sm:py-12">
            <Newspaper className="mx-auto h-10 w-10 text-gray-400 dark:text-zinc-500" />
            <p className="mt-2 text-sm text-gray-600 dark:text-zinc-400">{emptyStateMessage}</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2.5 sm:gap-3 md:grid-cols-3 md:gap-4 xl:grid-cols-4">
              {epapers.map((paper) => (
                <button
                  key={paper._id}
                  type="button"
                  onClick={() => void openPaper(paper._id)}
                  className="cnp-card cnp-card-hover min-w-0 overflow-hidden text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/70 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
                >
                  <div className="aspect-[3/4] overflow-hidden bg-gray-100 dark:bg-zinc-800 sm:aspect-[4/5]">
                    {paper.thumbnailPath ? (
                      <div className="relative h-full w-full">
                        <Image
                          src={paper.thumbnailPath}
                          alt={paper.title}
                          fill
                          unoptimized
                          className="object-cover"
                          sizes="(max-width: 767px) 50vw, (max-width: 1279px) 33vw, 25vw"
                        />
                      </div>
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-gray-500 dark:text-zinc-400">
                        {t.noThumbnail}
                      </div>
                    )}
                  </div>
                  <div className="p-2.5 sm:p-3">
                    <h2 className="line-clamp-2 text-xs font-semibold text-gray-900 dark:text-zinc-100 sm:text-sm">{paper.title}</h2>
                    <p className="mt-1 line-clamp-2 text-[11px] text-gray-600 dark:text-zinc-400 sm:text-xs">
                      {paper.cityName} | {formatUiDate(paper.publishDate, paper.publishDate)} | {paper.pageCount} {t.pages}
                    </p>
                  </div>
                </button>
              ))}
            </div>

            {hasMoreList ? (
              <div className="text-center">
                <div ref={loadMoreSentinelRef} className="h-px w-full" aria-hidden="true" />
                <button
                  type="button"
                  onClick={() => {
                    void loadMorePapers();
                  }}
                  disabled={isLoadingMore}
                  className="rounded-full border border-zinc-300 bg-white px-8 py-2.5 text-sm font-semibold text-zinc-900 transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-red-700/70 dark:hover:bg-zinc-800 dark:hover:text-red-300"
                >
                  {isLoadingMore ? 'Loading...' : t.loadMore}
                </button>
              </div>
            ) : (
              <p className="text-center text-xs text-zinc-500 dark:text-zinc-400">{t.noMore}</p>
            )}
          </div>
        )}
      </section>

      {activePaper ? (
        <div className="fixed inset-0 z-[95] bg-black/88 p-0 backdrop-blur-sm sm:bg-black/75 sm:p-4">
          <div className="mx-auto flex h-full w-full max-w-[1480px] flex-col overflow-hidden border border-gray-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950 sm:h-[calc(100dvh-2rem)] sm:rounded-2xl">
            <div className="border-b border-gray-200 bg-white/95 px-3 py-2.5 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/95 sm:px-4">
              <div className="sm:hidden">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-gray-900 dark:text-zinc-100">
                      {activePaper.title}
                    </p>
                    <p className="truncate text-xs text-gray-600 dark:text-zinc-400">
                      {activePaper.cityName} | {formatUiDate(activePaper.publishDate, activePaper.publishDate)}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setActivePaper(null);
                      setActiveArticle(null);
                    }}
                    aria-label={t.close}
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-gray-300 text-gray-700 transition hover:bg-gray-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-3 flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => goToRelativePage(-1)}
                    aria-label={t.previous}
                    disabled={!canGoPreviousPage}
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-gray-300 text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>

                  <span className="inline-flex h-9 shrink-0 items-center rounded-xl border border-gray-200 px-2.5 text-center text-xs font-semibold text-gray-700 dark:border-zinc-700 dark:text-zinc-300">
                    {readerPageLabel}
                  </span>

                  <label className="flex h-9 min-w-0 flex-1 items-center rounded-xl border border-gray-200 bg-white px-2.5 text-xs font-medium text-gray-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200">
                    <select
                      value={activePage}
                      onChange={(event) => {
                        const nextPage = Number.parseInt(event.target.value, 10);
                        if (Number.isFinite(nextPage)) {
                          navigateToPage(nextPage);
                        }
                      }}
                      aria-label={t.quickJump}
                      className="w-full bg-transparent text-xs outline-none"
                    >
                      {pageSummaries.map((page) => (
                        <option key={`jump-mobile-${page.pageNumber}`} value={page.pageNumber}>
                          {t.page} {page.pageNumber}
                        </option>
                      ))}
                    </select>
                  </label>

                  <button
                    type="button"
                    onClick={() => goToRelativePage(1)}
                    aria-label={t.next}
                    disabled={!canGoNextPage}
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-gray-300 text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-2 grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={handlePdfDownload}
                    disabled={!pdfUrlForOpen}
                    className="inline-flex h-9 items-center justify-center gap-1 rounded-xl border border-zinc-300 bg-white px-2.5 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>PDF</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      void shareActivePaperOnWhatsApp();
                    }}
                    aria-label={t.shareWhatsApp}
                    className="inline-flex h-9 items-center justify-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50 px-2.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-900/40"
                  >
                    <Share2 className="h-3.5 w-3.5" />
                    <span>{t.shareWhatsApp}</span>
                  </button>

                  <details className="relative">
                    <summary className="flex h-9 cursor-pointer list-none items-center justify-center rounded-xl border border-gray-300 bg-white px-2.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-800 [&::-webkit-details-marker]:hidden">
                      {t.moreActions}
                    </summary>

                    <div className="absolute right-0 top-[calc(100%+0.45rem)] z-30 w-56 rounded-2xl border border-gray-200 bg-white p-2 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950">
                      <p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                        {t.readerTools}
                      </p>

                      <div className="space-y-1">
                        <button
                          type="button"
                          onClick={handleIssueSaveToggle}
                          disabled={!activePaperLibraryInput || isSavingIssue}
                          className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                            isActivePaperSaved
                              ? 'bg-primary-600 text-white hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-400'
                              : 'bg-primary-50 text-primary-700 hover:bg-primary-100 dark:bg-primary-950/40 dark:text-primary-300 dark:hover:bg-primary-900/40'
                          }`}
                        >
                          <span>{isActivePaperSaved ? t.savedIssue : t.saveIssue}</span>
                          {isSavingIssue ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Bookmark className={`h-3.5 w-3.5 ${isActivePaperSaved ? 'fill-current' : ''}`} />
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={openPdfInNewTab}
                          disabled={!pdfUrlForOpen}
                          className="flex w-full items-center justify-between rounded-xl border border-primary-200 bg-primary-50 px-3 py-2 text-left text-xs font-semibold text-primary-700 transition hover:bg-primary-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-primary-800 dark:bg-primary-950/40 dark:text-primary-300 dark:hover:bg-primary-900/40"
                        >
                          <span>{t.openPdf}</span>
                          <ExternalLink className="h-3.5 w-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            void handleOfflinePaperSave();
                          }}
                          disabled={!activePaperLibraryInput || isPreparingOfflinePaper || isActivePaperOfflineReady}
                          className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                            isActivePaperOfflineReady
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300'
                              : 'border border-emerald-300 bg-white text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:bg-zinc-950 dark:text-emerald-300 dark:hover:bg-emerald-950/30'
                          }`}
                        >
                          <span>
                            {isPreparingOfflinePaper
                              ? t.offlineSaving
                              : isActivePaperOfflineReady
                                ? t.offlineReady
                                : t.keepOffline}
                          </span>
                          {isPreparingOfflinePaper ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Download className="h-3.5 w-3.5" />
                          )}
                        </button>

                        {canUseSpreadMode ? (
                          <button
                            type="button"
                            onClick={() =>
                              setReaderDisplayMode((current) =>
                                current === 'spread' ? 'single' : 'spread'
                              )
                            }
                            className="flex w-full items-center justify-between rounded-xl border border-gray-300 bg-white px-3 py-2 text-left text-xs font-semibold text-gray-700 transition hover:bg-gray-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-800"
                          >
                            <span>{shouldShowSpreadMode ? t.singleView : t.spreadView}</span>
                            <Newspaper className="h-3.5 w-3.5" />
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </details>
                </div>
              </div>

              <div className="hidden flex-col gap-3 sm:flex">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-gray-900 dark:text-zinc-100">
                      {activePaper.title}
                    </p>
                    <p className="truncate text-xs text-gray-600 dark:text-zinc-400">
                      {activePaper.cityName} | {formatUiDate(activePaper.publishDate, activePaper.publishDate)}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setActivePaper(null);
                      setActiveArticle(null);
                    }}
                    aria-label={t.close}
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-gray-300 text-gray-700 transition hover:bg-gray-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="flex flex-col gap-2 border-t border-gray-200/80 pt-2 dark:border-zinc-800 xl:flex-row xl:items-center xl:justify-between">
                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                    <button
                      type="button"
                      onClick={() => goToRelativePage(-1)}
                      aria-label={t.previous}
                      disabled={!canGoPreviousPage}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-300 text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>

                    <span className="min-w-[72px] rounded-md border border-gray-200 px-2 py-1 text-center text-xs font-semibold text-gray-700 dark:border-zinc-700 dark:text-zinc-300">
                      {readerPageLabel}
                    </span>

                    <label className="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200">
                      <span className="hidden md:inline">{t.quickJump}</span>
                      <select
                        value={activePage}
                        onChange={(event) => {
                          const nextPage = Number.parseInt(event.target.value, 10);
                          if (Number.isFinite(nextPage)) {
                            navigateToPage(nextPage);
                          }
                        }}
                        aria-label={t.quickJump}
                        className="min-w-[72px] bg-transparent text-xs outline-none"
                      >
                        {pageSummaries.map((page) => (
                          <option key={`jump-${page.pageNumber}`} value={page.pageNumber}>
                            {t.page} {page.pageNumber}
                          </option>
                        ))}
                      </select>
                    </label>

                    <button
                      type="button"
                      onClick={() => goToRelativePage(1)}
                      aria-label={t.next}
                      disabled={!canGoNextPage}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-300 text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>

                    <div className="hidden items-center gap-1 rounded-md border border-gray-300 px-1 py-0.5 md:flex dark:border-zinc-700">
                      <button
                        type="button"
                        onClick={zoomPreviewOut}
                        aria-label={t.zoomOut}
                        disabled={previewZoom <= MIN_PREVIEW_ZOOM}
                        className="inline-flex h-6 w-6 items-center justify-center rounded text-sm font-bold text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
                      >
                        -
                      </button>
                      <span className="min-w-[48px] text-center text-[11px] font-semibold text-gray-700 dark:text-zinc-300">
                        {Math.round(previewZoom * 100)}%
                      </span>
                      <button
                        type="button"
                        onClick={zoomPreviewIn}
                        aria-label={t.zoomIn}
                        disabled={previewZoom >= MAX_PREVIEW_ZOOM}
                        className="inline-flex h-6 w-6 items-center justify-center rounded text-sm font-bold text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
                      >
                        +
                      </button>
                    </div>

                    {canUseSpreadMode ? (
                      <button
                        type="button"
                        onClick={() =>
                          setReaderDisplayMode((current) =>
                            current === 'spread' ? 'single' : 'spread'
                          )
                        }
                        className="inline-flex h-8 items-center gap-1 rounded-md border border-gray-300 bg-white px-2.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-800"
                      >
                        <span>{shouldShowSpreadMode ? t.singleView : t.spreadView}</span>
                      </button>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                    <button
                      type="button"
                      onClick={handleIssueSaveToggle}
                      disabled={!activePaperLibraryInput || isSavingIssue}
                      className={`inline-flex h-8 items-center gap-1 rounded-md border px-2.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                        isActivePaperSaved
                          ? 'border-primary-300 bg-primary-600 text-white hover:bg-primary-700 dark:border-primary-500 dark:bg-primary-500 dark:hover:bg-primary-400'
                          : 'border-primary-200 bg-primary-50 text-primary-700 hover:bg-primary-100 dark:border-primary-800 dark:bg-primary-950/40 dark:text-primary-300 dark:hover:bg-primary-900/40'
                      }`}
                    >
                      {isSavingIssue ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Bookmark className={`h-3.5 w-3.5 ${isActivePaperSaved ? 'fill-current' : ''}`} />
                      )}
                      <span>{isActivePaperSaved ? t.savedIssue : t.saveIssue}</span>
                    </button>

                    <button
                      type="button"
                      onClick={openPdfInNewTab}
                      disabled={!pdfUrlForOpen}
                      className="inline-flex h-8 items-center gap-1 rounded-md border border-primary-200 bg-primary-50 px-2.5 text-xs font-semibold text-primary-700 transition hover:bg-primary-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-primary-800 dark:bg-primary-950/40 dark:text-primary-300 dark:hover:bg-primary-900/40"
                    >
                      <span>{t.openPdf}</span>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={handlePdfDownload}
                      disabled={!pdfUrlForOpen}
                      className="inline-flex h-8 items-center gap-1 rounded-md border border-zinc-300 bg-white px-2.5 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-800"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>{t.downloadPdf}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        void handleOfflinePaperSave();
                      }}
                      disabled={!activePaperLibraryInput || isPreparingOfflinePaper || isActivePaperOfflineReady}
                      className={`inline-flex h-8 items-center gap-1 rounded-md border px-2.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                        isActivePaperOfflineReady
                          ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300'
                          : 'border-emerald-300 bg-white text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:bg-zinc-950 dark:text-emerald-300 dark:hover:bg-emerald-950/30'
                      }`}
                    >
                      {isPreparingOfflinePaper ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Download className="h-3.5 w-3.5" />
                      )}
                      <span>
                        {isPreparingOfflinePaper
                          ? t.offlineSaving
                          : isActivePaperOfflineReady
                            ? t.offlineReady
                            : t.keepOffline}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        void shareActivePaperOnWhatsApp();
                      }}
                      aria-label={t.shareWhatsApp}
                      className="inline-flex h-8 items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-900/40"
                    >
                      <Share2 className="h-3.5 w-3.5" />
                      <span>{t.shareWhatsApp}</span>
                    </button>

                    <div className="hidden xl:flex xl:items-center xl:gap-1.5">
                      <button
                        type="button"
                        onClick={() => setIsDesktopPageRailVisible((current) => !current)}
                        className="inline-flex h-8 items-center rounded-md border border-gray-300 bg-white px-2.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-800"
                      >
                        {isDesktopPageRailVisible ? t.hidePagesRail : t.showPagesRail}
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsDesktopContextRailVisible((current) => !current)}
                        className="inline-flex h-8 items-center rounded-md border border-gray-300 bg-white px-2.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-800"
                      >
                        {isDesktopContextRailVisible ? t.hideContentsRail : t.showContentsRail}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {!activePageImage ? (
              <div className="border-b border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-medium text-amber-700 sm:px-4 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300">
                {t.pageMissingPrefix} {activePage}.
              </div>
            ) : null}

            <div className="border-b border-gray-200 bg-white/90 px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-950/80 sm:px-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    {t.pageStrip}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">{t.tapPageToFocus}</p>
                </div>
                {canUseSpreadMode ? (
                  <button
                    type="button"
                    onClick={() =>
                      setReaderDisplayMode((current) =>
                        current === 'spread' ? 'single' : 'spread'
                      )
                    }
                    className="inline-flex h-8 items-center rounded-full border border-gray-300 px-3 text-[11px] font-semibold text-gray-700 transition hover:bg-gray-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800 xl:hidden"
                  >
                    {shouldShowSpreadMode ? t.singleView : t.spreadView}
                  </button>
                ) : null}
              </div>

              <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {pageSummaries.map((page) => {
                  const isCurrentPage = page.pageNumber === activePage;
                  const isCompanionPage =
                    shouldShowSpreadMode && spreadCompanionPage?.pageNumber === page.pageNumber;

                  return (
                    <button
                      key={`strip-${page.pageNumber}`}
                      type="button"
                      onClick={() => navigateToPage(page.pageNumber)}
                      className={`group min-w-[88px] max-w-[88px] shrink-0 overflow-hidden rounded-xl border text-left transition md:min-w-[96px] md:max-w-[96px] ${
                        isCurrentPage
                          ? 'border-primary-500 bg-primary-50 shadow-sm dark:border-primary-400 dark:bg-primary-950/30'
                          : isCompanionPage
                            ? 'border-amber-300 bg-amber-50/80 dark:border-amber-700 dark:bg-amber-950/20'
                            : 'border-gray-200 bg-white hover:border-primary-300 hover:bg-primary-50/60 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-primary-700 dark:hover:bg-primary-950/20'
                      }`}
                    >
                      <div className="relative aspect-[3/4] overflow-hidden bg-gradient-to-br from-zinc-100 to-zinc-200 dark:from-zinc-900 dark:to-zinc-800">
                        {page.imagePath ? (
                          <Image
                            src={page.imagePath}
                            alt={`${t.page} ${page.pageNumber}`}
                            fill
                            unoptimized
                            className="object-cover"
                            sizes="84px"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center px-2 text-center text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
                            {t.page} {page.pageNumber}
                          </div>
                        )}
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent px-2 py-1 text-[10px] font-semibold text-white">
                          {t.page} {page.pageNumber}
                        </div>
                      </div>
                      <div className="flex min-h-[30px] items-center px-2 py-1.5">
                        {page.storyCount > 0 ? (
                          <span className="inline-flex items-center rounded-full bg-primary-50 px-2 py-0.5 text-[10px] font-semibold text-primary-700 dark:bg-primary-950/40 dark:text-primary-300">
                            {page.storyCount} {t.stories}
                          </span>
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className={`grid min-h-0 flex-1 grid-cols-1 ${desktopReaderGridClassName}`}>
              {isDesktopPageRailVisible ? (
                <aside className="hidden min-h-0 bg-gray-50/80 dark:bg-zinc-900/70 xl:flex xl:flex-col">
                  <div className="border-b border-gray-200 px-3 py-3 dark:border-zinc-800">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                      {t.pagesTab}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{t.quickJump}</p>
                  </div>

                  <div className="flex-1 overflow-auto p-3">
                    <div className="space-y-2">
                      {pageSummaries.map((page) => {
                        const isCurrentPage = page.pageNumber === activePage;
                        const isCompanionPage =
                          shouldShowSpreadMode && spreadCompanionPage?.pageNumber === page.pageNumber;

                        return (
                          <button
                            key={`nav-${page.pageNumber}`}
                            type="button"
                            onClick={() => navigateToPage(page.pageNumber)}
                            className={`w-full rounded-xl border px-3 py-2 text-left transition ${
                              isCurrentPage
                                ? 'border-primary-500 bg-primary-50 dark:border-primary-400 dark:bg-primary-950/30'
                                : isCompanionPage
                                  ? 'border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/20'
                                  : 'border-gray-200 bg-white hover:border-primary-300 hover:bg-primary-50/70 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-primary-700 dark:hover:bg-primary-950/25'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-semibold text-gray-900 dark:text-zinc-100">
                                {t.page} {page.pageNumber}
                              </span>
                              {page.storyCount > 0 ? (
                                <span className="inline-flex items-center rounded-full bg-primary-50 px-2 py-0.5 text-[10px] font-semibold text-primary-700 dark:bg-primary-950/40 dark:text-primary-300">
                                  {page.storyCount} {t.stories}
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                              {page.imagePath ? t.openPage : t.noThumbnail}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </aside>
              ) : null}

              <div className={`relative min-w-0 overflow-auto overscroll-contain bg-gradient-to-b from-zinc-100 via-white to-zinc-100 p-2 [-webkit-overflow-scrolling:touch] sm:p-3 md:p-4 dark:from-zinc-950 dark:via-zinc-950 dark:to-zinc-900 ${readerStageBorderClassName}`}>
                {loadingFallback ? (
                  <div className="flex h-full min-h-48 items-center justify-center">
                    <Loader2 className="h-7 w-7 animate-spin text-primary-600" />
                  </div>
                ) : fallbackError ? (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
                    {fallbackError}
                  </div>
                ) : activePageImage || pdfFallbackPreview ? (
                  <div className="mx-auto flex min-h-full w-full max-w-[1340px] items-start justify-center">
                    <div
                      className={`relative w-full ${readerStageWidthClassName}`}
                      onTouchStart={onPreviewTouchStart}
                      onTouchMove={onPreviewTouchMove}
                      onTouchEnd={onPreviewTouchEnd}
                      onTouchCancel={onPreviewTouchCancel}
                    >
                      <button
                        type="button"
                        onClick={() => goToRelativePage(-1)}
                        aria-label={t.previous}
                        disabled={!canGoPreviousPage}
                        className="absolute left-1 top-1/2 z-20 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/70 bg-black/55 text-white shadow-lg backdrop-blur-md transition hover:bg-black/70 disabled:pointer-events-none disabled:opacity-30 sm:-left-4 sm:h-12 sm:w-12 xl:-left-6"
                      >
                        <ChevronLeft className="h-5 w-5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => goToRelativePage(1)}
                        aria-label={t.next}
                        disabled={!canGoNextPage}
                        className="absolute right-1 top-1/2 z-20 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/70 bg-black/55 text-white shadow-lg backdrop-blur-md transition hover:bg-black/70 disabled:pointer-events-none disabled:opacity-30 sm:-right-4 sm:h-12 sm:w-12 xl:-right-6"
                      >
                        <ChevronRight className="h-5 w-5" />
                      </button>

                      <div
                        className={`mx-auto grid items-start gap-4 ${shouldShowSpreadMode ? 'xl:grid-cols-2' : 'grid-cols-1'}`}
                      >
                        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-[0_24px_60px_-30px_rgba(15,23,42,0.55)] dark:border-zinc-800 dark:bg-zinc-900">
                          <AnimatePresence initial={false} custom={pageTurnDirection} mode="wait">
                            <motion.div
                              key={`epaper-page-${activePaper._id}-${activePage}-${previewSrc}`}
                              custom={pageTurnDirection}
                              variants={pageTurnVariants}
                              initial="enter"
                              animate="center"
                              exit="exit"
                              className="relative mx-auto w-fit"
                              style={{ transformOrigin: pageTurnDirection >= 0 ? 'left center' : 'right center' }}
                            >
                              {previewIsDataUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={previewSrc}
                                  alt={`Page ${activePage}`}
                                  style={{ maxHeight: previewMaxHeight }}
                                  className="block h-auto w-auto object-contain"
                                  draggable={false}
                                />
                              ) : (
                                <Image
                                  src={previewSrc}
                                  alt={`Page ${activePage}`}
                                  width={previewWidth}
                                  height={previewHeight}
                                  unoptimized
                                  style={{ maxHeight: previewMaxHeight }}
                                  className="block h-auto w-auto object-contain"
                                  draggable={false}
                                />
                              )}

                              {pageArticles.map((article, index) => (
                                <button
                                  key={article._id}
                                  type="button"
                                  onClick={() => setActiveArticle(article)}
                                  className="absolute rounded-[2px] bg-transparent outline-none transition focus-visible:ring-2 focus-visible:ring-white/90 focus-visible:ring-offset-2 focus-visible:ring-offset-black/60"
                                  style={{
                                    left: `${article.hotspot.x * 100}%`,
                                    top: `${article.hotspot.y * 100}%`,
                                    width: `${article.hotspot.w * 100}%`,
                                    height: `${article.hotspot.h * 100}%`,
                                  }}
                                  title={article.title || `${t.story} ${index + 1}`}
                                >
                                  <span className="sr-only">
                                    {article.title || `${t.story} ${index + 1}`}
                                  </span>
                                </button>
                              ))}
                            </motion.div>
                          </AnimatePresence>
                        </div>

                        {shouldShowSpreadMode && spreadCompanionPage ? (
                          <div
                            className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-[0_24px_60px_-30px_rgba(15,23,42,0.45)] transition hover:border-amber-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-amber-700"
                            onClick={() => navigateToPage(spreadCompanionPage.pageNumber)}
                          >
                            <div className="border-b border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 dark:border-zinc-800 dark:text-zinc-200">
                              {t.page} {spreadCompanionPage.pageNumber}
                            </div>

                            <div className="relative">
                              {spreadCompanionPage.imagePath ? (
                                <Image
                                  src={spreadCompanionPage.imagePath}
                                  alt={`Page ${spreadCompanionPage.pageNumber}`}
                                  width={spreadCompanionPage.width}
                                  height={spreadCompanionPage.height}
                                  unoptimized
                                  style={{ maxHeight: previewMaxHeight }}
                                  className="block h-auto w-auto object-contain"
                                  draggable={false}
                                />
                              ) : (
                                <div
                                  className="flex items-center justify-center bg-zinc-100 px-6 py-16 text-center text-sm text-zinc-500 dark:bg-zinc-950 dark:text-zinc-400"
                                  style={{ minHeight: '22rem' }}
                                >
                                  {t.pageMissingPrefix} {spreadCompanionPage.pageNumber}.
                                </div>
                              )}

                              {spreadCompanionPage.articles.map((article, index) => (
                                <button
                                  key={`spread-${article._id}`}
                                  type="button"
                                  onClick={() => {
                                    navigateToPage(spreadCompanionPage.pageNumber);
                                    setActiveArticle(article);
                                  }}
                                  className="absolute rounded-[2px] bg-transparent outline-none transition focus-visible:ring-2 focus-visible:ring-white/90 focus-visible:ring-offset-2 focus-visible:ring-offset-black/60"
                                  style={{
                                    left: `${article.hotspot.x * 100}%`,
                                    top: `${article.hotspot.y * 100}%`,
                                    width: `${article.hotspot.w * 100}%`,
                                    height: `${article.hotspot.h * 100}%`,
                                  }}
                                  title={article.title || `${t.story} ${index + 1}`}
                                >
                                  <span className="sr-only">
                                    {article.title || `${t.story} ${index + 1}`}
                                  </span>
                                </button>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
                    {t.noPreview}
                  </div>
                )}

                <div className="mt-3 xl:hidden">
                  <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white/90 dark:border-zinc-800 dark:bg-zinc-900/75">
                    <div className="border-b border-gray-200 px-3 py-3 dark:border-zinc-800 sm:px-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                            {readerSidebarView === 'pages' ? t.pageOverview : t.editionContents}
                          </p>
                          <p className="mt-1 text-xs font-medium text-gray-700 dark:text-zinc-300">
                            {readerSidebarSummary}
                          </p>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setReaderSidebarView('pages')}
                            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                              readerSidebarView === 'pages'
                                ? 'bg-primary-600 text-white'
                                : 'border border-gray-300 text-gray-700 hover:bg-gray-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800'
                            }`}
                          >
                            {t.pagesTab}
                          </button>
                          <button
                            type="button"
                            onClick={() => setReaderSidebarView('contents')}
                            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                              readerSidebarView === 'contents'
                                ? 'bg-primary-600 text-white'
                                : 'border border-gray-300 text-gray-700 hover:bg-gray-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800'
                            }`}
                          >
                            {t.contentsTab}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4 px-3 py-3 sm:px-4">
                      {readerSidebarView === 'pages' ? (
                        <>
                          <div>
                            <div className="mb-2 flex items-center justify-between gap-3">
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                                {t.pagesTab}
                              </p>
                              <span className="inline-flex items-center rounded-full border border-gray-300 px-2.5 py-1 text-[11px] font-semibold text-gray-700 dark:border-zinc-700 dark:text-zinc-200">
                                {readerPageLabel}
                              </span>
                            </div>

                            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                              {pageSummaries.map((page) => {
                                const isCurrentPage = page.pageNumber === activePage;
                                const isCompanionPage =
                                  shouldShowSpreadMode && spreadCompanionPage?.pageNumber === page.pageNumber;

                                return (
                                  <button
                                    key={`support-nav-${page.pageNumber}`}
                                    type="button"
                                    onClick={() => navigateToPage(page.pageNumber)}
                                    className={`rounded-xl border px-3 py-2 text-left transition ${
                                      isCurrentPage
                                        ? 'border-primary-500 bg-primary-50 dark:border-primary-400 dark:bg-primary-950/30'
                                        : isCompanionPage
                                          ? 'border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/20'
                                          : 'border-gray-200 bg-white hover:border-primary-300 hover:bg-primary-50/70 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-primary-700 dark:hover:bg-primary-950/25'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="text-sm font-semibold text-gray-900 dark:text-zinc-100">
                                        {t.page} {page.pageNumber}
                                      </span>
                                      {page.storyCount > 0 ? (
                                        <span className="inline-flex items-center rounded-full bg-primary-50 px-2 py-0.5 text-[10px] font-semibold text-primary-700 dark:bg-primary-950/40 dark:text-primary-300">
                                          {page.storyCount} {t.stories}
                                        </span>
                                      ) : null}
                                    </div>
                                    <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                                      {page.imagePath ? t.openPage : t.noThumbnail}
                                    </p>
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          <div>
                            <div className="mb-2 flex items-center justify-between gap-3">
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                                {t.storiesOnPage}
                              </p>
                              {pageArticles.length > 0 ? (
                                <span className="inline-flex items-center rounded-full border border-gray-300 px-2.5 py-1 text-[11px] font-semibold text-gray-700 dark:border-zinc-700 dark:text-zinc-200">
                                  {pageArticles.length} {t.stories}
                                </span>
                              ) : null}
                            </div>

                            {pageArticles.length === 0 ? (
                              <p className="rounded-lg border border-dashed border-gray-300 px-3 py-2 text-xs text-gray-600 dark:border-zinc-700 dark:text-zinc-400">
                                {t.noStories}
                              </p>
                            ) : (
                              <div className="space-y-2">
                                {pageArticles.map((article, index) => (
                                  <button
                                    key={`${article._id}-mobile`}
                                    type="button"
                                    onClick={() => setActiveArticle(article)}
                                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-left transition hover:border-primary-300 hover:bg-primary-50/70 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-primary-700 dark:hover:bg-primary-950/25"
                                  >
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="min-w-0">
                                        <span className="block text-[11px] font-semibold uppercase tracking-wide text-primary-700 dark:text-primary-300">
                                          {t.story} {index + 1}
                                        </span>
                                        <span className="mt-1 block text-sm font-medium text-gray-900 dark:text-zinc-100">
                                          {article.title || `${t.story} ${index + 1}`}
                                        </span>
                                        {article.excerpt ? (
                                          <span className="mt-1 block line-clamp-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                                            {article.excerpt}
                                          </span>
                                        ) : null}
                                      </div>
                                    </div>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </>
                      ) : editionArticlesByPage.length === 0 ? (
                        <p className="rounded-lg border border-dashed border-gray-300 px-3 py-2 text-xs text-gray-600 dark:border-zinc-700 dark:text-zinc-400">
                          {t.noStoriesEdition}
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {editionArticlesByPage.map((page) => (
                            <div key={`mobile-contents-${page.pageNumber}`} className="space-y-2">
                              <div className="flex items-center justify-between gap-3">
                                <button
                                  type="button"
                                  onClick={() => navigateToPage(page.pageNumber)}
                                  className="text-xs font-semibold uppercase tracking-wide text-primary-700 dark:text-primary-300"
                                >
                                  {t.page} {page.pageNumber}
                                </button>
                                <span className="inline-flex items-center rounded-full bg-primary-50 px-2 py-0.5 text-[10px] font-semibold text-primary-700 dark:bg-primary-950/40 dark:text-primary-300">
                                  {page.storyCount} {t.stories}
                                </span>
                              </div>

                              <div className="space-y-2">
                                {page.articles.map((article, index) => (
                                  <button
                                    key={`mobile-contents-article-${article._id}`}
                                    type="button"
                                    onClick={() => {
                                      navigateToPage(page.pageNumber);
                                      setActiveArticle(article);
                                    }}
                                    className="block w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-left transition hover:border-primary-300 hover:bg-primary-50/70 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-primary-700 dark:hover:bg-primary-950/25"
                                  >
                                    <span className="block text-sm font-medium text-gray-900 dark:text-zinc-100">
                                      {article.title || `${t.story} ${index + 1}`}
                                    </span>
                                    {article.excerpt ? (
                                      <span className="mt-1 block line-clamp-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                                        {article.excerpt}
                                      </span>
                                    ) : null}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </section>
                </div>
              </div>

              {isDesktopContextRailVisible ? (
                <aside className="hidden min-h-0 border-l border-gray-200 bg-gray-50/80 dark:border-zinc-800 dark:bg-zinc-900/70 xl:flex xl:flex-col">
                  <div className="border-b border-gray-200 px-3 py-3 dark:border-zinc-800">
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setReaderSidebarView('pages')}
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                          readerSidebarView === 'pages'
                            ? 'bg-primary-600 text-white'
                            : 'border border-gray-300 text-gray-700 hover:bg-gray-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800'
                        }`}
                      >
                        {t.pagesTab}
                      </button>
                      <button
                        type="button"
                        onClick={() => setReaderSidebarView('contents')}
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                          readerSidebarView === 'contents'
                            ? 'bg-primary-600 text-white'
                            : 'border border-gray-300 text-gray-700 hover:bg-gray-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800'
                        }`}
                      >
                        {t.contentsTab}
                      </button>
                    </div>
                    <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                      {readerSidebarView === 'pages' ? t.pageStories : t.editionContents}
                    </p>
                    <p className="mt-1 text-xs font-medium text-gray-700 dark:text-zinc-300">{readerSidebarSummary}</p>
                  </div>

                  <div className="flex-1 overflow-auto p-3">
                    {readerSidebarView === 'pages' ? (
                      pageArticles.length === 0 ? (
                        <p className="rounded-lg border border-dashed border-gray-300 px-3 py-2 text-xs text-gray-600 dark:border-zinc-700 dark:text-zinc-400">
                          {t.noStories}
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {pageArticles.map((article, index) => (
                            <button
                              key={`${article._id}-side`}
                              type="button"
                              onClick={() => setActiveArticle(article)}
                              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-left transition hover:border-primary-300 hover:bg-primary-50/70 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-primary-700 dark:hover:bg-primary-950/25"
                            >
                              <span className="block text-[11px] font-semibold uppercase tracking-wide text-primary-700 dark:text-primary-300">
                                {t.story} {index + 1}
                              </span>
                              <span className="mt-1 block text-sm font-medium text-gray-900 dark:text-zinc-100">
                                {article.title || `${t.story} ${index + 1}`}
                              </span>
                              {article.excerpt ? (
                                <span className="mt-1 block line-clamp-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                                  {article.excerpt}
                                </span>
                              ) : null}
                            </button>
                          ))}
                        </div>
                      )
                    ) : editionArticlesByPage.length === 0 ? (
                      <p className="rounded-lg border border-dashed border-gray-300 px-3 py-2 text-xs text-gray-600 dark:border-zinc-700 dark:text-zinc-400">
                        {t.noStoriesEdition}
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {editionArticlesByPage.map((page) => (
                          <div key={`contents-${page.pageNumber}`} className="space-y-2">
                            <div className="flex items-center justify-between gap-3">
                              <button
                                type="button"
                                onClick={() => navigateToPage(page.pageNumber)}
                                className="text-xs font-semibold uppercase tracking-wide text-primary-700 dark:text-primary-300"
                              >
                                {t.page} {page.pageNumber}
                              </button>
                              <span className="inline-flex items-center rounded-full bg-primary-50 px-2 py-0.5 text-[10px] font-semibold text-primary-700 dark:bg-primary-950/40 dark:text-primary-300">
                                {page.storyCount} {t.stories}
                              </span>
                            </div>
                            <div className="space-y-2">
                              {page.articles.map((article, index) => (
                                <button
                                  key={`contents-article-${article._id}`}
                                  type="button"
                                  onClick={() => {
                                    navigateToPage(page.pageNumber);
                                    setActiveArticle(article);
                                  }}
                                  className="block w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-left text-sm text-gray-700 transition hover:border-primary-300 hover:bg-primary-50/70 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-primary-700 dark:hover:bg-primary-950/25"
                                >
                                  <span className="block font-medium text-gray-900 dark:text-zinc-100">
                                    {article.title || `${t.story} ${index + 1}`}
                                  </span>
                                  {article.excerpt ? (
                                    <span className="mt-1 block line-clamp-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                                      {article.excerpt}
                                    </span>
                                  ) : null}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </aside>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {activeArticle ? (
        <div
          className="fixed inset-0 z-[100] bg-black/65 p-2 sm:p-4"
          onClick={(event) => {
            if (event.target !== event.currentTarget) return;
            setActiveArticle(null);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={activeArticle.title || t.story}
            className="mx-auto flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
          >
            <h3 className="sr-only">{activeArticle.title}</h3>

            <div className="border-b border-gray-200 px-3 py-3 dark:border-zinc-800 sm:px-4">
              <div className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                    <div className="inline-flex h-9 items-center rounded-full border border-gray-200 bg-white p-1 dark:border-zinc-700 dark:bg-zinc-950">
                      <button
                        type="button"
                        onClick={() => setArticleReaderMode('story')}
                        className={`inline-flex h-7 items-center gap-1 rounded-full px-3 text-xs font-semibold transition ${
                          articleReaderMode === 'story'
                            ? 'bg-primary-600 text-white'
                            : 'text-gray-700 hover:bg-gray-100 dark:text-zinc-200 dark:hover:bg-zinc-800'
                        }`}
                      >
                        <Newspaper className="h-3.5 w-3.5" />
                        <span>{t.storyMode}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setArticleReaderMode('text')}
                        disabled={!hasReadableArticleText}
                        className={`inline-flex h-7 items-center gap-1 rounded-full px-3 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                          articleReaderMode === 'text'
                            ? 'bg-primary-600 text-white'
                            : 'text-gray-700 hover:bg-gray-100 dark:text-zinc-200 dark:hover:bg-zinc-800'
                        }`}
                      >
                        <Type className="h-3.5 w-3.5" />
                        <span>{t.textMode}</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={handleStorySaveToggle}
                      disabled={isSavingStory}
                      className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                        isActiveArticleSaved
                          ? 'border-primary-300 bg-primary-600 text-white hover:bg-primary-700 dark:border-primary-500 dark:bg-primary-500 dark:hover:bg-primary-400'
                          : 'border-primary-200 bg-primary-50 text-primary-700 hover:bg-primary-100 dark:border-primary-800 dark:bg-primary-950/40 dark:text-primary-300 dark:hover:bg-primary-900/40'
                      }`}
                    >
                      {isSavingStory ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Bookmark className={`h-3.5 w-3.5 ${isActiveArticleSaved ? 'fill-current' : ''}`} />
                      )}
                      <span>{isActiveArticleSaved ? t.savedStory : t.saveStory}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        void shareActiveArticleOnWhatsApp();
                      }}
                      className="inline-flex h-9 items-center gap-2 rounded-full border border-emerald-300 bg-white px-3 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50 dark:border-emerald-800 dark:bg-zinc-950 dark:text-emerald-300 dark:hover:bg-emerald-950/30"
                    >
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#25D366] text-white">
                        <WhatsAppIcon className="h-3.5 w-3.5" />
                      </span>
                      <span>{t.whatsApp}</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setActiveArticle(null)}
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gray-300 text-gray-700 transition hover:bg-gray-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void handleArticleListen()}
                      disabled={isPreparingArticleListen || !hasReadableArticleText}
                      className="inline-flex h-9 items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-3 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300 dark:hover:bg-emerald-900/30"
                    >
                      {isPreparingArticleListen ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Volume2 className="h-3.5 w-3.5" />
                      )}
                      <span>{isPreparingArticleListen ? t.listening : t.listen}</span>
                    </button>

                    {shouldShowStoryReaderStopAction ? (
                      <button
                        type="button"
                        onClick={() => stopArticleListening()}
                        className="inline-flex h-9 items-center gap-1.5 rounded-full border border-zinc-300 bg-zinc-100 px-3 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                      >
                        <PauseCircle className="h-3.5 w-3.5" />
                        <span>{t.stopListening}</span>
                      </button>
                    ) : null}

                    {articleReaderMode === 'text' ? (
                      <div className="inline-flex h-9 items-center gap-1 rounded-full border border-gray-200 bg-white px-1 text-xs font-semibold text-gray-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200">
                        <span className="hidden px-2 text-[11px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400 sm:inline">
                          {t.textSize}
                        </span>
                        <span className="px-2 text-[11px] font-black text-zinc-500 dark:text-zinc-400 sm:hidden">
                          A
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setArticleTextScale((current) =>
                              Math.max(0.9, Number((current - 0.1).toFixed(2)))
                            )
                          }
                          disabled={articleTextScale <= 0.9}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-full transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-zinc-800"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="min-w-[44px] text-center text-[11px]">
                          {Math.round(articleTextScale * 100)}%
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setArticleTextScale((current) =>
                              Math.min(1.4, Number((current + 0.1).toFixed(2)))
                            )
                          }
                          disabled={articleTextScale >= 1.4}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-full transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-zinc-800"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : null}

                    {articleReaderMode === 'story' && activeArticleHasImage && !isCoarsePointer ? (
                      <div className="inline-flex h-9 items-center gap-1 rounded-full border border-gray-200 bg-white px-1 text-xs font-semibold text-gray-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200">
                        <button
                          type="button"
                          onClick={() =>
                            setArticleImageZoom((current) =>
                              Math.max(
                                MIN_ARTICLE_IMAGE_ZOOM,
                                Number((current - ARTICLE_IMAGE_ZOOM_STEP).toFixed(2))
                              )
                            )
                          }
                          aria-label={t.imageZoomOut}
                          disabled={articleImageZoom <= MIN_ARTICLE_IMAGE_ZOOM}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-full transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-zinc-800"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="min-w-[46px] text-center text-[11px]">
                          {Math.round(articleImageZoom * 100)}%
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setArticleImageZoom((current) =>
                              Math.min(
                                MAX_ARTICLE_IMAGE_ZOOM,
                                Number((current + ARTICLE_IMAGE_ZOOM_STEP).toFixed(2))
                              )
                            )
                          }
                          aria-label={t.imageZoomIn}
                          disabled={articleImageZoom >= MAX_ARTICLE_IMAGE_ZOOM}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-full transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-zinc-800"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : null}

                    {articleReaderMode === 'story' && activeArticleHasImage && isCoarsePointer ? (
                      <div className="inline-flex h-9 items-center rounded-full border border-zinc-200 bg-zinc-50 px-3 text-[11px] font-medium text-zinc-600 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300">
                        {t.pinchToZoom}
                      </div>
                    ) : null}
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="hidden items-center gap-2 lg:flex">
                      <button
                        type="button"
                        onClick={() => {
                          void shareActiveArticle();
                        }}
                        className="inline-flex h-9 items-center gap-1.5 rounded-full border border-primary-200 bg-primary-50 px-3 text-xs font-semibold text-primary-700 transition hover:bg-primary-100 dark:border-primary-800 dark:bg-primary-950/40 dark:text-primary-300 dark:hover:bg-primary-900/40"
                      >
                        <Share2 className="h-3.5 w-3.5" />
                        <span>{t.shareStory}</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleStoryTextDownload}
                        disabled={!hasReadableArticleText}
                        className="inline-flex h-9 items-center gap-1.5 rounded-full border border-zinc-300 bg-white px-3 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-800"
                      >
                        <Download className="h-3.5 w-3.5" />
                        <span>{t.downloadText}</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleStoryPrint}
                        disabled={!hasReadableArticleText && !activeArticleHasContent}
                        className="inline-flex h-9 items-center gap-1.5 rounded-full border border-zinc-300 bg-white px-3 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-800"
                      >
                        <Printer className="h-3.5 w-3.5" />
                        <span>{t.printStory}</span>
                      </button>
                    </div>

                    <details ref={articleActionMenuRef} className="relative lg:hidden">
                      <summary className="flex h-9 cursor-pointer list-none items-center gap-1.5 rounded-full border border-gray-300 bg-white px-3 text-xs font-semibold text-gray-700 transition hover:bg-gray-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-800 [&::-webkit-details-marker]:hidden">
                        <MoreHorizontal className="h-3.5 w-3.5" />
                        <span>{t.moreActions}</span>
                      </summary>

                      <div className="absolute right-0 top-[calc(100%+0.5rem)] z-10 w-56 rounded-2xl border border-gray-200 bg-white p-2 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950">
                        <div className="grid gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              closeArticleActionMenu();
                              void shareActiveArticle();
                            }}
                            className="inline-flex h-10 items-center justify-start gap-2 rounded-xl border border-primary-200 bg-primary-50 px-3 text-sm font-semibold text-primary-700 transition hover:bg-primary-100 dark:border-primary-800 dark:bg-primary-950/40 dark:text-primary-300 dark:hover:bg-primary-900/40"
                          >
                            <Share2 className="h-4 w-4" />
                            <span>{t.shareStory}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              closeArticleActionMenu();
                              handleStoryTextDownload();
                            }}
                            disabled={!hasReadableArticleText}
                            className="inline-flex h-10 items-center justify-start gap-2 rounded-xl border border-zinc-300 bg-white px-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-800"
                          >
                            <Download className="h-4 w-4" />
                            <span>{t.downloadText}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              closeArticleActionMenu();
                              handleStoryPrint();
                            }}
                            disabled={!hasReadableArticleText && !activeArticleHasContent}
                            className="inline-flex h-10 items-center justify-start gap-2 rounded-xl border border-zinc-300 bg-white px-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-800"
                          >
                            <Printer className="h-4 w-4" />
                            <span>{t.printStory}</span>
                          </button>
                        </div>
                      </div>
                    </details>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-auto bg-white dark:bg-zinc-900">
              <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-3 sm:p-4 md:p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                      activeArticleReadableTextState === 'full'
                        ? 'border border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300'
                        : activeArticleReadableTextState === 'excerpt'
                          ? 'border border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300'
                          : 'border border-zinc-300 bg-zinc-100 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200'
                    }`}
                  >
                    {activeArticleTextBadgeLabel}
                  </span>
                  <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    {t.articleReader}
                  </span>
                </div>

                {activeArticleTextHelp ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
                    {activeArticleTextHelp}
                  </div>
                ) : null}

                {articleListenError ? (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
                    {articleListenError}
                  </div>
                ) : null}

                {articleReaderMode === 'story' && activeArticleHasImage ? (
                  <div
                    className="overflow-auto rounded-2xl border border-gray-200 bg-zinc-100 shadow-sm dark:border-zinc-800 dark:bg-black"
                    onTouchStart={onArticleImageTouchStart}
                    onTouchMove={onArticleImageTouchMove}
                    onTouchEnd={onArticleImageTouchEnd}
                    onTouchCancel={onArticleImageTouchEnd}
                  >
                    <div
                      className="mx-auto min-w-full"
                      style={{
                        width: `${Math.max(100, Math.round(articleImageZoom * 100))}%`,
                        touchAction: 'pan-x pan-y',
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={activeArticle.coverImagePath}
                        alt={activeArticle.title || t.storyImage}
                        className="block h-auto w-full max-w-none select-none object-contain"
                        draggable={false}
                      />
                    </div>
                  </div>
                ) : null}

                {articleReaderMode === 'story' ? (
                  activeArticleHasImage ? (
                    hasReadableArticleText && activeArticlePreviewText ? (
                      <div className="mx-auto w-full max-w-3xl rounded-2xl border border-gray-200 bg-white/95 px-4 py-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/75 sm:px-5">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                              {t.storyPreview}
                            </p>
                            <h4 className="mt-1 text-lg font-bold leading-tight text-zinc-900 dark:text-zinc-100 sm:text-xl">
                              {activeArticle.title || t.story}
                            </h4>
                            <p className="mt-3 line-clamp-6 text-sm leading-7 text-zinc-700 dark:text-zinc-300">
                              {activeArticlePreviewText}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => setArticleReaderMode('text')}
                            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-primary-200 bg-primary-50 px-4 py-2 text-sm font-semibold text-primary-700 transition hover:bg-primary-100 dark:border-primary-800 dark:bg-primary-950/40 dark:text-primary-300 dark:hover:bg-primary-900/40"
                          >
                            <Type className="h-4 w-4" />
                            <span>{t.openTextStory}</span>
                          </button>
                        </div>
                      </div>
                    ) : null
                  ) : (
                    <>
                      {activeArticleHasExcerpt ? (
                        <p className="text-sm font-medium leading-6 text-gray-700 dark:text-zinc-300">
                          {activeArticle.excerpt}
                        </p>
                      ) : null}

                      {activeArticleHasContent ? (
                        <article
                          className="prose prose-sm max-w-none text-gray-800 dark:prose-invert dark:text-zinc-200 sm:prose-base"
                          dangerouslySetInnerHTML={{ __html: activeArticle.contentHtml || '' }}
                        />
                      ) : null}

                      {shouldShowNoArticleState ? (
                        <p className="text-sm text-gray-600 dark:text-zinc-400">{t.noArticle}</p>
                      ) : null}
                    </>
                  )
                ) : hasReadableArticleText ? (
                  <div className="mx-auto w-full max-w-3xl rounded-2xl border border-gray-200 bg-white px-4 py-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/80 sm:px-6 sm:py-6">
                    <div className="border-b border-gray-200 pb-4 dark:border-zinc-800">
                      <h4
                        className="text-xl font-black leading-tight text-zinc-900 dark:text-zinc-100 sm:text-2xl"
                        style={{ fontSize: `${1.35 * articleTextScale}rem` }}
                      >
                        {activeArticle?.title || t.story}
                      </h4>
                      {activeArticleHasExcerpt && activeArticleHasContent ? (
                        <p
                          className="mt-3 font-medium leading-8 text-zinc-700 dark:text-zinc-300"
                          style={{ fontSize: `${1.02 * articleTextScale}rem` }}
                        >
                          {activeArticle.excerpt}
                        </p>
                      ) : null}
                    </div>

                    {activeArticleHasContent ? (
                      <article
                        className="prose max-w-none pt-5 text-zinc-800 dark:prose-invert dark:text-zinc-200"
                        style={{ fontSize: `${1 * articleTextScale}rem`, lineHeight: 1.95 }}
                        dangerouslySetInnerHTML={{ __html: activeArticle.contentHtml || '' }}
                      />
                    ) : activeArticleParagraphs.length ? (
                      <div
                        className="space-y-4 pt-5 text-zinc-800 dark:text-zinc-200"
                        style={{ fontSize: `${1 * articleTextScale}rem`, lineHeight: 1.95 }}
                      >
                        {activeArticleParagraphs.map((paragraph, index) => (
                          <p
                            key={`reader-paragraph-${index + 1}`}
                            className="font-[family:var(--font-devanagari),var(--font-latin),system-ui,sans-serif]"
                          >
                            {paragraph}
                          </p>
                        ))}
                      </div>
                    ) : (
                      <p className="pt-5 text-sm text-zinc-600 dark:text-zinc-400">
                        {t.noReadableText}
                      </p>
                    )}

                    {activeArticleHasImage ? (
                      <button
                        type="button"
                        onClick={() => setArticleReaderMode('story')}
                        className="mt-6 inline-flex items-center gap-1.5 rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                      >
                        <Newspaper className="h-4 w-4" />
                        <span>{t.openVisualStory}</span>
                      </button>
                    ) : null}
                  </div>
                ) : (
                  <p className="text-sm text-gray-600 dark:text-zinc-400">{t.noReadableText}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

