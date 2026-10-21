import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  findNodeHandle,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, {
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';
import { colors, fonts } from '../theme';
import { useReduceMotion } from './Magnet';

/* eslint-disable react-hooks/refs -- gesture callbacks run off-render and intentionally touch shared values */

export type DoorPhase = 'closed' | 'moving' | 'open';

/** A window-coordinate rect where a door drag must not start (notes, magnets,
 *  header controls, handle strip). Owned by the board screen, checked at
 *  touch-down before the drag activates. */
export type DoorHitRect = { x: number; y: number; w: number; h: number };

/** Fully open angle: the face passes beyond edge-on, so the interior shows
 *  without mirrored notes (backface is hidden). */
const FULL_DEG = 100;
/** Drag distance mapping to a full swing: 80% of the compartment width. */
const DRAG_FRACTION = 0.8;
/** Horizontal travel that commits to a drag; vertical travel that fails it. */
const ACTIVATE_X = 10;
const FAIL_Y = 12;
/** Release settles open at or past half travel (after velocity projection). */
const RELEASE_AT = 0.5;
/** Small velocity projection on release. */
const FLING_K = 0.18;

const SPRING = { mass: 0.9, stiffness: 220, damping: 28, overshootClamping: true } as const;

/** 44pt handle touch target (the visible chrome stays slim). */
const HANDLE_W = 44;
/** Handle bands inside the leaf, matching the chrome bar each door carries. */
const HANDLE_BAND = { top: { fromBottom: true, size: 150 }, bottom: { fromBottom: false, size: 170 } } as const;
/** Swipe-left-to-close strip along the hinge (right) edge while open. */
const HINGE_STRIP_W = 48;

/**
 * TEMPORARY diagnostic bypass for a silent startup crash. When true the
 * scene renders the face statically (no detectors, no animated leaf) so a
 * single JS reload tells us whether the crash lives in DoorScene's
 * native output or elsewhere. Remove once diagnosed.
 */
const STATIC_FALLBACK = true;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Hit test: true when the touch-down point is on empty enamel. */
function hitIsEmpty(rects: DoorHitRect[], x: number, y: number): boolean {
  for (let i = 0; i < rects.length; i += 1) {
    const r = rects[i];
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return false;
  }
  return true;
}

/** Scene-local handle-strip rect, for the board's exclusion list. */
export function handleStripRect(
  scene: { x: number; y: number; w: number; h: number },
  band: 'top' | 'bottom',
): DoorHitRect {
  const b = HANDLE_BAND[band];
  return b.fromBottom
    ? { x: scene.x, y: scene.y + scene.h - b.size, w: HANDLE_W, h: b.size }
    : { x: scene.x, y: scene.y, w: HANDLE_W, h: b.size };
}

type SceneMetrics = { x: number; y: number; w: number; h: number };

type Props = {
  /** The complete door face (frame, enamel, notes, header). Rotates as one. */
  front: ReactNode;
  /** Spoken + test label for this door, e.g. "Top door". */
  label: string;
  /** Interior heading, e.g. "Top compartment". */
  compartmentLabel: string;
  /** Window-coordinate exclusion rects for the enamel swipe (UI thread). */
  exclusion: SharedValue<DoorHitRect[]>;
  /** Which end of the free (left) edge carries the handle band. */
  handleBand: 'top' | 'bottom';
  /** When true every door gesture is disabled (sheets, modals, note drags). */
  locked?: boolean;
  onOpened?: () => void;
  onClosed?: () => void;
  onPhaseChange?: (phase: DoorPhase) => void;
  /** Scene window rect + size, for drag mapping and exclusion math. */
  onSceneMetrics?: (m: SceneMetrics) => void;
  testID?: string;
};

/**
 * One openable fridge compartment. The `front` leaf rotates around the
 * RIGHT-hand hinge (positive Y rotation, transform origin at the right edge);
 * the compartment (shelves, lamp, Close) stays stationary behind it.
 *
 * Dragging is continuous and interruptible: grabbing mid-spring cancels the
 * spring and resumes from the live progress. Flicks project forward a little
 * and settle with a restrained spring. The interior lamp, wash and enamel
 * sheen all derive from the same progress value.
 *
 * The gesture receiver is a separate layer from the content wrappers, so
 * disabling door/interior interaction mid-drag never cancels the drag.
 * Like the board's note handlers, door gestures run explicitly on the JS
 * thread (`.runOnJS(true)`); the leaf rotation itself stays smooth because
 * it derives from a shared progress value on the UI thread. Only occasional
 * phase changes cross over, via `runOnJS` (safe from either thread).
 */
export function DoorScene({
  front,
  label,
  compartmentLabel,
  exclusion,
  handleBand,
  locked = false,
  onOpened,
  onClosed,
  onPhaseChange,
  onSceneMetrics,
  testID,
}: Props) {
  // 0 = shut, 1 = swung to FULL_DEG.
  const progress = useSharedValue(0);
  const committed = useSharedValue<0 | 1>(0);
  const sceneW = useSharedValue(0);
  const startProg = useSharedValue(0);
  const startAbsX = useSharedValue(0);
  const downX = useSharedValue(0);
  const downY = useSharedValue(0);
  const decided = useSharedValue(false);
  const blocked = useSharedValue(false);
  const dragging = useSharedValue(false);
  const released = useSharedValue(false);
  const movingSent = useSharedValue(false);
  const reduceUI = useSharedValue(false);

  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<DoorPhase>('closed');
  const reduceMotion = useReduceMotion();
  useEffect(() => {
    reduceUI.value = reduceMotion;
  }, [reduceMotion, reduceUI]);

  const handleRef = useRef<View | null>(null);
  const closeRef = useRef<View | null>(null);
  const cbRef = useRef({ onOpened, onClosed, onPhaseChange });
  useEffect(() => {
    cbRef.current = { onOpened, onClosed, onPhaseChange };
  });

  const focusNode = useCallback((ref: { current: View | null }) => {
    try {
      const node = ref.current ? findNodeHandle(ref.current) : null;
      if (node) AccessibilityInfo.setAccessibilityFocus(node);
    } catch {
      // Focus is a nicety; never break the settle path.
    }
  }, []);

  // JS-thread landing for a completed settle. Runs occasionally. Plain
  // functions (not useCallback): they only touch stable setState fns, refs
  // and shared values, so the gesture memo below never goes stale.
  const jsSettled = (target: 0 | 1) => {
    committed.value = target;
    movingSent.value = false;
    const isOpen = target === 1;
    setOpen(isOpen);
    setPhase(isOpen ? 'open' : 'closed');
    cbRef.current.onPhaseChange?.(isOpen ? 'open' : 'closed');
    if (isOpen) {
      cbRef.current.onOpened?.();
      focusNode(closeRef);
    } else {
      cbRef.current.onClosed?.();
      focusNode(handleRef);
    }
  };

  const jsMoving = () => {
    setPhase((prev) => {
      if (prev === 'moving') return prev;
      cbRef.current.onPhaseChange?.('moving');
      return 'moving';
    });
  };

  const metricsRef = useRef(onSceneMetrics);
  useEffect(() => {
    metricsRef.current = onSceneMetrics;
  });

  // Settle shared by every release path. Shared-value writes are safe from
  // the JS thread; the spring completion may land on either thread, so it
  // always crosses via runOnJS.
  const uiSettle = (target: 0 | 1, velocity: number) => {
    if (reduceUI.value) {
      progress.value = target;
      runOnJS(jsSettled)(target);
      return;
    }
    progress.value = withSpring(target, { ...SPRING, velocity }, (finished) => {
      if (finished) runOnJS(jsSettled)(target);
    });
  };

  const beginDrag = (absX: number) => {
    cancelAnimation(progress);
    startProg.value = progress.value;
    startAbsX.value = absX;
    if (!movingSent.value) {
      movingSent.value = true;
      runOnJS(jsMoving)();
    }
  };

  const dragDist = () => Math.max(1, sceneW.value * DRAG_FRACTION);

  // JS-thread open/close for the labelled buttons (tap the handle to open).
  const jsDrive = (target: 0 | 1) => {
    movingSent.value = true;
    setPhase('moving');
    cbRef.current.onPhaseChange?.('moving');
    if (reduceMotion) {
      progress.value = target;
      jsSettled(target);
      return;
    }
    progress.value = withSpring(target, { ...SPRING, velocity: 0 }, (finished) => {
      if (finished) runOnJS(jsSettled)(target);
    });
  };
  const jsOpen = () => jsDrive(1);
  const jsClose = () => jsDrive(0);

  const gestures = useMemo(() => {
    // Continuous drag shared by the handle strip, the enamel receiver and
    // the hinge strip. `gated` adds the empty-enamel touch-down check.
    const buildDragPan = (gated: boolean, enabled: boolean) => {
      // Explicit JS thread, matching BoardNote/MagnetLayer: the callbacks
      // were otherwise falling back with a "none are worklets" warning.
      const pan = Gesture.Pan().enabled(enabled).runOnJS(true);
      if (gated) {
        pan.manualActivation(true);
        pan.onTouchesDown((e, sm) => {
          if (dragging.value) return;
          const t = e.changedTouches[0];
          if (!t) {
            sm.fail();
            return;
          }
          decided.value = false;
          released.value = false;
          downX.value = t.x;
          downY.value = t.y;
          startAbsX.value = t.absoluteX;
          blocked.value = !hitIsEmpty(exclusion.value, t.x, t.y);
          if (blocked.value) sm.fail();
        });
        pan.onTouchesMove((e, sm) => {
          if (dragging.value || decided.value || blocked.value) return;
          const t = e.allTouches[0] ?? e.changedTouches[0];
          if (!t) return;
          const dx = Math.abs(t.x - downX.value);
          const dy = Math.abs(t.y - downY.value);
          if (dx >= ACTIVATE_X && dx > dy) {
            decided.value = true;
            dragging.value = true;
            beginDrag(t.absoluteX);
            sm.activate();
          } else if (dy >= FAIL_Y) {
            decided.value = true;
            sm.fail();
          }
        });
      } else {
        pan.activeOffsetX([-ACTIVATE_X, ACTIVATE_X]);
        pan.failOffsetY([-FAIL_Y, FAIL_Y]);
        pan.onStart((e) => {
          released.value = false;
          dragging.value = true;
          beginDrag(e.absoluteX);
        });
      }
      pan.onUpdate((e) => {
        progress.value = clamp01(startProg.value + (e.absoluteX - startAbsX.value) / dragDist());
      });
      pan.onEnd((e, success) => {
        if (!success) return;
        released.value = true;
        const dd = dragDist();
        const projected = progress.value + (e.velocityX / dd) * FLING_K;
        uiSettle(projected >= RELEASE_AT ? 1 : 0, e.velocityX / dd);
      });
      // A cancelled touch returns to the last committed state — but never
      // double-settle after a successful release.
      pan.onFinalize(() => {
        dragging.value = false;
        decided.value = false;
        if (released.value) return;
        uiSettle(committed.value, 0);
      });
      return pan;
    };

    const enamelPan = buildDragPan(true, !open && !locked);
    const handlePan = buildDragPan(false, !open && !locked);
    const hingePan = buildDragPan(false, open && !locked);
    return { enamelPan, handlePan, hingePan };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- shared values + stable closures
  }, [open, locked, exclusion]);

  // Right-hand hinge, positive Y: the free (left) edge swings out past
  // edge-on to FULL_DEG, revealing the stationary compartment.
  const leafStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 1100 }, { rotateY: `${progress.value * FULL_DEG}deg` }],
  }));
  // Interior lamp wash driven by the same progress: cracking the door
  // (~2.5%) starts the light, full brightness lands around 12%.
  const washStyle = useAnimatedStyle(() => {
    const l = clamp01((progress.value - 0.025) / 0.1);
    return { opacity: l * 0.55 };
  });
  const darkStyle = useAnimatedStyle(() => {
    const l = clamp01((progress.value - 0.025) / 0.1);
    return { opacity: (1 - l) * 0.62 };
  });
  const lampStyle = useAnimatedStyle(() => {
    const l = clamp01((progress.value - 0.025) / 0.1);
    return { opacity: 0.25 + l * 0.75 };
  });
  // Enamel reflection breathes slightly with the swing.
  const sheenStyle = useAnimatedStyle(() => ({ opacity: progress.value * 0.12 }));

  const band = HANDLE_BAND[handleBand];
  const frontInteractive = phase === 'closed';
  const interiorInteractive = phase === 'open';

  // Hooks above must keep running in the same order; only the native
  // output is bypassed.
  if (STATIC_FALLBACK) {
    return (
      <View style={styles.scene} testID={testID}>
        {front}
        {/* Visible proof of which code is running (stale-bundle check). */}
        <View style={styles.safeBadge} pointerEvents="none">
          <Text style={styles.safeBadgeText}>SAFE MODE</Text>
        </View>
      </View>
    );
  }

  return (
    <View
      style={styles.scene}
      testID={testID}
      onLayout={(e) => {
        const { width } = e.nativeEvent.layout;
        sceneW.value = width;
        try {
          const node = e.currentTarget as unknown as {
            measureInWindow?: (cb: (x: number, y: number, w: number, h: number) => void) => void;
          } | null;
          node?.measureInWindow?.((x, y, w, h) => {
            metricsRef.current?.({ x, y, w, h });
          });
        } catch {
          metricsRef.current?.({ x: 0, y: 0, w: width, h: 0 });
        }
      }}
    >
      {/* Stationary compartment behind the leaf. */}
      <View
        style={styles.cavity}
        pointerEvents={interiorInteractive ? 'auto' : 'none'}
        importantForAccessibility={interiorInteractive ? 'auto' : 'no-hide-descendants'}
        accessibilityElementsHidden={!interiorInteractive}
      >
        <View style={styles.cavityInner}>
          <Animated.View style={[styles.lamp, lampStyle]} pointerEvents="none" />
          <Text
            style={styles.cavityTitle}
            accessibilityRole="header"
            accessibilityLabel={compartmentLabel}
          >
            {compartmentLabel}
          </Text>
          <Text style={styles.cavitySub}>Door bins</Text>
          {[0, 1, 2].map((i) => (
            <View key={i} style={styles.shelf} pointerEvents="none">
              <View style={styles.shelfEdge} />
            </View>
          ))}
          <Animated.View style={[StyleSheet.absoluteFill, styles.wash, washStyle]} pointerEvents="none" />
          <Animated.View style={[StyleSheet.absoluteFill, styles.dark, darkStyle]} pointerEvents="none" />
        </View>
      </View>

      {/* Rotating leaf: the complete door face. Surface clipping stays here. */}
      <Animated.View style={[StyleSheet.absoluteFill, styles.leafHinge, leafStyle]}>
        <View
          style={styles.leafClip}
          pointerEvents={frontInteractive ? 'auto' : 'none'}
          importantForAccessibility={frontInteractive ? 'auto' : 'no-hide-descendants'}
          accessibilityElementsHidden={!frontInteractive}
        >
          {front}
          <Animated.View style={[StyleSheet.absoluteFill, styles.sheen, sheenStyle]} pointerEvents="none" />
        </View>
        {/* 44pt handle touch target over the slim chrome bar. */}
        {!open ? (
          <GestureDetector gesture={gestures.handlePan}>
            <Pressable
              ref={handleRef}
              onPress={jsOpen}
              style={[
                styles.handleHit,
                band.fromBottom ? styles.handleBottom : styles.handleTop,
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Open ${label}`}
              accessibilityHint="Drag right or tap to swing the door open"
              accessibilityState={{ expanded: false }}
              testID={testID ? `${testID}-handle` : undefined}
            />
          </GestureDetector>
        ) : null}
      </Animated.View>

      {/* Stationary close affordances while open, clear of the bins. */}
      {open ? (
        <View style={styles.closeLayer} pointerEvents="box-none">
          <GestureDetector gesture={gestures.hingePan}>
            <View style={styles.hingeStrip} testID={testID ? `${testID}-hinge` : undefined} />
          </GestureDetector>
          <Pressable
            ref={closeRef}
            onPress={jsClose}
            style={styles.closeBtn}
            accessibilityRole="button"
            accessibilityLabel={`Close ${label}`}
            accessibilityHint="Snap the door shut"
            testID={testID ? `${testID}-close` : undefined}
          >
            <MaterialCommunityIcons name="close" size={16} color={colors.white} />
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
        </View>
      ) : null}

      {/* Enamel swipe receiver: separate layer, box-none so notes, magnets
          and scrolling keep their touches; the manual gate fails fast on
          anything but empty enamel. */}
      {!open ? (
        <GestureDetector gesture={gestures.enamelPan}>
          <View style={StyleSheet.absoluteFill} pointerEvents="box-none" />
        </GestureDetector>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // The scene must allow the rotating leaf its overflow; the leaf itself
  // keeps the surface clipping. The phone viewport still clips at the root.
  scene: { flex: 1 },
  cavity: { ...StyleSheet.absoluteFill },
  cavityInner: {
    flex: 1,
    backgroundColor: colors.interior.cavity,
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 14,
    overflow: 'hidden',
  },
  lamp: {
    alignSelf: 'center',
    width: 64,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.interior.lamp,
    marginBottom: 8,
  },
  cavityTitle: {
    fontFamily: fonts.ui.extraBold,
    fontSize: 15,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: colors.interior.ink,
  },
  cavitySub: {
    fontFamily: fonts.ui.regular,
    fontSize: 12,
    color: colors.interior.inkSoft,
    marginBottom: 10,
  },
  shelf: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingBottom: 12,
  },
  shelfEdge: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.interior.shelf,
    borderWidth: 1,
    borderColor: colors.interior.shelfEdge,
  },
  wash: { backgroundColor: colors.interior.wash },
  dark: { backgroundColor: colors.interior.scrim },
  // Right-hand hinge geometry: the leaf pivots around its right edge with a
  // positive Y rotation; past edge-on the hidden backface yields to the bay.
  leafHinge: {
    transformOrigin: ['100%', '50%', 0],
    backfaceVisibility: 'hidden',
  },
  leafClip: { flex: 1, overflow: 'hidden' },
  sheen: { backgroundColor: colors.white },
  handleHit: {
    position: 'absolute',
    left: 0,
    width: HANDLE_W,
    backgroundColor: 'transparent',
  },
  handleTop: { top: 0, height: HANDLE_BAND.bottom.size },
  handleBottom: { bottom: 0, height: HANDLE_BAND.top.size },
  closeLayer: { ...StyleSheet.absoluteFill },
  hingeStrip: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: HINGE_STRIP_W,
    backgroundColor: 'transparent',
    borderRightWidth: 3,
    borderRightColor: 'rgba(255,255,255,0.35)',
  },
  closeBtn: {
    position: 'absolute',
    top: 12,
    right: HINGE_STRIP_W + 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  closeText: { fontFamily: fonts.ui.bold, fontSize: 13, color: colors.white },
  safeBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: colors.danger,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    zIndex: 999,
  },
  safeBadgeText: {
    fontFamily: fonts.ui.bold,
    fontSize: 11,
    color: colors.white,
  },
});
