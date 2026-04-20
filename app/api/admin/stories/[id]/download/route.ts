import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import connectDB from '@/lib/db/mongoose';
import Story from '@/lib/models/Story';
import { getAdminSession } from '@/lib/auth/admin';
import { getCanDownloadStoryAssets } from '@/lib/auth/storyEditing';
import { getStoredStoryById } from '@/lib/storage/storiesFile';
import {
  createStoryVideoDownloadRequest,
  STORY_VIDEO_STORAGE_PROVIDER,
} from '@/lib/storage/storyVideoUpload';
import { resolveStoryWorkflow } from '@/lib/workflow/story';

type RouteContext = {
  params: Promise<{ id: string }>;
};

type StoryDownloadAsset = 'thumbnail' | 'media';

type StoryRecord = {
  _id?: unknown;
  title?: unknown;
  author?: unknown;
  thumbnail?: unknown;
  mediaType?: unknown;
  mediaUrl?: unknown;
  mediaKey?: unknown;
  mediaMimeType?: unknown;
  storageProvider?: unknown;
  isPublished?: unknown;
  workflow?: unknown;
  publishedAt?: unknown;
  updatedAt?: unknown;
};

type DownloadSource = {
  url: string;
  headers?: Record<string, string>;
  fallbackMimeType?: string;
};

function isStoryDownloadAsset(value: string | null): value is StoryDownloadAsset {
  return value === 'thumbnail' || value === 'media';
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Failed to download story asset';
}

async function shouldUseFileStore() {
  if (!process.env.MONGODB_URI) return true;

  try {
    await connectDB();
    return false;
  } catch (error) {
    console.error('MongoDB unavailable for story download route, using file store.', error);
    return true;
  }
}

function buildStoryPermissionRecord(story: StoryRecord) {
  return {
    legacyAuthorName: typeof story.author === 'string' ? story.author : '',
    workflow: resolveStoryWorkflow({
      workflow:
        typeof story.workflow === 'object' && story.workflow
          ? (story.workflow as Record<string, unknown>)
          : null,
      isPublished: story.isPublished,
      publishedAt: story.publishedAt,
      updatedAt: story.updatedAt,
    }),
  };
}

function sanitizeFileNameSegment(value: string, fallback: string) {
  const sanitized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');

  return sanitized || fallback;
}

function getMimeBase(contentType: string | undefined) {
  return String(contentType || '')
    .split(';')[0]
    .trim()
    .toLowerCase();
}

function getFileExtensionFromMimeType(contentType: string | undefined) {
  const mime = getMimeBase(contentType);

  switch (mime) {
    case 'video/mp4':
      return '.mp4';
    case 'image/jpeg':
      return '.jpg';
    case 'image/png':
      return '.png';
    case 'image/webp':
      return '.webp';
    case 'image/gif':
      return '.gif';
    case 'application/pdf':
      return '.pdf';
    default:
      return '';
  }
}

function getFileExtensionFromUrl(rawUrl: string) {
  try {
    const pathname = new URL(rawUrl).pathname;
    const match = pathname.match(/(\.[a-z0-9]{2,5})$/i);
    return match ? match[1].toLowerCase() : '';
  } catch {
    const sanitized = rawUrl.split('?')[0] || rawUrl;
    const match = sanitized.match(/(\.[a-z0-9]{2,5})$/i);
    return match ? match[1].toLowerCase() : '';
  }
}

function buildDownloadFilename(story: StoryRecord, asset: StoryDownloadAsset, contentType: string, url: string) {
  const storyId = String(story._id || '').trim().slice(0, 8) || 'story';
  const title = sanitizeFileNameSegment(String(story.title || ''), `story-${storyId}`);
  const assetLabel = asset === 'thumbnail' ? 'thumbnail' : 'media';
  const extension =
    getFileExtensionFromMimeType(contentType) || getFileExtensionFromUrl(url) || '.bin';

  return `${title}-${assetLabel}${extension}`;
}

