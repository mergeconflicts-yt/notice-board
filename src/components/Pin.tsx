import { View, StyleSheet } from 'react-native';
import { seeded } from '../utils/id';
import { fastenerColors } from '../theme';

export type Fastener = {
  color: string;
  /** Horizontal spot across the top edge, 0.3–0.7. */
  x: number;
};

/** One magnet per item: stable colour and a slightly off-centre spot. */
export function fastenerForItem(seed: string): Fastener {
  const rand = seeded(seed);
  return {
    color: fastenerColors.magnets[Math.floor(rand() * fastenerColors.magnets.length)],
    x: 0.3 + rand() * 0.4,
  };
}

export function FastenerView({ fastener }: { fastener: Fastener }) {
  return (
    <View
      pointerEvents="none"
      style={[styles.magnet, { left: `${fastener.x * 100}%`, backgroundColor: fastener.color }]}
    >
      <View style={styles.glint} />
    </View>
  );
}

const styles = StyleSheet.create({
  magnet: {
    position: 'absolute',
    top: -11,
    marginLeft: -12,
    width: 24,
    height: 24,
    borderRadius: 12,
    zIndex: 2,
    // Drop shadow only: inset and gradient highlights are web-only props, so
    // the roundness comes from a plain glint dot instead.
    boxShadow: '0 3px 5px rgba(0,0,0,0.35)',
  },
  glint: {
    position: 'absolute',
    top: 4,
    left: 5,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
});
