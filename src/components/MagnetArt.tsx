import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useSharedValue, type SharedValue } from 'react-native-reanimated';
import { colors, fonts } from '../theme';
import { Magnet } from './Magnet';
import { artSources } from '../lib/packAssets';
import type { PackArt } from '../types';

type Props = {
  art: PackArt | null;
  /** Rendered size in px (the magnet's reference box). */
  size: number;
  /** Degrees, applied to magnets only. */
  rotation?: number;
  /** Parent-driven lift; ignored by flat stickers. */
  lift?: SharedValue<number>;
  /** Overrides the art label for accessibility. */
  label?: string;
};

/**
 * Renders one pack-art item. Magnets use the baked body + shadow via `Magnet`
 * (docs/plan-magnets.md §4) and lift on pick-up; stickers are flat die-cut
 * vinyl that sit on the door with a small silhouette shadow and never lift.
 * Unknown art with no baked sources falls back to a labelled placeholder.
 */
export function MagnetArt({ art, size, rotation = 0, lift, label }: Props) {
  // Hook must run unconditionally; static callers rest at 0.
  const resting = useSharedValue(0);
  const liftValue = lift ?? resting;
  const a11y = label ?? art?.label ?? 'Magnet';
  const sources = art ? artSources(art) : null;

  // Flat sticker: body only, with a small dark silhouette shadow. No lift.
  if (art?.kind === 'sticker' && sources) {
    return (
      <View style={{ width: size, height: size }} pointerEvents="none">
        <Image
          source={sources.body}
          style={[StyleSheet.absoluteFill, styles.stickerShadow]}
          contentFit="contain"
          cachePolicy="disk"
          tintColor="rgba(0,0,0,0.3)"
          accessible={false}
        />
        <Image
          source={sources.body}
          style={StyleSheet.absoluteFill}
          contentFit="contain"
          cachePolicy="disk"
          accessible={false}
        />
        <View accessible accessibilityRole="image" accessibilityLabel={a11y} style={StyleSheet.absoluteFill} />
      </View>
    );
  }

  if (sources?.shadow) {
    return (
      <View accessible accessibilityRole="image" accessibilityLabel={a11y}>
        <Magnet
          body={sources.body}
          shadow={sources.shadow}
          size={size}
          rotation={rotation}
          lift={liftValue}
          accessibilityLabel={a11y}
        />
      </View>
    );
  }

  // Unknown art with no baked sources: neutral round placeholder.
  return (
    <View
      style={[styles.missing, { width: size, height: size, transform: [{ rotate: `${rotation}deg` }] }]}
      pointerEvents="none"
      accessible
      accessibilityRole="image"
      accessibilityLabel={a11y}
    >
      <View style={[styles.missingDisc, { width: size * 0.86, height: size * 0.86, borderRadius: size }]}>
        <Text numberOfLines={2} style={[styles.missingText, { fontSize: Math.max(6, size * 0.14) }]}>
          {art?.label ?? '?'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stickerShadow: { transform: [{ translateX: 1 }, { translateY: 1.5 }] },
  missing: { alignItems: 'center', justifyContent: 'center' },
  missingDisc: {
    backgroundColor: colors.hairline,
    borderWidth: 1,
    borderColor: colors.inkSoft,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2,
  },
  missingText: {
    fontFamily: fonts.ui.semibold,
    color: colors.inkSoft,
    textAlign: 'center',
  },
});
