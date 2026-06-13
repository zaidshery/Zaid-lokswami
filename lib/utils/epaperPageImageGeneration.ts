import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import {
  buildEpaperAssetPath,
  getImageDimensionsFromPath,
  resolveEpaperAssetPath,
} from '@/lib/utils/epaperStorage';
import { EPAPER_PAGE_TARGET_WIDTH } from '@/lib/utils/epaperPageImage';

const execFileAsync = promisify(execFile);

export type ConverterEngine = 'pdftoppm' | 'magick';

type PdfToJpgCommand = {
  command: ConverterEngine;
  args: string[];
  timeout: number;
};

function safeRelativeOutput(relativePath: string) {
  return relativePath.replace(/\\/g, '/').replace(/^\/+/, '');
}

async function exists(filePath: string) {
  const stat = await fs.stat(filePath).catch(() => null);
  return Boolean(stat && stat.isFile());
}

async function hasCommand(command: string, args: string[] = ['-h']) {
  try {
    await execFileAsync(command, args, { timeout: 12_000 });
    return true;
  } catch (error: unknown) {
    const code =
      typeof error === 'object' && error !== null && 'code' in error
        ? String((error as { code?: unknown }).code || '').toUpperCase()
        : '';
    if (code === 'ENOENT') return false;
    return true;
  }
}

async function detectConverterEngine(): Promise<ConverterEngine | null> {
  if (await hasCommand('pdftoppm')) return 'pdftoppm';
  if (await hasCommand('magick', ['-version'])) return 'magick';
  return null;
}

export function buildPdfToJpgCommand(
  engine: ConverterEngine,
  pdfAbsolutePath: string,
  pageCount: number,
  tempDir: string
): PdfToJpgCommand {
  if (engine === 'pdftoppm') {
    const prefix = path.join(tempDir, 'page');
    return {
      command: 'pdftoppm',
      args: [
        '-jpeg',
        '-r',
        '220',
        '-scale-to-x',
        String(EPAPER_PAGE_TARGET_WIDTH),
        '-scale-to-y',
        '-1',
        '-jpegopt',
        'quality=90',
        '-f',
        '1',
        '-l',
        String(pageCount),
        pdfAbsolutePath,
        prefix,
      ],
      timeout: 240_000,
    };
  }

  const inputRange = `${pdfAbsolutePath}[0-${Math.max(0, pageCount - 1)}]`;
  const outputPattern = path.join(tempDir, 'page-%d.jpg');
  return {
    command: 'magick',
    args: [
      '-density',
      '220',
      inputRange,
      '-resize',
      `${EPAPER_PAGE_TARGET_WIDTH}x`,
      '-quality',
      '90',
      outputPattern,
    ],
    timeout: 300_000,
  };
}

async function runPdfToJpg(
  engine: ConverterEngine,
  pdfAbsolutePath: string,
  pageCount: number,
  tempDir: string
) {
  const command = buildPdfToJpgCommand(
    engine,
    pdfAbsolutePath,
    pageCount,
    tempDir
  );
  await execFileAsync(
    command.command,
    command.args,
    { timeout: command.timeout, maxBuffer: 10 * 1024 * 1024 }
  );
}

async function collectGeneratedPages(tempDir: string, pageCount: number) {
  const files = await fs.readdir(tempDir);
  const pageMap = new Map<number, string>();

  for (const file of files) {
    const match = /^page-(\d+)\.jpg$/i.exec(file);
    if (!match) continue;
    const rawIndex = Number.parseInt(match[1], 10);
    if (!Number.isFinite(rawIndex)) continue;
    pageMap.set(rawIndex, path.join(tempDir, file));
  }

  if (pageMap.size === 0) {
    throw new Error('Converter did not generate any page images.');
  }

  const indices = Array.from(pageMap.keys()).sort((a, b) => a - b);
  const startsAtZero = indices[0] === 0;

  const ordered: Array<{ pageNumber: number; sourcePath: string }> = [];
  for (const index of indices) {
    const pageNumber = startsAtZero ? index + 1 : index;
    if (pageNumber < 1 || pageNumber > pageCount) continue;
    const sourcePath = pageMap.get(index);
    if (!sourcePath) continue;
    if (!(await exists(sourcePath))) continue;
    ordered.push({ pageNumber, sourcePath });
  }

  if (ordered.length === 0) {
    throw new Error('Generated page images were invalid.');
  }

  ordered.sort((a, b) => a.pageNumber - b.pageNumber);
  return ordered;
}

export async function generatePageImagesFromPdf(params: {
  pdfPath: string;
  pageCount: number;
}) {
  const { pdfPath, pageCount } = params;
  if (pageCount < 1 || !Number.isFinite(pageCount)) {
    throw new Error('Invalid page count for generation.');
  }

  const resolvedPdf = resolveEpaperAssetPath(pdfPath);
  if (!resolvedPdf) {
    throw new Error('PDF path is invalid or outside e-paper storage.');
  }

  const converter = await detectConverterEngine();
  if (!converter) {
    throw new Error(
      'No PDF converter found. Install "pdftoppm" (Poppler) or ImageMagick ("magick").'
    );
  }

  const editionRelativeDir = path.posix.dirname(resolvedPdf.relativePath);
  const pagesRelativeDir = safeRelativeOutput(path.posix.join(editionRelativeDir, 'pages'));
  const pagesAbsoluteDir = path.resolve(resolvedPdf.fsBaseDir, ...pagesRelativeDir.split('/'));

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'epaper-pages-'));
  try {
    await runPdfToJpg(converter, resolvedPdf.absolutePath, pageCount, tempDir);
    const generatedFiles = await collectGeneratedPages(tempDir, pageCount);
    await fs.mkdir(pagesAbsoluteDir, { recursive: true });

    const generatedPages: Array<{
      pageNumber: number;
      imagePath: string;
      width?: number;
      height?: number;
    }> = [];

    for (const item of generatedFiles) {
      const targetFileName = `${item.pageNumber}.jpg`;
      const targetAbsolutePath = path.resolve(pagesAbsoluteDir, targetFileName);
      await fs.copyFile(item.sourcePath, targetAbsolutePath);

      const dimensions = await getImageDimensionsFromPath(targetAbsolutePath);
      generatedPages.push({
        pageNumber: item.pageNumber,
        imagePath: buildEpaperAssetPath(
          resolvedPdf.publicPathPrefix,
          path.posix.join(pagesRelativeDir, targetFileName)
        ),
        width: dimensions?.width,
        height: dimensions?.height,
      });
    }

    return {
      converter,
      generatedPages,
    };
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
