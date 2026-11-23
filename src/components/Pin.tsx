import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { seeded } from '../utils/id';
import { fastenerColors } from '../theme';

export type HolderStyle = 'magnet' | 'pink' | 'gingham' | 'clip' | 'hazard';

export function holderStyleFor(value: unknown): HolderStyle {
  return value === 'pink' || value === 'gingham' || value === 'clip' || value === 'hazard'
    ? value
    : 'magnet';
}

export type Fastener = {
  color: string;
  /** Horizontal spot across the top edge, 0.3–0.7. */
  x: number;
  style?: HolderStyle;
};

/** One holder per item: stable colour and a slightly off-centre spot. */
export function fastenerForItem(seed: string, style: HolderStyle = 'magnet'): Fastener {
  const rand = seeded(seed);
  return {
    color: fastenerColors.magnets[Math.floor(rand() * fastenerColors.magnets.length)],
    x: 0.3 + rand() * 0.4,
    style,
  };
}

export function FastenerView({ fastener }: { fastener: Fastener }) {
  const left = `${fastener.x * 100}%`;
  if (fastener.style === 'gingham') {
    return (
      <View pointerEvents="none" style={[styles.tapeWrap, { left }]}>
        <View style={styles.gingham}>
          <View style={[styles.ginghamV, { left: '0%' }]} />
          <View style={[styles.ginghamV, { left: '50%' }]} />
          <View style={[styles.ginghamH, { top: '0%' }]} />
          <View style={[styles.ginghamH, { top: '50%' }]} />
        </View>
      </View>
    );
  }
  if (fastener.style === 'clip') {
    return (
      <View pointerEvents="none" style={[styles.clipWrap, { left }]}>
        <View style={styles.clipWire} />
        <View style={styles.clipBody} />
      </View>
    );
  }
  if (fastener.style === 'hazard') {
    return (
      <View pointerEvents="none" style={[styles.tapeWrap, { left }]}>
        <View style={styles.hazard}>
          <View style={[styles.hazardStripe, { left: '0%' }]} />
          <View style={[styles.hazardStripe, { left: '35%' }]} />
          <View style={[styles.hazardStripe, { left: '70%' }]} />
        </View>
      </View>
    );
  }
  return (
    <View
      pointerEvents="none"
      style={[
        styles.magnet,
        {
          left,
          backgroundColor:
            fastener.style === 'pink' ? fastenerColors.pink : fastener.color,
        },
      ]}
    >
      <LinearGradient
        colors={['rgba(255,255,255,0.62)', 'rgba(255,255,255,0.04)', 'rgba(0,0,0,0.22)']}
        locations={[0, 0.48, 1]}
        start={{ x: 0.15, y: 0.1 }}
        end={{ x: 0.85, y: 0.95 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.glint} />
    </View>
  );
}

const styles = StyleSheet.create({
  magnet: {
    position: 'absolute',
    top: -11,
    marginLeft: -11,
    width: 22,
    height: 22,
    borderRadius: 11,
    zIndex: 2,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.14)',
    overflow: 'hidden',
    // Drop shadow only: the rounded resin look comes from the gradient and
    // glint above, since inset shadows are web-only.
    boxShadow: '0 2px 4px rgba(0,0,0,0.35)',
  },
  glint: {
    position: 'absolute',
    top: 4,
    left: 5,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.58)',
  },
  tapeWrap: {
    position: 'absolute',
    top: -10,
    marginLeft: -16,
    width: 32,
    height: 15,
    zIndex: 2,
    transform: [{ rotate: '-7deg' }],
    boxShadow: '0 2px 4px rgba(0,0,0,0.28)',
  },
  gingham: {
    flex: 1,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: '#C9453A',
    backgroundColor: '#FFF8F0',
    overflow: 'hidden',
  },
  ginghamV: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: '50%',
    backgroundColor: 'rgba(201,69,58,0.32)',
  },
  ginghamH: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: '50%',
    backgroundColor: 'rgba(201,69,58,0.32)',
  },
  clipWrap: {
    position: 'absolute',
    top: -11,
    marginLeft: -8,
    width: 16,
    height: 18,
    zIndex: 2,
    alignItems: 'center',
    boxShadow: '0 2px 4px rgba(0,0,0,0.28)',
  },
  clipWire: {
    width: 9,
    height: 9,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#E8D9A8',
    marginBottom: -3,
  },
  clipBody: {
    width: 14,
    height: 10,
    borderRadius: 3,
    backgroundColor: '#D9B05A',
    borderWidth: 1,
    borderColor: '#8E6A10',
  },
  hazard: {
    flex: 1,
    borderRadius: 2,
    backgroundColor: '#F2C443',
    overflow: 'hidden',
  },
  hazardStripe: {
    position: 'absolute',
    top: -6,
    bottom: -6,
    width: 8,
    backgroundColor: '#2B2620',
    transform: [{ rotate: '35deg' }],
  },
});