function isSupportedDownloadContentType(contentType: string | undefined) {
  const mime = getMimeBase(contentType);
  return (
    !mime ||
    mime.startsWith('image/') ||
    mime.startsWith('video/') ||
    mime === 'application/pdf' ||
    mime === 'application/octet-stream'
  );
}

function resolveDownloadSource(story: StoryRecord, asset: StoryDownloadAsset): DownloadSource | null {
  if (asset === 'thumbnail') {
    const thumbnailUrl = String(story.thumbnail || '').trim();
    if (!thumbnailUrl) return null;

    return {
      url: thumbnailUrl,
    };
  }

  const mediaKey = String(story.mediaKey || '').trim();
  const mediaUrl = String(story.mediaUrl || '').trim();
  const mediaMimeType = String(story.mediaMimeType || '').trim().toLowerCase();
  const storageProvider = String(story.storageProvider || '').trim();

  if (storageProvider === STORY_VIDEO_STORAGE_PROVIDER && mediaKey) {
    const signedRequest = createStoryVideoDownloadRequest(mediaKey);
    return {
      url: signedRequest.url,
      headers: signedRequest.headers,
      fallbackMimeType: mediaMimeType || 'video/mp4',
    };
  }

  if (!mediaUrl) {
    return null;
  }

  return {
    url: mediaUrl,
    fallbackMimeType: mediaMimeType,
  };
}

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const user = await getAdminSession();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const assetParam = new URL(req.url).searchParams.get('asset');
    if (!isStoryDownloadAsset(assetParam)) {
      return NextResponse.json(
        { success: false, error: 'A valid asset query is required.' },
        { status: 400 }
      );
    }

    const { id } = await context.params;
    let story: StoryRecord | null = null;

    if (await shouldUseFileStore()) {
      story = await getStoredStoryById(id);
    } else {
      if (!Types.ObjectId.isValid(id)) {
        return NextResponse.json(
          { success: false, error: 'Invalid story ID' },
          { status: 400 }
        );
      }

      story = (await Story.findById(id).lean()) as StoryRecord | null;
    }

    if (!story) {
      return NextResponse.json(
        { success: false, error: 'Story not found' },
        { status: 404 }
      );
    }

    if (!getCanDownloadStoryAssets(user, buildStoryPermissionRecord(story))) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    const downloadSource = resolveDownloadSource(story, assetParam);
    if (!downloadSource) {
      return NextResponse.json(
        {
          success: false,
          error:
            assetParam === 'thumbnail'
              ? 'Story thumbnail is not available for download.'
              : 'Story media is not available for download.',
        },
        { status: 404 }
      );
    }

    const upstreamResponse = await fetch(downloadSource.url, {
      method: 'GET',
      headers: downloadSource.headers,
      cache: 'no-store',
    });

    if (upstreamResponse.status === 404) {
      return NextResponse.json(
        {
          success: false,
          error:
            assetParam === 'thumbnail'
              ? 'Story thumbnail was not found in storage.'
              : 'Story media was not found in storage.',
        },
        { status: 404 }
      );
    }

    if (!upstreamResponse.ok) {
      return NextResponse.json(
        {
          success: false,
          error: `Storage provider returned ${upstreamResponse.status} while downloading the asset.`,
        },
        { status: 502 }
      );
    }

    const contentType =
      String(upstreamResponse.headers.get('content-type') || '').trim() ||
      downloadSource.fallbackMimeType ||
      'application/octet-stream';

    if (!isSupportedDownloadContentType(contentType)) {
      return NextResponse.json(
        {
          success: false,
          error: 'The selected asset is not a downloadable image, video, or PDF.',
        },
        { status: 400 }
      );
    }

    const fileName = buildDownloadFilename(story, assetParam, contentType, downloadSource.url);
    const assetBytes = await upstreamResponse.arrayBuffer();

    return new NextResponse(assetBytes, {
      status: 200,
      headers: {
        'Cache-Control': 'private, no-store, max-age=0',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': String(assetBytes.byteLength),
        'Content-Type': contentType,
      },
    });
  } catch (error) {
    console.error('Error downloading story asset:', error);
    return NextResponse.json(
      { success: false, error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}
