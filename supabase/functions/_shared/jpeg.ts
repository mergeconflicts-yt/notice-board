/**
 * Minimal JPEG segment parser for the upload-photo fast path.
 *
 * Pure Uint8Array/DataView code — no Deno, Node, or npm APIs — so it runs
 * unchanged in the Edge Function (Deno) and in the node:test unit suite.
 *
 * Why this exists: the full pixel pipeline (decode → resize → JPEG
 * re-encode in pure JS) burns >2.7 CPU-seconds on a 2048px photo and trips
 * the hosted edge CPU ceiling (`WORKER_RESOURCE_LIMIT`), while local dev has
 * no such limit. The client always sends ≤2048px JPEGs, so the common case
 * needs no pixel work at all: validate the structure from the headers and
 * drop the metadata segments in a single O(bytes) pass (milliseconds).
 *
 * Security properties (fail closed — any anomaly returns null and the
 * caller falls back to the full pipeline, which rejects what it cannot
 * decode):
 * - Rejects non-JPEG input (SOI magic) and truncated/malformed structure
 *   (length overruns, missing SOF, missing SOS→EOI scan).
 * - Drops APP1 (EXIF/XMP — the GPS carrier), APP13 (Photoshop/IPTC
 *   captions), and COM (free-text comments). Keeps APP0 (JFIF density),
 *   APP2 (ICC profile), APP14 (Adobe flags) and all image-data segments, so
 *   rendering is preserved while personal metadata is gone.
 * - Dimensions come from a real SOF parse, never from client claims; the
 *   caller still routes oversized images to the resizing pipeline.
 */
export type StrippedJpeg = {
  bytes: Uint8Array;
  width: number;
  height: number;
};

// Plain consts (not a const enum): this file is also compiled by tsc for
// the node unit suite, where isolated-modules semantics reject const enums.
const SOI = 0xd8;
const EOI = 0xd9;
const SOS = 0xda;
const COM = 0xfe;
const APP1 = 0xe1;
const APP13 = 0xed;

function isStandalone(marker: number): boolean {
  return marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9);
}

function isStartOfFrame(marker: number): boolean {
  // C0–C3, C5–C7, C9–CB, CD–CF. Excludes DHT (C4), JPG (C8), DAC (CC),
  // which share the range but carry different payloads.
  return marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
}

export function stripJpegMetadata(input: Uint8Array): StrippedJpeg | null {
  const n = input.length;
  if (n < 4 || input[0] !== 0xff || input[1] !== SOI) return null;

  // Kept byte ranges [start, end); concatenated once at the end.
  const kept: Array<[number, number]> = [[0, 2]];
  let keptLen = 2;
  const keep = (start: number, end: number): void => {
    kept.push([start, end]);
    keptLen += end - start;
  };

  let pos = 2;
  let width = 0;
  let height = 0;
  let sawSOF = false;

  const u16 = (p: number): number => (input[p] << 8) | input[p + 1];

  for (;;) {
    if (pos + 1 >= n || input[pos] !== 0xff) return null;
    const marker = input[pos + 1];

    if (isStandalone(marker)) {
      if (marker === EOI) {
        // End of image outside a scan: only valid for degenerate files;
        // accept only with a real SOF already parsed.
        if (!sawSOF || width <= 0 || height <= 0) return null;
        keep(pos, pos + 2);
        break;
      }
      if (marker === 0x01) {
        keep(pos, pos + 2); // TEM — vanishingly rare, harmless.
        pos += 2;
        continue;
      }
      return null; // RSTn outside scan data: malformed.
    }

    if (pos + 3 >= n) return null;
    const len = u16(pos + 2);
    const end = pos + 2 + len; // length field counts its own 2 bytes
    if (len < 2 || end > n) return null;
    const segStart = pos;
    pos = end;

    if (marker === SOS) {
      if (!sawSOF) return null;
      // Scan data runs to EOI. FF00 is a stuffed data byte, FF D0–D7 are
      // restart markers inside the scan; anything else starting with FF
      // must be the terminating EOI.
      let p = pos;
      let found = -1;
      while (p + 1 < n) {
        if (input[p] !== 0xff) {
          p += 1;
          continue;
        }
        const m = input[p + 1];
        if (m === 0x00 || (m >= 0xd0 && m <= 0xd7)) {
          p += 2;
          continue;
        }
        if (m === EOI) {
          found = p + 2;
          break;
        }
        return null;
      }
      if (found < 0) return null;
      keep(segStart, found); // SOS header + scan + EOI verbatim.
      pos = found;
      break; // Trailing bytes after EOI are never rendered — drop them.
    }

    if (isStartOfFrame(marker)) {
      // SOF layout: precision(1) height(2) width(2) components…
      if (len < 8 || pos > n) return null;
      const h = u16(segStart + 5);
      const w = u16(segStart + 7);
      if (h <= 0 || w <= 0 || h > 262144 || w > 262144) return null;
      height = h;
      width = w;
      sawSOF = true;
      keep(segStart, end);
      continue;
    }

    // Metadata with personal-data potential goes; image-data segments stay.
    if (marker === APP1 || marker === APP13 || marker === COM) continue;
    keep(segStart, end);
  }

  if (!sawSOF || width <= 0 || height <= 0 || pos > n) return null;
  const out = new Uint8Array(keptLen);
  let at = 0;
  for (const [s, e] of kept) {
    out.set(input.subarray(s, e), at);
    at += e - s;
  }
  return { bytes: out, width, height };
}
