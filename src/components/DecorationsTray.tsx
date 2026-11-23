import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, fonts } from '../theme';
import { getPacks } from '../lib/api';
import { MagnetArt } from './MagnetArt';
import { Pack, PackArt } from '../types';

type Props = {
  visible: boolean;
  art: PackArt[];
  onPlace: (artId: string) => void;
  onClose: () => void;
  onOpenShop: () => void;
};

const CELL = 64;

function packLabel(packId: string): string {
  return packId
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

/** Decorations tray (M-9, §6.1 interaction model): tap a magnet to drop it on
 *  the door, drag placed magnets in decorate mode. Items are grouped by pack so
 *  a long catalogue stays easy to scan. */
export function DecorationsTray({
  visible,
  art,
  onPlace,
  onClose,
  onOpenShop,
}: Props) {
  const [packs, setPacks] = useState<Pack[]>([]);
  useEffect(() => {
    if (!visible) return;
    let alive = true;
    void getPacks()
      .then((next) => {
        if (alive) setPacks(next);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [visible]);

  const groups = useMemo(() => {
    const order = new Map(packs.map((pack, index) => [pack.id, index]));
    const byPack = new Map<string, PackArt[]>();
    art.forEach((item) => {
      if (item.kind !== 'magnet' && item.kind !== 'sticker') return;
      const list = byPack.get(item.packId);
      if (list) list.push(item);
      else byPack.set(item.packId, [item]);
    });
    return [...byPack.entries()]
      .map(([packId, items]) => ({
        packId,
        name: packs.find((pack) => pack.id === packId)?.name ?? packLabel(packId),
        magnets: items.filter((item) => item.kind === 'magnet'),
        stickers: items.filter((item) => item.kind === 'sticker'),
      }))
      .filter((group) => group.magnets.length + group.stickers.length > 0)
      .sort((a, b) => {
        const rankA = order.get(a.packId) ?? Number.MAX_SAFE_INTEGER;
        const rankB = order.get(b.packId) ?? Number.MAX_SAFE_INTEGER;
        return rankA === rankB ? a.name.localeCompare(b.name) : rankA - rankB;
      });
  }, [art, packs]);

  // Close this sheet before opening the shop: otherwise the modal stays on top
  // of the pushed shop screen (and the board comes back still in decorate mode).
  const openShop = () => {
    onClose();
    onOpenShop();
  };
  const cell = (a: PackArt) => (
    <Pressable
      key={a.artId}
      onPress={() => onPlace(a.artId)}
      style={styles.cell}
      accessibilityRole="button"
      accessibilityLabel={`Add ${a.label}`}
    >
      <MagnetArt art={a} size={CELL - 12} />
      <Text numberOfLines={1} style={styles.cellLabel}>
        {a.label}
      </Text>
    </Pressable>
  );
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <View style={styles.header}>
          <Text style={styles.title}>Decorate</Text>
          <Pressable
            onPress={openShop}
            style={styles.shopBtn}
            accessibilityRole="button"
            accessibilityLabel="Get more packs, open the shop"
          >
            <MaterialCommunityIcons name="storefront-outline" size={16} color={colors.ink} />
            <Text style={styles.shopText}>Get more</Text>
          </Pressable>
          <Pressable onPress={onClose} hitSlop={8} style={styles.doneBtn}>
            <Text style={styles.doneText}>Done</Text>
          </Pressable>
        </View>

        <Text style={styles.hint}>
          Tap a magnet or sticker to add it, then drag it on the fridge to move it.
        </Text>

        {groups.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.empty}>Nothing to decorate with yet.</Text>
            <Pressable
              onPress={openShop}
              style={styles.emptyShop}
              accessibilityRole="button"
              accessibilityLabel="Get more packs"
            >
              <Text style={styles.emptyShopText}>Get more packs</Text>
            </Pressable>
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false}>
            {groups.map((group) => (
              <View key={group.packId}>
                <Text style={styles.packTitle}>{group.name}</Text>
                {group.magnets.length > 0 ? (
                  <>
                    <Text style={styles.section}>Magnets</Text>
                    <View style={styles.grid}>{group.magnets.map(cell)}</View>
                  </>
                ) : null}
                {group.stickers.length > 0 ? (
                  <>
                    <Text style={styles.section}>Stickers</Text>
                    <View style={styles.grid}>{group.stickers.map(cell)}</View>
                  </>
                ) : null}
              </View>
            ))}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: colors.scrim },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 18,
    paddingBottom: 28,
    maxHeight: '75%',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.hairline,
    marginTop: 10,
    marginBottom: 10,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { flex: 1, fontFamily: fonts.hand.bold, fontSize: 26, color: colors.ink },
  shopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 48,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: colors.selected,
  },
  shopText: { fontFamily: fonts.ui.bold, fontSize: 13, color: colors.ink },
  doneBtn: { paddingHorizontal: 8, paddingVertical: 6 },
  doneText: { fontFamily: fonts.ui.bold, fontSize: 15, color: colors.accentDeep },
  hint: {
    fontFamily: fonts.ui.regular,
    fontSize: 13,
    color: colors.inkSoft,
    marginTop: 6,
    marginBottom: 12,
  },
  empty: {
    fontFamily: fonts.ui.regular,
    fontSize: 14,
    color: colors.inkSoft,
    paddingVertical: 24,
    textAlign: 'center',
  },
  emptyWrap: { alignItems: 'center', paddingVertical: 12, gap: 4 },
  emptyShop: {
    minHeight: 48,
    borderRadius: 999,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brandYellow,
  },
  emptyShopText: { fontFamily: fonts.ui.extraBold, fontSize: 15, color: colors.ink },
  packTitle: {
    marginTop: 12,
    fontFamily: fonts.ui.extraBold,
    fontSize: 17,
    color: colors.ink,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingBottom: 8 },
  section: {
    fontFamily: fonts.ui.bold,
    fontSize: 13,
    color: colors.inkSoft,
    marginTop: 6,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  cell: {
    width: 80,
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: colors.surface,
  },
  cellLabel: {
    fontFamily: fonts.ui.regular,
    fontSize: 10,
    color: colors.inkSoft,
    maxWidth: 72,
    textAlign: 'center',
  },
});
