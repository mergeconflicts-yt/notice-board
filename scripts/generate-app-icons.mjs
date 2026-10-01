/**
 * Generates the app icon set from a single vector description:
 * a sage fridge (rounded body on a dark cabinet) with a shelf seam,
 * two cream handles, and a pinned yellow sticky note. Dependency-free
 * software rasterizer + PNG encoder, so `node scripts/generate-app-icons.mjs`
 * reproduces every asset.
 *
 * Design canvas is 1024x1024; each output is rendered at 4x and box-downsampled.
 */
import zlib from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ASSETS = join(__dirname, '..', 'assets');

// ---------------------------------------------------------------- palette
const C = {
  cabinet: '#1E1B17',
  greenTop: '#78AA8B',
  greenBottom: '#649674',
  seam: '#3E6C4B',
  seamHi: '#8FBC9C',
  handle: '#FBF9F4',
  handleShade: '#E6EAE1',
  handleShadow: 'rgba(16, 40, 28, 0.30)',
  note: '#F2E196',
  noteTop: '#F8EAAD',
  noteLine: '#B2894F',
  noteShadow: 'rgba(20, 42, 28, 0.34)',
  pin: '#E23E2B',
  pinHi: '#F47A62',
  pinSpec: '#FFEDE6',
  pinShadow: 'rgba(20, 42, 28, 0.42)',
};

// ---------------------------------------------------------------- design
const DESIGN = 1024;
// Fridge body: a rounded rectangle inset from the canvas so its corners read.
const FR = { x: 58, y: 58, w: 908, h: 908, r: 158 };
// Details are expressed as fractions of the fridge box (u along width, v along
// height) so they scale together.
const shelf = { v: 0.30, t: 0.014, hi: 0.004 };
const handles = [
  { u: 0.115, v: 0.205, hw: 0.029, hh: 0.056 },
  { u: 0.115, v: 0.56, hw: 0.029, hh: 0.15 },
];
const note = { u: 0.60, v: 0.635, half: 0.185, r: 0.016, rot: (10 * Math.PI) / 180 };
// note-local, in units of the note half-size
const noteLines = [
  { x0: -0.62, y0: -0.23, x1: 0.485, y1: -0.23, t: 0.079 },
  { x0: -0.62, y0: 0.21, x1: 0.095, y1: 0.21, t: 0.079 },
];
const pin = { lx: 0.115, ly: -0.925, r: 0.263 };

