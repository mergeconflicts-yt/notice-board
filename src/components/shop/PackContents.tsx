import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, doorTints, fonts, noteColorKeys, noteColorNames, noteColors } from '../../theme';
import { artSources } from '../../lib/packAssets';
import { MemberDot } from '../MemberDot';
import { MagnetArt } from '../MagnetArt';
import { NotePaper, PaperTexture } from '../NotePaper';
import { holderStyleFor } from '../Pin';
import type {
  Board,
  BoardMember,
  ItemColor,
  ItemWithAuthor,
  PackArt,
  PackDetailPack,
  PackSpecPaper,
  ShopCardArt,
} from '../../types';

const PAPER_NAMES = noteColorNames;

function humanize(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function makePaperSample(color: ItemColor): ItemWithAuthor {
  const now = new Date().toISOString();
  return {
    id: `paper-sample-${color}`,
    boardId: 'sample',
    type: 'note',
    color,
    paperStyle: null,
    body: 'Groceries\nMilk · Bread · Coffee',
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
    createdBy: 'sample-user',
    updatedBy: null,
    deletedAt: null,
    deletedBy: null,
    version: 1,
    createdAt: now,
    updatedAt: now,
    author: null,
  };
}

type Props = {
  pack: PackDetailPack;
  art: PackArt[];
  board: Board | null;
  members: BoardMember[];
  owned: boolean;
};

type PaperChoice = {
  key: string;
  name: string;
  color?: ItemColor;
  paper?: PackSpecPaper;
};

function ArtTile({ art }: { art: PackArt }) {
  const source = artSources(art)?.body;
  const isMagnet = art.kind === 'magnet' || art.kind === 'sticker' || art.kind === 'fastener';
  return (
    <View style={styles.tile}>
      <View style={styles.tileArt}>
        {isMagnet ? (
          <MagnetArt art={art} size={54} />
        ) : source ? (
          <Image
            source={source}
            style={styles.tileImage}
            contentFit="contain"
            cachePolicy="disk"
            accessible={false}
          />
        ) : (
          <View style={styles.tileMissing} />
        )}
      </View>
      <Text style={styles.tileLabel} numberOfLines={2}>
        {art.label}
      </Text>
    </View>
  );
}

function IncludeTile({ name, art }: { name: string; art?: ShopCardArt }) {
  const packArt: PackArt | null = art
    ? {
        artId: art.artId,
        packId: art.packId,
        kind: art.kind,
        label: art.label,
        path: art.path,
        w: null,
        h: null,
      }
    : null;
  const source = packArt ? artSources(packArt)?.body : null;
  const isMagnet =
    packArt?.kind === 'magnet' || packArt?.kind === 'sticker' || packArt?.kind === 'fastener';
  return (
    <View style={styles.tile}>
      <View style={styles.tileArt}>
        {packArt && isMagnet ? (
          <MagnetArt art={packArt} size={54} />
        ) : source ? (
          <Image
            source={source}
            style={styles.tileImage}
            contentFit="contain"
            cachePolicy="disk"
            accessible={false}
          />
        ) : (
          <View style={styles.tileMissing} />
        )}
      </View>
      <Text style={styles.tileLabel} numberOfLines={2}>
        {name}
      </Text>
    </View>
  );
}

function SectionHead({ title, count }: { title: string; count: string }) {
  return (
    <View style={styles.sectionHead}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionCount}>{count}</Text>
    </View>
  );
}

