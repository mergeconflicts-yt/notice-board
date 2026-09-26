import { type ReactNode, useMemo } from 'react';
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
const FRAME_SEAM = 5;

type Scratch = {
  key: string;
  left: number;
  top: number;
  length: number;
  angle: number;
  opacity: number;
};

function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function makeScratches(seed: string): Scratch[] {
  let state = hashSeed(seed) || 1;
  const rand = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const count = 9 + Math.floor(rand() * 5);
  return Array.from({ length: count }, (_, i) => ({
    key: `scratch-${i}`,
    left: 6 + rand() * 78,
    top: 5 + rand() * 86,
    length: 16 + rand() * 54,
    angle: rand() < 0.6 ? -25 + rand() * 50 : 55 + rand() * 70,
    opacity: 0.16 + rand() * 0.22,
  }));
}

type Props = {
  color: BoardColor;
  /** Top door holds the pinned strip; bottom door holds the rest. */
  placement: 'top' | 'bottom';
  children: ReactNode;
};

/**
 * One enamel fridge door, mirroring the website hero: a board-tinted diagonal
 * gradient panel with a soft sheen sweeping across it and a chrome bar
 * handle. The dark strip between the doors is drawn by the board screen,
 * not here.
 */
export function FridgeDoor({ color, placement, children }: Props) {
  const tint = doorTints[color];
  const scratches = useMemo(
    () => makeScratches(`${color}:${placement}`),
    [color, placement],
  );
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
      {/* Soft sheen hugging the left edge of the enamel. */}
      <LinearGradient
        colors={['rgba(255,255,255,0.35)', 'rgba(255,255,255,0)']}
        locations={[0, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.shine}
        pointerEvents="none"
      />
      {/* Lived-in scratches: a dark groove with a bright edge so they read
          on pale and mid enamel alike. Seeded per door so they never jump. */}
      {scratches.map((s) => (
        <View
          key={s.key}
          pointerEvents="none"
          style={[
            styles.scratch,
            {
              left: `${s.left}%`,
              top: `${s.top}%`,
              width: s.length,
              opacity: s.opacity,
              transform: [{ rotate: `${s.angle}deg` }],
            },
          ]}
        >
          <View style={styles.scratchGroove} />
          <View style={styles.scratchGlint} />
        </View>
      ))}
      {/* Chrome bar handle: bright face, dark spine, bright edge. */}
      <LinearGradient
        colors={['#F4F2EC', '#CFC9BB', '#8F8878', '#E8E4D8']}
        locations={[0, 0.35, 0.7, 1]}
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
    width: 90,
  },
  scratch: {
    position: 'absolute',
    height: 3,
  },
  scratchGroove: {
    height: 1.5,
    borderRadius: 1,
    backgroundColor: 'rgba(62, 54, 46, 0.42)',
  },
  scratchGlint: {
    height: 1,
    borderRadius: 1,
    marginTop: 0.5,
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
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
