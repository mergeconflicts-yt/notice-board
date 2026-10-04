import { useEffect, useRef, useState } from 'react';
import { Animated, View, Text, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { ScrollView } from 'react-native-gesture-handler';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, doorSoft, fonts, noteColors } from '../theme';
import type { BoardColor } from '../types';
import { NotePaper } from './NotePaper';
import { ItemWithAuthor, ListEntry } from '../types';

/** Fixed width of each pinned card; height fills the strip. */
const CARD_W = 150;
/** Row insets around the cards: left clears the door handle, right the edge. */
const ROW_PAD_LEFT = 33;
const ROW_PAD_RIGHT = 12;
const ROW_GAP = 10;
const V_PAD = 4;

type Props = {
  items: ItemWithAuthor[];
  entries: ListEntry[];
  photoUrls: Record<string, string>;
  onOpen: (item: ItemWithAuthor) => void;
  /** Fridge door colour: the empty hint follows it. */
  doorColor: BoardColor;
  /** Id of a just-pinned item to reveal once: the strip scrolls it into
   *  view, then reports back so the parent clears this one-shot request. */
  focusId?: string | null;
  onFocusShown?: () => void;
};

/**
 * The pinned-forever band: a single row of cards that scrolls sideways. Each
 * card fills the band's height and is clipped, so pinned notes can never
 * overlap one another vertically (and dragging is left to the main board).
 */
