import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { ItemWithAuthor, ListEntry } from '../types';
import { NotePaper } from './NotePaper';

type Props = {
  item: ItemWithAuthor;
  left: number;
  top: number;
  width: number;
  /** Floor for the paper's rendered height. */
  minHeight?: number;
  rotation: number;
  animateIn?: boolean;
  entries: ListEntry[];
  photoUrl?: string | null;
  onPress: (item: ItemWithAuthor) => void;
  onToggleEntry?: (entry: ListEntry) => void;
  /** A note was picked up and is following the finger. */
  onDragStart?: (item: ItemWithAuthor) => void;
  /** The held note moved; `screenY` is the finger's position in the window. */
  onDragUpdate?: (item: ItemWithAuthor, screenY: number) => void;
  /** Called on drop with the note's new top-left corner, in canvas pixels. */
  onMove?: (item: ItemWithAuthor, left: number, top: number) => void;
  /** A drag ended without a real move (e.g. a long-press in place), so the
   *  board can hide the delete zone. `onMove` is not called on this path. */
  onDragEnd?: (item: ItemWithAuthor) => void;
  /** Reports the note's rendered height so the layout reserves enough room. */
  onMeasure?: (id: string, heightPx: number) => void;
  /** Bumped by the board when a drop wasn't persisted, to snap the note back. */
  resetKey?: number;
};

/** How long a note must be held before it can be picked up and dragged. */
const LIFT_MS = 260;

/**
 * A pinned paper. A quick tap opens it; holding picks it up and drags it,
 * reporting the drop point so the board can persist the new spot. List rows
 * can be ticked right on the board.
 *
 * The gesture callbacks run on the JS thread (`.runOnJS(true)`) — Reanimated
 * is present, so without it they'd be workletized and calling React state
 * there crashes the native app.
 */
export function BoardNote({
  item,
  left,
  top,
  width,
  minHeight,
  rotation,
  animateIn = false,
  entries,
  photoUrl,
  onPress,
  onToggleEntry,
  onDragStart,
  onDragUpdate,
  onMove,
  onDragEnd,
  onMeasure,
  resetKey = 0,
}: Props) {
  const [enter] = useState(() => new Animated.Value(animateIn ? 0 : 1));
  const [posX] = useState(() => new Animated.Value(left));
  const [posY] = useState(() => new Animated.Value(top));
  const [lift] = useState(() => new Animated.Value(0));
  const [dragging, setDragging] = useState(false);

  const draggingRef = useRef(false);
  const posRef = useRef({ x: left, y: top });
  const startRef = useRef({ x: left, y: top });

  // Latest props for the (stable) gesture callbacks.
  const handlers = useRef({ item, onPress, onMove, onDragEnd, onDragStart, onDragUpdate, left, top });
  useEffect(() => {
    handlers.current = { item, onPress, onMove, onDragEnd, onDragStart, onDragUpdate, left, top };
  });

  // Follow the layout unless the note is in hand (so a saved position settles
  // back through `left`/`top` without a jump).
  useEffect(() => {
    posRef.current = { x: left, y: top };
    if (draggingRef.current) return;
    Animated.timing(posX, { toValue: left, duration: 220, useNativeDriver: false }).start();
    Animated.timing(posY, { toValue: top, duration: 220, useNativeDriver: false }).start();
  }, [left, top, posX, posY]);

  // A drop that wasn't persisted (e.g. a failed delete) bumps resetKey so the
  // note animates back to its stored spot instead of staying under the finger.
  useEffect(() => {
    if (resetKey === 0 || draggingRef.current) return;
    posRef.current = { x: left, y: top };
    Animated.timing(posX, { toValue: left, duration: 200, useNativeDriver: false }).start();
    Animated.timing(posY, { toValue: top, duration: 200, useNativeDriver: false }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to the bump
  }, [resetKey]);

  useEffect(() => {
    if (!animateIn) return;
    Animated.spring(enter, { toValue: 1, friction: 7, tension: 80, useNativeDriver: false }).start();
  }, [animateIn, enter]);

  const gesture = useMemo(() => {
    const pan = Gesture.Pan()
      .runOnJS(true)
      .activateAfterLongPress(LIFT_MS)
      // eslint-disable-next-line react-hooks/refs -- gesture callbacks run off-render
      .onStart(() => {
        draggingRef.current = true;
        startRef.current = { ...posRef.current };
        setDragging(true);
        Animated.spring(lift, { toValue: 1, friction: 7, tension: 90, useNativeDriver: false }).start();
        handlers.current.onDragStart?.(handlers.current.item);
      })
      // eslint-disable-next-line react-hooks/refs -- gesture callbacks run off-render
      .onUpdate((e) => {
        const x = startRef.current.x + e.translationX;
        const y = startRef.current.y + e.translationY;
        posRef.current = { x, y };
        posX.setValue(x);
        posY.setValue(y);
        handlers.current.onDragUpdate?.(handlers.current.item, e.absoluteY);
      })
      // eslint-disable-next-line react-hooks/refs -- gesture callbacks run off-render
      .onFinalize(() => {
        if (!draggingRef.current) return;
        draggingRef.current = false;
        setDragging(false);
        Animated.spring(lift, { toValue: 0, friction: 7, tension: 90, useNativeDriver: false }).start();
        const movedX = Math.abs(posRef.current.x - startRef.current.x);
        const movedY = Math.abs(posRef.current.y - startRef.current.y);
        if (movedX < 4 && movedY < 4) {
          // A long-press without a real drag: don't persist a position, but
          // still tell the board the drag ended so it hides the delete zone.
          Animated.timing(posX, {
            toValue: handlers.current.left,
            duration: 180,
            useNativeDriver: false,
          }).start();
          Animated.timing(posY, {
            toValue: handlers.current.top,
            duration: 180,
            useNativeDriver: false,
          }).start();
          handlers.current.onDragEnd?.(handlers.current.item);
          return;
        }
        handlers.current.onMove?.(handlers.current.item, posRef.current.x, posRef.current.y);
      });

    const tap = Gesture.Tap()
      .runOnJS(true)
      .maxDuration(LIFT_MS)
      // eslint-disable-next-line react-hooks/refs -- gesture callbacks run off-render
      .onEnd((_e, success) => {
        if (!success) return;
        // Defer out of the gesture callback so the re-render it causes lands
        // after the native gesture has fully finished.
        const current = handlers.current;
        setTimeout(() => current.onPress(current.item), 0);
      });

    return Gesture.Race(pan, tap);
  }, [posX, posY, lift]);

  const enterTranslateY = enter.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] });
  const enterScale = enter.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] });
  const liftScale = lift.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });

  return (
    <Animated.View
      style={[
        styles.pin,
        {
          // All values are JS-driven (useNativeDriver: false): the native
          // driver rejects layout props like `left`/`top` (even constants), so
          // the note is positioned with animated left/top on the JS thread.
          left: posX,
          top: posY,
          width,
          opacity: enter,
          zIndex: dragging ? 20 : 0,
          transform: [
            { translateY: enterTranslateY },
            { scale: enterScale },
            { scale: liftScale },
            { rotate: `${rotation}deg` },
          ],
        },
      ]}
      onLayout={(e) => onMeasure?.(item.id, e.nativeEvent.layout.height)}
    >
      <GestureDetector gesture={gesture}>
        <Animated.View>
          <NotePaper
            item={item}
            minHeight={minHeight}
            entries={entries}
            photoUrl={photoUrl}
            onToggleEntry={onToggleEntry}
          />
        </Animated.View>
      </GestureDetector>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pin: { position: 'absolute' },
});
