import { useState } from 'react';
import { View, Text, TextInput, ScrollView, Pressable, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { colors, fonts } from '../../../theme';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { useBoard, useBoards } from '../../../hooks/useBoard';
import { useSession } from '../../../store/session';

export default function BoardSettingsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const boardId = id as string;
  const { board, updateName, deleteBoard, leaveBoard } = useBoard(boardId);
  const { boards } = useBoards();
  const user = useSession((s) => s.user);
  const [draftName, setDraftName] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const name = draftName ?? board?.name ?? '';

  const isOwner = board && user && board.ownerId === user.id;

  const saveName = async () => {
    if (!name.trim() || !board) return;
    setSaving(true);
    await updateName(name.trim());
    setSaving(false);
  };

  const confirmLeave = () => {
    Alert.alert('Leave this board?', 'You can rejoin anytime with the invite code.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: async () => {
          await leaveBoard();
          router.replace('/');
        },
      },
    ]);
  };

  const confirmDelete = () => {
    Alert.alert('Delete this board?', 'All notes will be permanently removed for everyone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete board',
        style: 'destructive',
        onPress: async () => {
          await deleteBoard();
          router.replace('/');
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader title="Board settings" />
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.sectionLabel}>Board name</Text>
        <View style={styles.nameRow}>
          <TextInput
            style={styles.nameInput}
            value={name}
            onChangeText={setDraftName}
            placeholder="Board name"
            placeholderTextColor={colors.inkFaint}
          />
          <Pressable
            onPress={saveName}
            disabled={saving || !name.trim() || name.trim() === board?.name}
            style={[
              styles.saveBtn,
              (saving || !name.trim() || name.trim() === board?.name) && styles.saveDisabled,
            ]}
          >
            <Text style={styles.saveText}>Save</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionLabel}>Members</Text>
        <Pressable
          style={styles.row}
          onPress={() => router.push(`/board/${boardId}/people`)}
        >
          <Text style={styles.rowText}>Invite people</Text>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
        <Pressable
          style={styles.row}
          onPress={() => router.push(`/board/${boardId}/people`)}
        >
          <Text style={styles.rowText}>People</Text>
          <Text style={styles.chevron}>›</Text>
        </Pressable>

        <Text style={styles.sectionLabel}>Your boards</Text>
        {(boards ?? []).map((b) => (
          <Pressable
            key={b.id}
            style={styles.row}
            onPress={() => {
              if (b.id !== boardId) router.replace(`/board/${b.id}`);
            }}
          >
            <Text style={styles.rowText} numberOfLines={1}>
              {b.name}
            </Text>
            {b.id === boardId ? <Text style={styles.currentBadge}>Current</Text> : <Text style={styles.chevron}>›</Text>}
          </Pressable>
        ))}
        <Pressable style={styles.row} onPress={() => router.push('/create')}>
          <Text style={styles.rowText}>＋ New board</Text>
          <Text style={styles.chevron}>›</Text>
        </Pressable>

        <Text style={styles.sectionLabel}>Danger zone</Text>
        <Pressable style={styles.row} onPress={confirmLeave}>
          <Text style={[styles.rowText, styles.dangerText]}>Leave board</Text>
        </Pressable>
        {isOwner ? (
          <Pressable style={styles.row} onPress={confirmDelete}>
            <Text style={[styles.rowText, styles.dangerText]}>Delete board</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  body: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 32 },
  sectionLabel: {
    fontFamily: fonts.ui.bold,
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.inkFaint,
    marginTop: 22,
    marginBottom: 8,
  },
  nameRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  nameInput: {
    flex: 1,
    height: 52,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    fontFamily: fonts.ui.semibold,
    fontSize: 16,
    color: colors.ink,
  },
  saveBtn: {
    height: 52,
    paddingHorizontal: 18,
    borderRadius: 16,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveDisabled: { opacity: 0.4 },
  saveText: { fontFamily: fonts.ui.bold, color: colors.background, fontSize: 15 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  rowText: {
    fontFamily: fonts.ui.semibold,
    fontSize: 16,
    color: colors.ink,
  },
  dangerText: { color: colors.danger },
  chevron: { fontSize: 22, color: colors.inkFaint },
  currentBadge: {
    fontFamily: fonts.ui.bold,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.accentDeep,
  },
});
