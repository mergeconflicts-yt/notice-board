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
    top: -9,
    marginLeft: -9,
    width: 18,
    height: 18,
    borderRadius: 9,
    zIndex: 2,
    // Drop shadow only: inset and gradient highlights are web-only props, so
    // the roundness comes from a plain glint dot instead.
    boxShadow: '0 2px 4px rgba(0,0,0,0.35)',
  },
  glint: {
    position: 'absolute',
    top: 3,
    left: 4,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
});
