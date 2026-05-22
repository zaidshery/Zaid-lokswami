import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import { COMPANY_INFO } from '@/lib/constants/company';
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

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function normalizeText(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function wrapText(value: string, maxChars: number, maxLines: number) {
  const words = normalizeText(value).split(' ').filter(Boolean);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxChars) {
      current = next;
      continue;
    }

    if (current) lines.push(current);
    current = word;
    if (lines.length >= maxLines) break;
  }

  if (current && lines.length < maxLines) lines.push(current);
  if (lines.length > maxLines) lines.length = maxLines;

  const lastIndex = lines.length - 1;
  if (lastIndex >= 0 && words.join(' ').length > lines.join(' ').length) {
    lines[lastIndex] = `${lines[lastIndex].replace(/\.*$/, '').slice(0, maxChars - 3).trim()}...`;
  }

  return lines;
}

function textLinesSvg(lines: string[], x: number, y: number, fontSize: number, lineHeight: number) {
  return lines
    .map(
      (line, index) =>
        `<text x="${x}" y="${y + index * lineHeight}" fill="#f8fafc" font-size="${fontSize}" font-weight="800">${escapeXml(line)}</text>`
    )
    .join('');
}

async function readPublicAsset(publicPath: string) {
  const normalized = publicPath.replace(/^\/+/, '');
  return fs.readFile(path.join(PUBLIC_DIR, normalized));
}

async function loadImageBuffer(input: string, fallbackPath: string) {
  const source = input.trim();

  try {
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

async function buildContainedImage(input: {
  imageUrl: string;
  fallbackPath: string;
  width: number;
  height: number;
  background: string;
}) {
  const imageBuffer = await loadImageBuffer(input.imageUrl, input.fallbackPath);
  return sharp(imageBuffer)
    .rotate()
    .resize(input.width, input.height, {
      fit: 'contain',
      background: input.background,
      withoutEnlargement: false,
    })
    .png()
    .toBuffer();
}

function createBase() {
  return sharp({
    create: {
      width: PREVIEW_WIDTH,
      height: PREVIEW_HEIGHT,
      channels: 4,
      background: '#171417',
    },
  });
}

function logoSvg(x: number, y: number) {
  return `
    <g transform="translate(${x} ${y})">
      <rect x="0" y="0" width="44" height="44" rx="12" fill="#dc2626"/>
      <text x="58" y="30" fill="#f8fafc" font-size="25" font-weight="800">${escapeXml(COMPANY_INFO.name)}</text>
    </g>
  `;
}

export async function buildArticleSocialPreview(input: ArticlePreviewInput) {
  const titleLines = wrapText(input.title || COMPANY_INFO.name, 24, 3);
  const descriptionLines = wrapText(input.description || COMPANY_INFO.tagline.en, 34, 3);
  const image = await buildContainedImage({
    imageUrl: input.imageUrl,
    fallbackPath: '/lokswami-share-preview.png',
    width: 674,
    height: 502,
    background: '#09090b',
  });
  const overlay = Buffer.from(`
    <svg width="${PREVIEW_WIDTH}" height="${PREVIEW_HEIGHT}" viewBox="0 0 ${PREVIEW_WIDTH} ${PREVIEW_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <rect x="40" y="40" width="1120" height="550" rx="34" fill="#0f0f12" stroke="rgba(255,255,255,0.12)"/>
      <rect x="64" y="64" width="674" height="502" rx="18" fill="#09090b"/>
      <rect x="764" y="40" width="396" height="550" fill="#171417"/>
      <circle cx="1108" cy="72" r="210" fill="rgba(220,38,38,0.18)"/>
      <rect x="800" y="86" width="${Math.max(126, Math.min(260, normalizeText(input.label || 'NEWS').length * 13 + 34))}" height="38" rx="19" fill="#dc2626"/>
      <text x="818" y="111" fill="#ffffff" font-size="18" font-weight="800">${escapeXml(normalizeText(input.label || 'NEWS').toUpperCase().slice(0, 22))}</text>
      ${textLinesSvg(titleLines, 800, 184, 42, 50)}
      ${descriptionLines
        .map(
          (line, index) =>
            `<text x="800" y="${384 + index * 32}" fill="#d4d4d8" font-size="22" font-weight="500">${escapeXml(line)}</text>`
        )
        .join('')}
      <rect x="800" y="462" width="336" height="38" rx="19" fill="#ffffff"/>
      <text x="820" y="487" fill="#18181b" font-size="17" font-weight="900">READ FULL STORY</text>
      <text x="990" y="487" fill="#dc2626" font-size="17" font-weight="900">lokswami.com</text>
      ${logoSvg(800, 526)}
    </svg>
  `);

  return createBase()
    .composite([
      { input: overlay, left: 0, top: 0 },
      { input: image, left: 64, top: 64 },
    ])
    .png()
    .toBuffer();
}

export async function buildEpaperSocialPreview(input: EpaperPreviewInput) {
  const titleLines = wrapText(input.title || 'Lokswami E-Paper', 23, 2);
  const cover = await buildContainedImage({
    imageUrl: input.imageUrl,
    fallbackPath: '/placeholders/epaper-3x4.svg',
    width: 292,
    height: 422,
    background: '#f6f1e8',
  });
  const overlay = Buffer.from(`
    <svg width="${PREVIEW_WIDTH}" height="${PREVIEW_HEIGHT}" viewBox="0 0 ${PREVIEW_WIDTH} ${PREVIEW_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <rect x="40" y="40" width="1120" height="550" rx="34" fill="#0f0f12" stroke="rgba(255,255,255,0.12)"/>
      <rect x="40" y="40" width="446" height="550" fill="#09090b"/>
      <rect x="114" y="92" width="316" height="446" rx="26" fill="#f6f1e8"/>
      <rect x="486" y="40" width="674" height="550" fill="#171417"/>
      <circle cx="1074" cy="84" r="240" fill="rgba(220,38,38,0.2)"/>
      <rect x="540" y="94" width="174" height="38" rx="19" fill="#dc2626"/>
      <text x="558" y="119" fill="#ffffff" font-size="18" font-weight="800">LATEST E-PAPER</text>
      ${textLinesSvg(titleLines, 540, 210, 54, 62)}
      <text x="540" y="366" fill="#ffffff" font-size="30" font-weight="800">${escapeXml(input.cityLabel)} | ${escapeXml(input.dateLabel)}</text>
      <text x="540" y="414" fill="#d4d4d8" font-size="24" font-weight="500">Read the full Lokswami digital newspaper edition online.</text>
      <rect x="540" y="454" width="438" height="40" rx="20" fill="#ffffff"/>
      <text x="562" y="480" fill="#18181b" font-size="18" font-weight="900">OPEN E-PAPER ONLINE</text>
      <text x="856" y="480" fill="#dc2626" font-size="18" font-weight="900">lokswami.com</text>
      ${logoSvg(540, 506)}
    </svg>
  `);

  return createBase()
    .composite([
      { input: overlay, left: 0, top: 0 },
      { input: cover, left: 126, top: 104 },
    ])
    .png()
    .toBuffer();
}

export function socialPreviewHeaders() {
  return {
    'Content-Type': 'image/png',
    'Cache-Control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400',
  };
}
