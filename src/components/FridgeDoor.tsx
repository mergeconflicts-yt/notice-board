import { memo, type ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  cabinetMaterial,
  chromeHandle,
  doorTints,
  enamelInsetShadows,
  enamelReflection,
  handleShadows,
} from '../theme';
import type { BoardColor } from '../types';

/** Outer-corner radius, matching the website fridge silhouette. */
const OUTER_R = 60;
/** Gap-side radius where the door meets the dark seam. */
const GAP_R = 10;
/** Thick cabinet frame around the doors. */
const FRAME = 10;
/** Thinner frame edge where the doors meet the middle seam. */
const FRAME_SEAM = 4;

/**
 * Inset box shadows need Android API 29+ (outset 28+). Gradients below are
 * the fallback and always render, so older Android keeps the same lighting.
 */
const supportsInsetShadow =
  Platform.OS === 'ios' ? true : Platform.OS === 'android' ? Number(Platform.Version) >= 29 : false;

type Props = {
  color: BoardColor;
  /** Top door holds the pinned strip; bottom door holds the rest. */
  placement: 'top' | 'bottom';
  children: ReactNode;
};

type Tint = (typeof doorTints)[BoardColor];

/**
 * Cabinet metal behind the door, painted inside the existing frame budget so
 * the note canvas never shrinks: dark outer edge → bright silver line → grey
 * metal → dark gasket → paint. The gap side (middle seam) stays
 * predominantly dark — chrome belongs around the cabinet's outside edge.
 */
