import { useEffect, useState } from 'react';
import { AccessibilityInfo, StyleSheet, View, type ImageSourcePropType } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { Image } from 'expo-image';

export type MagnetProps = {
  /** Baked body webp (with the 3D lighting). */
  body: ImageSourcePropType;
  /** Baked shadow webp (silhouette; the app offsets it). */
  shadow: ImageSourcePropType;
  /** Reference size in points (PRD M-8). Default 56. */
  size?: number;
  /** Degrees, default 0; clamped to ±15. */
  rotation?: number;
  /** 0 = resting on the door, 1 = picked up. */
  lift: SharedValue<number>;
  /** e.g. "Torii gate magnet, from Lily". */
  accessibilityLabel: string;
};

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

/**
 * A single baked magnet (docs/plan-magnets.md §4). Two stacked layers in a
 * size×size box, shadow first:
 *
 *                     resting (lift 0)      picked up (lift 1)
 *   shadow translate   (1.5, 3) × size/56    (6, 14) × size/56
 *   shadow scale       1.0                   1.12
 *   shadow opacity     0.50                  0.30
 *   body translateY    0                     −6 × size/56
 *   body scale         1.0                   1.18
 *
 * Rotation is applied to the body only, so the light (and its shadow) stays
 * top-left whatever the magnet's angle. Everything is interpolated inside
 * `useAnimatedStyle` against the shared `lift` value the parent drives.
 */
export function Magnet({
  body,
  shadow,
  size = 56,
  rotation = 0,
  lift,
  accessibilityLabel,
}: MagnetProps) {
  const r = clamp(rotation, -15, 15);
  const k = size / 56;

  const shadowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(lift.value, [0, 1], [0.5, 0.3]),
    transform: [
      { translateX: interpolate(lift.value, [0, 1], [1.5 * k, 6 * k]) },
      { translateY: interpolate(lift.value, [0, 1], [3 * k, 14 * k]) },
      { scale: interpolate(lift.value, [0, 1], [1, 1.12]) },
    ],
  }));

  const bodyStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(lift.value, [0, 1], [0, -6 * k]) },
      { scale: interpolate(lift.value, [0, 1], [1, 1.18]) },
      { rotate: `${r}deg` },
    ],
  }));

  return (
    <View
      style={{ width: size, height: size }}
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
    >
      <Animated.View style={[StyleSheet.absoluteFill, shadowStyle]} pointerEvents="none">
        <Image
          source={shadow}
          style={StyleSheet.absoluteFill}
          contentFit="contain"
          cachePolicy="disk"
          accessible={false}
        />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, bodyStyle]} pointerEvents="none">
        <Image
          source={body}
          style={StyleSheet.absoluteFill}
          contentFit="contain"
          cachePolicy="disk"
          accessible={false}
        />
      </Animated.View>
    </View>
  );
}

/**
 * Drive the `lift` shared value. Springs on pick-up/drop normally; when the
 * system Reduce Motion setting is on, a short fade-only timing is used instead.
 */
export function liftTo(lift: SharedValue<number>, to: 0 | 1, reduceMotion: boolean): void {
  if (reduceMotion) {
    lift.value = withTiming(to, { duration: 120 });
    return;
  }
  lift.value = to === 1 ? withSpring(1) : withSpring(0, { damping: 12, stiffness: 260 });
}

/** Reactive Reduce Motion flag (React Native's AccessibilityInfo). */
export function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      if (alive) setReduce(v);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  return reduce;
}
