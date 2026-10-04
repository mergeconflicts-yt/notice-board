// One-off: bake the photorealistic Mt. Fuji (st_fuji) from the reference photo.
// The vector catalog cannot do photorealism, so this cuts the mountain out of
// art/ref/fuji.jpeg.webp through a die-cut cone mask, adds the dark outline,
// and bakes body + shadow WebP with the same sizes/budgets as bake-pack.mjs.
// Run AFTER `npm run bake:packs -- --pack starter`; it upserts st_fuji into
// the Starter manifest so ordering never drops it.
import { chromium } from 'playwright';
import sharp from 'sharp';
import { mkdir, writeFile, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REF = path.join(ROOT, 'art/ref/fuji.jpeg.webp');
const OUT = path.join(ROOT, 'assets/packs/starter');

// Crop window in the reference photo (px): centred on the apex so the die-cut
// is a nearly symmetrical cone standing alone. Holds snow + rock, excludes the
// train and fields below.
const CROP = { left: 355, top: 100, width: 500, height: 310 };
// Die-cut cone inside the crop (px): symmetric apex + base, inset a touch so
// no sky slivers survive. The summit is a gentle curve (crater rim).
const CONE = { lx: 14, by: 303, rx: 486 };
const SUMMIT = { lx: 230, ly: 48, cx: 250, cy: 30, rx: 270, ry: 48 };
function cropPath() {
  return `M${CONE.lx},${CONE.by} L${SUMMIT.lx},${SUMMIT.ly} Q${SUMMIT.cx},${SUMMIT.cy} ${SUMMIT.rx},${SUMMIT.ry} L${CONE.rx},${CONE.by} Z`;
}
// Placement in the 40-unit art box (36 wide, vertically centred).
const BOX = { x: 2, y: (40 - (CROP.height * 36) / CROP.width) / 2, w: 36, h: (CROP.height * 36) / CROP.width };

const SHADOW_FILTER = `
<filter id="f" x="-30%" y="-30%" width="160%" height="160%">
  <feFlood flood-color="#000" result="flood"/>
  <feComposite in="flood" in2="SourceAlpha" operator="in" result="sil"/>
  <feGaussianBlur in="sil" stdDeviation="1.6"/>
</filter>`;

function conePath40() {
  const sx = BOX.w / CROP.width;
  const X = (px) => BOX.x + px * sx;
  const Y = (py) => BOX.y + py * sx;
  return `M${X(CONE.lx)} ${Y(CONE.by)} L${X(SUMMIT.lx)} ${Y(SUMMIT.ly)} Q${X(SUMMIT.cx)} ${Y(SUMMIT.cy)} ${X(SUMMIT.rx)} ${Y(SUMMIT.ry)} L${X(CONE.rx)} ${Y(CONE.by)} Z`;
}

function pageHtml(inner) {
  return `<!doctype html><html><head><meta charset="utf-8"></head>
<body style="margin:0;background:transparent">
<svg id="art" xmlns="http://www.w3.org/2000/svg" viewBox="-4 -4 48 48" width="64" height="64">
${inner}
</svg></body></html>`;
}

async function main() {
  // 1. Mask the crop through the cone.
  const crop = sharp(REF).extract(CROP);
  const maskSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${CROP.width}" height="${CROP.height}"><path d="${cropPath()}" fill="#fff"/></svg>`;
  const mask = await sharp(Buffer.from(maskSvg)).png().toBuffer();
  const cut = await crop.composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
  const uri = `data:image/png;base64,${cut.toString('base64')}`;

  const outline = `<path d="${conePath40()}" fill="none" stroke="#282620" stroke-width="1.5" stroke-linejoin="round"/>`;
  const bodyInner = `<image href="${uri}" x="${BOX.x}" y="${BOX.y}" width="${BOX.w}" height="${BOX.h}"/>${outline}`;
  const shadowInner = `<defs>${SHADOW_FILTER}</defs><g filter="url(#f)"><path d="${conePath40()}" fill="#000"/></g>`;

  // 2. Render body (flat photo + outline) and silhouette shadow.
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 64, height: 64 }, deviceScaleFactor: 3 });
  await page.setContent(pageHtml(bodyInner), { waitUntil: 'load' });
  const bodyPng = await page.locator('#art').screenshot({ omitBackground: true });
  await page.setContent(pageHtml(shadowInner), { waitUntil: 'load' });
  const shadowPng = await page.locator('#art').screenshot({ omitBackground: true });
  await browser.close();

  // 3. Write @1x/@2x/@3x + Metro base, same budgets as bake-pack.
  await mkdir(OUT, { recursive: true });
  const jobs = [
    { buf: bodyPng, id: 'st_fuji', budget: 25 * 1024 },
    { buf: shadowPng, id: 'st_fuji_shadow', budget: 8 * 1024 },
  ];
  for (const { buf, id, budget } of jobs) {
    for (const [suffix, px] of [['@1x', 64], ['@2x', 128], ['@3x', 192]]) {
      await sharp(buf).resize(px, px).webp({ quality: 90, alphaQuality: 100 }).toFile(path.join(OUT, `${id}${suffix}.webp`));
    }
    await sharp(buf).resize(64, 64).webp({ quality: 90, alphaQuality: 100 }).toFile(path.join(OUT, `${id}.webp`));
    const { size } = await stat(path.join(OUT, `${id}@3x.webp`));
    console.log(`${id}@3x.webp\t${(size / 1024).toFixed(1)} KB`);
    if (size > budget) {
      console.error(`Budget exceeded for ${id}`);
      process.exit(1);
    }
  }

  // 4. Upsert st_fuji in the Starter manifest (keep bake-pack output intact).
  const manifestPath = path.join(OUT, 'manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const entry = {
    art_id: 'st_fuji',
    pack_id: 'starter',
    kind: 'magnet',
    label: 'Mt. Fuji',
    path: 'assets/packs/starter/st_fuji@3x.webp',
    w: 64,
    h: 64,
  };
  const i = manifest.findIndex((m) => m.art_id === 'st_fuji');
  if (i >= 0) manifest[i] = entry;
  else manifest.unshift(entry);
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  console.log('manifest upserted: st_fuji (photo)');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
