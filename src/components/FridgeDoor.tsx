import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, doorTints } from '../theme';
import type { BoardColor } from '../types';

/** Outer-corner radius, matching the website fridge silhouette. */
const OUTER_R = 28;
/** Gap-side radius where the door meets the dark seam. */
const GAP_R = 14;

type Props = {
  color: BoardColor;
  /** Top door holds the pinned strip; bottom door holds the rest. */
  placement: 'top' | 'bottom';
  children: ReactNode;
};

/**
 * One enamel fridge door, mirroring the website hero: a board-tinted diagonal
 * gradient panel with a brushed-steel handle by the seam. The dark strip
 * between the doors is drawn by the board screen, not here.
 */
export function FridgeDoor({ color, placement, children }: Props) {
  const tint = doorTints[color];
  return (
    <View style={[styles.door, placement === 'top' ? styles.topRadii : styles.bottomRadii]}>
      <LinearGradient
        colors={[tint.light, tint.base, tint.shade]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <LinearGradient
        colors={[...colors.steel]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.handle, placement === 'top' ? styles.handleTop : styles.handleBottom]}
        pointerEvents="none"
      />
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  door: {
    flex: 1,
    overflow: 'hidden',
    boxShadow: '0 6px 14px -6px rgba(20, 30, 25, 0.35)',
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
  },
  handleTop: { bottom: 12, height: 56 },
  handleBottom: { top: 16, height: 130 },
});
