// Export each `.shot` section in index.html as a 1290×2796 PNG for the App Store.
// Usage:
//   npm i -D playwright   (one time; downloads Chromium)
//   node store-screenshots/export.mjs
// Output: store-screenshots/out/01-hero-1290x2796.png … 06-invite-1290x2796.png
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const dir = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(dir, 'out');
fs.mkdirSync(out, { recursive: true });

const shots = [
  ['shot-1', '01-hero-1290x2796.png'],
  ['shot-2', '02-no-noise-1290x2796.png'],
  ['shot-3', '03-pin-in-two-taps-1290x2796.png'],
  ['shot-4', '04-dates-1290x2796.png'],
  ['shot-5', '05-tidies-itself-1290x2796.png'],
  ['shot-6', '06-invite-1290x2796.png'],
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 3000 } });
await page.goto('file://' + path.join(dir, 'index.html'));
// Let Google Fonts settle so Caveat/Nunito render before capture.
await page.waitForTimeout(2500);
// The preview lays .shot out at scale(0.28) for side-by-side viewing — an
// element screenshot would then capture 1290*0.28 ≈ 362px wide. Export needs
// true 1290×2796 pixels, so neutralise the preview transform first.
await page.addStyleTag({
  content: '.shots-row{display:block;overflow:visible}.shots-row .shot{transform:none!important;margin:0 0 48px!important}',
});
for (const [id, file] of shots) {
  const el = page.locator('#' + id);
  await el.screenshot({ path: path.join(out, file) });
  console.log('wrote', file);
}

await browser.close();
