import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, doorTints, fonts } from '../../theme';
import { FridgeDoor } from '../FridgeDoor';
import { NotePaper } from '../NotePaper';
import { MagnetArt } from '../MagnetArt';
import { holderStyleFor } from '../Pin';
import type {
  Board,
  ItemColor,
  ItemWithAuthor,
  ListEntry,
  PackArt,
  PackDetailPack,
  PackSpecPaper,
} from '../../types';

type Props = {
  pack: PackDetailPack;
  art: PackArt[];
  board: Board | null;
  items: ItemWithAuthor[];
  entries: ListEntry[];
  photoUrl?: string | null;
  height: number;
  owned: boolean;
  onBack: () => void;
};

type SampleKind = 'note' | 'list' | 'date' | 'photo';

const SAMPLE_IDS: Record<SampleKind, string> = {
  note: 'sample-note',
  list: 'sample-list',
  date: 'sample-date',
  photo: 'sample-photo',
};

const SAMPLE_COLORS: Record<SampleKind, ItemColor> = {
  note: 'butter',
  list: 'sage',
  date: 'sky',
  photo: 'paper',
};

function sampleItem(kind: SampleKind): ItemWithAuthor {
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 86_400_000);
  tomorrow.setHours(9, 0, 0, 0);
  const base: ItemWithAuthor = {
    id: SAMPLE_IDS[kind],
    boardId: 'sample',
    type: kind,
    color: SAMPLE_COLORS[kind],
    paperStyle: null,
    body: null,
    title: null,
    eventAt: null,
    place: null,
    photoPath: null,
    sharedFromApp: null,
    sharedFromAuthor: null,
    layout: null,
    pinned: false,
    keepUntil: null,
    doneAt: null,
    doneBy: null,
    updatedBy: null,
    deletedAt: null,
    deletedBy: null,
    version: 1,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    author: null,
    createdBy: 'sample-user',
  };
  if (kind === 'note') {
    return { ...base, body: 'Sunflower22\nWi-Fi password' };
  }
  if (kind === 'list') {
    return { ...base, title: 'Groceries' };
  }
  if (kind === 'date') {
    return { ...base, title: 'Dentist', eventAt: tomorrow.toISOString(), place: 'Clinic' };
  }
  return { ...base, body: 'Beach day' };
}

const SAMPLE_ENTRIES: ListEntry[] = [
  { text: 'Milk', checked: true },
  { text: 'Bread', checked: false },
  { text: 'Coffee', checked: true },
].map((row, index) => {
  const now = new Date().toISOString();
  return {
    id: `sample-entry-${index + 1}`,
    itemId: SAMPLE_IDS.list,
    boardId: 'sample',
    text: row.text,
    position: index,
    checkedAt: row.checked ? now : null,
    checkedBy: null,
    createdBy: null,
    createdAt: now,
    updatedAt: now,
  };
});

const ART_SPOTS: {
  top?: `${number}%`;
  left?: `${number}%`;
  right?: `${number}%`;
  bottom?: `${number}%`;
  size: number;
  rotation: number;
}[] = [
  { top: '10%', left: '3%', size: 42, rotation: -8 },
  { top: '9%', right: '4%', size: 46, rotation: 7 },
  { top: '45%', right: '2%', size: 40, rotation: 10 },
  { top: '58%', left: '5%', size: 44, rotation: -5 },
  { bottom: '20%', right: '30%', size: 36, rotation: 4 },
];

/** The pack applied to the member's real board, rendered with the same
 *  fridge, paper and magnet components the board uses. */
