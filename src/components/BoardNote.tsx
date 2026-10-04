import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
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
  /** The held note moved; `screenX`/`screenY` is the finger's position in the
   *  window, `canvasX`/`canvasY` the note's new top-left corner in canvas px. */
  onDragUpdate?: (
    item: ItemWithAuthor,
    screenX: number,
    screenY: number,
    canvasX: number,
    canvasY: number,
  ) => void;
  /** Called on drop with the note's new top-left corner, in canvas pixels. */
  onMove?: (item: ItemWithAuthor, left: number, top: number) => void;
  /** A drag ended without a real move (e.g. a long-press in place), so the
   *  board can hide the delete zone. `onMove` is not called on this path. */
  onDragEnd?: (item: ItemWithAuthor) => void;
  /** True for a just-posted note being revealed: replay the entrance pop as
   *  the reveal scroll lands (the mount animation plays behind the closing
   *  composer sheet, so without this the user never sees it). */
  spotlight?: boolean;
  /** Reports the note's rendered height so the layout reserves enough room. */
  onMeasure?: (id: string, heightPx: number) => void;
  /** Bumped by the board when a drop wasn't persisted, to snap the note back. */
  resetKey?: number;
  /** Shared slot the board uses to keep the held note glued to the finger
   *  while it auto-scrolls underneath. The active note registers an adjust
   *  fn on pick-up (cleared on drop); the board calls it with each
   *  programmatic scroll delta so canvas position tracks the finger. */
  adjustRef?: { current: ((dy: number) => void) | null };
};

/** How long a note must be held before it can be picked up and dragged. */
const LIFT_MS = 260;

/** Screen-reader description for a board note, so a note is a labelled,
 *  activatable element rather than an unlabelled gesture target. */
function noteAccessibilityLabel(item: ItemWithAuthor, entries: ListEntry[]): string {
  switch (item.type) {
    case 'note': {
      const body = (item.body ?? '').trim();
      const short = body.length > 80 ? `${body.slice(0, 80)}…` : body;
      return item.author?.displayName
        ? `Note by ${item.author.displayName}: ${short}`
        : `Note: ${short}`;
    }
    case 'list': {
      const done = entries.filter((e) => e.checkedAt).length;
      return `List: ${item.title ?? 'Untitled'}, ${done} of ${entries.length} done`;
    }
    case 'date':
      return `Date: ${item.title ?? 'Untitled'}`;
    case 'photo':
      return item.body ? `Photo: ${item.body}` : 'Photo';
    default:
      return 'Post';
  }
}

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
  adjustRef,
  spotlight = false,
}: Props) {
  const [enter] = useState(() => new Animated.Value(animateIn ? 0 : 1));
  const [posX] = useState(() => new Animated.Value(left));
  const [posY] = useState(() => new Animated.Value(top));
  const [lift] = useState(() => new Animated.Value(0));
  const [dragging, setDragging] = useState(false);

  const draggingRef = useRef(false);
  const posRef = useRef({ x: left, y: top });
  const startRef = useRef({ x: left, y: top });

  // Keeps the held note under the finger while the board auto-scrolls:
  // every programmatic scroll delta shifts both the live position and the
  // gesture start, so the next onUpdate (start + translation) still holds
  // the accumulated scroll. Registered only while this note is in hand.
  const adjustFn = useMemo(() => {
    return (dy: number) => {
      startRef.current.y += dy;
      posRef.current.y = Math.max(0, posRef.current.y + dy);
      posY.setValue(posRef.current.y);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stable per note instance
  }, []);

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
    Animated.spring(enter, { toValue: 1, friction: 6, tension: 70, useNativeDriver: false }).start();
  }, [animateIn, enter]);

  // A just-posted note mounts while the composer sheet is still closing, so
  // its mount pop plays unseen behind the sheet. Replay it once as the
  // reveal scroll lands, timed just after BoardSection's 250ms scroll kick.
  const spotlitRef = useRef(false);
  useEffect(() => {
    if (!spotlight || spotlitRef.current) return;
    spotlitRef.current = true;
    const t = setTimeout(() => {
      enter.setValue(0);
      Animated.spring(enter, {
        toValue: 1,
        friction: 6,
        tension: 70,
        useNativeDriver: false,
      }).start();
    }, 450);
    return () => clearTimeout(t);
  }, [spotlight, enter]);

  const gesture = useMemo(() => {
    const pan = Gesture.Pan()
      .runOnJS(true)
      .activateAfterLongPress(LIFT_MS)
      // eslint-disable-next-line react-hooks/refs -- gesture callbacks run off-render
      .onStart(() => {
        draggingRef.current = true;
        startRef.current = { ...posRef.current };
        if (adjustRef) adjustRef.current = adjustFn;
        setDragging(true);
        Animated.spring(lift, { toValue: 1, friction: 7, tension: 90, useNativeDriver: false }).start();
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        handlers.current.onDragStart?.(handlers.current.item);
      })
      // eslint-disable-next-line react-hooks/refs -- gesture callbacks run off-render
      .onUpdate((e) => {
        const x = startRef.current.x + e.translationX;
        // Never let a held note cross the divider into the pinned strip:
        // clamp its top edge to the section's top.
        const y = Math.max(0, startRef.current.y + e.translationY);
        posRef.current = { x, y };
        posX.setValue(x);
        posY.setValue(y);
        handlers.current.onDragUpdate?.(handlers.current.item, e.absoluteX, e.absoluteY, x, y);
      })
      // eslint-disable-next-line react-hooks/refs -- gesture callbacks run off-render
      .onFinalize(() => {
        if (!draggingRef.current) return;
        draggingRef.current = false;
        if (adjustRef?.current === adjustFn) adjustRef.current = null;
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
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
  }, [posX, posY, lift, adjustFn, adjustRef]);

  const enterTranslateY = enter.interpolate({ inputRange: [0, 1], outputRange: [-24, 0] });
  const enterScale = enter.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] });
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
        <Animated.View
          accessible
          accessibilityRole="button"
          testID="note-card"
          accessibilityLabel={noteAccessibilityLabel(item, entries)}
          accessibilityHint="Opens the post"
          accessibilityActions={[{ name: 'activate', label: 'Open post' }]}
          onAccessibilityAction={(e) => {
            if (e.nativeEvent.actionName === 'activate') onPress(item);
          }}
          onAccessibilityTap={() => onPress(item)}
        >
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
