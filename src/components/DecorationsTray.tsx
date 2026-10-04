import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, fonts } from '../theme';
import { MagnetArt } from './MagnetArt';
import { PackArt } from '../types';

type Props = {
  visible: boolean;
  art: PackArt[];
  /** The pack the board can currently use is already filtered by the caller. */
  hideDecorations: boolean;
  onToggleHide: () => void;
  onPlace: (artId: string) => void;
  onClose: () => void;
};

const CELL = 64;

/** Decorations tray (M-9, §6.1 interaction model): tap a magnet to drop it on
 *  the door, drag placed magnets in decorate mode. */
export function DecorationsTray({
  visible,
  art,
  hideDecorations,
  onToggleHide,
  onPlace,
  onClose,
}: Props) {
  const magnets = art.filter((a) => a.kind === 'magnet');
  const stickers = art.filter((a) => a.kind === 'sticker');
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
            onPress={onToggleHide}
            style={styles.hideBtn}
            accessibilityRole="switch"
            accessibilityState={{ checked: hideDecorations }}
            accessibilityLabel="Hide decorations"
          >
            <MaterialCommunityIcons
              name={hideDecorations ? 'eye-off-outline' : 'eye-outline'}
              size={18}
              color={colors.ink}
            />
            <Text style={styles.hideText}>{hideDecorations ? 'Hidden' : 'Hide'}</Text>
          </Pressable>
          <Pressable onPress={onClose} hitSlop={8} style={styles.doneBtn}>
            <Text style={styles.doneText}>Done</Text>
          </Pressable>
        </View>

        <Text style={styles.hint}>
          Tap a magnet or sticker to add it, then drag it on the fridge to move it.
        </Text>

        {magnets.length === 0 && stickers.length === 0 ? (
          <Text style={styles.empty}>Nothing to decorate with yet. The shop is coming soon.</Text>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false}>
            {magnets.length > 0 ? (
              <>
                <Text style={styles.section}>Magnets</Text>
                <View style={styles.grid}>{magnets.map(cell)}</View>
              </>
            ) : null}
            {stickers.length > 0 ? (
              <>
                <Text style={styles.section}>Stickers</Text>
                <View style={styles.grid}>{stickers.map(cell)}</View>
              </>
            ) : null}
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
    maxHeight: '60%',
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
  hideBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.accentWash,
  },
  hideText: { fontFamily: fonts.ui.semibold, fontSize: 13, color: colors.ink },
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
