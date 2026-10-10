import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

describe('Lokswami logo assets', () => {
  it('provides correctly sized transparent icons for site and app metadata', async () => {
    const assets = [
      ['public/logo-header-cutout.png', 572],
      ['public/logo-app-192.png', 192],
      ['public/logo-app-512.png', 512],
      ['public/favicon-32x32.png', 32],
      ['public/favicon-48x48.png', 48],
      ['public/favicon-96x96.png', 96],
      ['public/favicon-192x192.png', 192],
      ['public/apple-touch-icon.png', 180],
      ['app/icon.png', 512],
    ] as const;

    for (const [file, size] of assets) {
      const metadata = await sharp(path.join(root, file)).metadata();
      expect([metadata.width, metadata.height], file).toEqual([size, size]);
      expect(metadata.hasAlpha, file).toBe(true);
    }
  });

  it('provides a valid multi-size ICO favicon', async () => {
    const icon = await fs.readFile(path.join(root, 'public/favicon.ico'));
    expect(icon.readUInt16LE(0)).toBe(0);
    expect(icon.readUInt16LE(2)).toBe(1);
    expect(icon.readUInt16LE(4)).toBe(3);
    expect([icon.readUInt8(6), icon.readUInt8(22), icon.readUInt8(38)]).toEqual([16, 32, 48]);
  });
});
