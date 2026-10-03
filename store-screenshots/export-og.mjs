// Render store-screenshots/og.html to website/og.png (1200×630) for
// og:image / twitter:image meta. The right side is the REAL website hero
// fridge (website/index.html .fridge with live styles), captured first and
// composited in — never a redrawn imitation.
// Usage: node store-screenshots/export-og.mjs
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import path from 'node:path';

const dir = path.dirname(fileURLToPath(import.meta.url));
const fridgeShot = path.join(tmpdir(), 'og-fridge.png');
const browser = await chromium.launch();

// 1. The actual hero fridge, at 2x for crisp downscale compositing.
const site = await browser.newPage({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 2 });
await site.goto('file://' + path.join(dir, '..', 'website', 'index.html'));
await site.waitForTimeout(2500); // Google Fonts (Caveat/Nunito) must settle.
// The tilted chat mock overlaps the fridge — hide it for a clean capture.
await site.addStyleTag({ content: '.hero-chat-col{display:none!important}' });
await site.locator('#fridge').screenshot({ path: fridgeShot });
await site.close();

// 2. Compose: copy (left) + real fridge (right), then capture the 1200×630 card.
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.goto('file://' + path.join(dir, 'og.html') + '?fridge=' + encodeURIComponent(fridgeShot));
await page.waitForTimeout(2500);
await page.screenshot({ path: path.join(dir, '..', 'website', 'og.png') });
console.log('wrote website/og.png 1200x630');
await browser.close();
