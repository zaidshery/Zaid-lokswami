export type EPaperStatus = 'draft' | 'published';
export type EPaperReadinessStatus = 'ready' | 'needs-review' | 'not-ready';

export interface EPaperPageData {
  pageNumber: number;
  imagePath?: string;
  width?: number;
  height?: number;
}

export interface EPaperReadiness {
  status: EPaperReadinessStatus;
  blockers: string[];
  warnings: string[];
  pageImageCoveragePercent: number;
  hotspotCoveragePercent: number;
  textCoveragePercent: number;
  pagesWithImage: number;
  pagesMissingImage: number;
  pagesWithHotspots: number;
  pagesMissingHotspots: number;
  mappedArticles: number;
  articlesWithReadableText: number;
  articlesMissingReadableText: number;
  missingImagePages: number[];
  missingHotspotPages: number[];
}

export interface EPaperAutomationInfo {
  sourceType:
    | 'manual-upload'
    | 'drive-import'
    | 'remote-import'
    | 'legacy'
    | 'unknown';
  sourceLabel?: string;
  sourceUrl?: string;
  sourceHost?: string;
  pageImageGenerationEnabled: boolean;
  pageImageGenerationAvailable: boolean;
  pageImageGenerationReason?: string;
}

export interface EPaperRecord {
  _id: string;
  citySlug: string;
  cityName: string;
  title: string;
  publishDate: string;
  pdfPath: string;
  thumbnailPath: string;
  pageCount: number;
  pages: EPaperPageData[];
  status: EPaperStatus;
  articleCount?: number;
  pagesWithImage?: number;
  pagesMissingImage?: number;
  readiness?: EPaperReadiness;
  automation?: EPaperAutomationInfo;
  sourceType?: EPaperAutomationInfo['sourceType'];
  sourceLabel?: string;
  sourceUrl?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface EPaperArticleHotspot {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface EPaperArticleRecord {
  _id: string;
  epaperId: string;
  pageNumber: number;
  title: string;
  slug: string;
  excerpt?: string;
  contentHtml?: string;
  coverImagePath?: string;
  hotspot: EPaperArticleHotspot;
  createdAt?: string;
  updatedAt?: string;
}
