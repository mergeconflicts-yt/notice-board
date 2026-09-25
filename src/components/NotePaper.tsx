import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import { ItemWithAuthor, ListEntry } from '../types';
import { colors, noteColors, fonts } from '../theme';
import { FastenerView, fastenerForItem } from './Pin';
import {
  formatEventTime,
  ticketDay,
  timeAgo,
  paperVariantFor,
} from '../utils/note';

type Props = {
  item: ItemWithAuthor;
  large?: boolean;
  /** Bare paper for the pinned strip: no shadow, no fastener (the card
   *  wrapper carries the shadow there so it isn't clipped). */
  flat?: boolean;
  /** Floor for the rendered height, so small papers still fill their slot. */
  minHeight?: number;
  /** Show every checklist row instead of the first few. */
  showAllEntries?: boolean;
  /** Cap on visible checklist rows before a "+N more" line (default 6). */
  maxEntries?: number;
  entries?: ListEntry[];
  onToggleEntry?: (entry: ListEntry) => void;
  /** Resolved signed URL for a photo item. */
  photoUrl?: string | null;
};

const TITLE_LINES = 3;
const ENTRY_LIMIT = 6;

export function NotePaper({
  item,
  large = false,
  flat = false,
  minHeight,
  showAllEntries = false,
  maxEntries,
  entries = [],
  onToggleEntry,
  photoUrl,
}: Props) {
  const variant = paperVariantFor(item.type);
  const palette = noteColors[item.color];
  const done = Boolean(item.doneAt);
  const age = timeAgo(item.createdAt);

  const isPhoto = variant === 'photo';
  const cardBg = item.color === 'paper' ? colors.paper : palette.bg;
  const borderColor = item.color === 'paper' ? colors.paperEdge : palette.edge;

  const bodyTrimmed = item.type === 'note' ? (item.body ?? '').trim() : '';
  const bodyLen = bodyTrimmed.length;
  // Handwriting sized by length: a two-word note is a bold little slip, a
  // sentence is smaller, anything longer is body size.
  const bodyFontSize = large
    ? 26
    : item.type !== 'note'
      ? 18
      : bodyLen > 0 && bodyLen <= 20 && !bodyTrimmed.includes('\n')
        ? 33
        : bodyLen <= 60
          ? 25
          : 20;
  const heroNote = !large && item.type === 'note' && bodyLen > 0 && bodyLen <= 20 && !bodyTrimmed.includes('\n');

  const rawName = item.author?.displayName?.trim();
  const authorName = rawName ? rawName : item.createdBy ? null : 'Former member';

  return (
    <View
      style={[
        styles.paper,
        {
          backgroundColor: cardBg,
          borderColor,
          borderWidth: item.color === 'paper' ? 1 : 0,
          borderTopLeftRadius: 3,
          borderTopRightRadius: 5,
          borderBottomRightRadius: 3,
          borderBottomLeftRadius: 4,
          minHeight: minHeight ?? undefined,
          padding: large ? 22 : variant === 'photo' ? 14 : 16,
        },
        // boxShadow draws on both platforms; elevation would double-draw the
        // shadow on Android, so it stays off the paper.
        flat ? { boxShadow: undefined } : styles.raised,
      ]}
    >
      {!flat ? (
        <View accessible={false}>
          <FastenerView fastener={fastenerForItem(item.id)} />
        </View>
      ) : null}

      <View style={styles.body}>
        {isPhoto && photoUrl ? (
          <Image
            source={{ uri: photoUrl }}
            style={[styles.image, { borderRadius: 2, aspectRatio: 4 / 3 }]}
            resizeMode="cover"
            accessible
            accessibilityLabel={item.body?.trim() ? item.body.trim() : 'Attached photo'}
            accessibilityRole="image"
          />
        ) : null}

        {variant === 'list' ? (
          <ListBody
            item={item}
            entries={entries}
            large={large || showAllEntries}
            maxEntries={maxEntries}
            onToggleEntry={onToggleEntry}
          />
        ) : variant === 'appointment' ? (
          <TicketBody item={item} palette={palette} done={done} large={large} />
        ) : isPhoto ? (
          item.body?.trim() ? (
            <Text
              numberOfLines={large ? undefined : 3}
              style={[styles.text, styles.photoCaption, { color: palette.ink, fontSize: bodyFontSize }]}
            >
              {item.body}
            </Text>
          ) : null
        ) : (
          <Text
            numberOfLines={large ? undefined : 6}
            style={[
              styles.text,
              heroNote && { fontFamily: fonts.hand.bold },
              {
                color: palette.ink,
                fontSize: bodyFontSize,
                lineHeight: bodyFontSize * 1.2,
                textDecorationLine: done ? 'line-through' : 'none',
                opacity: done ? 0.55 : 1,
              },
            ]}
          >
            {item.body ?? ''}
          </Text>
        )}
      </View>

      {authorName || age ? (
        <Text numberOfLines={1} style={[styles.meta, { color: palette.ink }]}>
          {[authorName, age].filter(Boolean).join(' · ')}
        </Text>
      ) : null}
    </View>
  );
}