// ---------------------------------------------------------------- color utils
function hex(h) {
  const n = h.replace('#', '');
  return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16)];
}
function rgba(s) {
  const m = s.match(/rgba?\(([^)]+)\)/);
  const p = m[1].split(',').map((v) => parseFloat(v.trim()));
  return [p[0], p[1], p[2], p[3] ?? 1];
}
function mix(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

// ---------------------------------------------------------------- canvas
class Canvas {
  constructor(size, ss) {
    this.size = size;
    this.ss = ss;
    this.rw = size * ss;
    this.rh = size * ss;
    this.k = this.rw / DESIGN; // design units -> render pixels
    this.buf = new Uint8ClampedArray(this.rw * this.rh * 4);
  }

  blend(x, y, col, a) {
    if (a <= 0) return;
    const i = (y * this.rw + x) * 4;
    const b = this.buf;
    const da = b[i + 3] / 255;
    const oa = a + da * (1 - a);
    if (oa <= 0) return;
    b[i] = (col[0] * a + b[i] * da * (1 - a)) / oa;
    b[i + 1] = (col[1] * a + b[i + 1] * da * (1 - a)) / oa;
    b[i + 2] = (col[2] * a + b[i + 2] * da * (1 - a)) / oa;
    b[i + 3] = oa * 255;
  }

  clear(x, y, a) {
    const i = (y * this.rw + x) * 4;
    this.buf[i + 3] = (this.buf[i + 3] / 255) * (1 - a) * 255;
  }

  around(cx, cy, rx, ry, fn) {
    const x0 = Math.max(0, Math.floor(cx - rx - 2));
    const y0 = Math.max(0, Math.floor(cy - ry - 2));
    const x1 = Math.min(this.rw - 1, Math.ceil(cx + rx + 2));
    const y1 = Math.min(this.rh - 1, Math.ceil(cy + ry + 2));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) fn(x, y);
  }

  rrSDF(px, py, cx, cy, hx, hy, r) {
    const qx = Math.abs(px - cx) - (hx - r);
    const qy = Math.abs(py - cy) - (hy - r);
    return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
  }

  fillSolid(col) {
    for (let i = 0; i < this.buf.length; i += 4) {
      this.buf[i] = col[0];
      this.buf[i + 1] = col[1];
      this.buf[i + 2] = col[2];
      this.buf[i + 3] = 255;
    }
  }

  // rounded rect; `col` is [r,g,b] or a function (rx, ry) => [r,g,b] in render px
  rect(cx, cy, hx, hy, radius, col) {
    const cxr = cx * this.k;
    const cyr = cy * this.k;
    const hxr = hx * this.k;
    const hyr = hy * this.k;
    const rr = radius * this.k;
    const solid = typeof col !== 'function';
    this.around(cxr, cyr, hxr + rr, hyr + rr, (x, y) => {
      const d = this.rrSDF(x + 0.5, y + 0.5, cxr, cyr, hxr, hyr, rr);
      this.blend(x, y, solid ? col : col(x + 0.5, y + 0.5), clamp(0.5 - d, 0, 1));
    });
  }

  shadowRect(cx, cy, hx, hy, radius, dx, dy, soft, col) {
    const cxr = (cx + dx) * this.k;
    const cyr = (cy + dy) * this.k;
    const hxr = hx * this.k;
    const hyr = hy * this.k;
    const rr = radius * this.k;
    const s = soft * this.k;
    this.around(cxr, cyr, hxr + rr + s * 2, hyr + rr + s * 2, (x, y) => {
      const d = this.rrSDF(x + 0.5, y + 0.5, cxr, cyr, hxr, hyr, rr);
      this.blend(x, y, col, col[3] * clamp((s - d) / (2 * s), 0, 1));
    });
  }

  circle(cx, cy, r, col) {
    const cxr = cx * this.k;
    const cyr = cy * this.k;
    const rr = r * this.k;
    this.around(cxr, cyr, rr, rr, (x, y) => {
      const d = Math.hypot(x + 0.5 - cxr, y + 0.5 - cyr) - rr;
      this.blend(x, y, col, clamp(0.5 - d, 0, 1));
    });
  }

  shadowCircle(cx, cy, r, dx, dy, soft, col) {
    const cxr = (cx + dx) * this.k;
    const cyr = (cy + dy) * this.k;
    const rr = r * this.k;
    const s = soft * this.k;
    this.around(cxr, cyr, rr + s * 2, rr + s * 2, (x, y) => {
      const d = Math.hypot(x + 0.5 - cxr, y + 0.5 - cyr) - rr;
      this.blend(x, y, col, col[3] * clamp((s - d) / (2 * s), 0, 1));
    });
  }

  capsule(x0, y0, x1, y1, t, col) {
    const ax = x0 * this.k;
    const ay = y0 * this.k;
    const bx = x1 * this.k;
    const by = y1 * this.k;
    const ht = t * this.k;
    const minx = Math.min(ax, bx) - ht;
    const maxx = Math.max(ax, bx) + ht;
    const miny = Math.min(ay, by) - ht;
    const maxy = Math.max(ay, by) + ht;
    this.around((minx + maxx) / 2, (miny + maxy) / 2, (maxx - minx) / 2, (maxy - miny) / 2, (x, y) => {
      const px = x + 0.5;
      const py = y + 0.5;
      const abx = bx - ax;
      const aby = by - ay;
      const l2 = abx * abx + aby * aby || 1;
      const u = clamp(((px - ax) * abx + (py - ay) * aby) / l2, 0, 1);
      const d = Math.hypot(px - (ax + abx * u), py - (ay + aby * u)) - ht;
      this.blend(x, y, col, clamp(0.5 - d, 0, 1));
    });
  }

  rotRect(cx, cy, hx, hy, radius, rot, col, mode = 'paint') {
    const c = Math.cos(rot);
    const s = Math.sin(rot);
    const cxr = cx * this.k;
    const cyr = cy * this.k;
    const hxr = hx * this.k;
    const hyr = hy * this.k;
    const rr = radius * this.k;
    const reach = Math.hypot(hxr, hyr) + rr;
    const solid = typeof col !== 'function';
    this.around(cxr, cyr, reach, reach, (x, y) => {
      const dx = x + 0.5 - cxr;
      const dy = y + 0.5 - cyr;
      const lx = dx * c + dy * s;
      const ly = -dx * s + dy * c;
      const d = this.rrSDF(lx, ly, 0, 0, hxr, hyr, rr);
      const a = clamp(0.5 - d, 0, 1);
      if (mode === 'paint') this.blend(x, y, solid ? col : col(lx, ly), a);
      else this.clear(x, y, a);
    });
  }
}

