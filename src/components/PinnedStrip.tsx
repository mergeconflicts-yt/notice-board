import { useState } from 'react';
import { View, Text, Pressable, Image, StyleSheet } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { colors, fonts } from '../theme';
import { NotePaper } from './NotePaper';
import { ItemWithAuthor, ListEntry } from '../types';

/** Fixed width of each pinned card; height fills the strip. */
const CARD_W = 190;
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
  const cardH = height > 0 ? Math.max(40, height - V_PAD * 2) : undefined;
  // How many checklist rows fit before the card is clipped: card height minus
  // room for padding, the title and attribution, then ~30px per row, with
  // space kept for the "+N more" line.
  const maxEntries =
    cardH != null ? Math.max(1, Math.min(6, Math.floor((cardH - 118) / 30))) : 6;

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
          {items.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => onOpen(item)}
              style={[styles.card, cardH != null && { height: cardH }]}
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
                  <NotePaper
                    item={item}
                    maxEntries={maxEntries}
                    entries={entries.filter((e) => e.itemId === item.id)}
                  />
                </View>
              )}
            </Pressable>
          ))}
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
          resizeMode="contain"
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
  clip: { flex: 1, overflow: 'hidden', borderRadius: 4 },
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
    fontSize: 15,
    lineHeight: 18,
    color: colors.ink,
    textAlign: 'center',
    marginTop: 6,
  },
});
