import { useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { colors, fonts } from '../theme';
import { BoardNote } from './BoardNote';
import { boardCanvasHeight, computeBoardLayout, REF_W } from '../utils/layout';
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
  const layout = useMemo(() => computeBoardLayout(items), [items]);
  const scale = boardW > 0 ? boardW / REF_W : 1;
  const canvasH = useMemo(() => boardCanvasHeight(layout, scale), [layout, scale]);

  const handleMove = (item: ItemWithAuthor, left: number, top: number) => {
    if (boardW <= 0) return;
    const placement = layout.get(item.id);
    if (!placement) return;
    const refScale = boardW / REF_W;
    const x = Math.max(0.02, Math.min(1 - placement.w - 0.02, left / boardW));
    const y = Math.max(0, top / refScale);
    onMove(item, x, y);
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
