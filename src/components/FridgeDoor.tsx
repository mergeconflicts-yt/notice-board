import { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, doorTints } from '../theme';
import type { BoardColor } from '../types';

/** Outer-corner radius, matching the website fridge silhouette. */
const OUTER_R = 60;
/** Gap-side radius where the door meets the dark seam. */
const GAP_R = 10;
/** Thick cabinet frame around the doors. */
const FRAME = 10;
/** Thinner frame edge where the doors meet the middle seam. */
const FRAME_SEAM = 4;

type Props = {
  color: BoardColor;
  /** Top door holds the pinned strip; bottom door holds the rest. */
  placement: 'top' | 'bottom';
  children: ReactNode;
};

/**
 * One enamel fridge door, mirroring the website hero: a board-tinted panel
 * with the horizontal sheen sweeping across it, a bright inner top edge, a
 * dark pool along the bottom edge (the website's inset shadows, drawn as
 * overlay gradients since React Native has no inset shadows) and a chrome
 * bar handle. The dark strip between the doors is drawn by the board screen,
 * not here.
 */
export function FridgeDoor({ color, placement, children }: Props) {
  const tint = doorTints[color];
  return (
    <View
      style={[
        styles.frame,
        placement === 'top' ? styles.frameTop : styles.frameBottom,
      ]}
    >
      <View style={[styles.door, placement === 'top' ? styles.topRadii : styles.bottomRadii]}>
      <View
        style={[StyleSheet.absoluteFill, { backgroundColor: tint.base }]}
        pointerEvents="none"
      />
      <LinearGradient
        colors={[
          'rgba(255,255,255,0.16)',
          'rgba(255,255,255,0)',
          'rgba(0,0,0,0)',
          'rgba(0,0,0,0.06)',
        ]}
        locations={[0, 0.22, 0.78, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {/* Inner top light: website `inset 0 2px 2px rgba(255,255,255,.7)`.
          Kept subtle on the bottom door, where it meets the dark seam. */}
      <LinearGradient
        colors={
          placement === 'top'
            ? ['rgba(255,255,255,0.7)', 'rgba(255,255,255,0)']
            : ['rgba(255,255,255,0.35)', 'rgba(255,255,255,0)']
        }
        locations={[0, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={[styles.topGlow, placement === 'bottom' && styles.topGlowBottom]}
        pointerEvents="none"
      />
      {/* Inner bottom shade: website `inset 0 -4px 8px rgba(62,54,46,.18)`. */}
      <LinearGradient
        colors={['rgba(62,54,46,0)', 'rgba(62,54,46,0.18)']}
        locations={[0, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.bottomShade}
        pointerEvents="none"
      />
      {/* Chrome bar handle: bright face, dark spine, bright edge. */}
      <LinearGradient
        colors={['#87A5A8', '#FBFBFB', '#A4ABB3']}
        locations={[0, 0.45, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.handle, placement === 'top' ? styles.handleTop : styles.handleBottom]}
        pointerEvents="none"
      />
      <View style={styles.content}>{children}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    flex: 1,
    backgroundColor: colors.black,
  },
  frameTop: {
    borderTopLeftRadius: OUTER_R + FRAME,
    borderTopRightRadius: OUTER_R + FRAME,
    borderBottomLeftRadius: GAP_R + FRAME,
    borderBottomRightRadius: GAP_R + FRAME,
    padding: FRAME,
    paddingBottom: FRAME_SEAM,
  },
  frameBottom: {
    borderTopLeftRadius: GAP_R + FRAME,
    borderTopRightRadius: GAP_R + FRAME,
    borderBottomLeftRadius: OUTER_R + FRAME,
    borderBottomRightRadius: OUTER_R + FRAME,
    padding: FRAME,
    paddingTop: FRAME_SEAM,
  },
  door: {
    flex: 1,
    overflow: 'hidden',
  },
  // Clipped by the door's own radii + overflow, so no per-corner radii here.
  topGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 8,
  },
  topGlowBottom: {
    height: 6,
  },
  bottomShade: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 14,
  },
  topRadii: {
    borderTopLeftRadius: OUTER_R,
    borderTopRightRadius: OUTER_R,
    borderBottomLeftRadius: GAP_R,
    borderBottomRightRadius: GAP_R,
  },
  bottomRadii: {
    borderTopLeftRadius: GAP_R,
    borderTopRightRadius: GAP_R,
    borderBottomLeftRadius: OUTER_R,
    borderBottomRightRadius: OUTER_R,
  },
  content: {
    flex: 1,
    paddingLeft: 30,
    paddingRight: 10,
    paddingTop: 4,
    paddingBottom: 10,
  },
  handle: {
    position: 'absolute',
    left: 12,
    width: 13,
    borderRadius: 7,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 3,
  },
  handleTop: { bottom: 12, height: 110 },
  handleBottom: { top: 16, height: 130 },
});
