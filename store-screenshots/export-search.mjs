// Render store-screenshots/search.html to the dedicated Search Results asset
// (3840×2560, 3:2, opaque PNG) for App Store Connect's Search Results slot.
// Usage: node store-screenshots/export-search.mjs
// Output: store-screenshots/creative/search-3840x2560.png
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const dir = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(dir, 'creative');
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
// Design canvas is 1920×1280; 2x capture lands exactly 3840×2560.
const page = await browser.newPage({ viewport: { width: 1920, height: 1280 }, deviceScaleFactor: 2 });
await page.goto('file://' + path.join(dir, 'search.html'));
// Let Google Fonts (Caveat/Nunito) settle before capture.
await page.waitForTimeout(2500);
await page.locator('#search').screenshot({ path: path.join(out, 'search-3840x2560.png') });
console.log('wrote store-screenshots/creative/search-3840x2560.png');
await browser.close();
