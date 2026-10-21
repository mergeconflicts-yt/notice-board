// Export each `.shot` section in index.html as a 2064×2752 PNG for the
// App Store 13" iPad slot. Same panels and copy as the phone set —
// re-composed bezel-free (copy on top, full-width app UI below) via
// injected CSS, so index.html stays the single source of truth.
// Usage: node store-screenshots/export-ipad.mjs
// Output: store-screenshots/out-ipad/01-hero-2064x2752.png … 06-invite-2064x2752.png
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const dir = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(dir, 'out-ipad');
fs.mkdirSync(out, { recursive: true });

const shots = [
  ['shot-1', '01-hero-2064x2752.png'],
  ['shot-2', '02-no-noise-2064x2752.png'],
  ['shot-3', '03-pin-in-two-taps-2064x2752.png'],
  ['shot-4', '04-dates-2064x2752.png'],
  ['shot-5', '05-tidies-itself-2064x2752.png'],
  ['shot-6', '06-invite-2064x2752.png'],
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 2200, height: 2900 } });
// iPad panels use the drawn mockups, not the real captures: the captures
// are phone-aspect device screenshots (baked bezels, corner wedges) that
// cannot fill the wide canvas cleanly, while the mockups reflow to the
// full-width bezel-free layout. Abort the asset loads so the inline script
// falls back to mockups (same art as phone panels 1 & 4).
await page.route('**/assets/*.png', (route) => route.abort());
await page.goto('file://' + path.join(dir, 'index.html'));
// Let Google Fonts settle so Caveat/Nunito render before capture.
await page.waitForTimeout(2500);
// Phone panels are 1290×2796 portrait; the iPad canvas (2064×2752) is far
// wider. iPad shots are NOT a bigger iPhone: the bezel comes off and the
// app UI fills a full-width panel like it runs on iPad (copy on top, UI
// below, vertically centered). Real captures render whole (contain, no
// crop) on the cream screen; drawn mockups keep their truthful 2-column
// board, just wider — the way wider screens actually render.
await page.addStyleTag({
  content: `
    .shots-row{display:block;overflow:visible}
    .shots-row .shot{transform:none!important;margin:0 0 48px!important}
    .shot{width:2064px!important;height:2752px!important;flex-direction:column!important;justify-content:center!important;align-items:stretch!important}
    .shot .copy{text-align:center!important;padding:0 110px!important;max-width:none}
    .shot .copy h2{font-size:118px}
    .shot .copy p{font-size:40px;max-width:1200px;margin-left:auto;margin-right:auto}
    .shot .phone-wrap{margin-top:40px!important}
    .shot .phone{width:auto!important;height:auto!important;background:none!important;border-radius:0!important;padding:0!important;box-shadow:none!important}
    .shot .screen{height:auto!important;min-height:1000px;margin:0 112px!important;border-radius:40px!important;box-shadow:0 30px 80px rgba(0,0,0,.25)!important}
    .shot .island{display:none!important}
    .shot .statusbar{display:none!important}
    #shot-2 .debris{inset:150px 0 0}
    #shot-2 .note{min-height:0!important}
    #shot-2 .bubble:nth-child(1){left:33%!important;right:auto!important}
    #shot-2 .bubble:nth-child(2){left:43%!important}
    #shot-2 .bubble:nth-child(3){left:60%!important;right:auto!important}
    #shot-5 .screen{min-height:0}
    #shot-5 .legend{margin:28px auto 0!important;width:1600px}
  `,
});
for (const [id, file] of shots) {
  const el = page.locator('#' + id);
  await el.screenshot({ path: path.join(out, file) });
  console.log('wrote', file);
}

await browser.close();
