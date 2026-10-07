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
 * - Requires the quantization (DQT) and Huffman (DHT) tables a real decoder
 *   needs: a bare SOF/SOS/EOI skeleton with no tables is structurally shaped
 *   like a JPEG but undecodable, so it is rejected here (and would also fail
 *   the caller's decode-only pass). Tables may appear in the header or
 *   between scans (progressive refinements).
 * - Drops APP1 (EXIF/XMP — the GPS carrier), APP13 (Photoshop/IPTC
 *   captions), and COM (free-text comments). Keeps APP0 (JFIF density),
 *   APP2 (ICC profile), APP14 (Adobe flags) and all image-data segments, so
 *   rendering is preserved while personal metadata is gone.
 * - Dimensions come from a real SOF parse, never from client claims; the
 *   caller still routes oversized images to the resizing pipeline, and always
 *   runs a decode-only pass over the exact bytes being stored (structure
 *   alone is never proof of decodability).
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
  let sawDQT = false;
  let sawDHT = false;

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
      keep(segStart, end);
      pos = end;
      // One or more scans (progressive JPEGs chain SOS segments and may
      // redefine DHT/DQT/DRI tables between scans). FF00 is stuffed data,
      // FF D0–D7 are restart markers inside the scan, FF FF are fill bytes;
      // FF DA starts the next scan, FF DC is DNL, FF D9 ends the image, and
      // other length-bearing segments (tables, APPn) are skipped with the
      // same keep/drop rules as the header. Anything else inside scan data
      // means corruption.
      for (;;) {
        let p = pos;
        let markerPos = -1;
        let m2 = 0;
        while (p + 1 < n) {
          if (input[p] !== 0xff) {
            p += 1;
            continue;
          }
          const m = input[p + 1];
          if (m === 0xff) {
            p += 1; // Fill byte before a marker: skip it.
            continue;
          }
          if (m === 0x00 || (m >= 0xd0 && m <= 0xd7)) {
            p += 2;
            continue;
          }
          markerPos = p;
          m2 = m;
          break;
        }
        if (markerPos < 0) return null;
        if (m2 === EOI) {
          keep(pos, markerPos + 2);
          pos = markerPos + 2;
          break;
        }
        if (isStandalone(m2) || isStartOfFrame(m2)) return null;
        if (markerPos + 3 >= n) return null;
        const l2 = u16(markerPos + 2);
        const e2 = markerPos + 2 + l2;
        if (l2 < 2 || e2 > n) return null;
        if (m2 === APP1 || m2 === APP13 || m2 === COM) {
          pos = e2; // Drop inter-scan metadata like header metadata.
          continue;
        }
        if (m2 === 0xdb) sawDQT = true;
        if (m2 === 0xc4) sawDHT = true;
        keep(pos, e2); // Next scan header, DNL, or table segment.
        pos = e2;
      }
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

    if (marker === 0xdb) sawDQT = true;
    if (marker === 0xc4) sawDHT = true;

    // Metadata with personal-data potential goes; image-data segments stay.
    if (marker === APP1 || marker === APP13 || marker === COM) continue;
    keep(segStart, end);
  }

  if (!sawSOF || width <= 0 || height <= 0 || pos > n) return null;
  // A decodable JPEG needs its quantization and Huffman tables: without
  // them even a well-shaped SOF/SOS/EOI skeleton fails every real decoder.
  // Reject here (fail closed to the full pipeline, which also decode-checks).
  if (!sawDQT || !sawDHT) return null;
  const out = new Uint8Array(keptLen);
  let at = 0;
  for (const [s, e] of kept) {
    out.set(input.subarray(s, e), at);
    at += e - s;
  }
  return { bytes: out, width, height };
}
