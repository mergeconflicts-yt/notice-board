// Render store-screenshots/creative.html to the universal creative asset
// (5244×2950, 16:9, opaque PNG) for App Store Connect's Product Page Header
// + Search Results slots — one file fills both.
// Usage: node store-screenshots/export-creative.mjs
// Output: store-screenshots/creative/universal-5244x2950.png
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const dir = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(dir, 'creative');
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
// Design canvas is 2622×1475; 2x capture lands exactly 5244×2950.
const page = await browser.newPage({ viewport: { width: 2622, height: 1475 }, deviceScaleFactor: 2 });
await page.goto('file://' + path.join(dir, 'creative.html'));
// Let Google Fonts (Caveat/Nunito) settle before capture.
await page.waitForTimeout(2500);
await page.locator('#creative').screenshot({ path: path.join(out, 'universal-5244x2950.png') });
console.log('wrote store-screenshots/creative/universal-5244x2950.png');
await browser.close();
