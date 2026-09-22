import { useState } from 'react';
import { View, Text, TextInput, ScrollView, Pressable, StyleSheet, Alert, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, fonts, noteColors } from '../../../theme';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { Avatar } from '../../../components/Avatar';
import { useBoard, useBoards, useMembers } from '../../../hooks/useBoard';
import { useSession } from '../../../store/session';

export default function BoardSettingsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const boardId = id as string;
  const { board, updateName, deleteBoard, leaveBoard } = useBoard(boardId);
  const { boards } = useBoards();
  const { members } = useMembers(boardId);
  const user = useSession((s) => s.user);
  const [draftName, setDraftName] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [saving, setSaving] = useState(false);

  const name = draftName ?? board?.name ?? '';
  const isOwner = board && user && board.ownerId === user.id;
  const memberCount = members?.length ?? 0;

  const openEditor = () => {
    setDraftName(board?.name ?? '');
    setEditingName(true);
  };

  const saveName = async () => {
    if (!name.trim() || !board || saving) return;
    setSaving(true);
    try {
      await updateName(name.trim());
      setEditingName(false);
      setDraftName(null);
    } finally {
      setSaving(false);
    }
  };

  const shareInvite = async () => {
    if (!board) return;
    await Share.share({
      message: `Join my board "${board.name}" on Notice Board! Invite code: ${board.inviteCode}`,
    });
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
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <View style={styles.idCard}>
          <View style={styles.idTop}>
            <Text style={styles.idName} numberOfLines={2}>
              {board?.name ?? ''}
            </Text>
            <Pressable hitSlop={12} onPress={openEditor} style={styles.idEdit}>
              <MaterialCommunityIcons name="pencil-outline" size={22} color={colors.ink} />
            </Pressable>
          </View>
          <Pressable
            style={styles.idPeople}
            onPress={() => router.push(`/board/${boardId}/people`)}
          >
            <View style={styles.stack}>
              {(members ?? []).slice(0, 4).map((m, i) => (
                <View key={m.userId} style={[styles.stackAvatar, i > 0 && styles.stackOverlap]}>
                  <Avatar name={m.user.displayName} emoji={m.user.avatar} size={30} />
                </View>
              ))}
            </View>
            <Text style={styles.idCount}>
              {memberCount} {memberCount === 1 ? 'person' : 'people'}
            </Text>
          </Pressable>
        </View>

        <Text style={styles.sectionLabel}>Board</Text>
        <View style={styles.group}>
          <Pressable
            style={styles.row}
            onPress={() => (editingName ? setEditingName(false) : openEditor())}
          >
            <Text style={styles.rowLabel}>Board name</Text>
            <View style={styles.rowRight}>
              <Text style={styles.rowValue} numberOfLines={1}>
                {board?.name}
              </Text>
              <Text style={styles.chevron}>›</Text>
            </View>
          </Pressable>
          {editingName ? (
            <View style={styles.editor}>
              <TextInput
                style={styles.editorInput}
                value={name}
                onChangeText={setDraftName}
                placeholder="Board name"
                placeholderTextColor={colors.inkFaint}
                autoFocus
              />
              <View style={styles.editorActions}>
                <Pressable
                  onPress={() => {
                    setEditingName(false);
                    setDraftName(null);
                  }}
                  style={styles.editorCancel}
                >
                  <Text style={styles.editorCancelText}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={saveName}
                  disabled={saving || !name.trim() || name.trim() === board?.name}
                  style={[
                    styles.editorSave,
                    (saving || !name.trim() || name.trim() === board?.name) &&
                      styles.editorSaveDisabled,
                  ]}
                >
                  <Text style={styles.editorSaveText}>Save</Text>
                </Pressable>
              </View>
            </View>
          ) : null}
          <View style={styles.divider} />
          <Pressable style={styles.row} onPress={() => router.push(`/board/${boardId}/people`)}>
            <Text style={styles.rowLabel}>People</Text>
            <View style={styles.rowRight}>
              <Text style={styles.rowValue}>
                {memberCount} {memberCount === 1 ? 'member' : 'members'}
              </Text>
              <Text style={styles.chevron}>›</Text>
            </View>
          </Pressable>
          <View style={styles.divider} />
          <Pressable style={styles.row} onPress={shareInvite}>
            <Text style={styles.rowLabel}>Invite someone</Text>
            <View style={styles.rowRight}>
              <MaterialCommunityIcons
                name="share-outline"
                size={22}
                color={colors.inkSoft}
              />
              <Text style={styles.chevron}>›</Text>
            </View>
          </Pressable>
        </View>

        <Text style={styles.sectionLabel}>Your boards</Text>
        <View style={styles.group}>
          {(boards ?? []).map((b, i, arr) => {
            const current = b.id === boardId;
            return (
              <View key={b.id}>
                <Pressable
                  style={styles.row}
                  onPress={() => {
                    if (!current) router.replace(`/board/${b.id}`);
                  }}
                >
                  <Text style={styles.rowLabel} numberOfLines={1}>
                    {b.name}
                  </Text>
                  <View style={styles.rowRight}>
                    {current ? (
                      <View style={styles.currentPill}>
                        <MaterialCommunityIcons
                          name="check-circle"
                          size={18}
                          color="#6AA84F"
                        />
                        <Text style={styles.currentText}>Current</Text>
                      </View>
                    ) : null}
                    <Text style={styles.chevron}>›</Text>
                  </View>
                </Pressable>
                {i < arr.length ? <View style={styles.divider} /> : null}
              </View>
            );
          })}
          <Pressable style={styles.row} onPress={() => router.push('/create')}>
            <View style={styles.newBoardLeft}>
              <Text style={styles.newBoardPlus}>＋</Text>
              <Text style={styles.rowLabel}>New board</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionLabel}>Board access</Text>
        <View style={styles.group}>
          <Pressable style={styles.row} onPress={confirmLeave}>
            <View style={styles.accessLeft}>
              <MaterialCommunityIcons name="logout" size={22} color={colors.danger} />
              <Text style={[styles.rowLabel, styles.dangerText]}>Leave board</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
          {isOwner ? (
            <>
              <View style={styles.divider} />
              <Pressable style={styles.row} onPress={confirmDelete}>
                <View style={styles.accessLeft}>
                  <MaterialCommunityIcons
                    name="trash-can-outline"
                    size={22}
                    color={colors.danger}
                  />
                  <View>
                    <Text style={[styles.rowLabel, styles.dangerText]}>Delete board</Text>
                    <Text style={styles.deleteSub}>
                      Permanently removes the board for everyone.
                    </Text>
                  </View>
                </View>
                <Text style={styles.chevron}>›</Text>
              </Pressable>
            </>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  body: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 32 },
  idCard: {
    backgroundColor: noteColors.yellow.bg,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 16,
    shadowColor: colors.shadow,
    shadowOpacity: 0.22,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  idTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  idName: {
    flex: 1,
    fontFamily: fonts.hand.bold,
    fontSize: 32,
    lineHeight: 34,
    color: colors.ink,
  },
  idEdit: {
    padding: 4,
  },
  idPeople: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
  },
  stack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stackAvatar: {
    borderRadius: 17,
    borderWidth: 2,
    borderColor: noteColors.yellow.bg,
  },
  stackOverlap: {
    marginLeft: -10,
  },
  idCount: {
    fontFamily: fonts.ui.regular,
    fontSize: 14,
    color: colors.inkSoft,
  },
  sectionLabel: {
    fontFamily: fonts.ui.regular,
    fontSize: 17,
    color: colors.ink,
    marginTop: 26,
    marginBottom: 10,
    paddingLeft: 4,
  },
  group: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    paddingHorizontal: 16,
    shadowColor: colors.shadow,
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 15,
  },
  rowLabel: {
    fontFamily: fonts.ui.semibold,
    fontSize: 16,
    color: colors.ink,
    flexShrink: 1,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  rowValue: {
    fontFamily: fonts.ui.regular,
    fontSize: 15,
    color: colors.inkSoft,
    flexShrink: 1,
    textAlign: 'right',
  },
  chevron: {
    fontSize: 22,
    lineHeight: 22,
    color: colors.inkFaint,
  },
  divider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  editor: {
    paddingBottom: 14,
    gap: 10,
  },
  editorInput: {
    height: 50,
    backgroundColor: colors.background,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    fontFamily: fonts.ui.semibold,
    fontSize: 16,
    color: colors.ink,
  },
  editorActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  editorCancel: {
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  editorCancelText: {
    fontFamily: fonts.ui.semibold,
    fontSize: 15,
    color: colors.inkSoft,
  },
  editorSave: {
    paddingVertical: 10,
    paddingHorizontal: 22,
    borderRadius: 14,
    backgroundColor: colors.ink,
  },
  editorSaveDisabled: {
    opacity: 0.4,
  },
  editorSaveText: {
    fontFamily: fonts.ui.bold,
    fontSize: 15,
    color: colors.background,
  },
  currentPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  currentText: {
    fontFamily: fonts.ui.regular,
    fontSize: 14,
    color: colors.inkSoft,
  },
  newBoardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  newBoardPlus: {
    fontSize: 22,
    color: colors.ink,
    lineHeight: 24,
  },
  accessLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexShrink: 1,
  },
  dangerText: {
    color: colors.danger,
  },
  deleteSub: {
    fontFamily: fonts.ui.regular,
    fontSize: 13,
    color: colors.inkSoft,
    marginTop: 2,
  },
});
