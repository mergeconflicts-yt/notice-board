import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { colors, fonts } from '../theme';
import { BoardNote } from './BoardNote';
import { boardCanvasHeight, clampBoardX, computeBoardLayout, BoardLayout, REF_W, settleNoOverlap } from '../utils/layout';
import { ItemWithAuthor, ListEntry } from '../types';

/** A note the drop displaced, with its new spot in stored coordinates
 *  (x = fraction of width, y = ref points). */
export type DisplacedMove = { item: ItemWithAuthor; x: number; y: number };

type Props = {
  items: ItemWithAuthor[];
  entries: ListEntry[];
  photoUrls: Record<string, string>;
  entering: Set<string>;
  onOpen: (item: ItemWithAuthor) => void;
  /** Called with the drop point in stored coordinates (x = fraction of width,
   *  y = ref points) plus every other note the drop displaced, so the board
   *  can persist the whole new arrangement. */
  onMove: (item: ItemWithAuthor, x: number, y: number, others: DisplacedMove[]) => void;
  onDragStart?: (item: ItemWithAuthor) => void;
  onDragUpdate?: (
    item: ItemWithAuthor,
    screenX: number,
    screenY: number,
    canvasX: number,
    canvasY: number,
  ) => void;
  onDragEnd?: (item: ItemWithAuthor) => void;
  /** Shown in place of the canvas when the section has no items. */
  emptyHint?: string;
  /** Bumped when a drop wasn't persisted, to snap the note back. */
  resetKey?: number;
  /** Decoration overlay drawn above the notes, in the same canvas space.
   *  Receives the computed layout so legacy note-attached magnets can find
   *  their note (new drops always anchor to the door). */
  renderOverlay?: (ctx: { layout: BoardLayout; boardW: number; scale: number }) => ReactNode;
  /** Transparent backdrop drawn behind the notes; taps on empty door space
   *  land here (used to clear magnet selection). */
  renderBackdrop?: () => ReactNode;
  /** Id of a just-posted item to reveal once: the section scrolls it into
   *  view, then reports back so the parent clears this one-shot request. */
  focusId?: string | null;
  /** Same, but for a coordinate in ref units (e.g. a freshly placed magnet,
   *  whose position the parent already knows). focusId wins when both set. */
  focusPoint?: { x: number; y: number } | null;
  onFocusShown?: () => void;
};

/**
 * One board region (docs/plan.md's board is split into a pinned band and the
 * rest). It owns its own width measurement and deterministic layout, and
 * converts a note's drop point back into stored coordinates.
 *
 * While a note is held, the section edge-auto-scrolls: dragging near the top
 * or bottom edge scrolls the fridge along with the finger, and the held note
 * is shifted by the same delta so it stays glued to the finger.
 *
 * The other notes also make way live: with the held note pinned at the
 * finger, every other note settles around it (same rule as the board layout),
 * gliding aside to preview the drop. On drop the whole arrangement is
 * reported so it persists; on cancel everything glides back.
 */
