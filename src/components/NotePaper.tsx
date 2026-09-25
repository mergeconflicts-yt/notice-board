import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import { ItemWithAuthor, ListEntry } from '../types';
import { colors, noteColors, fonts } from '../theme';
import { FastenerView, fastenerForItem } from './Pin';
import { MemberDot } from './MemberDot';
import {
  PaperVariant,
  formatEventTime,
  ticketDay,
  timeAgo,
  paperVariantFor,
} from '../utils/note';

type Props = {
  item: ItemWithAuthor;
  large?: boolean;
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

const RADIUS: Record<PaperVariant, number> = {
  note: 2,
  list: 6,
  appointment: 2,
  photo: 4,
};

const TITLE_LINES = 3;
const ENTRY_LIMIT = 6;

export function NotePaper({
  item,
  large = false,
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
  const isList = variant === 'list';
  const cardBg = item.color === 'paper' ? colors.paper : palette.bg;
  const borderColor = item.color === 'paper' ? colors.paperEdge : palette.edge;

  const bodyTrimmed = item.type === 'note' ? (item.body ?? '').trim() : '';
  // A short one-liner note gets the big hero treatment.
  const heroNote = bodyTrimmed.length > 0 && bodyTrimmed.length <= 20 && !bodyTrimmed.includes('\n');
  const bodyFontSize = large ? 26 : heroNote ? 32 : item.type === 'note' ? 20 : 18;

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
          shadowColor: palette.shadow,
          borderRadius: RADIUS[variant],
          minHeight: minHeight ?? undefined,
          padding: large ? 22 : variant === 'photo' ? 14 : 16,
          paddingTop: isList ? (large ? 34 : 30) : undefined,
        },
      ]}
    >
      <View accessible={false}>
        <FastenerView fastener={fastenerForItem(item.id, variant)} />
      </View>

      {isList ? (
        <View style={styles.holes} pointerEvents="none" accessible={false}>
          {[0, 1, 2, 3, 4].map((i) => (
            <View key={i} style={styles.tornHole}>
              <View style={styles.tornSlit} />
              <View style={styles.hole} />
            </View>
          ))}
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
        <View style={styles.attribution}>
          {authorName ? (
            <>
              <MemberDot
                seed={item.createdBy ?? authorName}
                name={authorName}
                size={large ? 26 : 22}
              />
              <Text
                numberOfLines={1}
                style={[styles.signature, { color: palette.ink, fontSize: large ? 20 : 16 }]}
              >
                {authorName}
              </Text>
            </>
          ) : null}
          {age ? (
            <Text style={[styles.age, { color: palette.ink }]}>
              {authorName ? `· ${age}` : age}
            </Text>
          ) : null}
        </View>
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
    // Deep, soft drop shadow so notes read as physically placed on the board
    // rather than painted flat onto it.
    shadowOpacity: 0.38,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  body: { flexGrow: 1, justifyContent: 'center' },
  holes: {
    position: 'absolute',
    top: 0,
    left: 18,
    right: 18,
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    zIndex: 1,
  },
  tornHole: { alignItems: 'center', width: 12 },
  tornSlit: { width: 5, height: 9, backgroundColor: colors.background, marginBottom: -3 },
  hole: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.divider,
  },
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
  attribution: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 12,
    gap: 6,
  },
  signature: { flexShrink: 1, fontFamily: fonts.hand.semibold, opacity: 0.85 },
  age: { fontFamily: fonts.ui.semibold, fontSize: 12, opacity: 0.65 },
});
