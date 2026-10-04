import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { colors } from '../theme';
import { MagnetArt } from './MagnetArt';
import { liftTo, useReduceMotion } from './Magnet';
import { BoardLayout } from '../utils/layout';
import { Magnet, PackArt } from '../types';

/** Reference size of a magnet in points (PRD M-8 says 56; tuned up to read
 *  chunky on the board like the design mockups). */
export const MAGNET_SIZE = 100;

type Pos = { x: number; y: number };

/** Where a magnet's centre sits, in canvas px. */
export function magnetCentre(
  m: Magnet,
  layout: BoardLayout,
  boardW: number,
  scale: number,
): Pos {
  if (m.itemId) {
    const p = layout.get(m.itemId);
    if (p) {
      return { x: (p.x + m.x * p.w) * boardW, y: (p.y + m.y) * scale };
    }
  }
  return { x: m.x * boardW, y: m.y * scale };
}

/** Inverse of `magnetCentre`: canvas px → stored coordinates, attaching to a
 *  note when the drop centre lands inside one (M-4). */
export function magnetDropTarget(
  cx: number,
  cy: number,
  layout: BoardLayout,
  boardW: number,
  scale: number,
): { x: number; y: number; itemId: string | null } {
  const rx = cx / boardW;
  const ry = cy / scale;
  let attached: string | null = null;
  layout.forEach((p, id) => {
    if (attached === null && rx >= p.x && rx <= p.x + p.w && ry >= p.y && ry <= p.y + p.h) {
      attached = id;
    }
  });
  if (attached) {
    const p = layout.get(attached)!;
    return {
      itemId: attached,
      x: Math.min(1, Math.max(0, (rx - p.x) / p.w)),
      y: ry - p.y,
    };
  }
  return { itemId: null, x: Math.min(1, Math.max(0, rx)), y: Math.max(0, ry) };
}

type LayerProps = {
  magnets: Magnet[];
  artById: Map<string, PackArt>;
  layout: BoardLayout;
  boardW: number;
  scale: number;
  /** Decorate mode reveals the × on every removable magnet at once. */
  decorate: boolean;
  /** Whether the current user may remove this magnet (placer or owner). */
  canRemove: (m: Magnet) => boolean;
  onMove: (m: Magnet, x: number, y: number, itemId: string | null) => void;
  onRemove: (m: Magnet) => void;
  onTap: (m: Magnet) => void;
  onOpenUnder: (itemId: string) => void;
  onDraggingChange?: (dragging: boolean) => void;
};

/**
 * Renders every magnet for a board inside its canvas, above the notes (M-3).
 * Interaction: a tap selects a magnet and reveals its × (removal is
 * placer/owner only, M-10); a long-press lifts and drags it (M-2); a
 * long-press without moving opens the note underneath. In decorate mode every
 * removable magnet shows its × at once.
 */
export function MagnetLayer({
  magnets,
  artById,
  layout,
  boardW,
  scale,
  decorate,
  canRemove,
  onMove,
  onRemove,
  onTap,
  onOpenUnder,
  onDraggingChange,
}: LayerProps) {
  const size = MAGNET_SIZE * scale;
  const sorted = useMemo(() => [...magnets].sort((a, b) => a.z - b.z), [magnets]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const reduceMotion = useReduceMotion();

  const handleDropCanvas = (m: Magnet, cx: number, cy: number) => {
    const t = magnetDropTarget(cx, cy, layout, boardW, scale);
    onMove(m, t.x, t.y, t.itemId);
  };
  const handleTap = (m: Magnet) => {
    if (canRemove(m)) setSelectedId((prev) => (prev === m.id ? null : m.id));
    else onTap(m);
  };
  const handleLongPress = (m: Magnet) => {
    if (m.itemId) onOpenUnder(m.itemId);
    else if (canRemove(m)) setSelectedId((prev) => (prev === m.id ? null : m.id));
  };
  const handleRemove = (m: Magnet) => {
    setSelectedId(null);
    onRemove(m);
  };
  const handleDragStart = () => setSelectedId(null);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {boardW > 0
        ? sorted.map((m) => (
            <MagnetItem
              key={m.id}
              magnet={m}
              art={artById.get(m.artId) ?? null}
              centre={magnetCentre(m, layout, boardW, scale)}
              size={size}
              selected={selectedId === m.id}
              showRemove={canRemove(m) && (decorate || selectedId === m.id)}
              reduceMotion={reduceMotion}
              onDropCanvas={handleDropCanvas}
              onRemove={handleRemove}
              onTap={handleTap}
              onLongPress={handleLongPress}
              onDragStart={handleDragStart}
              onDraggingChange={onDraggingChange}
            />
          ))
        : null}
    </View>
  );
}

