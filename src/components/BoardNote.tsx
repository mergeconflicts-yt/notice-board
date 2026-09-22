import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { NoteWithAuthor } from '../types';
import { NotePaper } from './NotePaper';

type Props = {
  note: NoteWithAuthor;
  left: number;
  top: number;
  width: number;
  rotation: number;
  /** Play the "settling onto the board" entrance (only for freshly added notes). */
  animateIn?: boolean;
  onPress: (note: NoteWithAuthor) => void;
  /** A held note was picked up and is now following the finger. */
  onDragStart?: (note: NoteWithAuthor) => void;
  /** The held note moved; `screenY` is the finger's position in the window. */
  onDragUpdate?: (note: NoteWithAuthor, screenY: number) => void;
  /** Called when a held note is dropped, with its new canvas position (px). */
  onMove?: (note: NoteWithAuthor, x: number, y: number) => void;
};

/** How long a note must be held before it can be picked up and dragged. */
const LIFT_MS = 280;

/**
 * A pin on the board. It follows the deterministic layout until it is held,
 * at which point it lifts and can be dragged; dropping it reports the new
 * spot so the board can save it. A quick tap still opens the note.
 */
export function BoardNote({
  note,
  left,
  top,
  width,
  rotation,
  animateIn = false,
  onPress,
  onDragStart,
  onDragUpdate,
  onMove,
}: Props) {
  const [posX] = useState(() => new Animated.Value(left));
  const [posY] = useState(() => new Animated.Value(top));
  const [enter] = useState(() => new Animated.Value(animateIn ? 0 : 1));
  const [lift] = useState(() => new Animated.Value(0));
  const [press] = useState(() => new Animated.Value(0));
  const [dragging, setDragging] = useState(false);

  const draggingRef = useRef(false);
  const startRef = useRef({ x: left, y: top });
  const posRef = useRef({ x: left, y: top });

  // Follow the layout unless the note is in hand. Once it is dropped, the
  // saved position flows back through `left`/`top`, so this settles on the
  // same spot without a jump.
  useEffect(() => {
    posRef.current = { x: left, y: top };
    if (draggingRef.current) return;
    Animated.timing(posX, { toValue: left, duration: 240, useNativeDriver: false }).start();
    Animated.timing(posY, { toValue: top, duration: 240, useNativeDriver: false }).start();
  }, [left, top, posX, posY]);

  useEffect(() => {
    if (!animateIn) return;
    Animated.spring(enter, {
      toValue: 1,
      friction: 7,
      tension: 80,
      useNativeDriver: false,
    }).start();
  }, [animateIn, enter]);

  const pan = Gesture.Pan()
    .activateAfterLongPress(LIFT_MS)
    // eslint-disable-next-line react-hooks/refs -- gesture callbacks run off-render
    .onStart(() => {
      draggingRef.current = true;
      startRef.current = { ...posRef.current };
      setDragging(true);
      Animated.spring(lift, {
        toValue: 1,
        friction: 7,
        tension: 90,
        useNativeDriver: false,
      }).start();
      onDragStart?.(note);
    })
    // eslint-disable-next-line react-hooks/refs -- gesture callbacks run off-render
    .onUpdate((e) => {
      const x = startRef.current.x + e.translationX;
      const y = startRef.current.y + e.translationY;
      posRef.current = { x, y };
      posX.setValue(x);
      posY.setValue(y);
      onDragUpdate?.(note, e.absoluteY);
    })
    // eslint-disable-next-line react-hooks/refs -- gesture callbacks run off-render
    .onFinalize(() => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      setDragging(false);
      Animated.spring(lift, {
        toValue: 0,
        friction: 7,
        tension: 90,
        useNativeDriver: false,
      }).start();
      onMove?.(note, posRef.current.x, posRef.current.y);
    });

  const tap = Gesture.Tap()
    .maxDuration(LIFT_MS)
    .onBegin(() => {
      Animated.timing(press, { toValue: 1, duration: 90, useNativeDriver: false }).start();
    })
    .onFinalize(() => {
      Animated.timing(press, { toValue: 0, duration: 120, useNativeDriver: false }).start();
    })
    .onEnd((_e, success) => {
      if (success) onPress(note);
    });

  const gesture = Gesture.Race(pan, tap);

  const settleY = enter.interpolate({ inputRange: [0, 1], outputRange: [-18, 0] });
  const settleScale = enter.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1] });
  const pressScale = press.interpolate({ inputRange: [0, 1], outputRange: [1, 0.985] });
  const liftScale = lift.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });
  const liftRotate = lift.interpolate({
    inputRange: [0, 1],
    outputRange: [`${rotation}deg`, '0deg'],
  });

  return (
    <Animated.View
      style={[
        styles.pin,
        { left: posX, top: posY, width, opacity: enter, zIndex: dragging ? 20 : 0 },
      ]}
    >
      <GestureDetector gesture={gesture}>
        <Animated.View style={{ transform: [{ translateY: settleY }, { scale: settleScale }] }}>
          <Animated.View style={{ transform: [{ scale: pressScale }] }}>
            <Animated.View style={{ transform: [{ scale: liftScale }, { rotate: liftRotate }] }}>
              <NotePaper note={note} />
            </Animated.View>
          </Animated.View>
        </Animated.View>
      </GestureDetector>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pin: { position: 'absolute' },
});
