import { useEffect, useRef, useState } from 'react';
import { Animated, GestureResponderEvent } from 'react-native';
import { NoteWithAuthor } from '../types';
import { StickyNote } from './StickyNote';

/** Hold duration before a note can be picked up (lets taps + scrolls pass). */
const HOLD_MS = 160;
const MOVE_SLOP = 4;

type Props = {
  note: NoteWithAuthor;
  left: number;
  top: number;
  width: number;
  frac: number;
  boardW: number;
  scale: number;
  onPress: (note: NoteWithAuthor) => void;
  onDrop: (id: string, x: number, y: number) => void;
  onDragStateChange: (dragging: boolean) => void;
};

type TouchPt = { x: number; y: number };

function touchPt(e: GestureResponderEvent): TouchPt | null {
  const t = e.nativeEvent.touches[0] ?? e.nativeEvent.changedTouches[0];
  return t ? { x: t.pageX, y: t.pageY } : null;
}

/**
 * A board pin you can pick up with press-and-hold and drop anywhere.
 * The drop spot is persisted by the parent, so every device converges.
 */
export function DraggableNote({
  note,
  left,
  top,
  width,
  frac,
  boardW,
  scale,
  onPress,
  onDrop,
  onDragStateChange,
}: Props) {
  const [pan] = useState(() => new Animated.ValueXY());
  const [lift] = useState(() => new Animated.Value(0));
  const [dragging, setDragging] = useState(false);
  const armedRef = useRef(false);
  const claimRef = useRef(false);
  const activeRef = useRef(false);
  const startRef = useRef<TouchPt | null>(null);
  const lastRef = useRef<TouchPt | null>(null);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const geomRef = useRef({ left, top, frac, boardW, scale });
  const dropRef = useRef(onDrop);
  const dragCbRef = useRef(onDragStateChange);

  useEffect(() => {
    geomRef.current = { left, top, frac, boardW, scale };
    dropRef.current = onDrop;
    dragCbRef.current = onDragStateChange;
  }, [left, top, frac, boardW, scale, onDrop, onDragStateChange]);

  // Snap to the authoritative spot once the drop persists.
  useEffect(() => {
    pan.setValue({ x: 0, y: 0 });
  }, [note.positionX, note.positionY, pan]);

  useEffect(
    () => () => {
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    },
    [],
  );

  const resetTouch = () => {
    armedRef.current = false;
    claimRef.current = false;
    startRef.current = null;
    lastRef.current = null;
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    // Don't re-enable mid-drag (e.g. a second finger touching down).
    if (!activeRef.current) dragCbRef.current(false);
  };

  const handleTouchStart = (e: GestureResponderEvent) => {
    resetTouch();
    const p = touchPt(e);
    startRef.current = p;
    lastRef.current = p;
    holdTimerRef.current = setTimeout(() => {
      // Only arm (and lock the board scroll) if the finger held still.
      // A finger already in motion means this touch is a scroll.
      const s = startRef.current;
      const q = lastRef.current;
      if (s && q && Math.hypot(q.x - s.x, q.y - s.y) <= MOVE_SLOP) {
        armedRef.current = true;
        dragCbRef.current(true);
      }
    }, HOLD_MS);
  };

  const handleTouchMove = (e: GestureResponderEvent) => {
    const p = touchPt(e);
    if (!p) return;
    lastRef.current = p;
    if (!armedRef.current) return;
    const s = startRef.current;
    if (!s) return;
    if (!claimRef.current && Math.hypot(p.x - s.x, p.y - s.y) > MOVE_SLOP) {
      claimRef.current = true;
    }
    if (activeRef.current) {
      pan.setValue({ x: p.x - s.x, y: p.y - s.y });
    }
  };

  const endDrag = (cancelled: boolean) => {
    const s = startRef.current;
    const p = lastRef.current;
    resetTouch();
    setDragging(false);
    activeRef.current = false;
    dragCbRef.current(false);
    Animated.timing(lift, { toValue: 0, duration: 140, useNativeDriver: true }).start();
    if (cancelled || !s || !p) {
      pan.setValue({ x: 0, y: 0 });
      return;
    }
    const pos = geomRef.current;
    const x = Math.min(Math.max((pos.left + (p.x - s.x)) / pos.boardW, 0), Math.max(0, 1 - pos.frac));
    const y = Math.max(8, (pos.top + (p.y - s.y)) / pos.scale);
    dropRef.current(note.id, x, y);
  };

  const handleGrant = () => {
    pan.setValue({ x: 0, y: 0 });
    activeRef.current = true;
    setDragging(true);
    dragCbRef.current(true);
    Animated.timing(lift, { toValue: 1, duration: 140, useNativeDriver: true }).start();
  };

  const liftScale = lift.interpolate({ inputRange: [0, 1], outputRange: [1, 1.07] });

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left,
        top,
        width,
        zIndex: dragging ? 10 : 0,
        transform: [{ translateX: pan.x }, { translateY: pan.y }, { scale: liftScale }],
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={resetTouch}
      onStartShouldSetResponder={() => false}
      onMoveShouldSetResponder={() => claimRef.current}
      onResponderGrant={handleGrant}
      onResponderRelease={() => endDrag(false)}
      onResponderTerminate={() => endDrag(true)}
      onResponderTerminationRequest={() => false}
    >
      <StickyNote note={note} onPress={onPress} flat />
    </Animated.View>
  );
}
