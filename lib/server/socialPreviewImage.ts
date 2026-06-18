import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import { getSiteUrl, toAbsoluteArticleUrl } from '@/lib/seo/articleSeo';

const PREVIEW_WIDTH = 1200;
const PREVIEW_HEIGHT = 630;
const PUBLIC_DIR = path.resolve(process.cwd(), 'public');

type ArticlePreviewInput = {
  title: string;
  description: string;
  imageUrl: string;
  label: string;
};

type EpaperPreviewInput = {
  title: string;
  cityLabel: string;
  dateLabel: string;
  imageUrl: string;
};

async function readPublicAsset(publicPath: string) {
  const normalized = publicPath.replace(/^\/+/, '');
  return fs.readFile(path.join(PUBLIC_DIR, normalized));
}

function readDataUri(source: string) {
  const match = source.match(/^data:[^,]*,(.*)$/i);
  if (!match) return null;

  const metadata = source.slice(0, source.indexOf(',')).toLowerCase();
  return metadata.includes(';base64')
    ? Buffer.from(match[1], 'base64')
    : Buffer.from(decodeURIComponent(match[1]));
}

async function loadImageBuffer(input: string, fallbackPath: string) {
  const source = input.trim();

  try {
    const dataUriBuffer = readDataUri(source);
    if (dataUriBuffer) return dataUriBuffer;

    if (source.startsWith('/')) {
      return await readPublicAsset(source);
    }

    const url = toAbsoluteArticleUrl(source, getSiteUrl());
    const response = await fetch(url, {
      headers: { accept: 'image/*' },
      next: { revalidate: 300 },
    });
    if (!response.ok) throw new Error(`Image fetch failed with ${response.status}`);
    return Buffer.from(await response.arrayBuffer());
  } catch {
    return readPublicAsset(fallbackPath);
  }
}

async function buildMediaOnlyPreview(input: {
  imageUrl: string;
  fallbackPath: string;
  fit: 'cover' | 'contain';
  background: string;
}) {
  const imageBuffer = await loadImageBuffer(input.imageUrl, input.fallbackPath);
  return sharp(imageBuffer)
    .rotate()
    .resize(PREVIEW_WIDTH, PREVIEW_HEIGHT, {
      fit: input.fit,
      position: 'center',
      background: input.background,
      withoutEnlargement: false,
    })
    .png()
    .toBuffer();
}

export async function buildArticleSocialPreview(input: ArticlePreviewInput) {
  void input.title;
  void input.description;
  void input.label;

  return buildMediaOnlyPreview({
    imageUrl: input.imageUrl,
    fallbackPath: '/lokswami-share-preview.png',
    fit: 'cover',
    background: '#09090b',
  });
}

export async function buildEpaperSocialPreview(input: EpaperPreviewInput) {
  void input.title;
  void input.cityLabel;
  void input.dateLabel;

  return buildMediaOnlyPreview({
    imageUrl: input.imageUrl,
    fallbackPath: '/placeholders/epaper-3x4.svg',
    fit: 'contain',
    background: '#f6f1e8',
  });
}

export function socialPreviewHeaders() {
  return {
    'Content-Type': 'image/png',
    'Cache-Control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400',
  };
}
