import { useEffect, useState } from 'react';
import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import { NoteWithAuthor } from '../types';
import { colors, noteColors, fonts } from '../theme';
import { FastenerView, fastenerForNote } from './Pin';
import { expiresShort, clockTime } from '../utils/time';
import {
  fontSizeForText,
  parseListItems,
  pinVariantForNote,
  PinVariant,
} from '../utils/note';

type Props = {
  note: NoteWithAuthor;
  large?: boolean;
  showAttribution?: boolean;
  /** Floor for the rendered height, so small papers still fill their slot. */
  minHeight?: number;
  /** When provided (detail screen), list checkboxes become tappable for everyone. */
  onToggleItem?: (index: number) => void;
};

const RADIUS: Record<PinVariant, number> = {
  mini: 2,
  note: 2,
  announcement: 3,
  photo: 4,
  list: 6,
  appointment: 2,
  receipt: 3,
};

const LINES: Record<PinVariant, number> = {
  mini: 3,
  note: 6,
  announcement: 8,
  photo: 4,
  list: 99,
  appointment: 5,
  receipt: 8,
};

const ratioCache = new Map<string, number>();

/** Measured width/height of a photo so the polaroid fits it exactly — never cropped. */
function useImageRatio(uri: string | null): number | null {
  const [ratio, setRatio] = useState<number | null>(() =>
    uri ? (ratioCache.get(uri) ?? null) : null,
  );

  useEffect(() => {
    if (!uri || ratioCache.has(uri)) return;
    let alive = true;
    Image.getSize(
      uri,
      (w, h) => {
        if (!alive || w <= 0 || h <= 0) return;
        const r = w / h;
        ratioCache.set(uri, r);
        setRatio(r);
      },
      () => {
        if (alive) {
          ratioCache.set(uri, 4 / 3);
          setRatio(4 / 3);
        }
      },
    );
    return () => {
      alive = false;
    };
  }, [uri]);

  return ratio;
}

