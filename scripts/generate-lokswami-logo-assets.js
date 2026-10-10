const fs = require('fs/promises');
const path = require('path');
const sharp = require('sharp');

const root = path.resolve(__dirname, '..');
const source = path.join(root, 'public', 'lokswami-glossy-badge.png');
const publicDir = path.join(root, 'public');

function pngIconEntry(image, size, offset) {
  const entry = Buffer.alloc(16);
  entry.writeUInt8(size === 256 ? 0 : size, 0);
  entry.writeUInt8(size === 256 ? 0 : size, 1);
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(image.length, 8);
  entry.writeUInt32LE(offset, 12);
  return entry;
}

async function main() {
  // Keep the supplied badge geometry and transparency for the site header.
  const badge = await sharp(source)
    .trim()
    .resize(572, 572, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  await fs.writeFile(path.join(publicDir, 'logo-header-cutout.png'), badge);

  // The central medallion stays legible at small favicon and app-icon sizes.
  const medallion = await sharp(source)
    .extract({ left: 410, top: 145, width: 740, height: 740 })
    .png()
    .toBuffer();
  const sizes = [16, 32, 48, 96, 180, 192, 512, 572];
  const icons = new Map();
  for (const size of sizes) {
    icons.set(size, await sharp(medallion).resize(size, size).png().toBuffer());
  }

  const outputs = [
    ['logo-icon-final.png', 572],
    ['logo-emblem-round.png', 572],
    ['logo-app-192.png', 192],
    ['logo-app-512.png', 512],
    ['favicon-32x32.png', 32],
    ['favicon-48x48.png', 48],
    ['favicon-96x96.png', 96],
    ['favicon-192x192.png', 192],
    ['apple-touch-icon.png', 180],
  ];
  await Promise.all(outputs.map(([name, size]) => fs.writeFile(path.join(publicDir, name), icons.get(size))));
  await fs.writeFile(path.join(root, 'app', 'icon.png'), icons.get(512));

  const icoSizes = [16, 32, 48];
  const header = Buffer.alloc(6);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(icoSizes.length, 4);
  let offset = header.length + icoSizes.length * 16;
  const entries = icoSizes.map((size) => {
    const image = icons.get(size);
    const entry = pngIconEntry(image, size, offset);
    offset += image.length;
    return entry;
  });
  await fs.writeFile(path.join(publicDir, 'favicon.ico'), Buffer.concat([
    header,
    ...entries,
    ...icoSizes.map((size) => icons.get(size)),
  ]));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
