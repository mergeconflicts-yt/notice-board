import { useState } from 'react';
import { View, Text, Pressable, Image, StyleSheet } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, fonts, noteColors } from '../theme';
import { NotePaper } from './NotePaper';
import { ItemWithAuthor, ListEntry } from '../types';

/** Fixed width of each pinned card; height fills the strip. */
const CARD_W = 150;
const V_PAD = 4;

type Props = {
  items: ItemWithAuthor[];
  entries: ListEntry[];
  photoUrls: Record<string, string>;
  onOpen: (item: ItemWithAuthor) => void;
};

/**
 * The pinned-forever band: a single row of cards that scrolls sideways. Each
 * card fills the band's height and is clipped, so pinned notes can never
 * overlap one another vertically (and dragging is left to the main board).
 */
export function PinnedStrip({ items, entries, photoUrls, onOpen }: Props) {
  const [height, setHeight] = useState(0);
  // Full content height per card, so the fade only renders when the card is
  // actually clipped (a short card must not get a gradient washed over it).
  const [contentH, setContentH] = useState<Record<string, number>>({});
  const cardH = height > 0 ? Math.max(40, height - V_PAD * 2) : undefined;
  // How many checklist rows fit before the card is clipped: card height minus
  // room for the compact padding, title and meta line, then ~24px per row,
  // with space kept for the "+N more" line.
  const maxEntries =
    cardH != null ? Math.max(1, Math.min(4, Math.floor((cardH - 76) / 24))) : 4;

  return (
    <View style={styles.wrap} onLayout={(e) => setHeight(e.nativeEvent.layout.height)}>
      {items.length === 0 ? (
        <Text style={styles.hint}>Pin a note to keep it up here.</Text>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.row}
        >
          {items.map((item) => {
            // 6-digit hex, so a `00` alpha suffix is valid.
            const bg = item.color === 'paper' ? colors.paper : noteColors[item.color].bg;
            const naturalH = contentH[item.id] ?? 0;
            const clipped = cardH != null && naturalH > cardH + 4;
            return (
              <Pressable
                key={item.id}
                onPress={() => onOpen(item)}
                style={[styles.card, styles.cardShadow, cardH != null && { height: cardH }]}
                accessibilityRole="button"
                accessibilityLabel={item.title ?? item.body ?? 'Pinned post'}
              >
                {item.type === 'photo' ? (
                  <PhotoCard
                    url={item.photoPath ? photoUrls[item.photoPath] ?? null : null}
                    caption={item.body}
                  />
                ) : (
                  <View style={styles.clip}>
                  <View
                    onLayout={(e) => {
                      const h = e.nativeEvent.layout.height;
                      setContentH((prev) =>
                        Math.abs((prev[item.id] ?? -1) - h) < 1 ? prev : { ...prev, [item.id]: h },
                      );
                    }}
                  >
                    <NotePaper
                      item={item}
                      flat
                      compact
                      maxEntries={maxEntries}
                      entries={entries.filter((e) => e.itemId === item.id)}
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
                    <LinearGradient
                      colors={[`${bg}00`, bg]}
                      style={styles.fade}
                      pointerEvents="none"
                    />
                  ) : null}
                </View>
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

/** A pinned photo fitted (letterboxed) entirely inside the card. */
function PhotoCard({ url, caption }: { url: string | null; caption: string | null }) {
  return (
    <View style={styles.photoCard}>
      {url ? (
        <Image
          source={{ uri: url }}
          style={styles.photo}
          resizeMode="cover"
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
    paddingHorizontal: 12,
    paddingVertical: V_PAD,
    gap: 10,
  },
  card: { width: CARD_W },
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
