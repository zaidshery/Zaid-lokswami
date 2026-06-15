import { describe, expect, it } from 'vitest';

import {
  getPdfPageCountFromBuffer,
  renderPdfPageToJpeg,
} from '@/lib/server/epaperPdfRenderer';

function createSinglePagePdf(): Buffer {
  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] /Resources << >> /Contents 4 0 R >>\nendobj\n',
    '4 0 obj\n<< /Length 0 >>\nstream\n\nendstream\nendobj\n',
  ];

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  for (const object of objects) {
    offsets.push(Buffer.byteLength(pdf, 'ascii'));
    pdf += object;
  }

  const xrefOffset = Buffer.byteLength(pdf, 'ascii');
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (const offset of offsets) {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  pdf += `startxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdf, 'ascii');
}

describe('server-side e-paper PDF rendering', () => {
  it('counts pages and renders a 3000px-wide JPEG', async () => {
    const pdf = createSinglePagePdf();

    await expect(getPdfPageCountFromBuffer(pdf)).resolves.toBe(1);

    const rendered = await renderPdfPageToJpeg({
      pdfBuffer: pdf,
      pageNumber: 1,
    });
    expect(rendered.width).toBe(3000);
    expect(rendered.height).toBe(3000);
    expect(rendered.buffer.subarray(0, 3)).toEqual(
      Buffer.from([0xff, 0xd8, 0xff]),
    );
  }, 30_000);
});
