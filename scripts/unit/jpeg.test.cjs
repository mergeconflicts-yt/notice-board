// Unit tests for the upload-photo JPEG fast path
// (supabase/functions/_shared/jpeg.ts): header validation + metadata
// segment stripping without pixel decode. Guards the EXIF/GPS removal and
// the fail-closed nulls (malformed input must never reach storage).
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const BUILD = process.env.TEST_BUILD;
if (!BUILD) throw new Error('TEST_BUILD env var is required (see scripts/run-unit-tests.cjs)');
const { stripJpegMetadata } = require(`${BUILD}/jpeg.js`);

const SOI = [0xff, 0xd8];
const EOI = [0xff, 0xd9];

// A marker segment: FF MM + u16 length (self-inclusive) + payload.
function seg(marker, payload) {
  const len = payload.length + 2;
  return [0xff, marker, (len >> 8) & 0xff, len & 0xff, ...payload];
}

// Minimal SOF0 for w×h (baseline, 3 components).
function sof0(w, h) {
  return seg(0xc0, [
    8,
    (h >> 8) & 0xff, h & 0xff,
    (w >> 8) & 0xff, w & 0xff,
    3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1,
  ]);
}

// SOS header for 1 component + tiny scan with stuffed + restart bytes.
function sosScan() {
  return [
    ...seg(0xda, [1, 1, 0, 0, 0x3f, 0]),
    0x11, 0xff, 0x00, 0x22, 0xff, 0xd3, 0x33, // data, stuffed FF00, RST3
  ];
}

function jpeg(parts) {
  return Uint8Array.from(parts.flat());
}

const EXIF = [...'Exif\0\0GPS:51.5N,0.1W'.split('').map((c) => c.charCodeAt(0))];

describe('stripJpegMetadata', () => {
  it('strips EXIF/XMP/IPTC/comments but keeps render segments + dims', () => {
    const input = jpeg([
      SOI,
      seg(0xe0, [0x4a, 0x46, 0x49, 0x46, 0]), // APP0 JFIF (kept)
      seg(0xe1, EXIF), // APP1 EXIF with fake GPS (dropped)
      seg(0xed, [1, 2, 3]), // APP13 IPTC (dropped)
      seg(0xfe, [9, 9]), // COM (dropped)
      seg(0xe2, [7, 7, 7]), // APP2 ICC (kept)
      seg(0xdb, [0, 1, 2]), // DQT (kept)
      sof0(640, 480),
      seg(0xc4, [4, 5]), // DHT (kept)
      sosScan(),
      EOI,
    ]);
    const out = stripJpegMetadata(input);
    assert.ok(out);
    assert.equal(out.width, 640);
    assert.equal(out.height, 480);
    const bytes = [...out.bytes];
    const has = (needle) => bytes.join(',').includes(needle.join(','));
    assert.ok(!has(EXIF), 'EXIF payload must be gone');
    assert.ok(!has([0xff, 0xed]), 'APP13 marker must be gone');
    assert.ok(!has([0xff, 0xfe]), 'COM marker must be gone');
    assert.ok(has([0xff, 0xe0]), 'APP0 kept');
    assert.ok(has([0xff, 0xe2]), 'APP2 kept');
    assert.equal(bytes[0], 0xff);
    assert.equal(bytes[1], 0xd8);
    assert.equal(bytes[bytes.length - 2], 0xff);
    assert.equal(bytes[bytes.length - 1], 0xd9);
    assert.ok(bytes.length < input.length, 'output is smaller without metadata');
  });

  it('parses progressive (SOF2) dimensions', () => {
    const sof2 = seg(0xc2, [
      8, 0, 10, 0, 20, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1,
    ]); // 20x10
    const out = stripJpegMetadata(jpeg([SOI, sof2, sosScan(), EOI]));
    assert.ok(out);
    assert.equal(out.width, 20);
    assert.equal(out.height, 10);
  });

  it('reports oversized dimensions instead of rejecting (caller decides)', () => {
    const out = stripJpegMetadata(jpeg([SOI, sof0(3000, 2000), sosScan(), EOI]));
    assert.ok(out);
    assert.equal(out.width, 3000);
  });

  it('rejects non-JPEG input', () => {
    assert.equal(stripJpegMetadata(Uint8Array.from([0x89, 0x50, 0x4e, 0x47])), null);
    assert.equal(stripJpegMetadata(new Uint8Array(0)), null);
  });

  it('rejects truncated segments, missing SOF, and missing EOI', () => {
    const good = [SOI, seg(0xe0, [1]), sof0(4, 4), sosScan(), EOI];
    assert.equal(stripJpegMetadata(jpeg(good).slice(0, 12)), null); // cut mid-segment
    assert.equal(
      stripJpegMetadata(jpeg([SOI, seg(0xe0, [1]), sosScan(), EOI])),
      null, // SOS without SOF
    );
    assert.equal(
      stripJpegMetadata(jpeg([SOI, sof0(4, 4), ...sosScan()])), // no EOI
      null,
    );
  });

  it('rejects zero dimensions and length overruns', () => {
    const badSof = seg(0xc0, [8, 0, 0, 0, 10, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1]);
    assert.equal(stripJpegMetadata(jpeg([SOI, badSof, sosScan(), EOI])), null);
    assert.equal(
      stripJpegMetadata(jpeg([SOI, [0xff, 0xe1, 0x7f, 0xff], sof0(4, 4), sosScan(), EOI])),
      null, // declared length runs past the buffer
    );
  });
});
