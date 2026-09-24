import { Image } from 'react-native';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

const MAX_SIDE = 2048;
const QUALITY = 0.8;

function sizeOf(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      () => resolve({ width: 0, height: 0 }),
    );
  });
}

/**
 * Downscale to a longest side of 2048 and re-encode as JPEG. Re-encoding is
 * what strips EXIF (including GPS) — the original file is never uploaded
 * (docs/plan.md §7).
 */
export async function preparePhoto(uri: string): Promise<string> {
  const { width, height } = await sizeOf(uri);
  const context = ImageManipulator.manipulate(uri);
  const longest = Math.max(width, height);
  if (longest > MAX_SIDE) {
    const scale = MAX_SIDE / longest;
    context.resize({
      width: Math.round(width * scale),
      height: Math.round(height * scale),
    });
  }
  const image = await context.renderAsync();
  const result = await image.saveAsync({ compress: QUALITY, format: SaveFormat.JPEG });
  return result.uri;
}