function TicketBody({
  item,
  palette,
  done,
  large,
}: {
  item: ItemWithAuthor;
  palette: { bg: string; ink: string; edge: string; shadow: string };
  done: boolean;
  large: boolean;
}) {
  const parts = item.eventAt ? ticketDay(item.eventAt) : null;
  return (
    <View style={styles.ticketRow}>
      {parts ? (
        <View style={styles.calBlock}>
          <Text style={styles.calDow}>{parts.dow}</Text>
          <Text style={[styles.calDay, { color: palette.ink }]}>{parts.day}</Text>
          <Text style={[styles.calMon, { color: palette.ink }]}>{parts.mon}</Text>
        </View>
      ) : null}
      <View style={styles.ticketMain}>
        {parts ? <Text style={styles.dayLabel}>{parts.label}</Text> : null}
        <Text
          numberOfLines={large ? undefined : TITLE_LINES}
          style={[
            styles.text,
            styles.ticketText,
            {
              color: palette.ink,
              fontSize: large ? 26 : 20,
              lineHeight: large ? 30 : 24,
              textDecorationLine: done ? 'line-through' : 'none',
              opacity: done ? 0.55 : 1,
            },
          ]}
        >
          {item.title ?? ''}
        </Text>
        {item.eventAt ? (
          <Text style={[styles.ticketTime, { color: palette.ink }]}>
            {formatEventTime(item.eventAt)}
          </Text>
        ) : null}
        {item.place ? (
          <Text style={[styles.place, { color: palette.ink }]} numberOfLines={2}>
            {item.place}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function ListBody({
  item,
  entries,
  large,
  maxEntries,
  onToggleEntry,
}: {
  item: ItemWithAuthor;
  entries: ListEntry[];
  large: boolean;
  maxEntries?: number;
  onToggleEntry?: (entry: ListEntry) => void;
}) {
  const sorted = [...entries].sort((a, b) => a.position - b.position);
  const visible = large ? sorted : sorted.slice(0, maxEntries ?? ENTRY_LIMIT);
  const truncated = visible.length < sorted.length;
  return (
    <View>
      {item.title ? (
        <Text style={[styles.listTitle, { color: colors.ink }]} numberOfLines={2}>
          {item.title}
        </Text>
      ) : null}
      <View style={styles.listItems}>
        {visible.map((entry) => {
          const checked = entry.checkedAt !== null;
          const row = (
            <>
              <View
                style={[styles.checkbox, { borderColor: colors.ink }, checked && styles.checkboxDone]}
              >
                {checked ? <Text style={styles.checkmark}>✓</Text> : null}
              </View>
              <Text
                style={[
                  styles.listText,
                  {
                    color: colors.ink,
                    textDecorationLine: checked ? 'line-through' : 'none',
                    opacity: checked ? 0.55 : 1,
                  },
                ]}
                numberOfLines={2}
              >
                {entry.text}
              </Text>
            </>
          );
          return onToggleEntry ? (
            <Pressable
              key={entry.id}
              style={styles.listRow}
              onPress={() => onToggleEntry(entry)}
              hitSlop={8}
              accessibilityRole="checkbox"
              accessibilityLabel={entry.text}
              accessibilityState={{ checked }}
            >
              {row}
            </Pressable>
          ) : (
            <View key={entry.id} style={styles.listRow}>
              {row}
            </View>
          );
        })}
      </View>
      {!large && truncated ? (
        <Text style={[styles.listMore, { color: colors.ink }]}>
          +{sorted.length - visible.length} more
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  paper: {
    borderWidth: 1,
  },
  // Two layers like real paper on a surface: a tight contact shadow where it
  // touches, and a soft drop that falls below it. boxShadow draws on both
  // platforms; elevation would double-draw the shadow on Android.
  raised: {
    boxShadow: '0 1px 1px rgba(0,0,0,0.08), 0 10px 18px -8px rgba(20,30,25,0.45)',
  },
  body: { flexGrow: 1, justifyContent: 'center' },
  image: { width: '100%', marginBottom: 10, marginTop: 6, backgroundColor: colors.imageWash },
  text: { fontFamily: fonts.hand.semibold },
  photoCaption: { textAlign: 'center' },
  ticketText: { fontFamily: fonts.hand.bold },
  ticketRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  calBlock: { alignItems: 'center', minWidth: 44, paddingTop: 2 },
  calDow: { fontFamily: fonts.ui.bold, fontSize: 12, letterSpacing: 0.5, color: colors.danger },
  calDay: { fontFamily: fonts.hand.bold, fontSize: 30, lineHeight: 32 },
  calMon: { fontFamily: fonts.ui.semibold, fontSize: 12, opacity: 0.7 },
  ticketMain: { flex: 1 },
  dayLabel: {
    fontFamily: fonts.ui.bold,
    fontSize: 13,
    letterSpacing: 0.5,
    color: colors.danger,
    marginBottom: 2,
  },
  ticketTime: { fontFamily: fonts.hand.bold, fontSize: 19, lineHeight: 23, marginTop: 2 },
  place: { fontFamily: fonts.ui.semibold, fontSize: 14, marginTop: 6, opacity: 0.85 },
  listTitle: {
    fontFamily: fonts.hand.regular,
    fontSize: 26,
    lineHeight: 30,
    marginTop: 2,
    marginBottom: 4,
    textDecorationLine: 'underline',
  },
  listItems: { gap: 4, marginTop: 6 },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderBottomWidth: 1,
    borderColor: colors.hairline,
    paddingBottom: 4,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxDone: { backgroundColor: colors.ink, borderColor: colors.ink },
  checkmark: { color: colors.paper, fontSize: 12, fontWeight: '800', marginTop: -1 },
  listText: { flex: 1, fontFamily: fonts.hand.regular, fontSize: 22, lineHeight: 24 },
  listMore: { fontFamily: fonts.ui.semibold, fontSize: 12, opacity: 0.6, marginTop: 8 },
  meta: {
    marginTop: 10,
    fontFamily: fonts.ui.semibold,
    fontSize: 11.5,
    opacity: 0.7,
    textAlign: 'right',
  },
});