// ---------------------------------------------------------------- composition
function drawFridge(c, { body = true, details = true, bg = false, scale = 1 } = {}) {
  if (bg) c.fillSolid(hex(C.cabinet));
  const b = {
    x: (FR.x - DESIGN / 2) * scale + DESIGN / 2,
    y: (FR.y - DESIGN / 2) * scale + DESIGN / 2,
    w: FR.w * scale,
    h: FR.h * scale,
    r: FR.r * scale,
  };
  const X = (u) => b.x + u * b.w;
  const Y = (v) => b.y + v * b.h;
  const W = (f) => f * b.w;
  const H = (f) => f * b.h;
  const col = (h) => hex(h);

  if (body) {
    const a = hex(C.greenTop);
    const bb = hex(C.greenBottom);
    c.rect(b.x + b.w / 2, b.y + b.h / 2, b.w / 2, b.h / 2, b.r, (rx, ry) => {
      const t = clamp(ry / (c.rh - 1), 0, 1);
      return mix(a, bb, t);
    });
  }
  if (!details) return;

  // shelf seam
  c.rect(b.x + b.w / 2, Y(shelf.v), b.w / 2, H(shelf.t) / 2, 0, col(C.seam));
  c.rect(b.x + b.w / 2, Y(shelf.v + shelf.t), b.w / 2, H(shelf.hi) / 2, 0, col(C.seamHi));

  for (const h of handles) {
    const cx = X(h.u);
    const cy = Y(h.v);
    c.shadowRect(cx, cy, W(h.hw), H(h.hh), W(h.hw), W(0.006), W(0.008), W(0.008), rgba(C.handleShadow));
    c.rect(cx, cy, W(h.hw), H(h.hh), W(h.hw), col(C.handle));
    c.rect(cx + W(h.hw) * 0.8, cy, W(h.hw) * 0.14, H(h.hh) * 0.78, W(h.hw) * 0.4, col(C.handleShade));
  }

  // sticky note
  const ncx = X(note.u);
  const ncy = Y(note.v);
  const nh = W(note.half);
  const nw = (lx, ly) => {
    const c2 = Math.cos(note.rot);
    const s2 = Math.sin(note.rot);
    return [ncx + lx * c2 - ly * s2, ncy + lx * s2 + ly * c2];
  };
  c.shadowRect(ncx, ncy, nh, nh, W(note.r), W(0.008), W(0.012), W(0.012), rgba(C.noteShadow));
  const na = hex(C.noteTop);
  const nb = hex(C.note);
  c.rotRect(ncx, ncy, nh, nh, W(note.r), note.rot, (lx, ly) => {
    const hyr = nh * c.k;
    return mix(na, nb, clamp((ly + hyr) / (2 * hyr), 0, 1));
  });

  for (const l of noteLines) {
    const [x0, y0] = nw(l.x0 * nh, l.y0 * nh);
    const [x1, y1] = nw(l.x1 * nh, l.y1 * nh);
    c.capsule(x0, y0, x1, y1, l.t * nh, col(C.noteLine));
  }

  const [pcx, pcy] = nw(pin.lx * nh, pin.ly * nh);
  const pr = pin.r * nh;
  c.shadowCircle(pcx, pcy, pr, W(0.005), W(0.007), W(0.008), rgba(C.pinShadow));
  c.circle(pcx, pcy, pr, col(C.pin));
  c.circle(pcx - pr * 0.26, pcy - pr * 0.3, pr * 0.62, col(C.pinHi));
  c.circle(pcx - pr * 0.34, pcy - pr * 0.4, pr * 0.2, col(C.pinSpec));
}