export function PinnedStrip({
  items,
  entries,
  photoUrls,
  onOpen,
  doorColor,
  focusId = null,
  onFocusShown,
}: Props) {
  const [height, setHeight] = useState(0);
  const [stripW, setStripW] = useState(0);
  // Full content height per card, so the fade only renders when the card is
  // actually clipped (a short card must not get a gradient washed over it).
  const [contentH, setContentH] = useState<Record<string, number>>({});
  const cardH = height > 0 ? Math.max(40, height - V_PAD * 2) : undefined;
  // Two cards across, always: each card takes half the strip minus insets
  // and the gap, so widths follow the screen instead of a fixed 150pt.
  const cardW = stripW > 0
    ? Math.max(100, (stripW - ROW_PAD_LEFT - ROW_PAD_RIGHT - ROW_GAP) / 2)
    : CARD_W;
  // How many checklist rows fit before the card is clipped: card height minus
  // room for the compact padding, title and meta line, then ~24px per row,
  // with space kept for the "+N more" line.
  const maxEntries =
    cardH != null ? Math.max(1, Math.min(4, Math.floor((cardH - 76) / 24))) : 4;

  const scrollRef = useRef<ScrollView | null>(null);
  const shownRef = useRef<string | null>(null);

  // A freshly pinned card can land off-screen to the right: scroll it into
  // view once, then report back so the parent clears the one-shot request.
  useEffect(() => {
    if (!focusId || shownRef.current === focusId) return;
    const index = items.findIndex((i) => i.id === focusId);
    if (index < 0) return;
    shownRef.current = focusId;
    // Card `index` starts at ROW_PAD_LEFT + (cardW + gap)·index; scroll so
    // its left edge lands exactly where the row starts — clear of the handle.
    const x = index * (cardW + ROW_GAP);
    const t = setTimeout(() => {
      scrollRef.current?.scrollTo({ x, animated: true });
      onFocusShown?.();
    }, 250);
    return () => {
      clearTimeout(t);
      shownRef.current = null;
    };
  }, [focusId, items, onFocusShown, cardW]);

  return (
    <View
      style={styles.wrap}
      onLayout={(e) => {
        setHeight(e.nativeEvent.layout.height);
        setStripW(e.nativeEvent.layout.width);
      }}
    >
      {items.length === 0 ? (
        <Text style={[styles.hint, { color: doorSoft(doorColor) }]}>Pin a note to keep it up here.</Text>
      ) : (
        <ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.row}
        >
          {items.map((item) => (
            <PinnedCard
              key={item.id}
              item={item}
              entries={entries.filter((e) => e.itemId === item.id)}
              photoUrl={item.photoPath ? photoUrls[item.photoPath] ?? null : null}
              cardW={cardW}
              cardH={cardH}
              maxEntries={maxEntries}
              naturalH={contentH[item.id] ?? 0}
              onMeasure={(h) => {
                setContentH((prev) =>
                  Math.abs((prev[item.id] ?? -1) - h) < 1 ? prev : { ...prev, [item.id]: h },
                );
              }}
              onOpen={onOpen}
              spotlight={focusId === item.id}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

/**
 * One pinned card. A just-added or just-pinned card (`spotlight`) eases in
 * with a soft spring — a small rise, a breath of scale, and a gentle
 * overshoot that settles instead of bouncing. The mount itself plays behind
 * the closing composer sheet, so only the replay is seen. No timeout cleanup:
 * the latched replay must survive the focus request being cleared (the strip
 * reports back before it plays).
 */
function PinnedCard({
  item,
  entries,
  photoUrl,
  cardW,
  cardH,
  maxEntries,
  naturalH,
  onMeasure,
  onOpen,
  spotlight,
}: {
  item: ItemWithAuthor;
  entries: ListEntry[];
  photoUrl: string | null;
  cardW: number;
  cardH: number | undefined;
  maxEntries: number;
  naturalH: number;
  onMeasure: (h: number) => void;
  onOpen: (item: ItemWithAuthor) => void;
  spotlight: boolean;
}) {
  const [enter] = useState(() => new Animated.Value(1));
  const playedRef = useRef(false);
  useEffect(() => {
    if (!spotlight || playedRef.current) return;
    playedRef.current = true;
    setTimeout(() => {
      enter.setValue(0);
      Animated.spring(enter, { toValue: 1, friction: 8, tension: 65, useNativeDriver: false }).start();
    }, 450);
  }, [spotlight, enter]);

  // 6-digit hex, so a `00` alpha suffix is valid.
  const bg = item.color === 'paper' ? colors.paper : noteColors[item.color].bg;
  const clipped = cardH != null && naturalH > cardH + 4;
  return (
    <Animated.View
      style={{
        opacity: enter,
        transform: [
          { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) },
          { scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.93, 1] }) },
        ],
      }}
    >
      <Pressable
        onPress={() => onOpen(item)}
        style={[styles.card, styles.cardShadow, { width: cardW }, cardH != null && { height: cardH }]}
        accessibilityRole="button"
        accessibilityLabel={item.title ?? item.body ?? 'Pinned post'}
      >
        {item.type === 'photo' ? (
          <PhotoCard url={photoUrl} caption={item.body} />
        ) : (
          <View style={styles.clip}>
            <View
              onLayout={(e) => {
                onMeasure(e.nativeEvent.layout.height);
              }}
            >
              <NotePaper
                item={item}
                flat
                compact
                maxEntries={maxEntries}
                entries={entries}
                // Small posts stretch to fill the whole card height.
                minHeight={cardH != null && naturalH <= cardH ? cardH : undefined}
              />
            </View>
            {/* Only cards actually taller than the strip get the overlay:
                the note's own colour, transparent at the top and
                deepening downward so the cut reads as intentional.
                'transparent' is rgba(0,0,0,0), which would blend through
                grey — use the bg with zero alpha instead. */}
            {clipped ? (
              <LinearGradient colors={[`${bg}00`, bg]} style={styles.fade} pointerEvents="none" />
            ) : null}
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

/** A pinned photo fitted (letterboxed) entirely inside the card. */function PhotoCard({ url, caption }: { url: string | null; caption: string | null }) {
  return (
    <View style={styles.photoCard}>
      {url ? (
        <Image
          source={{ uri: url }}
          style={styles.photo}
          contentFit="contain"
          accessible
          accessibilityLabel={caption?.trim() || 'Pinned photo'}
        />
      ) : (
        <View style={styles.photoPlaceholder}>
          <Text style={styles.photoPlaceholderText}>📷</Text>
        </View>
      )}
      {caption?.trim() ? (
        <Text style={styles.photoCaption} numberOfLines={2}>
          {caption}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  row: {
    paddingLeft: ROW_PAD_LEFT,
    paddingRight: ROW_PAD_RIGHT,
    paddingVertical: V_PAD,
    gap: ROW_GAP,
  },
  card: {
    // Width is set per-card from the measured strip (two across, always).
  },
  // The shadow lives on the card wrapper (not the paper) so `overflow:
  // 'hidden' on the clip can't cut it off.
  cardShadow: {
    borderRadius: 4,
    boxShadow: '0 1px 1px rgba(0,0,0,0.08), 0 8px 14px -8px rgba(20,30,25,0.4)',
  },
  clip: { flex: 1, overflow: 'hidden', borderRadius: 4 },
  fade: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  hint: {
    paddingHorizontal: 16,
    paddingTop: 12,
    fontFamily: fonts.ui.regular,
    fontSize: 13,
    color: colors.inkSoft,
    opacity: 0.8,
  },
  photoCard: {
    flex: 1,
    backgroundColor: colors.paper,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.paperEdge,
    padding: 8,
    overflow: 'hidden',
  },
  photo: { flex: 1, width: '100%' },
  photoPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  photoPlaceholderText: { fontSize: 28, opacity: 0.5 },
  photoCaption: {
    fontFamily: fonts.hand.semibold,
    fontSize: 13,
    lineHeight: 16,
    color: colors.ink,
    textAlign: 'center',
    marginTop: 6,
  },
});