export function NotePaper({
  note,
  large = false,
  showAttribution = true,
  minHeight,
  onToggleItem,
}: Props) {
  const variant = pinVariantForNote(note);
  const palette = noteColors[note.color];
  const done = Boolean(note.completedAt);
  const expiry = expiresShort(note.expiresAt);

  const isPhoto = variant === 'photo';
  const isList = variant === 'list';
  const isSticky = variant === 'note' || variant === 'mini' || variant === 'announcement' || variant === 'appointment';
  // Notebook / polaroid / slip papers are warm white; stickies keep their pastel color.
  const cardBg = isPhoto || isList ? '#FFFDF7' : palette.bg;
  const ink = isList ? colors.ink : palette.ink;

  const rawData = note.data as { eventAt?: unknown } | null;
  const eventIso =
    rawData && typeof rawData.eventAt === 'string' && rawData.eventAt ? rawData.eventAt : null;
  const eventDate = eventIso ? new Date(eventIso) : null;
  const validEventDate = eventDate && !Number.isNaN(eventDate.getTime()) ? eventDate : null;
  const photoRatio = useImageRatio(isPhoto ? note.imageUrl : null);

  const bodyFontSize =
    variant === 'mini'
      ? 19
      : variant === 'announcement'
        ? large
          ? 32
          : 27
        : variant === 'appointment'
          ? large
            ? 26
            : 22
          : large
            ? 30
            : fontSizeForText(note.text);

  return (
    <View
      style={[
        styles.paper,
        {
          backgroundColor: cardBg,
          borderColor: isPhoto || isList ? '#EAE0CC' : palette.edge,
          borderWidth: isSticky ? 0 : 1,
          shadowColor: isPhoto || isList ? colors.shadow : palette.shadow,
          shadowOpacity: isSticky ? 0.28 : 0.22,
          shadowRadius: isSticky ? 10 : 7,
          shadowOffset: isSticky ? { width: 0, height: 6 } : { width: 0, height: 4 },
          elevation: isSticky ? 5 : 4,
          borderRadius: RADIUS[variant],
          borderTopWidth: isList ? 0 : undefined,
          minHeight: minHeight ?? undefined,
          padding: large ? 22 : variant === 'mini' ? 12 : variant === 'receipt' ? 14 : 16,
          paddingTop: isList ? (large ? 36 : 32) : undefined,
          paddingLeft: undefined,
          paddingBottom: isPhoto ? (large ? 18 : 14) : undefined,
        },
      ]}
    >
      <FastenerView fastener={fastenerForNote(note.id, variant)} />

      {isList ? (
        <View style={styles.holes} pointerEvents="none">
          {[0, 1, 2, 3, 4].map((i) => (
            <View key={i} style={styles.tornHole}>
              <View style={styles.tornSlit} />
              <View style={styles.hole} />
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.body}>
      {isPhoto && note.imageUrl ? (
        <Image
          source={{ uri: note.imageUrl }}
          style={[styles.image, { borderRadius: 2, aspectRatio: photoRatio ?? 4 / 3 }]}
          resizeMode="cover"
        />
      ) : null}

      {variant === 'list' ? (
        <ListBody note={note} large={large} ink={ink} done={done} onToggleItem={onToggleItem} />
      ) : variant === 'appointment' ? (
        <View>
          <Text
            numberOfLines={large ? undefined : 3}
            style={[
              styles.text,
              styles.ticketText,
              {
                color: ink,
                fontSize: bodyFontSize,
                lineHeight: bodyFontSize * 1.2,
                textDecorationLine: done ? 'line-through' : 'none',
                opacity: done ? 0.55 : 1,
              },
            ]}
          >
            {note.text}
          </Text>
          {validEventDate ? (
            <View style={styles.apptEvent}>
              <Text style={[styles.apptEventDate, { color: ink }]}>
                {validEventDate.toLocaleDateString(undefined, {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                })}
              </Text>
              <Text style={[styles.apptEventTime, { color: ink }]}>
                {clockTime(validEventDate.toISOString())}
              </Text>
            </View>
          ) : null}
        </View>
      ) : variant === 'receipt' ? (
        <View>
          <Text style={styles.receiptKicker}>· NOTE ·</Text>
          <View style={styles.receiptRule} />
          <Text
            numberOfLines={large ? undefined : LINES[variant]}
            style={[
              styles.receiptText,
              {
                textDecorationLine: done ? 'line-through' : 'none',
                opacity: done ? 0.55 : 1,
              },
            ]}
          >
            {note.text}
          </Text>
          <View style={styles.receiptRule} />
        </View>
      ) : !isPhoto || note.text.trim() ? (
        <Text
          numberOfLines={large ? undefined : LINES[variant]}
          style={[
            styles.text,
            variant === 'mini' && styles.miniText,
            variant === 'announcement' && styles.announcementText,
            isPhoto && styles.photoCaption,
            {
              color: ink,
              fontSize: bodyFontSize,
              lineHeight: bodyFontSize * 1.25,
              textDecorationLine: done ? 'line-through' : 'none',
              opacity: done ? 0.55 : 1,
            },
          ]}
        >
          {note.text}
        </Text>
      ) : null}
      </View>

      {showAttribution && (note.author || expiry) ? (
        <View style={[styles.attribution, isPhoto && styles.photoAttribution]}>
          {note.author ? (
            <Text
              numberOfLines={1}
              style={[styles.signature, { color: ink, fontSize: large ? 26 : 21 }]}
            >
              - {note.author.displayName}
            </Text>
          ) : null}
          {expiry ? (
            <Text style={[styles.expiryInline, { color: ink }]}>· ⏳ {expiry}</Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function ListBody({
  note,
  large,
  ink,
  done,
  onToggleItem,
}: {
  note: NoteWithAuthor;
  large: boolean;
  ink: string;
  done: boolean;
  onToggleItem?: (index: number) => void;
}) {
  const { title, items } = parseListItems(note.text);
  const visible = large ? items : items.slice(0, 6);
  const truncated = visible.length < items.length;
  return (
    <View>
      {title ? (
        <Text style={[styles.listTitle, { color: ink }]} numberOfLines={2}>
          {title}
        </Text>
      ) : null}
      <View style={styles.listItems}>
        {visible.map((item, i) => {
          const checked = item.done || done;
          const rowBody = (
            <>
              <View
                style={[
                  styles.checkbox,
                  { borderColor: ink },
                  checked && { backgroundColor: ink, borderColor: ink },
                ]}
              >
                {checked && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text
                style={[
                  styles.listText,
                  {
                    color: ink,
                    textDecorationLine: checked ? 'line-through' : 'none',
                    opacity: checked ? 0.55 : 1,
                  },
                ]}
                numberOfLines={2}
              >
                {item.text}
              </Text>
            </>
          );
          return onToggleItem ? (
            <Pressable
              key={`${item.text}-${i}`}
              style={styles.listRow}
              onPress={() => onToggleItem(i)}
              hitSlop={4}
              accessibilityRole="checkbox"
              accessibilityState={{ checked }}
            >
              {rowBody}
            </Pressable>
          ) : (
            <View key={`${item.text}-${i}`} style={styles.listRow}>
              {rowBody}
            </View>
          );
        })}
      </View>
      {!large && truncated ? (
        <Text style={[styles.listMore, { color: ink }]}>+{items.length - visible.length} more</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  paper: {
    borderWidth: 1,
    shadowOpacity: 0.22,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  // Grows to fill any spare height (from minHeight) so the text sits centred
  // and the attribution is pushed to the bottom edge.
  body: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  holes: {
    position: 'absolute',
    top: 0,
    left: 18,
    right: 18,
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    zIndex: 1,
  },
  tornHole: {
    alignItems: 'center',
    width: 12,
  },
  tornSlit: {
    width: 5,
    height: 9,
    backgroundColor: colors.background,
    marginBottom: -3,
  },
  hole: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: 'rgba(62, 54, 46, 0.28)',
  },
  image: {
    width: '100%',
    marginBottom: 10,
    marginTop: 8,
    backgroundColor: 'rgba(0,0,0,0.04)',
  },
  text: {
    fontFamily: fonts.hand.semibold,
  },
  miniText: {
    textAlign: 'center',
  },
  announcementText: {
    fontFamily: fonts.hand.bold,
  },
  photoCaption: {
    textAlign: 'center',
  },
  photoAttribution: {
    justifyContent: 'center',
  },
  ticketText: {
    fontFamily: fonts.hand.bold,
  },
  apptEvent: {
    marginTop: 6,
    gap: 1,
  },
  apptEventDate: {
    fontFamily: fonts.hand.regular,
    fontSize: 20,
    lineHeight: 24,
  },
  apptEventTime: {
    fontFamily: fonts.hand.bold,
    fontSize: 22,
    lineHeight: 26,
    textDecorationLine: 'underline',
  },
  receiptKicker: {
    fontFamily: fonts.ui.bold,
    fontSize: 10,
    letterSpacing: 2,
    textAlign: 'center',
    color: colors.inkFaint,
  },
  receiptRule: {
    borderTopWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    marginVertical: 8,
  },
  receiptText: {
    fontFamily: fonts.ui.semibold,
    fontSize: 13.5,
    lineHeight: 20,
    color: colors.ink,
  },
  listTitle: {
    fontFamily: fonts.hand.regular,
    fontSize: 26,
    lineHeight: 30,
    marginTop: 2,
    marginBottom: 4,
    textDecorationLine: 'underline',
  },
  listItems: {
    gap: 4,
    marginTop: 6,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderBottomWidth: 1,
    borderColor: 'rgba(62, 54, 46, 0.14)',
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
  checkmark: {
    color: '#FFFDF7',
    fontSize: 12,
    fontWeight: '800',
    marginTop: -1,
  },
  listText: {
    flex: 1,
    fontFamily: fonts.hand.regular,
    fontSize: 22,
    lineHeight: 24,
  },
  listMore: {
    fontFamily: fonts.ui.semibold,
    fontSize: 12,
    opacity: 0.6,
    marginTop: 8,
  },
  attribution: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'flex-end',
    marginTop: 12,
    gap: 6,
  },
  // Signed like a paper note: a dash and a handwritten name.
  signature: {
    flexShrink: 1,
    fontFamily: fonts.hand.semibold,
    opacity: 0.85,
  },
  expiryInline: {
    fontFamily: fonts.ui.semibold,
    fontSize: 12,
    opacity: 0.65,
  },
});
