import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

const MAX_SIDE = 2048;
const QUALITY = 0.8;

/**
 * Downscale to a longest side of 2048 and re-encode as JPEG. Re-encoding is
 * what strips EXIF (including GPS) — the original file is never uploaded
 * (docs/plan.md §7).
 *
 * The dimensions come from the rendered image itself (not `Image.getSize`,
 * which can fail for HEIC/cloud URIs). If it did fail we'd skip the resize and
 * could upload an over-limit file, so the probe is unconditional.
 */
export async function preparePhoto(uri: string): Promise<string> {
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
}
