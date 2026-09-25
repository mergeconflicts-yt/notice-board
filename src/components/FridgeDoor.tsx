import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, doorTints, handleTints } from '../theme';
import type { BoardColor } from '../types';

/** Outer-corner radius, matching the website fridge silhouette. */
const OUTER_R = 60;
/** Gap-side radius where the door meets the dark seam. */
const GAP_R = 10;
/** Thick cabinet frame around the doors. */
const FRAME = 10;
/** Thinner frame edge where the doors meet the middle seam. */
const FRAME_SEAM = 5;

type Props = {
  color: BoardColor;
  /** Top door holds the pinned strip; bottom door holds the rest. */
  placement: 'top' | 'bottom';
  children: ReactNode;
};

/**
 * One enamel fridge door, mirroring the website hero: a board-tinted diagonal
 * gradient panel with a soft sheen sweeping across it and an enamel handle in
 * a deeper tone of the same door. The dark strip between the doors is drawn
 * by the board screen, not here.
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
      <LinearGradient
        colors={[tint.light, tint.base, tint.shade]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {/* Soft diagonal shine across the enamel, like the website doors. */}
      <LinearGradient
        colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.32)', 'rgba(255,255,255,0)']}
        locations={[0.45, 0.68, 0.9]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0.35 }}
        style={styles.shine}
        pointerEvents="none"
      />
      <LinearGradient
        colors={[...handleTints[color]]}
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
  // Thick cabinet frame around the door, drawn as solid padding so the border
  // renders evenly (uneven per-side borderWidth clips on rounded corners).
  frame: {
    flex: 1,
    backgroundColor: colors.seam,
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
  shine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
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
  },
  handleTop: { bottom: 12, height: 110 },
  handleBottom: { top: 16, height: 130 },
});