const CabinetChrome = memo(function CabinetChrome({ placement }: { placement: Props['placement'] }) {
  const gapOnBottom = placement === 'top';
  return (
    <View
      style={[StyleSheet.absoluteFill, placement === 'top' ? styles.chromeTop : styles.chromeBottom]}
      pointerEvents="none"
    >
      <View style={[StyleSheet.absoluteFill, { backgroundColor: cabinetMaterial.shade }]} />
      {/* Top band: bright outside edge, or dark when it is the middle seam. */}
      <LinearGradient
        colors={
          gapOnBottom
            ? [cabinetMaterial.edge, cabinetMaterial.highlight, cabinetMaterial.silver, cabinetMaterial.shade, cabinetMaterial.gasket]
            : [cabinetMaterial.shade, cabinetMaterial.gasket]
        }
        locations={gapOnBottom ? [0, 0.18, 0.4, 0.7, 1] : [0, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.bandTop}
      />
      {/* Bottom band: mirror of the top. */}
      <LinearGradient
        colors={
          gapOnBottom
            ? [cabinetMaterial.gasket, cabinetMaterial.shade]
            : [cabinetMaterial.gasket, cabinetMaterial.shade, cabinetMaterial.silver, cabinetMaterial.highlight, cabinetMaterial.edge]
        }
        locations={gapOnBottom ? [0, 1] : [0, 0.3, 0.6, 0.82, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.bandBottom}
      />
      {/* Left band: outer edge on the left, gasket toward the door. */}
      <LinearGradient
        colors={[cabinetMaterial.edge, cabinetMaterial.highlight, cabinetMaterial.silver, cabinetMaterial.shade, cabinetMaterial.gasket]}
        locations={[0, 0.18, 0.4, 0.7, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.bandLeft}
      />
      {/* Right band: mirror of the left. */}
      <LinearGradient
        colors={[cabinetMaterial.gasket, cabinetMaterial.shade, cabinetMaterial.silver, cabinetMaterial.highlight, cabinetMaterial.edge]}
        locations={[0, 0.3, 0.6, 0.82, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.bandRight}
      />
    </View>
  );
});

/**
 * Static enamel material: base coat, broad gloss reflection, soft top bloom,
 * and sharp rim/edge shading. Memoized on tint + placement only — it never
 * reads note state. Clipped by the door surface so highlights follow the same
 * per-corner radii as the paint (a straight stripe would miss the curved
 * metal lip).
 */
const DoorFinish = memo(function DoorFinish({
  tint,
  placement,
}: {
  tint: Tint;
  placement: Props['placement'];
}) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Enamel base: mostly the original paint; narrow dark edges curve it. */}
      <LinearGradient
        pointerEvents="none"
        colors={[tint.shade, tint.base, tint.light, tint.base, tint.base, tint.shade]}
        locations={[0, 0.04, 0.16, 0.5, 0.92, 1]}
        start={{ x: 0, y: 0.48 }}
        end={{ x: 1, y: 0.52 }}
        style={StyleSheet.absoluteFill}
      />
      {/* Broad reflection: upper-left toward lower-right. */}
      <LinearGradient
        pointerEvents="none"
        colors={[...enamelReflection.colors]}
        locations={[...enamelReflection.locations]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.65, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* Soft top bloom: full-bleed vertical falloff (no hard perimeter) with
          a horizontal center weight, brightest near the upper centre. */}
      <View style={styles.bloom} pointerEvents="none">
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(255,255,255,0.16)', 'rgba(255,255,255,0.04)', 'rgba(255,255,255,0)']}
          locations={[0, 0.55, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.07)', 'rgba(255,255,255,0)']}
          locations={[0, 0.5, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </View>
      {/* Sharp rim scale: 1–2pt curved top glint over the soft falloff. */}
      <LinearGradient
        pointerEvents="none"
        colors={
          placement === 'top'
            ? ['rgba(255,255,255,0.55)', 'rgba(255,255,255,0)']
            : ['rgba(255,255,255,0.35)', 'rgba(255,255,255,0)']
        }
        locations={[0, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={[styles.rimTop, placement === 'bottom' && styles.rimTopBottom]}
      />
      {/* Left edge highlight: 1pt white at 15–25%. */}
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(255,255,255,0.22)', 'rgba(255,255,255,0)']}
        locations={[0, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.edgeLeft}
      />
      {/* Right edge shadow: dark at 20–30%. */}
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(12,18,25,0)', 'rgba(12,18,25,0.28)']}
        locations={[0, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.edgeRight}
      />
      {/* Bottom edge shadow: dark at 25–40%. */}
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(12,18,25,0)', 'rgba(12,18,25,0.35)']}
        locations={[0, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.edgeBottom}
      />
    </View>
  );
});

/**
 * Polished-chrome bar handle. The unclipped wrapper carries the cast shadows;
 * the rounded inner view clips the chrome bands. Two mounting feet behind the
 * handle, near its ends, add darker contact shadows so the bar reads as
 * floating off the enamel.
 */
const ChromeHandle = memo(function ChromeHandle({ placement }: { placement: Props['placement'] }) {
  return (
    <View
      style={[styles.handle, placement === 'top' ? styles.handleTop : styles.handleBottom]}
      pointerEvents="none"
    >
      <View style={styles.footTop} />
      <View style={styles.footBottom} />
      <View style={styles.handleClip}>
        <LinearGradient
          colors={[...chromeHandle.colors]}
          locations={[...chromeHandle.locations]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
        {/* Lengthwise shading: darker ends, brighter middle. */}
        <LinearGradient
          colors={['rgba(0,0,0,0.20)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.24)']}
          locations={[0, 0.25, 0.75, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </View>
    </View>
  );
});

/**
 * One enamel fridge door: cabinet metal surrounding a recessed seal, a
 * board-tinted painted-metal panel with the gloss sweeping across it, and a
 * chrome bar handle floating above the content. The dark strip between the
 * doors is drawn by the board screen, not here. Decorative layers are static
 * and pointer-transparent; only Content is interactive, and reflections live
 * inside the door surface so they stay attached to the door.
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
      <CabinetChrome placement={placement} />
      <View style={styles.doorAssembly}>
        <View
          style={[
            styles.door,
            placement === 'top' ? styles.topRadii : styles.bottomRadii,
            supportsInsetShadow ? styles.insetShading : null,
          ]}
        >
          <View style={[StyleSheet.absoluteFill, { backgroundColor: tint.base }]} pointerEvents="none" />
          <DoorFinish tint={tint} placement={placement} />
          <View style={styles.content}>{children}</View>
        </View>
        <ChromeHandle placement={placement} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    flex: 1,
    backgroundColor: cabinetMaterial.gasket,
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
  // Decorative cabinet background: same outer radii as the frame, clipped so
  // the metal bands follow the corners. Only the FRAME-wide ring shows — the
  // door assembly covers the centre.
  chromeTop: {
    borderTopLeftRadius: OUTER_R + FRAME,
    borderTopRightRadius: OUTER_R + FRAME,
    borderBottomLeftRadius: GAP_R + FRAME,
    borderBottomRightRadius: GAP_R + FRAME,
    overflow: 'hidden',
  },
  chromeBottom: {
    borderTopLeftRadius: GAP_R + FRAME,
    borderTopRightRadius: GAP_R + FRAME,
    borderBottomLeftRadius: OUTER_R + FRAME,
    borderBottomRightRadius: OUTER_R + FRAME,
    overflow: 'hidden',
  },
  bandTop: { position: 'absolute', top: 0, left: 0, right: 0, height: FRAME },
  bandBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, height: FRAME },
  bandLeft: { position: 'absolute', top: FRAME, bottom: FRAME, left: 0, width: FRAME },
  bandRight: { position: 'absolute', top: FRAME, bottom: FRAME, right: 0, width: FRAME },
  // Lifts the door out of the gasket without affecting layout.
  doorAssembly: {
    flex: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.35,
    shadowRadius: 2,
    elevation: 2,
  },
  door: {
    flex: 1,
    overflow: 'hidden',
  },
  // Inset supplements to the gradient rim; gradients remain the fallback.
  insetShading: {
    boxShadow: [...enamelInsetShadows],
  },
  // Soft top bloom: ~90% of the door width, ~22% of its height.
  bloom: {
    position: 'absolute',
    top: 0,
    left: '5%',
    right: '5%',
    height: '22%',
  },
  // Clipped by the door's own radii + overflow, so no per-corner radii here.
  rimTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 8,
  },
  rimTopBottom: {
    height: 6,
  },
  edgeLeft: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 6,
  },
  edgeRight: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: 8,
  },
  edgeBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 10,
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
  },
  handle: {
    position: 'absolute',
    left: 12,
    width: 13,
    // Unclipped shadow wrapper: cast shadows stay visible around the bar.
    boxShadow: [...handleShadows],
    elevation: 3,
  },
  handleTop: { bottom: 12, height: 110 },
  handleBottom: { top: 16, height: 130 },
  handleClip: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    borderRadius: 7,
    overflow: 'hidden',
    backgroundColor: '#8A99A3',
  },
  // Mounting feet: small dark pads behind the bar, near its ends.
  footTop: {
    position: 'absolute',
    top: 6,
    left: -2,
    width: 17,
    height: 12,
    borderRadius: 4,
    backgroundColor: 'rgba(0,0,0,0.45)',
    boxShadow: [
      { offsetX: 1, offsetY: 1, blurRadius: 2, color: 'rgba(0,0,0,0.5)' },
    ],
    elevation: 2,
  },
  footBottom: {
    position: 'absolute',
    bottom: 6,
    left: -2,
    width: 17,
    height: 12,
    borderRadius: 4,
    backgroundColor: 'rgba(0,0,0,0.45)',
    boxShadow: [
      { offsetX: 1, offsetY: 1, blurRadius: 2, color: 'rgba(0,0,0,0.5)' },
    ],
    elevation: 2,
  },
});