type ItemProps = {
  magnet: Magnet;
  art: PackArt | null;
  centre: Pos;
  size: number;
  selected: boolean;
  showRemove: boolean;
  reduceMotion: boolean;
  onDropCanvas: (m: Magnet, cx: number, cy: number) => void;
  onRemove: (m: Magnet) => void;
  onTap: (m: Magnet) => void;
  onLongPress: (m: Magnet) => void;
  onDragStart: (m: Magnet) => void;
  onDraggingChange?: (dragging: boolean) => void;
};

function MagnetItem({
  magnet,
  art,
  centre,
  size,
  selected,
  showRemove,
  reduceMotion,
  onDropCanvas,
  onRemove,
  onTap,
  onLongPress,
  onDragStart,
  onDraggingChange,
}: ItemProps) {
  const posX = useSharedValue(centre.x);
  const posY = useSharedValue(centre.y);
  const lift = useSharedValue(0);
  // 60 ms drop squash (vertical only); Reduce Motion skips it.
  const squash = useSharedValue(1);
  const startX = useRef(centre.x);
  const startY = useRef(centre.y);
  const draggingRef = useRef(false);
  const props = useRef({
    magnet,
    onDropCanvas,
    onRemove,
    onTap,
    onLongPress,
    onDragStart,
    onDraggingChange,
    reduceMotion,
  });
  useEffect(() => {
    props.current = {
      magnet,
      onDropCanvas,
      onRemove,
      onTap,
      onLongPress,
      onDragStart,
      onDraggingChange,
      reduceMotion,
    };
  });

  // Follow the layout unless the magnet is in hand.
  useEffect(() => {
    if (draggingRef.current) return;
    posX.value = withTiming(centre.x, { duration: 180 });
    posY.value = withTiming(centre.y, { duration: 180 });
  }, [centre.x, centre.y, posX, posY]);

  const gesture = useMemo(() => {
    const pan = Gesture.Pan()
      .runOnJS(true)
      // A deliberate hold lifts the magnet; a quick tap selects instead.
      .activateAfterLongPress(240)
      // eslint-disable-next-line react-hooks/refs -- gesture callbacks run off-render
      .onStart(() => {
        draggingRef.current = true;
        startX.current = posX.value;
        startY.current = posY.value;
        liftTo(lift, 1, props.current.reduceMotion);
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        props.current.onDragStart?.(props.current.magnet);
        props.current.onDraggingChange?.(true);
      })
      // eslint-disable-next-line react-hooks/refs -- gesture callbacks run off-render
      .onUpdate((e) => {
        // eslint-disable-next-line react-hooks/immutability -- shared values are motion state
        posX.value = startX.current + e.translationX;
        // eslint-disable-next-line react-hooks/immutability -- shared values are motion state
        posY.value = startY.current + e.translationY;
      })
      // eslint-disable-next-line react-hooks/refs -- gesture callbacks run off-render
      .onFinalize(() => {
        if (!draggingRef.current) return;
        draggingRef.current = false;
        liftTo(lift, 0, props.current.reduceMotion);
        props.current.onDraggingChange?.(false);
        const moved = Math.abs(posX.value - startX.current) + Math.abs(posY.value - startY.current);
        if (moved < 4) {
          props.current.onLongPress?.(props.current.magnet);
          return;
        }
        // The 60 ms snap squash + a light haptic on drop.
        if (!props.current.reduceMotion) {
          // eslint-disable-next-line react-hooks/immutability -- shared values are motion state
          squash.value = withSequence(
            withTiming(0.9, { duration: 60 }),
            withSpring(1, { damping: 12, stiffness: 260 }),
          );
        }
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        props.current.onDropCanvas(props.current.magnet, posX.value, posY.value);
      });

    const tap = Gesture.Tap()
      .runOnJS(true)
      // eslint-disable-next-line react-hooks/refs -- gesture callbacks run off-render
      .onEnd((_e, success) => {
        if (!success) return;
        const current = props.current;
        setTimeout(() => current.onTap(current.magnet), 0);
      });

    return Gesture.Race(pan, tap);
  }, [lift, posX, posY, squash]);

  const itemStyle = useAnimatedStyle(() => ({
    left: posX.value - size / 2,
    top: posY.value - size / 2,
    transform: [{ scale: selected ? 1.12 : 1 }, { scaleY: squash.value }],
  }), [selected, size]);

  return (
    <Animated.View
      style={[styles.item, { width: size, height: size, zIndex: magnet.z }, itemStyle]}
      pointerEvents="box-none"
    >
      <GestureDetector gesture={gesture}>
        <Animated.View accessible accessibilityRole="button" accessibilityHint="Tap to select, hold to move">
          <MagnetArt art={art} size={size} rotation={magnet.rotation} lift={lift} label={art?.label} />
        </Animated.View>
      </GestureDetector>
      {showRemove ? (
        <Pressable
          onPress={() => onRemove(magnet)}
          hitSlop={10}
          style={styles.removeBtn}
          accessibilityRole="button"
          accessibilityLabel="Take this magnet off"
        >
          <MaterialCommunityIcons name="close" size={13} color={colors.white} />
        </Pressable>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  item: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  removeBtn: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.white,
  },
});
