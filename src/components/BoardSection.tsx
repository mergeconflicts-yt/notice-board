import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { colors, fonts } from '../theme';
import { BoardNote } from './BoardNote';
import { boardCanvasHeight, computeBoardLayout, REF_W, settleNoOverlap } from '../utils/layout';
import { ItemWithAuthor, ListEntry } from '../types';

type Props = {
  items: ItemWithAuthor[];
  entries: ListEntry[];
  photoUrls: Record<string, string>;
  entering: Set<string>;
  onOpen: (item: ItemWithAuthor) => void;
  /** Called with the drop point normalized (x = fraction of width, y = ref points). */
  onMove: (item: ItemWithAuthor, x: number, y: number) => void;
  onDragStart?: (item: ItemWithAuthor) => void;
  onDragUpdate?: (item: ItemWithAuthor, screenY: number) => void;
  /** Shown in place of the canvas when the section has no items. */
  emptyHint?: string;
};

/**
 * One board region (docs/plan.md's board is split into a pinned band and the
 * rest). It owns its own width measurement and deterministic layout, and
 * converts a note's drop point back into stored coordinates.
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
  emptyHint,
}: Props) {
  const [boardW, setBoardW] = useState(0);
  const [measured, setMeasured] = useState<Record<string, number>>({});
  const lastWRef = useRef(0);
  const layout = useMemo(() => computeBoardLayout(items, measured), [items, measured]);
  const scale = boardW > 0 ? boardW / REF_W : 1;
  const canvasH = useMemo(() => boardCanvasHeight(layout, scale), [layout, scale]);

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

  const handleMove = (item: ItemWithAuthor, left: number, top: number) => {
    if (boardW <= 0) return;
    const placement = layout.get(item.id);
    if (!placement) return;
    const refScale = boardW / REF_W;
    const others: { x: number; y: number; w: number; h: number }[] = [];
    layout.forEach((q, id) => {
      if (id !== item.id) others.push(q);
    });
    // Never let a drop land on top of another post.
    const settled = settleNoOverlap(
      left / boardW,
      top / refScale,
      placement.w,
      placement.h,
      others,
    );
    onMove(item, settled.x, settled.y);
  };

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View
        style={[styles.canvas, { height: Math.max(140, canvasH) }]}
        onLayout={(e) => setBoardW(e.nativeEvent.layout.width)}
      >
        {items.length === 0 && emptyHint ? (
          <Text style={styles.hint}>{emptyHint}</Text>
        ) : null}
        {boardW > 0
          ? items.map((item) => {
              const p = layout.get(item.id);
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
                  onDragStart={onDragStart}
                  onDragUpdate={onDragUpdate}
                  onMove={handleMove}
                  onMeasure={handleMeasure}
                />
              );
            })
          : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