export function BoardSection({
  items,
  entries,
  photoUrls,
  entering,
  onOpen,
  onMove,
  onDragStart,
  onDragUpdate,
  onDragEnd,
  emptyHint,
  resetKey,
  renderOverlay,
  renderBackdrop,
  focusId = null,
  focusPoint = null,
  onFocusShown,
}: Props) {
  const [boardW, setBoardW] = useState(0);
  const [measured, setMeasured] = useState<Record<string, number>>({});
  const lastWRef = useRef(0);
  const layout = useMemo(() => computeBoardLayout(items, measured), [items, measured]);
  const scale = boardW > 0 ? boardW / REF_W : 1;
  const canvasH = useMemo(() => boardCanvasHeight(layout, scale), [layout, scale]);
  const scrollRef = useRef<ScrollView | null>(null);
  const wrapRef = useRef<View | null>(null);
  const viewHRef = useRef(0);
  const scrollYRef = useRef(0);
  const contentHRef = useRef(0);
  const containerYRef = useRef(0);
  const dragActiveRef = useRef(false);
  const fingerYRef = useRef(0);
  const fingerSeenRef = useRef(false);
  const adjustRef = useRef<((dy: number) => void) | null>(null);
  const loopRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [dragScrolling, setDragScrolling] = useState(false);
  const scheduledRef = useRef<string | null>(null);
  // Live make-way preview: the held note + its canvas position (px). State
  // updates are throttled (~20Hz); the drop path recomputes from the exact
  // gesture values, so throttle staleness never affects persistence.
  const [dragLive, setDragLive] = useState<{ id: string; x: number; y: number } | null>(null);
  const dragIdRef = useRef<string | null>(null);
  const lastPreviewAt = useRef(0);

  // A freshly posted note can land anywhere in the masonry (shortest
  // column), so reveal it by position — not by scrolling to the end.
  // focusPoint covers things placed at known coordinates (magnets).
  const focusKey = focusId ?? (focusPoint ? `${focusPoint.x}:${focusPoint.y}` : null);
  useEffect(() => {
    if (!focusKey || scheduledRef.current === focusKey || boardW <= 0) return;
    let refY: number | null = null;
    if (focusId) {
      const placement = layout.get(focusId);
      if (!placement) return;
      refY = placement.y;
    } else if (focusPoint) {
      refY = focusPoint.y;
    } else {
      return;
    }
    scheduledRef.current = focusKey;
    const y = Math.max(0, refY * scale - Math.max(200, viewHRef.current * 0.3));
    // Let the fresh content mount before moving (a measured height can still
    // shift neighbours a little — close enough to land on it). A layout
    // change re-runs this effect, which re-arms with the fresher position.
    const t = setTimeout(() => {
      scrollRef.current?.scrollTo({ y, animated: true });
      onFocusShown?.();
    }, 250);
    return () => {
      clearTimeout(t);
      scheduledRef.current = null;
    };
  }, [focusKey, focusId, focusPoint, layout, boardW, scale, onFocusShown]);

  // Measurements only hold for the width they were taken at.
  useEffect(() => {
    if (boardW <= 0 || boardW === lastWRef.current) return;
    lastWRef.current = boardW;
    setMeasured({});
  }, [boardW]);

  // Feed each post's real rendered height back to the layout (in ref points),
  // so a taller-than-guessed post pushes its neighbours down instead of
  // overlapping them.
  const handleMeasure = (id: string, heightPx: number) => {
    if (boardW <= 0 || heightPx <= 0) return;
    const refH = (heightPx * REF_W) / boardW;
    setMeasured((prev) =>
      Math.abs((prev[id] ?? -1) - refH) < 1 ? prev : { ...prev, [id]: refH },
    );
  };

  // --- Make-way preview --------------------------------------------------
  // With the held note pinned at the finger (canvas px), every other note
  // settles around it with the board's own no-overlap rule — same column
  // order as computeBoardLayout, so neighbours glide aside to preview the
  // drop instead of being covered by it.
  const computePreview = useCallback(
    (dragId: string, xPx: number, yPx: number): BoardLayout => {
      const base = layout.get(dragId);
      if (!base || boardW <= 0) return layout;
      const next: BoardLayout = new Map();
      const placed: { x: number; y: number; w: number; h: number }[] = [];
      const dx = clampBoardX(xPx / boardW, base.w);
      const dy = Math.max(0, yPx / scale);
      placed.push({ x: dx, y: dy, w: base.w, h: base.h });
      next.set(dragId, { ...base, x: dx, y: dy });
      const ordered = [...items].sort(
        (a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
      );
      for (const it of ordered) {
        if (it.id === dragId) continue;
        const q = layout.get(it.id);
        if (!q) continue;
        const s = settleNoOverlap(q.x, q.y, q.w, q.h, placed);
        placed.push({ x: s.x, y: s.y, w: q.w, h: q.h });
        next.set(it.id, { ...q, ...s });
      }
      return next;
    },
    [items, layout, boardW, scale],
  );

  const previewLayout = useMemo(
    () => (dragLive ? computePreview(dragLive.id, dragLive.x, dragLive.y) : null),
    [dragLive, computePreview],
  );
  // --- Drag auto-scroll --------------------------------------------------
  // Finger distance from the viewport edge that starts pulling the fridge.
  const EDGE_PX = 110;
  // Per-tick (16ms) scroll speed at the very edge; eases down to MIN_STEP at
  // the zone boundary so the take-off doesn't jump.
  const MAX_STEP = 18;
  const MIN_STEP = 4;

  // contentHRef mirrors the real scrollable height; canvasH is the fallback
  // until the first onContentSizeChange lands.
  useEffect(() => {
    if (contentHRef.current <= 0) contentHRef.current = Math.max(140, canvasH) + 40;
  }, [canvasH]);
  useEffect(() => {
    return () => {
      if (loopRef.current != null) clearInterval(loopRef.current);
    };
  }, []);

  const stopAutoScroll = () => {
    dragActiveRef.current = false;
    setDragScrolling(false);
    if (loopRef.current != null) {
      clearInterval(loopRef.current);
      loopRef.current = null;
    }
  };

  const tickAutoScroll = () => {
    if (!dragActiveRef.current || !fingerSeenRef.current) return;
    const viewH = viewHRef.current;
    if (viewH <= 0) return;
    const maxScroll = Math.max(0, contentHRef.current - viewH);
    if (maxScroll <= 0) return;
    const relY = fingerYRef.current - containerYRef.current;
    const cur = scrollYRef.current;
    let dy = 0;
    if (relY < EDGE_PX) {
      const t = Math.min(1, Math.max(0, (EDGE_PX - relY) / EDGE_PX));
      dy = -(MIN_STEP + (MAX_STEP - MIN_STEP) * t);
    } else if (relY > viewH - EDGE_PX) {
      const t = Math.min(1, Math.max(0, (relY - (viewH - EDGE_PX)) / EDGE_PX));
      dy = MIN_STEP + (MAX_STEP - MIN_STEP) * t;
    }
    if (dy === 0) return;
    const next = Math.max(0, Math.min(maxScroll, cur + dy));
    const actual = next - cur;
    if (actual === 0) return;
    scrollYRef.current = next;
    scrollRef.current?.scrollTo({ y: next, animated: false });
    // Keep the held note glued to the finger (see BoardNote adjustRef).
    adjustRef.current?.(actual);
  };

  const measureContainer = () => {
    try {
      const node = wrapRef.current as unknown as {
        measureInWindow?: (cb: (x: number, y: number, w: number, h: number) => void) => void;
      } | null;
      node?.measureInWindow?.((_x, y) => {
        containerYRef.current = y;
      });
    } catch {
      // measure can throw during unmount — the last known Y is fine.
    }
  };

  const handleDragStartInner = (item: ItemWithAuthor) => {
    dragActiveRef.current = true;
    fingerSeenRef.current = false;
    setDragScrolling(true);
    measureContainer();
    if (loopRef.current == null) loopRef.current = setInterval(tickAutoScroll, 16);
    // Seed the make-way preview at the note's current spot; finger updates
    // refine it from here.
    dragIdRef.current = item.id;
    const p = layout.get(item.id);
    if (p && boardW > 0) setDragLive({ id: item.id, x: p.x * boardW, y: p.y * scale });
    onDragStart?.(item);
  };

  const handleDragUpdateInner = (
    item: ItemWithAuthor,
    screenX: number,
    screenY: number,
    canvasX: number,
    canvasY: number,
  ) => {
    fingerYRef.current = screenY;
    fingerSeenRef.current = true;
    onDragUpdate?.(item, screenX, screenY, canvasX, canvasY);
    if (dragIdRef.current !== item.id) return;
    // Throttle preview re-renders (~20Hz): the held note itself stays at
    // full rate on its own animated values, and the drop path recomputes
    // from the exact gesture values.
    const now = Date.now();
    if (now - lastPreviewAt.current > 50) {
      lastPreviewAt.current = now;
      setDragLive({ id: item.id, x: canvasX, y: canvasY });
    }
  };

  const handleDragEndInner = (item: ItemWithAuthor) => {
    stopAutoScroll();
    dragIdRef.current = null;
    setDragLive(null);
    onDragEnd?.(item);
  };

  const handleMove = (item: ItemWithAuthor, left: number, top: number) => {
    stopAutoScroll();
    dragIdRef.current = null;
    setDragLive(null);
    if (boardW <= 0) return;
    // Persist the previewed arrangement, recomputed from the exact drop
    // point: the held note plus every note it displaced. A bare long-press
    // reports (nearly) its start spot, the preview matches the stored layout,
    // and nothing else is persisted.
    const preview = computePreview(item.id, left, Math.max(0, top));
    const dropped = preview.get(item.id);
    if (!dropped) return;
    const byId = new Map(items.map((i) => [i.id, i] as const));
    const others: DisplacedMove[] = [];
    preview.forEach((p, id) => {
      if (id === item.id) return;
      const q = layout.get(id);
      const it = byId.get(id);
      if (!q || !it) return;
      if (Math.abs(p.x - q.x) > 0.001 || Math.abs(p.y - q.y) > 0.5) {
        others.push({ item: it, x: p.x, y: p.y });
      }
    });
    onMove(item, dropped.x, dropped.y, others);
  };

  return (
    <View ref={wrapRef} collapsable={false} style={styles.wrap}>
    <ScrollView
      ref={scrollRef}
      scrollEnabled={!dragScrolling}
      scrollEventThrottle={16}
      onScroll={(e) => {
        scrollYRef.current = e.nativeEvent.contentOffset.y;
      }}
      onContentSizeChange={(_w, h) => {
        contentHRef.current = h;
      }}
      onLayout={(e) => {
        viewHRef.current = e.nativeEvent.layout.height;
        measureContainer();
      }}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View
        style={[styles.canvas, { height: Math.max(140, canvasH) }]}
        onLayout={(e) => setBoardW(e.nativeEvent.layout.width)}
      >
        {renderBackdrop ? renderBackdrop() : null}
        {items.length === 0 && emptyHint ? (
          <Text style={styles.hint}>{emptyHint}</Text>
        ) : null}
        {boardW > 0
          ? items.map((item) => {
              // While dragging, non-held notes render at their preview spots
              // (gliding aside); the held note ignores left/top and follows
              // the finger on its own animated values.
              const p = previewLayout?.get(item.id) ?? layout.get(item.id);
              if (!p) return null;
              return (
                <BoardNote
                  key={item.id}
                  item={item}
                  left={p.x * boardW}
                  top={p.y * scale}
                  width={p.w * boardW}
                  rotation={p.rotation}
                  animateIn={entering.has(item.id)}
                  entries={entries.filter((e) => e.itemId === item.id)}
                  photoUrl={item.photoPath ? photoUrls[item.photoPath] ?? null : null}
                  onPress={onOpen}
                  onDragStart={handleDragStartInner}
                  onDragUpdate={handleDragUpdateInner}
                  onDragEnd={handleDragEndInner}
                  onMove={handleMove}
                  onMeasure={handleMeasure}
                  resetKey={resetKey}
                  adjustRef={adjustRef}
                  spotlight={focusId === item.id}
                />
              );
            })
          : null}
        {boardW > 0 && renderOverlay ? renderOverlay({ layout, boardW, scale }) : null}
      </View>
    </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  content: { paddingHorizontal: 6, paddingBottom: 40 },
  canvas: { position: 'relative' },
  hint: {
    position: 'absolute',
    top: 24,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontFamily: fonts.ui.regular,
    fontSize: 13,
    color: colors.inkSoft,
    opacity: 0.8,
  },
});