function drawMonochrome(c) {
  const s = 0.62;
  const map = (v) => (v - DESIGN / 2) * s + DESIGN / 2;
  const body = hex('#000000');
  const b = {
    x: map(FR.x),
    y: map(FR.y),
    w: FR.w * s,
    h: FR.h * s,
    r: FR.r * s,
  };
  const X = (u) => b.x + u * b.w;
  const Y = (v) => b.y + v * b.h;
  c.rect(b.x + b.w / 2, b.y + b.h / 2, b.w / 2, b.h / 2, b.r, body);
  c.rotRect(b.x + b.w / 2, Y(shelf.v), b.w / 2, (b.h * shelf.t) / 2 + 2, 0, 0, body, 'erase');
  for (const h of handles) {
    c.rotRect(X(h.u), Y(h.v), h.hw * b.w, h.hh * b.h, h.hw * b.w, 0, body, 'erase');
  }
  c.rotRect(X(note.u), Y(note.v), note.half * b.w, note.half * b.w, note.r * b.w, note.rot, body, 'erase');
}

// ---------------------------------------------------------------- downsample
function downsample(c) {
  const { rw, ss, size } = c;
  const out = new Uint8ClampedArray(size * size * 4);
  const inv = 1 / (ss * ss);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const i = ((y * ss + sy) * rw + (x * ss + sx)) * 4;
          r += c.buf[i];
          g += c.buf[i + 1];
          b += c.buf[i + 2];
          a += c.buf[i + 3];
        }
      }
      const o = (y * size + x) * 4;
      out[o] = r * inv;
      out[o + 1] = g * inv;
      out[o + 2] = b * inv;
      out[o + 3] = a * inv;
    }
  }
  return out;
}

function grain(buf, size, amp) {
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      if (buf[i + 3] < 8) continue;
      let h = (x * 374761393 + y * 668265263) ^ 0x5bf03635;
      h = Math.imul(h ^ (h >>> 13), 1274126177);
      const n = (((h ^ (h >>> 16)) >>> 0) / 4294967295 - 0.5) * amp;
      buf[i] = clamp(buf[i] + n, 0, 255);
      buf[i + 1] = clamp(buf[i + 1] + n, 0, 255);
      buf[i + 2] = clamp(buf[i + 2] + n, 0, 255);
    }
  }
}

// ---------------------------------------------------------------- PNG encode
const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function encodePNG(size, rgba, alpha) {
  const channels = alpha ? 4 : 3;
  const stride = size * channels;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const o = y * (stride + 1) + 1 + x * channels;
      raw[o] = rgba[i];
      raw[o + 1] = rgba[i + 1];
      raw[o + 2] = rgba[i + 2];
      if (alpha) raw[o + 3] = rgba[i + 3];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = alpha ? 6 : 2;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------- outputs
function render(name, size, draw, { alpha = true, ss = 4, grainAmp = 0 } = {}) {
  const c = new Canvas(size, ss);
  draw(c);
  const buf = downsample(c);
  if (grainAmp) grain(buf, size, grainAmp);
  writeFileSync(join(ASSETS, name), encodePNG(size, buf, alpha));
}

const outputs = [
  ['icon.png', 1024, (c) => drawFridge(c, { bg: true }), { alpha: false, ss: 3, grainAmp: 5 }],
  ['splash-icon.png', 1024, (c) => drawFridge(c, { bg: true }), { alpha: false, ss: 3, grainAmp: 5 }],
  ['android-icon-background.png', 512, (c) => c.fillSolid(hex(C.cabinet)), { alpha: false }],
  [
    'android-icon-foreground.png',
    512,
    (c) => drawFridge(c, { scale: 0.62 }),
    { alpha: true },
  ],
  ['android-icon-monochrome.png', 432, (c) => drawMonochrome(c), { alpha: true, ss: 4 }],
  ['favicon.png', 48, (c) => drawFridge(c, { bg: true }), { alpha: false, ss: 8, grainAmp: 5 }],
];

for (const [name, size, draw, opts] of outputs) {
  render(name, size, draw, opts);
  console.log('wrote assets/' + name, `${size}x${size}`);
}
