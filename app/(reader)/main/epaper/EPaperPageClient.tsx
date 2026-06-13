'use client';

import Image from 'next/image';
import {
  type SyntheticEvent as ReactSyntheticEvent,
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
  Instagram,
  Loader2,
  MoreHorizontal,
  Minus,
  Newspaper,
  PauseCircle,
  Plus,
  Printer,
  Sparkles,
  Type,
  Share2,
  Volume2,
  X,
  Youtube,
} from 'lucide-react';
import Logo from '@/components/layout/Logo';
import EPaperDatePicker from '@/components/ui/EPaperDatePicker';
import EPaperCityPicker from '@/components/ui/EPaperCityPicker';
import {
  EPAPER_CITY_OPTIONS,
} from '@/lib/constants/epaperCities';
import { COMPANY_INFO } from '@/lib/constants/company';
import { useAppStore } from '@/lib/store/appStore';
import {
  buildEpaperIssueShareText,
  buildEpaperIssueWhatsAppShareUrl,
  buildEpaperSharePath,
  buildEpaperStoryShareText,
  buildEpaperStoryWhatsAppShareUrl,
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
import { resolveEpaperPreviewMaxZoom } from '@/lib/utils/epaperPageImage';
import { renderPdfPagePreviewFromUrl } from '@/lib/utils/pdfThumbnailClient';
import {
  type EPaperCityFilter,
} from '@/lib/utils/publicEpaperFilters';
import type { EPaperArticleRecord, EPaperRecord } from '@/lib/types/epaper';
import { buildTtsAudioSource, requestEpaperStoryTtsAudio } from '@/lib/ai/ttsClient';

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
    pinchToZoom: 'Use two fingers to zoom this page. Drag with one finger after zooming.',
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
    visualAction: 'Visual',
    fullPageAction: 'Full page',
    textAction: 'Text',
    instagramAction: 'Instagram',
    youtubeAction: 'YouTube',
    whatsappChannelAction: 'WhatsApp Channel',
    downloadAction: 'Download',
    saveAction: 'Save',
    savedAction: 'Saved',
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
    pinchToZoom:
      '\u0907\u0938 \u092a\u0947\u091c \u0915\u094b \u0926\u094b \u0909\u0902\u0917\u0932\u093f\u092f\u094b\u0902 \u0938\u0947 \u091c\u093c\u0942\u092e \u0915\u0930\u0947\u0902\u0964 \u091c\u093c\u0942\u092e \u0915\u0947 \u092c\u093e\u0926 \u090f\u0915 \u0909\u0902\u0917\u0932\u0940 \u0938\u0947 \u092a\u0947\u091c \u0916\u093f\u0938\u0915\u093e\u090f\u0902\u0964',
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
    visualAction: '\u0935\u093f\u091c\u0941\u0905\u0932',
    fullPageAction: '\u092a\u0942\u0930\u093e \u092a\u0947\u091c',
    textAction: '\u091f\u0947\u0915\u094d\u0938\u094d\u091f',
    instagramAction: 'Instagram',
    youtubeAction: 'YouTube',
    whatsappChannelAction: 'WhatsApp \u091a\u0948\u0928\u0932',
    downloadAction: '\u0921\u093e\u0909\u0928\u0932\u094b\u0921',
    saveAction: '\u0938\u0947\u0935',
    savedAction: '\u0938\u0947\u0935 \u0939\u0948',
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
const EPAPER_ZOOM_HINT_STORAGE_KEY = 'lokswami_epaper_zoom_hint_seen_v1';
const EPAPER_OFFLINE_CACHE_NAME = 'lokswami-epaper-offline-v1';
const MIN_PREVIEW_ZOOM = 1;
const PREVIEW_ZOOM_STEP = 0.2;
const PREVIEW_DOUBLE_TAP_ZOOM = 2;
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

type PreviewPinchState = ArticlePinchState & {
  focalContentX: number;
  focalContentY: number;
  focalViewportX: number;
  focalViewportY: number;
  startScrollWidth: number;
  startScrollHeight: number;
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

function getPageSectionName(pageNumber: number, language: 'en' | 'hi') {
  if (language === 'hi') {
    switch (pageNumber) {
      case 1: return 'मुख्य पृष्ठ';
      case 2: return 'शहर';
      case 3: return 'देश-विदेश';
      case 4: return 'व्यापार';
      case 5: return 'खेल';
      case 6: return 'संपादकीय';
      default: return `पृष्ठ ${pageNumber}`;
    }
  }
  switch (pageNumber) {
    case 1: return 'Front Page';
    case 2: return 'City';
    case 3: return 'Nation';
    case 4: return 'Business';
    case 5: return 'Sports';
    case 6: return 'Editorial';
    default: return `Page ${pageNumber}`;
  }
}

function getTouchDistance(touches: TouchListLike) {
  if (touches.length < 2) return 0;
  const first = touches[0];
  const second = touches[1];
  const dx = first.clientX - second.clientX;
  const dy = first.clientY - second.clientY;
  return Math.hypot(dx, dy);
}

function getTouchMidpoint(touches: TouchListLike) {
  if (touches.length < 2) return null;
  return {
    clientX: (touches[0].clientX + touches[1].clientX) / 2,
    clientY: (touches[0].clientY + touches[1].clientY) / 2,
  };
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

function getEmbedUrl(url?: string) {
  if (!url) return '';
  const cleaned = url.trim();
  
  let regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  let match = cleaned.match(regExp);
  if (match && match[2].length === 11) {
    return `https://www.youtube.com/embed/${match[2]}`;
  }
  
  regExp = /^.*youtube.com\/shorts\/([^#\&\?]*).*/;
  match = cleaned.match(regExp);
  if (match && match[1]) {
    return `https://www.youtube.com/embed/${match[1]}`;
  }
  
  return cleaned;
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

function hasSeenEpaperZoomHint() {
  if (typeof window === 'undefined') return true;
  try {
    return window.localStorage.getItem(EPAPER_ZOOM_HINT_STORAGE_KEY) === '1';
  } catch {
    return true;
  }
}

function markEpaperZoomHintSeen() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(EPAPER_ZOOM_HINT_STORAGE_KEY, '1');
  } catch {
    // Ignore localStorage write errors.
  }
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
  const theme = useAppStore((state) => state.theme);
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
  const [isDesktopContextRailVisible, setIsDesktopContextRailVisible] = useState(false);
  const [isOverflowOpen, setIsOverflowOpen] = useState(false);
  const overflowRef = useRef<HTMLDivElement | null>(null);

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
  const [previewImageMetrics, setPreviewImageMetrics] = useState({
    src: '',
    naturalWidth: 0,
  });
  const [showHotspotHints, setShowHotspotHints] = useState(true);
  const [articleImageZoom, setArticleImageZoom] = useState(1);
  const [pageTurnDirection, setPageTurnDirection] = useState(0);
  const [isCoarsePointer, setIsCoarsePointer] = useState(false);
  const [isWideScreen, setIsWideScreen] = useState(false);

  const [pendingPaperId, setPendingPaperId] = useState('');
  const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);
  const previewTouchSurfaceRef = useRef<HTMLDivElement | null>(null);
  const loadMoreLockRef = useRef(false);
  const articleActionMenuRef = useRef<HTMLDetailsElement | null>(null);
  const articlePinchStateRef = useRef<ArticlePinchState>({
    startDistance: 0,
    startZoom: 1,
    isPinching: false,
  });
  const previewPinchStateRef = useRef<PreviewPinchState>({
    startDistance: 0,
    startZoom: 1,
    isPinching: false,
    focalContentX: 0,
    focalContentY: 0,
    focalViewportX: 0,
    focalViewportY: 0,
    startScrollWidth: 0,
    startScrollHeight: 0,
  });
  const articleTapStateRef = useRef<ArticleTapState>({
    lastTapAt: 0,
    lastTapX: 0,
    lastTapY: 0,
  });
  const previewTapStateRef = useRef<ArticleTapState>({
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
  const canUseSpreadMode = Boolean(activePaper && activePaper.pageCount > 1);
  const shouldShowSpreadMode = canUseSpreadMode && readerDisplayMode === 'spread' && isWideScreen;
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

    if (typeof window !== 'undefined') {
      if (window.innerWidth >= 768) {
        setReaderDisplayMode('spread');
      } else {
        setReaderDisplayMode('single');
      }
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
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;

    const mediaQuery = window.matchMedia('(min-width: 768px)');
    const updateWidthMode = () => setIsWideScreen(mediaQuery.matches);
    updateWidthMode();

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', updateWidthMode);
      return () => mediaQuery.removeEventListener('change', updateWidthMode);
    }

    mediaQuery.addListener(updateWidthMode);
    return () => mediaQuery.removeListener(updateWidthMode);
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
        const response = await fetch(
          `/api/v1/public/epapers/latest?${buildListQueryParams().toString()}`
        );
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
      const response = await fetch(
        `/api/v1/public/epapers/latest?${buildListQueryParams(nextCursor).toString()}`
      );
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
      setIsOverflowOpen(false);
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
    if (!activePaper) {
      setIsOverflowOpen(false);
      return;
    }
    setReaderSidebarView('pages');
    if (isCoarsePointer) {
      setIsDesktopContextRailVisible(true);
    } else {
      setIsDesktopContextRailVisible(false);
    }
  }, [activePaper, isCoarsePointer]);

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
      const step = shouldShowSpreadMode && maxPages > 1 ? 2 : 1;

      setActivePage((current) => {
        const nextPage = clampPage(current + delta * step, 1, maxPages);
        if (nextPage !== current) {
          setPageTurnDirection(delta > 0 ? 1 : -1);
          setActiveArticle(null);
        }
        return nextPage;
      });
    },
    [activePaper, shouldShowSpreadMode]
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
    if (!shouldShowSpreadMode) return;
    if (activePaper.pageCount <= 1) {
      setReaderDisplayMode('single');
      return;
    }

    const maxStartPage = Math.max(1, activePaper.pageCount - 1);
    if (activePage > maxStartPage) {
      setActivePage(maxStartPage);
    }
  }, [activePage, activePaper, shouldShowSpreadMode]);

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
  const spreadCompanionPage = useMemo(() => {
    if (!shouldShowSpreadMode) return null;
    return pageSummaries.find((item) => item.pageNumber === activePage + 1) || null;
  }, [activePage, pageSummaries, shouldShowSpreadMode]);
  const previewSrc = activePageImage || pdfFallbackPreview;
  const previewIsDataUrl = previewSrc.startsWith('data:');
  const previewWidth = activePageMeta?.width || 1200;
  const previewHeight = activePageMeta?.height || 1600;
  const previewNaturalWidth =
    previewImageMetrics.src === previewSrc ? previewImageMetrics.naturalWidth : 0;
  const previewSourceWidth = previewNaturalWidth || Number(activePageMeta?.width || 0);
  const maxPreviewZoom = resolveEpaperPreviewMaxZoom(previewSourceWidth);
  const isPreviewZoomed = previewZoom > MIN_PREVIEW_ZOOM + 0.01;
  const maxReaderPage = Math.max(1, Number(activePaper?.pageCount || 1));
  const maxSpreadStartPage = Math.max(1, maxReaderPage - 1);
  const canGoPreviousPage = activePage > 1;
  const canGoNextPage = shouldShowSpreadMode
    ? activePage < maxSpreadStartPage
    : activePage < maxReaderPage;

  const zoomPreviewIn = useCallback(() => {
    setPreviewZoom((current) =>
      Math.min(maxPreviewZoom, Number((current + PREVIEW_ZOOM_STEP).toFixed(2)))
    );
  }, [maxPreviewZoom]);

  const onPreviewImageLoad = useCallback(
    (event: ReactSyntheticEvent<HTMLImageElement>) => {
      const naturalWidth = Number(event.currentTarget.naturalWidth || 0);
      if (naturalWidth > 0) {
        setPreviewImageMetrics({
          src: previewSrc,
          naturalWidth,
        });
      }
    },
    [previewSrc]
  );

  useEffect(() => {
    setPreviewZoom((current) => Math.min(current, maxPreviewZoom));
  }, [maxPreviewZoom]);

  // Pre-fetch adjacent page images to make navigation instantaneous and smooth
  useEffect(() => {
    if (!activePaper || pageSummaries.length === 0) return;
    const pagesToPreload = [activePage + 1, activePage - 1];
    if (shouldShowSpreadMode) {
      pagesToPreload.push(activePage + 2);
    }
    pagesToPreload.forEach((pNum) => {
      const pageData = pageSummaries.find((s) => s.pageNumber === pNum);
      if (pageData?.imagePath) {
        const img = new window.Image();
        img.src = pageData.imagePath;
      }
    });
  }, [activePage, activePaper, pageSummaries, shouldShowSpreadMode]);

  // Click-away listener for details / actions overflow dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (overflowRef.current && !overflowRef.current.contains(target)) {
        setIsOverflowOpen(false);
      }
    }
    if (isOverflowOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOverflowOpen]);

  // Auto-switch sidebar tab to "contents" if the current page has no mapped stories
  useEffect(() => {
    if (activePaper) {
      if (pageArticles.length === 0 && readerSidebarView === 'pages') {
        setReaderSidebarView('contents');
      }
    }
  }, [activePage, pageArticles.length, readerSidebarView, activePaper]);

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

    const sharePath = buildEpaperSharePath({
      paperId: activePaper._id,
      page: activePage,
    });
    const shareUrl = toAbsoluteShareUrl(sharePath, window.location.origin);
    const dateLabel = activePaper.publishDate
      ? formatUiDate(activePaper.publishDate, activePaper.publishDate)
      : selectedPublishDate;
    const shareText = buildEpaperIssueShareText({
      title: activePaper.title,
      issueUrl: shareUrl,
      cityLabel: activePaper.cityName,
      dateLabel,
    });

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

    const whatsappUrl = buildEpaperIssueWhatsAppShareUrl({
      title: activePaper.title,
      issueUrl: shareUrl,
      cityLabel: activePaper.cityName,
      dateLabel,
    });
    const opened = window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
    if (!opened) {
      window.location.href = whatsappUrl;
    }
  };

  const buildActiveArticleShareUrl = () => {
    if (!activePaper || !activeArticle) return '';

    const storyToken = String(activeArticle.slug || activeArticle._id || '').trim();
    const sharePath = buildEpaperSharePath({
      paperId: activePaper._id,
      page: activeArticle.pageNumber || activePage,
      story: storyToken,
    });

    return toAbsoluteShareUrl(sharePath, window.location.origin);
  };

  const shareActiveArticleOnWhatsApp = async () => {
    if (!activePaper || !activeArticle) return;

    const shareUrl = buildActiveArticleShareUrl();
    const whatsappUrl = buildEpaperStoryWhatsAppShareUrl({
      title: activeArticle.title || activePaper.title,
      storyUrl: shareUrl,
      paperTitle: activePaper.title,
      excerpt: activeArticle.excerpt,
      page: activeArticle.pageNumber || activePage,
    });

    const opened = window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
    if (!opened) {
      window.location.href = whatsappUrl;
    }
  };

  const shareActiveArticle = async () => {
    if (!activePaper || !activeArticle) return;

    const shareUrl = buildActiveArticleShareUrl();
    const shareText = buildEpaperStoryShareText({
      title: activeArticle.title || activePaper.title,
      storyUrl: shareUrl,
      paperTitle: activePaper.title,
      excerpt: activeArticle.excerpt,
      page: activeArticle.pageNumber || activePage,
    });

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
    if (!activePaper || !activeArticle) {
      setArticleListenError(t.noReadableText);
      return;
    }

    if (!activeArticleHasContent && !activeArticleHasExcerpt) {
      setArticleListenError(t.noReadableText);
      return;
    }

    setArticleListenError('');
    setIsPreparingArticleListen(true);
    stopArticleListening(true);

    try {
      const payload = await requestEpaperStoryTtsAudio(activePaper._id, activeArticle._id);
      const src = buildTtsAudioSource(payload);

      if (!src) {
        throw new Error('Audio payload is not available.');
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
  }, [
    activeArticle,
    activeArticleHasContent,
    activeArticleHasExcerpt,
    activePaper,
    stopArticleListening,
    t.audioUnavailable,
    t.noReadableText,
  ]);
  const shouldShowNoArticleState =
    Boolean(activeArticle) &&
    !activeArticleHasImage &&
    !activeArticleHasContent &&
    !activeArticleHasExcerpt;
  const hasReadableArticleText = activeArticleReadableTextState !== 'none';
  const canListenToActiveArticle = activeArticleHasContent || activeArticleHasExcerpt;

  const pageTurnVariants = useMemo(
    () => ({
      enter: (direction: number) => {
        if (prefersReducedMotion) return { opacity: 0 };
        // Turning previous: the new page enters on top, unpeeling from top-left to bottom-right
        if (direction < 0) {
          return {
            opacity: 0.9,
            clipPath: 'polygon(0% 0%, 0% 0%, 0% 0%, 0% 0%, 0% 0%)',
            rotateY: -15,
            x: -30,
            z: 50,
            scale: 0.98,
          };
        }
        // Turning next: the new page enters underneath, scaling up gently
        return {
          opacity: 0.8,
          scale: 0.96,
          rotateY: 0,
          x: 0,
          z: -60,
          clipPath: 'polygon(0% 0%, 100% 0%, 100% 100%, 100% 100%, 0% 100%)',
        };
      },
      center: prefersReducedMotion
        ? {
            opacity: 1,
            transition: { duration: 0.16 },
          }
        : {
            opacity: 1,
            rotateY: 0,
            scale: 1,
            x: 0,
            z: 0,
            clipPath: 'polygon(0% 0%, 100% 0%, 100% 100%, 100% 100%, 0% 100%)',
            transition: {
              clipPath: { duration: 0.65, ease: [0.25, 1, 0.5, 1] },
              default: {
                type: 'spring',
                stiffness: 120,
                damping: 20,
                mass: 1.0,
              },
            },
          },
      exit: (direction: number) => {
        if (prefersReducedMotion) return { opacity: 0 };
        // Turning next: the current page peels off on top towards the top-left
        if (direction >= 0) {
          return {
            opacity: 0.9,
            clipPath: 'polygon(0% 0%, 0% 0%, 0% 0%, 0% 0%, 0% 0%)',
            rotateY: -15,
            x: -30,
            z: 50,
            scale: 0.98,
            transition: {
              clipPath: { duration: 0.65, ease: [0.25, 1, 0.5, 1] },
              default: { duration: 0.5, ease: 'easeOut' },
            },
          };
        }
        // Turning previous: the current page disappears underneath
        return {
          opacity: 0.7,
          scale: 0.96,
          rotateY: 0,
          x: 0,
          z: -60,
          clipPath: 'polygon(0% 0%, 100% 0%, 100% 100%, 100% 100%, 0% 100%)',
          transition: {
            duration: 0.45,
            ease: 'easeOut',
          },
        };
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

  const togglePreviewZoom = useCallback(() => {
    setPreviewZoom((current) =>
      current > MIN_PREVIEW_ZOOM + 0.05
        ? MIN_PREVIEW_ZOOM
        : Math.min(maxPreviewZoom, PREVIEW_DOUBLE_TAP_ZOOM)
    );
  }, [maxPreviewZoom]);

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

  const onPreviewTouchStart = useCallback((event: TouchEvent) => {
    if (!isCoarsePointer || activeArticle) return;

    if (event.touches.length === 2) {
      const distance = getTouchDistance(event.touches);
      const midpoint = getTouchMidpoint(event.touches);
      const surface = previewTouchSurfaceRef.current;
      if (!distance || !midpoint || !surface) return;

      event.preventDefault();
      const surfaceRect = surface.getBoundingClientRect();
      const focalViewportX = midpoint.clientX - surfaceRect.left;
      const focalViewportY = midpoint.clientY - surfaceRect.top;

      previewPinchStateRef.current = {
        startDistance: distance,
        startZoom: previewZoom,
        isPinching: true,
        focalContentX: surface.scrollLeft + focalViewportX,
        focalContentY: surface.scrollTop + focalViewportY,
        focalViewportX,
        focalViewportY,
        startScrollWidth: surface.scrollWidth,
        startScrollHeight: surface.scrollHeight,
      };
      pageSwipeStateRef.current.tracking = false;
      return;
    }

    if (event.touches.length !== 1 || previewPinchStateRef.current.isPinching) return;

    const touch = event.touches[0];
    pageSwipeStateRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      tracking: previewZoom <= MIN_PREVIEW_ZOOM + 0.01,
    };
  }, [activeArticle, isCoarsePointer, previewZoom]);

  const onPreviewTouchMove = useCallback((event: TouchEvent) => {
    if (!isCoarsePointer || activeArticle) return;

    if (event.touches.length === 2) {
      if (!previewPinchStateRef.current.isPinching) {
        const distance = getTouchDistance(event.touches);
        const midpoint = getTouchMidpoint(event.touches);
        const surface = previewTouchSurfaceRef.current;
        if (!distance || !midpoint || !surface) return;

        const surfaceRect = surface.getBoundingClientRect();
        const focalViewportX = midpoint.clientX - surfaceRect.left;
        const focalViewportY = midpoint.clientY - surfaceRect.top;

        previewPinchStateRef.current = {
          startDistance: distance,
          startZoom: previewZoom,
          isPinching: true,
          focalContentX: surface.scrollLeft + focalViewportX,
          focalContentY: surface.scrollTop + focalViewportY,
          focalViewportX,
          focalViewportY,
          startScrollWidth: surface.scrollWidth,
          startScrollHeight: surface.scrollHeight,
        };
      }

      const distance = getTouchDistance(event.touches);
      if (!distance || previewPinchStateRef.current.startDistance <= 0) return;

      event.preventDefault();
      pageSwipeStateRef.current.tracking = false;

      const nextZoom = Math.min(
        maxPreviewZoom,
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
      const pinchState = previewPinchStateRef.current;
      window.requestAnimationFrame(() => {
        const surface = previewTouchSurfaceRef.current;
        if (!surface || !pinchState.isPinching) return;

        const widthScale =
          pinchState.startScrollWidth > 0
            ? surface.scrollWidth / pinchState.startScrollWidth
            : nextZoom / pinchState.startZoom;
        const heightScale =
          pinchState.startScrollHeight > 0
            ? surface.scrollHeight / pinchState.startScrollHeight
            : nextZoom / pinchState.startZoom;

        surface.scrollLeft =
          pinchState.focalContentX * widthScale - pinchState.focalViewportX;
        surface.scrollTop =
          pinchState.focalContentY * heightScale - pinchState.focalViewportY;
      });
    }
  }, [activeArticle, isCoarsePointer, maxPreviewZoom, previewZoom]);

  const onPreviewTouchEnd = useCallback((event: TouchEvent) => {
    if (previewPinchStateRef.current.isPinching) {
      if (event.touches.length < 2) {
        previewPinchStateRef.current = {
          startDistance: 0,
          startZoom: previewZoom,
          isPinching: false,
          focalContentX: 0,
          focalContentY: 0,
          focalViewportX: 0,
          focalViewportY: 0,
          startScrollWidth: 0,
          startScrollHeight: 0,
        };
      }
      previewTapStateRef.current = {
        lastTapAt: 0,
        lastTapX: 0,
        lastTapY: 0,
      };
      pageSwipeStateRef.current.tracking = false;
      return;
    }

    if (event.changedTouches.length !== 1) {
      pageSwipeStateRef.current.tracking = false;
      return;
    }

    const touch = event.changedTouches[0];
    const touchMoveDistance = Math.hypot(
      touch.clientX - pageSwipeStateRef.current.startX,
      touch.clientY - pageSwipeStateRef.current.startY
    );
    const isTapGesture = touchMoveDistance <= ARTICLE_DOUBLE_TAP_MOVE_PX;

    if (isTapGesture) {
      const now = Date.now();
      const deltaTime = now - previewTapStateRef.current.lastTapAt;
      const deltaX = touch.clientX - previewTapStateRef.current.lastTapX;
      const deltaY = touch.clientY - previewTapStateRef.current.lastTapY;
      const moveDistance = Math.hypot(deltaX, deltaY);

      pageSwipeStateRef.current.tracking = false;

      if (
        deltaTime > 0 &&
        deltaTime <= ARTICLE_DOUBLE_TAP_DELAY_MS &&
        moveDistance <= ARTICLE_DOUBLE_TAP_MOVE_PX
      ) {
        event.preventDefault();
        togglePreviewZoom();
        previewTapStateRef.current = {
          lastTapAt: 0,
          lastTapX: 0,
          lastTapY: 0,
        };
      } else {
        previewTapStateRef.current = {
          lastTapAt: now,
          lastTapX: touch.clientX,
          lastTapY: touch.clientY,
        };
      }
      return;
    }

    if (!pageSwipeStateRef.current.tracking) {
      pageSwipeStateRef.current.tracking = false;
      return;
    }

    const deltaX = touch.clientX - pageSwipeStateRef.current.startX;
    const deltaY = touch.clientY - pageSwipeStateRef.current.startY;

    pageSwipeStateRef.current.tracking = false;
    previewTapStateRef.current = {
      lastTapAt: 0,
      lastTapX: 0,
      lastTapY: 0,
    };

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
  }, [goToRelativePage, previewZoom, togglePreviewZoom]);

  const onPreviewTouchCancel = useCallback(() => {
    previewPinchStateRef.current = {
      startDistance: 0,
      startZoom: previewZoom,
      isPinching: false,
      focalContentX: 0,
      focalContentY: 0,
      focalViewportX: 0,
      focalViewportY: 0,
      startScrollWidth: 0,
      startScrollHeight: 0,
    };
    previewTapStateRef.current = {
      lastTapAt: 0,
      lastTapX: 0,
      lastTapY: 0,
    };
    pageSwipeStateRef.current.tracking = false;
  }, [previewZoom]);

  useEffect(() => {
    const surface = previewTouchSurfaceRef.current;
    if (!surface || !activePaper || !isCoarsePointer) return;

    const listenerOptions: AddEventListenerOptions = { passive: false };

    surface.addEventListener('touchstart', onPreviewTouchStart, listenerOptions);
    surface.addEventListener('touchmove', onPreviewTouchMove, listenerOptions);
    surface.addEventListener('touchend', onPreviewTouchEnd, listenerOptions);
    surface.addEventListener('touchcancel', onPreviewTouchCancel, listenerOptions);

    return () => {
      surface.removeEventListener('touchstart', onPreviewTouchStart, listenerOptions);
      surface.removeEventListener('touchmove', onPreviewTouchMove, listenerOptions);
      surface.removeEventListener('touchend', onPreviewTouchEnd, listenerOptions);
      surface.removeEventListener('touchcancel', onPreviewTouchCancel, listenerOptions);
    };
  }, [
    activePaper,
    isCoarsePointer,
    onPreviewTouchCancel,
    onPreviewTouchEnd,
    onPreviewTouchMove,
    onPreviewTouchStart,
  ]);

  useEffect(() => {
    if (!activePaper || !isCoarsePointer) return;
    if (hasSeenEpaperZoomHint()) return;
    if (readerNotice) return;

    const timeoutId = window.setTimeout(() => {
      showReaderNotice('info', t.pinchToZoom);
      markEpaperZoomHintSeen();
    }, 520);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [activePaper, isCoarsePointer, readerNotice, showReaderNotice, t.pinchToZoom]);

  const selectedCityLabel =
    selectedCity === 'all'
      ? t.allCities
      : EPAPER_CITY_OPTIONS.find((city) => city.slug === selectedCity)?.name || selectedCity;
  const emptyStateMessage = hasArchiveFilters ? t.noPaperFiltered : t.noPaper;
  const readerPageLabel = shouldShowSpreadMode && spreadCompanionPage
    ? `${activePage}-${spreadCompanionPage.pageNumber} / ${maxReaderPage}`
    : `${activePage} / ${maxReaderPage}`;
  const activePaperStoryCount = activePaper?.articles.length || 0;
  const previewMaxHeight = useMemo(() => {
    return `calc((100dvh - 136px) * ${previewZoom})`;
  }, [previewZoom]);
  const desktopReaderGridClassName = isDesktopContextRailVisible
    ? 'xl:grid-cols-[minmax(0,1fr)_22rem]'
    : 'grid-cols-1';
  const readerStageBorderClassName = isDesktopContextRailVisible
    ? 'xl:border-r xl:border-gray-200 dark:xl:border-zinc-800'
    : '';
  const dynamicPaddingClass =
    "pt-3 pb-[calc(env(safe-area-inset-bottom)+6.5rem)] sm:pt-4 sm:pb-6";
  const readerStageWidthClassName = !isDesktopContextRailVisible
    ? shouldShowSpreadMode
      ? 'max-w-[1360px]'
      : 'max-w-[1120px]'
    : shouldShowSpreadMode
      ? 'max-w-[1280px]'
      : 'max-w-[1060px]';

  const bookContainerShadowClassName = shouldShowSpreadMode
    ? "shadow-[0_24px_60px_-30px_rgba(15,23,42,0.55),_3px_0_0_-1px_#fff,_3px_0_1px_rgba(0,0,0,0.12),_6px_0_0_-2px_#fff,_6px_0_2px_rgba(0,0,0,0.08),_-3px_0_0_-1px_#fff,_-3px_0_1px_rgba(0,0,0,0.12),_-6px_0_0_-2px_#fff,_-6px_0_2px_rgba(0,0,0,0.08)] dark:shadow-[0_24px_60px_-30px_rgba(0,0,0,0.85),_3px_0_0_-1px_#27272a,_3px_0_1px_rgba(0,0,0,0.45),_6px_0_0_-2px_#27272a,_6px_0_2px_rgba(0,0,0,0.4),_-3px_0_0_-1px_#27272a,_-3px_0_1px_rgba(0,0,0,0.45),_-6px_0_0_-2px_#27272a,_-6px_0_2px_rgba(0,0,0,0.4)]"
    : "shadow-[0_24px_60px_-30px_rgba(15,23,42,0.55)] dark:shadow-[0_24px_60px_-30px_rgba(0,0,0,0.85)]";

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
            <EPaperCityPicker
              value={selectedCity}
              onChange={setSelectedCity}
              language={language}
            />

            <EPaperDatePicker
              value={selectedPublishDate}
              onChange={onPublishDateChange}
              onClear={() => setSelectedPublishDate('')}
              placeholder="तारीख चुनें"
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
                      className="reader-touch-button reader-focus-ring flex min-h-24 items-start gap-3 rounded-2xl border border-zinc-200 bg-white p-3 text-left transition hover:border-primary-300 hover:bg-primary-50/50 dark:border-zinc-700 dark:bg-zinc-950/70 dark:hover:border-primary-700 dark:hover:bg-primary-950/20"
                    >
                      <div className="relative h-20 w-16 overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-900">
                        {paper.thumbnailPath ? (
                          <Image
                            src={paper.thumbnailPath}
                            alt={paper.title}
                            fill
                            quality={55}
                            className="object-contain p-1"
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
                      className="reader-touch-button reader-focus-ring flex min-h-16 items-start gap-3 rounded-xl border border-zinc-200 bg-white px-3 py-3 text-left transition hover:border-primary-300 hover:bg-primary-50/60 dark:border-zinc-700 dark:bg-zinc-950/70 dark:hover:border-primary-700 dark:hover:bg-primary-950/20"
                    >
                      {story.coverImagePath ? (
                        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-900">
                          <Image
                            src={story.coverImagePath}
                            alt={story.title || t.storyImage}
                            fill
                            unoptimized
                            className="object-cover"
                            sizes="64px"
                          />
                        </div>
                      ) : null}
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
              {epapers.map((paper, index) => (
                <button
                  key={paper._id}
                  type="button"
                  onClick={() => void openPaper(paper._id)}
                  className="cnp-card cnp-card-hover reader-touch-button reader-focus-ring min-w-0 overflow-hidden text-left"
                >
                  <div className="aspect-[3/4] overflow-hidden bg-gray-100 dark:bg-zinc-900 sm:aspect-[4/5]">
                    {paper.thumbnailPath ? (
                      <div className="relative h-full w-full">
                        <Image
                          src={paper.thumbnailPath}
                          alt={paper.title}
                          fill
                          quality={60}
                          priority={index < 4}
                          className="object-contain p-2"
                          sizes="(max-width: 639px) 44vw, (max-width: 767px) 46vw, (max-width: 1279px) 30vw, 22vw"
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
                  className="reader-touch-button reader-focus-ring min-h-12 w-full rounded-full border border-zinc-300 bg-white px-8 py-2.5 text-sm font-semibold text-zinc-900 transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-red-700/70 dark:hover:bg-zinc-800 dark:hover:text-red-300 sm:w-auto"
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
        <div className="fixed inset-0 z-[95] bg-zinc-950/70 p-0 backdrop-blur-md sm:bg-black/75 sm:p-4" data-swipe-ignore="true">
          <div className="mx-auto flex h-[100dvh] w-full max-w-[1480px] flex-col overflow-hidden border-0 bg-zinc-900/40 shadow-2xl dark:bg-zinc-950/40 sm:border sm:border-gray-200 sm:bg-white sm:dark:border-zinc-800 sm:dark:bg-zinc-950 sm:h-[calc(100dvh-2rem)] sm:rounded-2xl relative">
            {/* Ambient glows behind newspaper */}
            <div className="pointer-events-none absolute -left-16 -top-16 z-0 h-48 w-48 rounded-full bg-red-500/15 blur-3xl sm:hidden" />
            <div className="relative z-40 w-full shrink-0 sm:border-b sm:border-zinc-200/80 sm:bg-white/95 sm:backdrop-blur-md px-0 pb-0 pt-0 sm:dark:border-zinc-800/80 sm:dark:bg-zinc-900/95 sm:px-4 sm:py-2 sm:shadow-sm bg-transparent dark:bg-transparent">
              <div className="relative flex w-full items-center justify-between border-b border-zinc-200 bg-white/95 px-2.5 pb-3 pt-[calc(env(safe-area-inset-top)+0.5rem)] shadow-md backdrop-blur-xl dark:border-white/5 dark:bg-zinc-950/90 min-[375px]:px-4 sm:hidden">
                {/* Left: Back button */}
                <button
                  type="button"
                  onClick={() => {
                    setActivePaper(null);
                    setActiveArticle(null);
                  }}
                  aria-label={t.close}
                  className="reader-touch-button reader-focus-ring inline-flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-100/80 dark:bg-white/5 text-zinc-800 dark:text-white/90 transition hover:bg-zinc-200/80 dark:hover:bg-white/10"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>

                {/* Center: Brand Logo */}
                <div className="pointer-events-none absolute left-1/2 top-1/2 flex shrink-0 -translate-x-1/2 -translate-y-1/2 items-center justify-center">
                  <div className={`${theme === 'dark' ? 'dark' : ''} shrink-0`}>
                    <Logo size="headerCompact" />
                  </div>
                </div>

                {/* Right: Share action */}
                <div className="flex items-center">
                  <button
                    type="button"
                    onClick={() => {
                      void shareActivePaperOnWhatsApp();
                    }}
                    aria-label={t.shareWhatsApp}
                    className="reader-touch-button reader-focus-ring inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-zinc-200 bg-zinc-100 px-2.5 text-xs font-semibold text-zinc-800 transition hover:bg-zinc-200 dark:border-white/10 dark:bg-white/5 dark:text-white/80 dark:hover:bg-white/10"
                    title={t.shareWhatsApp}
                  >
                    <Share2 className="h-4 w-4" />
                    <span>{t.shareWhatsApp}</span>
                  </button>
                </div>
              </div>

              <div className="hidden items-center justify-between gap-4 sm:flex py-1">
                {/* Brand & Edition */}
                <div className="flex items-center gap-2 min-w-0 shrink-0">
                  <span className="inline-flex items-center rounded-full bg-primary-100 px-2 py-0.5 text-[9px] font-bold text-primary-700 dark:bg-primary-950/40 dark:text-primary-300">
                    Lokswami E-Paper
                  </span>
                  <span className="text-xs text-gray-300 dark:text-zinc-700">|</span>
                  <p className="truncate text-xs font-bold text-gray-900 dark:text-zinc-100">
                    {activePaper.cityName} Edition
                  </p>
                  <span className="text-[10px] text-gray-400 dark:text-zinc-500">
                    ({formatUiDate(activePaper.publishDate, activePaper.publishDate)})
                  </span>
                </div>

                {/* Controls (Navigation & Zoom) */}
                <div className="flex items-center gap-1.5 sm:gap-2 justify-center flex-1 min-w-0">
                  <button
                    type="button"
                    onClick={() => goToRelativePage(-1)}
                    aria-label={t.previous}
                    disabled={!canGoPreviousPage}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-300 text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>

                  <span className="min-w-[64px] rounded-md border border-gray-200 px-1.5 py-1 text-center text-xs font-semibold text-gray-700 dark:border-zinc-700 dark:text-zinc-300">
                    {readerPageLabel}
                  </span>

                  <div className="relative inline-flex items-center">
                    <select
                      value={activePage}
                      onChange={(event) => {
                        const nextPage = Number.parseInt(event.target.value, 10);
                        if (Number.isFinite(nextPage)) {
                          navigateToPage(nextPage);
                        }
                      }}
                      aria-label={t.quickJump}
                      className="appearance-none rounded-md border border-gray-300 bg-white px-2.5 py-1 pr-6 text-xs font-semibold text-gray-700 transition hover:border-gray-400 hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:border-zinc-600 dark:hover:bg-zinc-900"
                    >
                      {pageSummaries.map((page) => (
                        <option 
                          key={`jump-${page.pageNumber}`} 
                          value={page.pageNumber}
                          className="bg-white text-gray-900 dark:bg-zinc-950 dark:text-zinc-100"
                        >
                          {t.page} {page.pageNumber}
                        </option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 dark:text-zinc-500">
                      <svg className="h-3 w-3 fill-current" viewBox="0 0 20 20">
                        <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                      </svg>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => goToRelativePage(1)}
                    aria-label={t.next}
                    disabled={!canGoNextPage}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-300 text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>

                  <div className="hidden items-center gap-1 rounded-md border border-gray-300 px-1 py-0.5 md:flex dark:border-zinc-700 bg-white dark:bg-zinc-950">
                    <button
                      type="button"
                      onClick={zoomPreviewOut}
                      aria-label={t.zoomOut}
                      disabled={previewZoom <= MIN_PREVIEW_ZOOM}
                      className="inline-flex h-6 w-6 items-center justify-center rounded text-sm font-bold text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
                    >
                      -
                    </button>
                    <span className="min-w-[44px] text-center text-[10px] font-semibold text-gray-700 dark:text-zinc-300">
                      {Math.round(previewZoom * 100)}%
                    </span>
                    <button
                      type="button"
                      onClick={zoomPreviewIn}
                      aria-label={t.zoomIn}
                      disabled={previewZoom >= maxPreviewZoom}
                      className="inline-flex h-6 w-6 items-center justify-center rounded text-sm font-bold text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
                    >
                      +
                    </button>
                  </div>

                  {canUseSpreadMode && isWideScreen ? (
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

                {/* Right Actions */}
                <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowHotspotHints((current) => !current)}
                    className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition hover:bg-zinc-50 dark:hover:bg-zinc-900/60 ${
                      showHotspotHints
                        ? 'border-primary-200 bg-primary-50 text-primary-700 dark:border-primary-800 dark:bg-primary-950/40 dark:text-primary-300'
                        : 'border-zinc-300 bg-white text-gray-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-800'
                    }`}
                    title="Toggle story hotspots highlight"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    <span className="hidden lg:inline">Hotspots</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsDesktopContextRailVisible((current) => !current)}
                    className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition hover:bg-zinc-50 dark:hover:bg-zinc-900/60 ${
                      isDesktopContextRailVisible
                        ? 'border-primary-200 bg-primary-50 text-primary-700 dark:border-primary-800 dark:bg-primary-950/40 dark:text-primary-300'
                        : 'border-zinc-300 bg-white text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-800'
                    }`}
                    title={isDesktopContextRailVisible ? t.hideContentsRail : t.showContentsRail}
                  >
                    <Type className="h-3.5 w-3.5" />
                    <span className="hidden lg:inline">
                      {isDesktopContextRailVisible ? 'Hide Index' : 'Show Index'}
                    </span>
                  </button>

                  <span className="h-4 w-px bg-zinc-200 dark:bg-zinc-800 hidden md:inline-block" />

                  <button
                    type="button"
                    onClick={handleIssueSaveToggle}
                    disabled={!activePaperLibraryInput || isSavingIssue}
                    className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                      isActivePaperSaved
                        ? 'border-primary-300 bg-primary-500 text-white hover:bg-primary-600'
                        : 'border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-800'
                    }`}
                    title={isActivePaperSaved ? t.savedIssue : t.saveIssue}
                  >
                    {isSavingIssue ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Bookmark className={`h-3.5 w-3.5 ${isActivePaperSaved ? 'fill-current' : ''}`} />
                    )}
                    <span className="hidden lg:inline">{isActivePaperSaved ? t.savedIssue : t.saveIssue}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      void shareActivePaperOnWhatsApp();
                    }}
                    aria-label={t.shareWhatsApp}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-2.5 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-800"
                    title={t.shareWhatsApp}
                  >
                    <Share2 className="h-3.5 w-3.5" />
                    <span className="hidden lg:inline">{t.shareWhatsApp}</span>
                  </button>

                  <div className="relative" ref={overflowRef}>
                    <button
                      type="button"
                      onClick={() => setIsOverflowOpen((curr) => !curr)}
                      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border transition ${
                        isOverflowOpen
                          ? 'border-primary-200 bg-primary-50 text-primary-700 dark:border-primary-800 dark:bg-primary-950/40 dark:text-primary-300'
                          : 'border-zinc-300 bg-white text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-850'
                      }`}
                      title="More options"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>

                    {isOverflowOpen && (
                      <div className="absolute right-0 mt-1.5 w-48 rounded-xl border border-zinc-200 bg-white p-1 shadow-lg dark:border-zinc-800 dark:bg-zinc-950 z-[60]">
                        <button
                          type="button"
                          onClick={() => {
                            setIsOverflowOpen(false);
                            openPdfInNewTab();
                          }}
                          disabled={!pdfUrlForOpen}
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-200 dark:hover:bg-zinc-900/60"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          <span>{t.openPdf}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setIsOverflowOpen(false);
                            handlePdfDownload();
                          }}
                          disabled={!pdfUrlForOpen}
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-200 dark:hover:bg-zinc-900/60"
                        >
                          <Download className="h-3.5 w-3.5" />
                          <span>{t.downloadPdf}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setIsOverflowOpen(false);
                            void handleOfflinePaperSave();
                          }}
                          disabled={!activePaperLibraryInput || isPreparingOfflinePaper || isActivePaperOfflineReady}
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-200 dark:hover:bg-zinc-900/60"
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
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setActivePaper(null);
                      setActiveArticle(null);
                    }}
                    aria-label={t.close}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-300 text-gray-700 transition hover:bg-gray-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            {!activePageImage ? (
              <div className="absolute bottom-[170px] left-4 right-4 z-40 rounded-xl border border-amber-200/80 bg-amber-50/90 backdrop-blur px-3 py-2 text-center text-xs font-semibold text-amber-700 sm:bottom-6 sm:left-auto sm:right-6 sm:w-80 dark:border-amber-900/60 dark:bg-amber-950/80 dark:text-amber-300 shadow-md">
                {t.pageMissingPrefix} {activePage}.
              </div>
            ) : null}

            <div className={`grid min-h-0 flex-1 grid-cols-1 ${desktopReaderGridClassName}`}>
              <div
                ref={previewTouchSurfaceRef}
                className={`relative min-w-0 overflow-auto overscroll-contain bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-white via-zinc-50 to-zinc-100 p-1 [-webkit-overflow-scrolling:touch] sm:p-3 md:p-4 dark:bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] dark:from-zinc-900 dark:via-zinc-950 dark:to-zinc-950 reader-stage-scroll ${readerStageBorderClassName} ${dynamicPaddingClass}`}
                style={{
                  touchAction: 'pan-x pan-y',
                  WebkitOverflowScrolling: 'touch',
                  willChange: 'transform',
                  transform: 'translate3d(0,0,0)',
                  backfaceVisibility: 'hidden',
                }}
              >
                {loadingFallback ? (
                  <div className="flex h-full min-h-48 items-center justify-center">
                    <Loader2 className="h-7 w-7 animate-spin text-primary-600" />
                  </div>
                ) : fallbackError ? (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
                    {fallbackError}
                  </div>
                ) : activePageImage || pdfFallbackPreview ? (
                  <div
                    className={`mx-auto flex min-h-full w-full max-w-[1340px] items-center ${
                      isPreviewZoomed ? 'justify-start' : 'justify-center'
                    }`}
                  >
                    <div
                      className={`relative shrink-0 ${
                        isPreviewZoomed ? 'max-w-none' : readerStageWidthClassName
                      }`}
                      style={{
                        perspective: '1500px',
                        width: `${previewZoom * 100}%`,
                      }}
                    >
                      <div
                        className={`relative mx-auto w-fit max-w-full overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 ${bookContainerShadowClassName}`}
                        style={{ maxHeight: previewMaxHeight }}
                      >
                        <AnimatePresence initial={false} custom={pageTurnDirection} mode="popLayout">
                          <motion.div
                            key={`epaper-spread-${activePaper._id}-${activePage}-${shouldShowSpreadMode}`}
                            custom={pageTurnDirection}
                            variants={pageTurnVariants}
                            initial="enter"
                            animate="center"
                            exit="exit"
                            className="mx-auto w-fit max-w-full"
                            style={{ 
                              transformStyle: 'preserve-3d',
                              backfaceVisibility: 'hidden',
                            }}
                          >
                            <div className={`grid gap-0 items-start w-fit mx-auto ${shouldShowSpreadMode ? 'grid-cols-2 relative' : 'grid-cols-1'}`}>
                              {/* Left Page (Active Page) */}
                              <div className="relative mx-auto w-fit">
                                {previewIsDataUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={previewSrc}
                                    alt={`Page ${activePage}`}
                                    onLoad={onPreviewImageLoad}
                                    style={{ maxHeight: previewMaxHeight }}
                                    className="block h-auto w-auto max-w-full object-contain"
                                    draggable={false}
                                  />
                                ) : (
                                  <Image
                                    src={previewSrc}
                                    alt={`Page ${activePage}`}
                                    width={previewWidth}
                                    height={previewHeight}
                                    unoptimized
                                    onLoad={onPreviewImageLoad}
                                    style={{ maxHeight: previewMaxHeight }}
                                    className="block h-auto w-auto max-w-full object-contain"
                                    draggable={false}
                                  />
                                )}

                                {pageArticles.map((article, index) => (
                                  <button
                                    key={article._id}
                                    type="button"
                                    onClick={() => setActiveArticle(article)}
                                    className={`absolute rounded-[2px] outline-none transition focus-visible:ring-2 focus-visible:ring-white/90 focus-visible:ring-offset-2 focus-visible:ring-offset-black/60 ${
                                      showHotspotHints && !isCoarsePointer
                                        ? 'epaper-hotspot-glow'
                                        : 'bg-transparent'
                                    }`}
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

                              {/* Center Spine Divider Overlay (Spread Mode Only) */}
                              {shouldShowSpreadMode ? (
                                <div className="absolute top-0 bottom-0 left-1/2 w-[48px] -translate-x-1/2 pointer-events-none z-30 flex justify-center items-stretch">
                                  {/* Ambient Page Curve Shadow - Left */}
                                  <div className="absolute top-0 bottom-0 right-1/2 left-0 bg-gradient-to-r from-transparent via-black/5 to-black/15 dark:via-black/10 dark:to-black/30" />
                                  
                                  {/* Inner Crease Shadow - Left (Tighter roll) */}
                                  <div className="absolute top-0 bottom-0 right-1/2 w-3 bg-gradient-to-r from-transparent to-black/20 dark:to-black/40" />

                                  {/* Center Seam Line */}
                                  <div className="relative z-10 w-[2px] h-full bg-black/35 dark:bg-black/70 shadow-[0_0_4px_rgba(0,0,0,0.5)] dark:shadow-[0_0_8px_rgba(0,0,0,0.8)]" />

                                  {/* Inner Crease Shadow - Right (Tighter roll) */}
                                  <div className="absolute top-0 bottom-0 left-1/2 w-3 bg-gradient-to-r from-black/20 to-transparent dark:from-black/40" />

                                  {/* Ambient Page Curve Shadow - Right */}
                                  <div className="absolute top-0 bottom-0 left-1/2 right-0 bg-gradient-to-r from-black/15 via-black/5 to-transparent dark:from-black/30 dark:via-black/10" />
                                </div>
                              ) : null}

                              {/* Right Page (Companion Page - Spread Mode Only) */}
                              {shouldShowSpreadMode && spreadCompanionPage ? (
                                <div className="relative mx-auto w-fit border-l border-zinc-200 dark:border-zinc-800">
                                  {spreadCompanionPage.imagePath ? (
                                    <Image
                                      src={spreadCompanionPage.imagePath}
                                      alt={`Page ${spreadCompanionPage.pageNumber}`}
                                      width={spreadCompanionPage.width}
                                      height={spreadCompanionPage.height}
                                      unoptimized
                                      style={{ maxHeight: previewMaxHeight }}
                                      className="block h-auto w-auto max-w-full object-contain"
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
                                      className={`absolute rounded-[2px] outline-none transition focus-visible:ring-2 focus-visible:ring-white/90 focus-visible:ring-offset-2 focus-visible:ring-offset-black/60 ${
                                        showHotspotHints && !isCoarsePointer
                                          ? 'epaper-hotspot-glow'
                                          : 'bg-transparent'
                                      }`}
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
                              ) : null}
                            </div>
                          </motion.div>
                        </AnimatePresence>
                      </div>

                      <div className="pointer-events-none absolute bottom-2 left-1/2 z-20 -translate-x-1/2 sm:hidden">
                        <div className="rounded-full bg-black/65 px-2.5 py-0.5 text-[10px] font-semibold text-white shadow-lg backdrop-blur-md">
                          {readerPageLabel}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
                    {t.noPreview}
                  </div>
                )}

                <section
                  className="mx-auto mt-3 w-full max-w-[1120px] pb-3 sm:hidden"
                  aria-label={t.pageStrip}
                  data-swipe-ignore="true"
                >
                  <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white/95 p-3 shadow-lg dark:border-white/10 dark:bg-zinc-950/90">
                    <div className="mb-2.5 flex items-center justify-between gap-2 px-0.5">
                      <span className="text-[11px] font-bold uppercase tracking-wide text-zinc-700 dark:text-zinc-200">
                        {language === 'hi' ? 'संस्करण के पृष्ठ' : 'Edition Pages'}
                      </span>
                      <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300">
                        {pageSummaries.length} {language === 'hi' ? 'पृष्ठ' : 'Pages'}
                      </span>
                    </div>

                    <div
                      className="flex snap-x snap-mandatory scroll-px-0.5 gap-2.5 overflow-x-auto px-0.5 pb-2 [scrollbar-width:thin] reader-scroll-x"
                      data-reader-scroll="x"
                    >
                      {pageSummaries.map((page) => {
                        const isCurrentPage = page.pageNumber === activePage;
                        const isCompanionPage =
                          shouldShowSpreadMode &&
                          spreadCompanionPage?.pageNumber === page.pageNumber;

                        return (
                          <button
                            key={`mobile-strip-${page.pageNumber}`}
                            type="button"
                            onClick={() => {
                              navigateToPage(page.pageNumber);
                              window.requestAnimationFrame(() => {
                                previewTouchSurfaceRef.current?.scrollTo({
                                  top: 0,
                                  left: 0,
                                  behavior: 'smooth',
                                });
                              });
                            }}
                            className={`reader-touch-button reader-focus-ring group min-w-[88px] max-w-[88px] snap-start shrink-0 overflow-hidden rounded-xl border text-left transition active:scale-95 min-[380px]:min-w-[100px] min-[380px]:max-w-[100px] ${
                              isCurrentPage
                                ? 'border-red-500 bg-red-50 shadow-[0_0_18px_rgba(239,68,68,0.2)] dark:bg-red-500/10'
                                : isCompanionPage
                                  ? 'border-amber-300 bg-amber-50/80 dark:border-amber-700 dark:bg-amber-950/20'
                                  : 'border-zinc-200 bg-zinc-50 hover:border-zinc-300 dark:border-white/10 dark:bg-white/5'
                            }`}
                          >
                            <div className="relative aspect-[3/4] overflow-hidden bg-zinc-100 dark:bg-zinc-900">
                              {page.imagePath ? (
                                <Image
                                  src={page.imagePath}
                                  alt={getPageSectionName(page.pageNumber, language)}
                                  fill
                                  unoptimized
                                  className="object-contain p-1.5"
                                  sizes="(max-width: 379px) 88px, 100px"
                                />
                              ) : (
                                <div className="flex h-full items-center justify-center px-2 text-center text-[10px] font-semibold text-zinc-400">
                                  {getPageSectionName(page.pageNumber, language)}
                                </div>
                              )}
                            </div>
                            <div className="flex min-h-9 items-center justify-center border-t border-zinc-200 bg-white px-1.5 py-1 dark:border-white/10 dark:bg-zinc-900">
                              <span className={`truncate text-[10px] font-bold ${
                                isCurrentPage
                                  ? 'text-red-600 dark:text-red-400'
                                  : 'text-zinc-600 dark:text-zinc-300'
                              }`}>
                                {getPageSectionName(page.pageNumber, language)}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </section>

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
                              <div className="flex items-start gap-3">
                                {article.coverImagePath ? (
                                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-800">
                                    <Image
                                      src={article.coverImagePath}
                                      alt={article.title || t.storyImage}
                                      fill
                                      unoptimized
                                      className="object-cover"
                                      sizes="56px"
                                    />
                                  </div>
                                ) : null}
                                <div className="min-w-0 flex-1">
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
                                  <div className="flex items-start gap-3">
                                    {article.coverImagePath ? (
                                      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-800">
                                        <Image
                                          src={article.coverImagePath}
                                          alt={article.title || t.storyImage}
                                          fill
                                          unoptimized
                                          className="object-cover"
                                          sizes="64px"
                                        />
                                      </div>
                                    ) : null}
                                    <div className="min-w-0 flex-1">
                                      <span className="block font-medium text-gray-900 dark:text-zinc-100">
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
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </aside>
              ) : null}
            </div>

            {/* Floating social bar for mobile */}
            <div 
              className="absolute bottom-[calc(env(safe-area-inset-bottom)+0.5rem)] left-2 right-2 z-40 rounded-2xl border border-zinc-200 bg-white/95 p-1 shadow-[0_15px_30px_rgba(0,0,0,0.15)] backdrop-blur-2xl dark:border-white/10 dark:bg-zinc-950/90 dark:shadow-[0_20px_40px_rgba(0,0,0,0.5)] min-[380px]:left-3 min-[380px]:right-3 min-[380px]:p-1.5 sm:hidden"
              data-swipe-ignore="true"
            >
              <div className="grid w-full grid-cols-4 gap-0.5 text-center min-[380px]:gap-1">
                <a
                  href={COMPANY_INFO.social.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={t.instagramAction}
                  className="flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-0.5 py-2 text-zinc-500 transition-all duration-200 hover:bg-pink-50 hover:text-pink-600 active:scale-95 dark:text-zinc-400 dark:hover:bg-pink-500/10 dark:hover:text-pink-400"
                >
                  <Instagram className="h-[18px] w-[18px] shrink-0" />
                  <span className="max-w-full text-center text-[9px] font-semibold leading-tight min-[380px]:text-[10px]">{t.instagramAction}</span>
                </a>

                <a
                  href={COMPANY_INFO.social.youtube}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={t.youtubeAction}
                  className="flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-0.5 py-2 text-zinc-500 transition-all duration-200 hover:bg-red-50 hover:text-red-600 active:scale-95 dark:text-zinc-400 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                >
                  <Youtube className="h-[18px] w-[18px] shrink-0" />
                  <span className="max-w-full text-center text-[9px] font-semibold leading-tight min-[380px]:text-[10px]">{t.youtubeAction}</span>
                </a>

                <a
                  href={COMPANY_INFO.social.whatsapp}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={t.whatsappChannelAction}
                  className="flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-0.5 py-2 text-zinc-500 transition-all duration-200 hover:bg-emerald-50 hover:text-emerald-600 active:scale-95 dark:text-zinc-400 dark:hover:bg-emerald-500/10 dark:hover:text-emerald-400"
                >
                  <WhatsAppIcon className="h-[18px] w-[18px] shrink-0" />
                  <span className="max-w-full text-center text-[8.5px] font-semibold leading-tight min-[380px]:text-[9.5px]">
                    {t.whatsappChannelAction}
                  </span>
                </a>

                <button
                  type="button"
                  onClick={handlePdfDownload}
                  disabled={!pdfUrlForOpen}
                  aria-label={t.downloadAction}
                  className="flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-0.5 py-2 text-zinc-500 transition-all duration-200 hover:bg-zinc-100 hover:text-zinc-850 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-white"
                >
                  <Download className="h-[18px] w-[18px] shrink-0" />
                  <span className="max-w-full text-center text-[9px] font-semibold leading-tight min-[380px]:text-[10px]">{t.downloadAction}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {activeArticle ? (
        <div
          className="fixed inset-0 z-[100] bg-black/65 p-0 sm:p-4"
          data-swipe-ignore="true"
          onClick={(event) => {
            if (event.target !== event.currentTarget) return;
            setActiveArticle(null);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={activeArticle.title || t.story}
            className="relative mx-auto flex h-[100dvh] w-full max-w-6xl flex-col overflow-hidden rounded-none border border-gray-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 sm:h-full sm:rounded-2xl"
          >
            <h3 className="sr-only">{activeArticle.title}</h3>

            <div className="shrink-0 border-b border-zinc-200 bg-white px-2.5 pb-2.5 pt-[calc(env(safe-area-inset-top)+0.5rem)] shadow-sm dark:border-zinc-800 dark:bg-zinc-950 sm:border-gray-200 sm:px-4 sm:py-3 dark:sm:border-zinc-800 dark:sm:bg-zinc-900/95">
              <div className="sm:hidden">
                <div>
                  <div className="relative flex min-h-11 items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setActiveArticle(null)}
                      aria-label={t.close}
                      className="reader-touch-button reader-focus-ring inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 text-zinc-800 transition hover:bg-zinc-100 dark:border-white/15 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>

                    <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                      <div className={theme === 'dark' ? 'dark' : ''}>
                        <Logo size="headerCompact" />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        void shareActiveArticleOnWhatsApp();
                      }}
                      aria-label={t.whatsApp}
                      className="reader-touch-button reader-focus-ring inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300 dark:hover:bg-emerald-500/20"
                    >
                      <WhatsAppIcon className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="hidden flex-col gap-3 sm:flex">
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
                      disabled={isPreparingArticleListen || !canListenToActiveArticle}
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

            <div className="flex-1 scroll-smooth overflow-auto overscroll-contain bg-zinc-50 dark:bg-zinc-950 sm:bg-white sm:dark:bg-zinc-900">
              <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-2.5 py-3 pb-[calc(env(safe-area-inset-bottom)+6.75rem)] min-[380px]:px-3 sm:gap-4 sm:p-4 md:p-5">
                <div className="hidden flex-wrap items-center gap-2 sm:flex">
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

                {activeArticle.videoUrl ? (
                  <div className="overflow-hidden rounded-[1.25rem] border border-gray-200 bg-black shadow-sm dark:border-zinc-800 sm:rounded-2xl">
                    <div className="aspect-video w-full">
                      <iframe
                        src={getEmbedUrl(activeArticle.videoUrl)}
                        title={activeArticle.title || "Video Story"}
                        className="h-full w-full border-0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                      />
                    </div>
                  </div>
                ) : null}

                <AnimatePresence initial={false} mode="wait">
                  <motion.div
                    key={`article-reader-${articleReaderMode}`}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: prefersReducedMotion ? 0 : 0.2, ease: 'easeOut' }}
                    className="flex flex-col gap-3 sm:gap-4"
                  >
                    {articleReaderMode === 'story' && activeArticleHasImage ? (
                      <div
                        className="overflow-auto rounded-[1.25rem] border border-zinc-200 bg-zinc-100 shadow-[0_12px_30px_-22px_rgba(0,0,0,0.55)] dark:border-zinc-800 dark:bg-black sm:rounded-2xl"
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
                          <div className="mx-auto w-full max-w-3xl rounded-[1.5rem] border border-zinc-200 bg-white px-4 py-5 shadow-[0_18px_45px_-32px_rgba(0,0,0,0.6)] dark:border-zinc-800 dark:bg-zinc-900 sm:rounded-2xl sm:px-5">
                            <div>
                              <div className="min-w-0">
                                <p className="inline-flex rounded-full bg-red-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-red-700 dark:bg-red-500/10 dark:text-red-300">
                                  {t.storyPreview}
                                </p>
                                <h4 className="mt-3 font-[family:var(--font-devanagari),var(--font-latin),system-ui,sans-serif] text-[1.35rem] font-black leading-[1.28] text-zinc-950 dark:text-zinc-50 sm:text-xl">
                                  {activeArticle.title || t.story}
                                </h4>
                                <p className="mt-3 line-clamp-5 font-[family:var(--font-devanagari),var(--font-latin),system-ui,sans-serif] text-[15px] leading-7 text-zinc-700 dark:text-zinc-300">
                                  {activeArticlePreviewText}
                                </p>
                              </div>
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
                      <div className="mx-auto w-full max-w-3xl rounded-[1.5rem] border border-zinc-200 bg-white px-4 py-5 shadow-[0_18px_45px_-32px_rgba(0,0,0,0.6)] dark:border-zinc-800 dark:bg-zinc-900 sm:rounded-2xl sm:px-6 sm:py-6">
                        <div className="border-b border-zinc-200 pb-4 dark:border-zinc-800">
                          <h4
                            className="font-[family:var(--font-devanagari),var(--font-latin),system-ui,sans-serif] text-xl font-black leading-[1.3] text-zinc-950 dark:text-zinc-50 sm:text-2xl"
                            style={{ fontSize: `${1.35 * articleTextScale}rem` }}
                          >
                            {activeArticle?.title || t.story}
                          </h4>
                          {activeArticleHasExcerpt && activeArticleHasContent ? (
                            <p
                              className="mt-3 font-[family:var(--font-devanagari),var(--font-latin),system-ui,sans-serif] font-medium leading-8 text-zinc-700 dark:text-zinc-300"
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
                            className="reader-touch-button reader-focus-ring mt-6 inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800 sm:w-auto"
                          >
                            <Newspaper className="h-4 w-4" />
                            <span>{t.openVisualStory}</span>
                          </button>
                        ) : null}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-600 dark:text-zinc-400">{t.noReadableText}</p>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>

            <div className="absolute bottom-[calc(env(safe-area-inset-bottom)+0.5rem)] left-2.5 right-2.5 z-20 rounded-2xl border border-zinc-200 bg-white/95 p-1 shadow-[0_18px_45px_rgba(0,0,0,0.16)] backdrop-blur-xl dark:border-white/10 dark:bg-zinc-950/95 dark:shadow-[0_18px_45px_rgba(0,0,0,0.4)] sm:hidden">
              <div className="grid grid-cols-5 gap-1">
                <button
                  type="button"
                  onClick={() => setArticleReaderMode('story')}
                  className={`reader-touch-button reader-focus-ring flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-0.5 py-2 text-[9px] font-bold transition-all duration-200 ${
                    articleReaderMode === 'story'
                      ? 'bg-red-600 text-white shadow-sm'
                      : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-white'
                  }`}
                >
                  <Newspaper className="h-4 w-4 shrink-0" />
                  <span className="max-w-full truncate">{t.visualAction}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setArticleReaderMode('text')}
                  disabled={!hasReadableArticleText}
                  className={`reader-touch-button reader-focus-ring flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-0.5 py-2 text-[9px] font-bold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-40 ${
                    articleReaderMode === 'text'
                      ? 'bg-red-600 text-white shadow-sm'
                      : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-white'
                  }`}
                >
                  <Type className="h-4 w-4 shrink-0" />
                  <span className="max-w-full truncate">{t.textAction}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (shouldShowStoryReaderStopAction) {
                      stopArticleListening();
                      return;
                    }
                    void handleArticleListen();
                  }}
                  disabled={!shouldShowStoryReaderStopAction && !canListenToActiveArticle}
                  className={`reader-touch-button reader-focus-ring flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-0.5 py-2 text-[9px] font-bold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-40 ${
                    shouldShowStoryReaderStopAction
                      ? 'bg-zinc-700 text-white'
                      : 'text-zinc-500 hover:bg-emerald-50 hover:text-emerald-700 dark:text-zinc-400 dark:hover:bg-emerald-500/15 dark:hover:text-emerald-300'
                  }`}
                >
                  {isPreparingArticleListen ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : shouldShowStoryReaderStopAction ? (
                    <PauseCircle className="h-4 w-4" />
                  ) : (
                    <Volume2 className="h-4 w-4" />
                  )}
                  <span className="max-w-full truncate">
                    {isPreparingArticleListen
                      ? t.listening
                      : shouldShowStoryReaderStopAction
                        ? t.stopListening
                        : t.listen}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleStoryTextDownload}
                  disabled={!hasReadableArticleText}
                  className="reader-touch-button reader-focus-ring flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-0.5 py-2 text-[9px] font-bold text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-40 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-white"
                >
                  <Download className="h-4 w-4" />
                  <span className="max-w-full truncate">{t.downloadAction}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    void shareActiveArticle();
                  }}
                  className="reader-touch-button reader-focus-ring flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-0.5 py-2 text-[9px] font-bold text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-white"
                >
                  <Share2 className="h-4 w-4" />
                  <span className="max-w-full truncate">{t.shareWhatsApp}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