export function PackPreview({
  pack,
  art,
  board,
  items,
  entries,
  photoUrl,
  height,
  owned,
  onBack,
}: Props) {
  const tint = doorTints[board?.color ?? 'sage'];
  const door = pack.spec.door;
  const tintOverride = door
    ? {
        light: door.light ?? tint.light,
        base: door.base ?? tint.base,
        shade: door.shade ?? tint.shade,
      }
    : undefined;

  const tiles = art
    .filter((item) => item.kind === 'magnet' || item.kind === 'sticker')
    .slice(0, 6);
  const badge = tiles[0] ?? null;
  const overlay = tiles.slice(1, 6);

  const actual = (kind: SampleKind) => items.find((item) => item.type === kind);
  const holderStyle = holderStyleFor(pack.spec.holder);
  const paperSpecs = Array.isArray(pack.spec.papers)
    ? pack.spec.papers.filter(
        (paper): paper is PackSpecPaper => Boolean(paper) && typeof paper === 'object',
      )
    : [];
  // A pack can tell the preview which paper suits each sample card (PRD
  // §9.1 `preview.papers`, in card order: note, list, date, photo).
  const previewPapers = Array.isArray(pack.spec.preview?.papers)
    ? pack.spec.preview.papers
    : null;
  const cards = (['note', 'list', 'date', 'photo'] as const).map((kind, index) => {
    const real = actual(kind);
    const item = real ?? sampleItem(kind);
    const itemEntries =
      kind === 'list'
        ? real
          ? entries.filter((entry) => entry.itemId === real.id)
          : SAMPLE_ENTRIES
        : [];
    const previewIndex = previewPapers?.[index];
    const paper =
      real
        ? null
        : (previewIndex !== undefined ? paperSpecs[previewIndex] : undefined) ??
          paperSpecs[index] ??
          paperSpecs[0];
    return { kind, item, entries: itemEntries, paper };
  });

  return (
    <View style={[styles.frameWrap, { height }]}>
      <FridgeDoor
        color={board?.color ?? 'sage'}
        placement="top"
        tintOverride={tintOverride}
        handlePosition="mid"
      >
        <View style={styles.doorContent}>
          <View style={styles.topBar}>
            <Pressable
              onPress={onBack}
              style={styles.back}
              accessibilityRole="button"
              accessibilityLabel="Back"
            >
              <MaterialCommunityIcons name="chevron-left" size={26} color={colors.onPine} />
            </Pressable>
            <View style={styles.nameWrap}>
              <View style={styles.namePill}>
                <Text style={styles.nameText} numberOfLines={1}>
                  {board?.name ?? pack.name}
                </Text>
              </View>
            </View>
            <View style={styles.topRight}>
              {!owned ? (
                <View style={styles.previewTag}>
                  <Text style={styles.previewTagText}>PREVIEW</Text>
                </View>
              ) : null}
            </View>
          </View>

          <View style={styles.previewBody}>
            <View style={styles.noteGrid}>
              {cards.map((card, index) => (
                <View
                  key={card.item.id}
                  style={[
                    styles.noteCell,
                    { transform: [{ rotate: `${[-2.2, 1.9, 1.4, -1.8][index]}deg` }] },
                  ]}
                >
                  <NotePaper
                    item={card.item}
                    entries={card.entries}
                    compact
                    maxEntries={2}
                    photoUrl={card.kind === 'photo' ? photoUrl : null}
                    holderStyle={holderStyle}
                    paperStyle={
                      card.paper
                        ? {
                            bg: card.paper.bg,
                            ink: card.paper.ink,
                            edge: colors.paperEdge,
                            texture: card.paper.texture,
                            header: card.paper.header,
                          }
                        : null
                    }
                  />
                </View>
              ))}
            </View>

            {overlay.map((item, index) => {
              const spot = ART_SPOTS[index % ART_SPOTS.length];
              const { size, rotation, ...position } = spot;
              return (
                <View key={item.artId} style={[styles.float, position]} pointerEvents="none">
                  <MagnetArt art={item} size={size} rotation={rotation} />
                </View>
              );
            })}
          </View>

          {badge ? (
            <View style={styles.badge} pointerEvents="none">
              <MagnetArt art={badge} size={38} />
            </View>
          ) : null}
        </View>
      </FridgeDoor>
    </View>
  );
}

const styles = StyleSheet.create({
  frameWrap: { marginHorizontal: 10, marginTop: 6 },
  doorContent: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  back: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(7, 51, 42, 0.55)',
  },
  nameWrap: { flex: 1, alignItems: 'center', paddingHorizontal: 8 },
  namePill: {
    maxWidth: 220,
    flexShrink: 1,
    height: 38,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(7, 51, 42, 0.7)',
    paddingHorizontal: 18,
  },
  nameText: { fontFamily: fonts.ui.extraBold, fontSize: 15, color: colors.onPine },
  topRight: { width: 72, alignItems: 'flex-end' },
  previewTag: {
    backgroundColor: colors.brandYellow,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  previewTagText: {
    fontFamily: fonts.ui.extraBold,
    fontSize: 9,
    letterSpacing: 1,
    color: colors.ink,
  },
  previewBody: {
    flex: 1,
    paddingLeft: 30,
    paddingRight: 18,
    paddingTop: 10,
    paddingBottom: 18,
  },
  noteGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 10,
  },
  noteCell: { width: '48%' },
  float: { position: 'absolute' },
  badge: {
    position: 'absolute',
    right: 16,
    bottom: 12,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.paper,
    borderWidth: 2,
    borderColor: colors.brandYellow,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