export function PackContents({ pack, art, board, members, owned }: Props) {
  const [paperPreview, setPaperPreview] = useState<PaperChoice | null>(null);
  const holderStyle = holderStyleFor(pack.spec.holder);
  const door = pack.spec.door;
  const hasDoor = Boolean(door) || pack.kind === 'theme';
  const doorColor = door?.base ?? doorTints[board?.color ?? 'sage'].base;
  const doorName = door?.name ?? 'Door finish';
  const handle = typeof door?.handle === 'string' ? door.handle : null;

  const magnets = art.filter((item) => item.kind === 'magnet');
  const stickers = art.filter((item) => item.kind === 'sticker');
  const fasteners = art.filter((item) => item.kind === 'fastener');
  const includes = pack.bundleItems ?? [];
  const specPapers = Array.isArray(pack.spec.papers)
    ? pack.spec.papers.filter(
        (paper): paper is PackSpecPaper => Boolean(paper) && typeof paper === 'object',
      )
    : [];
  const specPaperCount = specPapers.length;
  const paperCount =
    specPaperCount > 0 ? specPaperCount : art.filter((item) => item.kind === 'paper').length;
  const useSpecPapers = specPapers.some((paper) => typeof paper.bg === 'string');
  const papers: PaperChoice[] = useSpecPapers
    ? specPapers.map((paper, index) => ({
        key: paper.id ?? paper.name ?? `paper-${index}`,
        name: paper.name ?? humanize(paper.id ?? `Paper ${index + 1}`),
        paper,
      }))
    : paperCount > 0
      ? noteColorKeys.slice(0, Math.min(paperCount, noteColorKeys.length)).map((color) => ({
          key: color,
          name: PAPER_NAMES[color],
          color,
        }))
      : [];
  const paperBg = (choice: PaperChoice) =>
    choice.paper?.bg ?? (choice.color ? noteColors[choice.color].bg : colors.paper);
  const paperInk = (choice: PaperChoice) =>
    choice.paper?.ink ?? (choice.color ? noteColors[choice.color].ink : colors.ink);

  const boardName = board?.name ?? 'this fridge';
  const people = members.length;
  const sharingText = owned
    ? `Everyone on ${boardName} gets it. ${
        people > 0 ? `All ${people} ${people === 1 ? 'person' : 'people'} can` : 'Everyone can'
      } use the magnets, stickers and papers. Notes keep their paper if you change the door later.`
    : `Buy once. Everyone on ${boardName} gets it — magnets, stickers and papers. Notes keep their paper if you change the door later.`;

  return (
    <>
      <View style={styles.wrap}>
        <Text style={styles.title}>{pack.name}</Text>
      {pack.blurb ? <Text style={styles.blurb}>{pack.blurb}</Text> : null}

      <View style={styles.card}>
        <Text style={styles.eyebrow}>EVERYTHING IN THIS PACK</Text>

        {hasDoor ? (
          <View style={styles.section}>
            <SectionHead title="Door" count="1 finish" />
            <View style={styles.doorRow}>
              <View style={[styles.doorSwatch, { backgroundColor: doorColor }]}>
                <View style={styles.doorHandle} />
              </View>
              <View style={styles.doorCopy}>
                <Text style={styles.itemTitle}>{doorName}</Text>
                {handle ? <Text style={styles.itemSub}>{humanize(handle)} handle</Text> : null}
                <Text style={styles.itemSub}>The board owner sets the door.</Text>
              </View>
            </View>
          </View>
        ) : null}

        {papers.length > 0 ? (
          <View style={styles.section}>
            <SectionHead title="Papers" count={String(papers.length)} />
            <View style={styles.grid}>
              {papers.map((choice) => {
                const bg = paperBg(choice);
                const ink = paperInk(choice);
                const texture = choice.paper?.texture;
                return (
                  <Pressable
                    key={choice.key}
                    onPress={() => setPaperPreview(choice)}
                    style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}
                    accessibilityRole="button"
                    accessibilityLabel={`Preview ${choice.name} paper`}
                  >
                    <View
                      style={[
                        styles.paperSwatch,
                        { backgroundColor: bg, borderColor: colors.paperEdge },
                      ]}
                    >
                      <PaperTexture
                        texture={texture}
                        ink={ink}
                        header={choice.paper?.header}
                      />
                      <View style={styles.paperPin} />
                    </View>
                    <Text style={styles.tileLabel} numberOfLines={1}>
                      {choice.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        {magnets.length > 0 ? (
          <View style={styles.section}>
            <SectionHead title="Magnets" count={String(magnets.length)} />
            <View style={styles.grid}>
              {magnets.map((item) => (
                <ArtTile key={item.artId} art={item} />
              ))}
            </View>
          </View>
        ) : null}

        {stickers.length > 0 ? (
          <View style={styles.section}>
            <SectionHead title="Stickers" count={String(stickers.length)} />
            <View style={styles.grid}>
              {stickers.map((item) => (
                <ArtTile key={item.artId} art={item} />
              ))}
            </View>
          </View>
        ) : null}

        {fasteners.length > 0 ? (
          <View style={styles.section}>
            <SectionHead title="Holds notes" count={String(fasteners.length)} />
            <View style={styles.fastenerList}>
              {fasteners.map((item) => (
                <View key={item.artId} style={styles.fastenerRow}>
                  <View style={styles.fastenerArt}>
                    <MagnetArt art={item} size={54} />
                  </View>
                  <Text style={styles.fastenerLabel} numberOfLines={2}>
                    {item.label}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {includes.length > 0 ? (
          <View style={styles.section}>
            <SectionHead title="Includes" count={String(includes.length)} />
            <View style={styles.grid}>
              {includes.map((item) => (
                <IncludeTile key={item.id} name={item.name} art={item.cardArt[0]} />
              ))}
            </View>
          </View>
        ) : null}
      </View>

      <View style={styles.shareCard}>
        <View style={styles.avatars}>
          {members.slice(0, 4).map((member) => (
            <View key={member.userId} style={styles.avatar}>
              <MemberDot
                seed={member.userId}
                name={member.user.displayName}
                size={24}
              />
            </View>
          ))}
        </View>
        <Text style={styles.shareText}>{sharingText}</Text>
      </View>
    </View>

    <Modal
      visible={paperPreview !== null}
      transparent
      animationType="fade"
      onRequestClose={() => setPaperPreview(null)}
    >
      <View style={styles.modalRoot}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => setPaperPreview(null)}
          accessibilityRole="button"
          accessibilityLabel="Close paper preview"
        />
        <View style={styles.modalCard} accessibilityViewIsModal>
          <View style={styles.modalHead}>
            <View style={styles.modalHeading}>
              <Text style={styles.modalEyebrow}>PAPER PREVIEW</Text>
              <Text style={styles.modalTitle}>
                {paperPreview ? paperPreview.name : ''}
              </Text>
            </View>
            <Pressable
              onPress={() => setPaperPreview(null)}
              style={styles.modalClose}
              accessibilityRole="button"
              accessibilityLabel="Close paper preview"
            >
              <MaterialCommunityIcons name="close" size={22} color={colors.ink} />
            </Pressable>
          </View>

          {paperPreview ? (
            <View style={styles.modalPaper}>
              <NotePaper
                item={makePaperSample(paperPreview.color ?? 'paper')}
                holderStyle={holderStyle}
                paperStyle={
                  paperPreview.paper
                    ? {
                        bg: paperPreview.paper.bg,
                        ink: paperPreview.paper.ink,
                        edge: colors.paperEdge,
                        texture: paperPreview.paper.texture,
                        header: paperPreview.paper.header,
                      }
                    : null
                }
              />
            </View>
          ) : null}

          <Text style={styles.modalHint}>
            This is the paper as it appears on the fridge.
          </Text>
        </View>
      </View>
    </Modal>
  </>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 20, paddingTop: 16 },
  title: {
    fontFamily: fonts.ui.extraBold,
    fontSize: 30,
    lineHeight: 34,
    color: colors.ink,
  },
  blurb: {
    marginTop: 4,
    fontFamily: fonts.ui.regular,
    fontSize: 15,
    lineHeight: 21,
    color: colors.inkSoft,
  },
  card: {
    marginTop: 16,
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  eyebrow: {
    fontFamily: fonts.ui.extraBold,
    fontSize: 12,
    letterSpacing: 1.2,
    color: colors.inkSoft,
    marginBottom: 4,
  },
  section: {
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: {
    fontFamily: fonts.ui.extraBold,
    fontSize: 18,
    color: colors.ink,
  },
  sectionCount: {
    fontFamily: fonts.ui.semibold,
    fontSize: 13,
    color: colors.inkSoft,
  },
  doorRow: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  doorSwatch: {
    width: 98,
    height: 72,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.12)',
    justifyContent: 'center',
    paddingLeft: 10,
  },
  doorHandle: {
    width: 7,
    height: 34,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.15)',
  },
  doorCopy: { flex: 1, gap: 2 },
  itemTitle: {
    fontFamily: fonts.ui.extraBold,
    fontSize: 15,
    color: colors.ink,
  },
  itemSub: {
    fontFamily: fonts.ui.regular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.inkSoft,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  fastenerList: { gap: 10 },
  fastenerRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  fastenerArt: {
    width: 68,
    height: 62,
    borderRadius: 12,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  fastenerLabel: {
    flex: 1,
    fontFamily: fonts.ui.semibold,
    fontSize: 15,
    color: colors.ink,
  },
  tile: { width: 72, alignItems: 'center', gap: 5 },
  tilePressed: { opacity: 0.72 },
  tileArt: {
    width: 68,
    height: 62,
    borderRadius: 12,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  tileImage: { width: 54, height: 54 },
  tileMissing: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.hairline,
  },
  tileLabel: {
    fontFamily: fonts.ui.semibold,
    fontSize: 11,
    lineHeight: 14,
    color: colors.ink,
    textAlign: 'center',
  },
  paperSwatch: {
    width: 68,
    height: 62,
    borderRadius: 5,
    borderWidth: 1,
    shadowColor: colors.shadow,
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  paperPin: {
    position: 'absolute',
    top: -4,
    left: '50%',
    marginLeft: -5,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.accent,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.15)',
  },
  modalRoot: {
    flex: 1,
    backgroundColor: 'rgba(11, 45, 38, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.background,
    borderRadius: 24,
    padding: 20,
  },
  modalHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  modalHeading: { flex: 1, gap: 2 },
  modalEyebrow: {
    fontFamily: fonts.ui.extraBold,
    fontSize: 11,
    letterSpacing: 1.2,
    color: colors.inkSoft,
  },
  modalTitle: { fontFamily: fonts.hand.bold, fontSize: 28, color: colors.ink },
  modalClose: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: -8,
    marginRight: -8,
  },
  modalPaper: { marginTop: 12 },
  modalHint: {
    marginTop: 12,
    fontFamily: fonts.ui.regular,
    fontSize: 12,
    lineHeight: 17,
    color: colors.inkSoft,
    textAlign: 'center',
  },
  shareCard: {
    marginTop: 14,
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    flexDirection: 'row',
    gap: 12,
  },
  avatars: { flexDirection: 'row', alignItems: 'flex-start' },
  avatar: { marginLeft: -6, borderWidth: 2, borderColor: colors.surface, borderRadius: 99 },
  shareText: {
    flex: 1,
    fontFamily: fonts.ui.regular,
    fontSize: 13,
    lineHeight: 19,
    color: colors.ink,
  },
});
