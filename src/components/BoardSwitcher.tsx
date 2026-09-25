import { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Modal } from 'react-native';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, boardColors, fonts } from '../theme';
import { useMyBoards } from '../hooks/useBoards';
import { getMembers } from '../lib/api';

type Props = {
  visible: boolean;
  currentBoardId: string;
  onClose: () => void;
};

/**
 * Board switcher bottom sheet (opened from the board title chevron): the
 * caller's boards with member counts, New board, Join with an invite, and
 * Board settings.
 */
export function BoardSwitcher({ visible, currentBoardId, onClose }: Props) {
  const { boards, reload } = useMyBoards();
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (visible) void reload();
  }, [visible, reload]);

  useEffect(() => {
    if (!visible || boards.length === 0) return;
    let alive = true;
    void (async () => {
      try {
        const pairs = await Promise.all(
          boards.map(async (b) => [b.id, (await getMembers(b.id)).length] as const),
        );
        if (alive) setCounts(Object.fromEntries(pairs));
      } catch {
        // Names still render; counts fill in next time the sheet opens.
      }
    })();
    return () => {
      alive = false;
    };
  }, [visible, boards]);

  const goBoard = (id: string) => {
    if (id === currentBoardId) {
      onClose();
      return;
    }
    router.replace(`/board/${id}`);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.scrim} onPress={onClose} />
        <View style={styles.sheet}>
          <Text style={styles.label}>Your boards</Text>
          <View style={styles.group}>
          {boards.map((b) => {
            const count = counts[b.id];
            return (
              <Pressable
                key={b.id}
                style={styles.row}
                onPress={() => goBoard(b.id)}
                accessibilityRole="button"
                accessibilityLabel={`Open ${b.name}`}
              >
                <View style={[styles.chip, { backgroundColor: boardColors[b.color] }]} />
                <View style={styles.rowText}>
                  <Text style={styles.name} numberOfLines={1}>
                    {b.name}
                  </Text>
                  {count != null ? (
                    <Text style={styles.sub}>
                      {count} {count === 1 ? 'person' : 'people'}
                    </Text>
                  ) : null}
                </View>
                {b.id === currentBoardId ? (
                  <MaterialCommunityIcons name="check" size={24} color={colors.inkSoft} />
                ) : null}
              </Pressable>
            );
          })}
          </View>

          <View style={styles.group}>
          <Pressable
            style={styles.row}
            onPress={() => {
              onClose();
              router.push('/create');
            }}
            accessibilityRole="button"
            accessibilityLabel="New board"
          >
            <MaterialCommunityIcons name="plus" size={22} color={colors.ink} />
            <Text style={styles.actionLabel}>New board</Text>
          </Pressable>
          <Pressable
            style={styles.row}
            onPress={() => {
              onClose();
              router.push('/join');
            }}
            accessibilityRole="button"
            accessibilityLabel="Join with an invite"
          >
            <MaterialCommunityIcons name="link-variant" size={22} color={colors.ink} />
            <Text style={styles.actionLabel}>Join with an invite</Text>
          </Pressable>
          </View>

          <View style={styles.group}>
          <Pressable
            style={styles.row}
            onPress={() => {
              onClose();
              router.push(`/board/${currentBoardId}/settings`);
            }}
            accessibilityRole="button"
            accessibilityLabel="Board settings"
          >
            <MaterialCommunityIcons name="cog-outline" size={22} color={colors.ink} />
            <Text style={[styles.actionLabel, styles.settingsLabel]}>Board settings</Text>
            <MaterialCommunityIcons name="chevron-right" size={22} color={colors.inkFaint} />
          </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.scrim,
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 32,
    maxHeight: '92%',
    gap: 10,
  },
  label: {
    fontFamily: fonts.ui.semibold,
    fontSize: 14,
    color: colors.inkSoft,
    paddingLeft: 4,
  },
  group: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: colors.border,
    paddingHorizontal: 16,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  chip: { width: 46, height: 46, borderRadius: 12 },
  rowText: { flex: 1 },
  name: { fontFamily: fonts.ui.semibold, fontSize: 17, color: colors.ink },
  sub: { fontFamily: fonts.ui.regular, fontSize: 14, color: colors.inkSoft, marginTop: 2 },
  actionLabel: { fontFamily: fonts.ui.semibold, fontSize: 17, color: colors.ink },
  settingsLabel: { flex: 1 },
});
