// Bake pack art (docs/plan-magnets.md §3). Node dev tool — run with npm, not
// expo. Renders each magnet/sticker SVG in headless Chromium (so SVG lighting
// filters run exactly as the mockups) and writes @1x/@2x/@3x WebP body +
// shadow files. Deterministic: the same catalogs always produce identical
// files.
//
//   npm run bake:packs                 # bake every pack
//   npm run bake:packs -- --pack travel_jp
import { chromium } from 'playwright';
import sharp from 'sharp';
import { mkdir, writeFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MAGNETS } from '../art/magnets/catalog.mjs';
import { STICKERS } from '../art/stickers/catalog.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Exact mockup lighting (#mag3d minus its shadow nodes). Light comes from the
// top-left (azimuth 225°); every magnet on the fridge shares this one light.
const BODY_FILTER = `
<filter id="f" x="-20%" y="-20%" width="150%" height="150%" color-interpolation-filters="sRGB">
  <feComponentTransfer in="SourceGraphic" result="dk"><feFuncR type="linear" slope=".45"/><feFuncG type="linear" slope=".45"/><feFuncB type="linear" slope=".45"/></feComponentTransfer>
  <feOffset in="dk" dx=".5" dy=".8" result="e1"/><feOffset in="dk" dx="1" dy="1.6" result="e2"/><feOffset in="dk" dx="1.5" dy="2.4" result="e3"/>
  <feGaussianBlur in="SourceAlpha" stdDeviation="1.3" result="bump"/>
  <feDiffuseLighting in="bump" surfaceScale="3.2" diffuseConstant="1" lighting-color="#fff" result="diff"><feDistantLight azimuth="225" elevation="52"/></feDiffuseLighting>
  <feComposite in="SourceGraphic" in2="diff" operator="arithmetic" k1=".7" k2=".45" result="lit"/>
  <feSpecularLighting in="bump" surfaceScale="3.2" specularConstant="1" specularExponent="22" lighting-color="#fff" result="spec"><feDistantLight azimuth="225" elevation="48"/></feSpecularLighting>
  <feComposite in="spec" in2="SourceAlpha" operator="in" result="specIn"/>
  <feComposite in="lit" in2="specIn" operator="arithmetic" k2="1" k3=".75" result="face0"/>
  <feComposite in="face0" in2="SourceAlpha" operator="in" result="face"/>
  <feMerge><feMergeNode in="e3"/><feMergeNode in="e2"/><feMergeNode in="e1"/><feMergeNode in="face"/></feMerge>
</filter>`;

// Soft black silhouette; the app offsets it (never baked with an offset).
const SHADOW_FILTER = `
<filter id="f" x="-30%" y="-30%" width="160%" height="160%">
  <feFlood flood-color="#000" result="flood"/>
  <feComposite in="flood" in2="SourceAlpha" operator="in" result="sil"/>
  <feGaussianBlur in="sil" stdDeviation="1.6"/>
</filter>`;

const SIZES = [
  { suffix: '@1x', px: 64 },
  { suffix: '@2x', px: 128 },
  { suffix: '@3x', px: 192 },
];
const BUDGET = { body3x: 25 * 1024, shadow3x: 8 * 1024, pack: 400 * 1024 };

function pageHtml(svg, filter) {
  // viewBox pads 4 units so thickness and gloss aren't clipped; CSS 64×64 at
  // deviceScaleFactor 3 gives a 192×192 master.
  return `<!doctype html><html><head><meta charset="utf-8"></head>
<body style="margin:0;background:transparent">
<svg id="art" xmlns="http://www.w3.org/2000/svg" viewBox="-4 -4 48 48" width="64" height="64">
${filter ? `<defs>${filter}</defs>` : ''}
<g${filter ? ' filter="url(#f)"' : ''}>${svg}</g>
</svg></body></html>`;
}

function outDir(packId) {
  return packId === 'starter'
    ? path.join(ROOT, 'assets/packs/starter')
    : path.join(ROOT, 'dist/packs', packId, 'v1');
}

async function renderArt(page, svg, filter) {
  await page.setContent(pageHtml(svg, filter), { waitUntil: 'load' });
  const el = page.locator('#art');
  return el.screenshot({ omitBackground: true });
}

async function writeVariants(page, dir, id, suffixTag, svg, filter, withBase) {
  const png = await renderArt(page, svg, filter);
  const files = [];
  for (const { suffix, px } of SIZES) {
    const file = path.join(dir, `${id}${suffixTag}${suffix}.webp`);
    await sharp(png).resize(px, px).webp({ quality: 90, alphaQuality: 100 }).toFile(file);
    files.push(file);
  }
  // Metro reads `@2x`/`@3x` as density qualifiers and requires a base file to
  // resolve a static require(); bundled Starter art therefore also ships a
  // base (`<id>.webp` = @1x). Remote packs are plain URLs and don't need it.
  if (withBase) {
    const base = path.join(dir, `${id}${suffixTag}.webp`);
    await sharp(png).resize(64, 64).webp({ quality: 90, alphaQuality: 100 }).toFile(base);
    files.push(base);
  }
  return files;
}

