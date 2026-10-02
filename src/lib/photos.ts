import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

const MAX_SIDE = 1600;
const QUALITY = 0.75;

/**
 * Downscale to a longest side of 1600 and re-encode as JPEG. Re-encoding is
 * what strips EXIF (including GPS) — the original file is never uploaded
 * (docs/plan.md §7).
 *
 * 1600 is deliberately below the server's 2048 ceiling: the largest render
 * anywhere is the note-detail popup (~1200px at 3x DPR; there is no
 * fullscreen/zoom viewer), so 1600 keeps full displayed sharpness while
 * roughly halving bytes against the per-account storage quota — and a
 * smaller input also means less work for the edge function's CPU ceiling.
 * The server still validates dimensions and EXIF itself regardless.
 *
 * The dimensions come from the rendered image itself (not `Image.getSize`,
 * which can fail for HEIC/cloud URIs). If it did fail we'd skip the resize and
 * could upload an over-limit file, so the probe is unconditional.
 */
export async function preparePhoto(uri: string): Promise<string> {
  try {
    const probe = await ImageManipulator.manipulate(uri).renderAsync();
    const width = probe.width ?? 0;
    const height = probe.height ?? 0;
    const longest = Math.max(width, height);
    if (longest > MAX_SIDE) {
      const scale = MAX_SIDE / longest;
      const resized = ImageManipulator.manipulate(uri).resize({
        width: Math.round(width * scale),
        height: Math.round(height * scale),
      });
      const image = await resized.renderAsync();
      const result = await image.saveAsync({ compress: QUALITY, format: SaveFormat.JPEG });
      return result.uri;
    }
    const result = await probe.saveAsync({ compress: QUALITY, format: SaveFormat.JPEG });
    return result.uri;
  } catch (e) {
    // Stage tag for Metro logs: distinguishes a local prepare failure from an
    // upload failure (both would otherwise surface as a generic toast).
    console.error('[preparePhoto] failed:', e);
    throw e;
  }
}