async function bakePack(page, packId, art) {
  const dir = outDir(packId);
  await mkdir(dir, { recursive: true });
  const withBase = packId === 'starter';
  const manifest = [];
  const written = [];

  for (const item of art) {
    if (item.pack !== packId) continue;
    const isSticker = item.kind === 'sticker';
    // Stickers are baked flat (no lighting/filter); magnets get the body
    // filter plus a separate baked silhouette shadow.
    written.push(
      ...(await writeVariants(page, dir, item.id, '', item.svg, isSticker ? null : BODY_FILTER, withBase)),
    );
    if (!isSticker) {
      written.push(
        ...(await writeVariants(
          page,
          dir,
          `${item.id}_shadow`,
          '',
          item.svg,
          SHADOW_FILTER,
          withBase,
        )),
      );
    }
    manifest.push({
      art_id: item.id,
      pack_id: packId,
      kind: item.kind,
      label: item.label,
      path:
        packId === 'starter'
          ? `assets/packs/starter/${item.id}@3x.webp`
          : `packs/${packId}/v1/${item.id}@3x.webp`,
      w: 64,
      h: 64,
    });
  }

  await writeFile(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  return { manifest, written };
}

async function main() {
  const args = process.argv.slice(2);
  const packFlag = args.indexOf('--pack');
  const only = packFlag >= 0 ? args[packFlag + 1] : null;

  const magnets = MAGNETS.map((m) => ({ ...m, kind: 'magnet' }));
  const stickers = STICKERS.map((s) => ({ ...s, kind: 'sticker' }));
  const all = [...magnets, ...stickers];
  const packs = [...new Set(all.map((a) => a.pack))].filter((p) => !only || p === only).sort();
  if (only && packs.length === 0) {
    console.error(`No art for pack "${only}"`);
    process.exit(1);
  }

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 64, height: 64 }, deviceScaleFactor: 3 });

  const rows = [];
  let overBudget = false;
  for (const packId of packs) {
    const { written } = await bakePack(page, packId, all);
    let packBytes = 0;
    for (const file of written) {
      const { size } = await stat(file);
      packBytes += size;
      const isShadow = file.includes('_shadow');
      const is3x = file.includes('@3x');
      if (is3x && !isShadow && size > BUDGET.body3x) overBudget = true;
      if (isShadow && is3x && size > BUDGET.shadow3x) overBudget = true;
      rows.push({ file: path.relative(ROOT, file), size });
    }
    if (packBytes > BUDGET.pack) overBudget = true;
    console.log(`baked ${packId}: ${written.length} files, ${(packBytes / 1024).toFixed(1)} KB`);
    if (packId !== 'starter') {
      previewEntries.push(
        ...written
          .filter((f) => f.includes('@2x') && !f.includes('_shadow'))
          .map((f) => ({ pack: packId, file: f })),
      );
    }
  }

  await browser.close();
  await writePreview(previewEntries);

  console.log('\nfile\tsize');
  for (const r of rows) console.log(`${r.file}\t${(r.size / 1024).toFixed(1)} KB`);
  if (overBudget) {
    console.error('\nBudget exceeded (body@3x ≤ 25 KB, shadow@3x ≤ 8 KB, pack ≤ 400 KB)');
    process.exit(1);
  }
}

const previewEntries = [];
async function writePreview(entries) {
  const cards = [];
  for (const e of entries) {
    const buf = await import('node:fs/promises').then((fs) => fs.readFile(e.file));
    cards.push(
      `<figure><img src="data:image/webp;base64,${buf.toString('base64')}"/><figcaption>${e.pack}<br>${path.basename(e.file, '.webp')}</figcaption></figure>`,
    );
  }
  const html = `<!doctype html><meta charset="utf-8"><title>Pack preview</title>
<style>body{font:13px system-ui;background:#F3E2B3;margin:24px}h2{font-family:ui-rounded}figure{display:inline-block;margin:8px;text-align:center}img{width:64px;height:64px;background:#fff;border-radius:12px;box-shadow:0 6px 12px -4px rgba(20,30,25,.5)}figcaption{font-size:11px;color:#47645B;margin-top:4px}section{background:#fff;border-radius:16px;padding:12px;margin:12px 0}</style>
<h2>Pack preview</h2>
<p>Generated contact sheet. Not for production; gitignored.</p>
${[...new Set(entries.map((e) => e.pack))]
  .map((p) => `<section><h3>${p}</h3>${cards.filter((_, i) => entries[i].pack === p).join('')}</section>`)
  .join('\n')}`;
  const dir = path.join(ROOT, 'dist/packs');
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, 'preview.html'), html);
  console.log(`contact sheet: dist/packs/preview.html`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
