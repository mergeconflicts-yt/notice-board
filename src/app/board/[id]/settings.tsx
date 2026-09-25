import { useState } from 'react';
import { View, Text, TextInput, ScrollView, Pressable, StyleSheet, Alert, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { boardColorKeys, boardColors, colors, fonts } from '../../../theme';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { Avatar } from '../../../components/Avatar';
import { useBoard, fetchRemovedItems } from '../../../hooks/useBoard';
import { useSession } from '../../../store/session';
import { useToast } from '../../../store/toast';
import {
  deleteBoard as apiDeleteBoard,
  friendlyMessage,
  getInviteLink,
  leaveBoard as apiLeaveBoard,
  renameBoard as apiRenameBoard,
  restoreItem as apiRestoreItem,
} from '../../../lib/api';
import { inviteMessage } from '../../../lib/inviteLinks';
import { BoardColor, ItemWithAuthor } from '../../../types';

export default function BoardSettingsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const boardId = id as string;
  const { board, members, reload } = useBoard(boardId);
  const user = useSession((s) => s.user);
  const [draftName, setDraftName] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [removed, setRemoved] = useState<ItemWithAuthor[] | null>(null);

  const name = draftName ?? board?.name ?? '';
  const myMembership = user ? members.find((m) => m.userId === user.id) : undefined;
  const isOwner = myMembership?.role === 'owner';
  const memberCount = members.length;

  const pickColor = async (color: BoardColor) => {
    if (!board || !isOwner) return;
    try {
      await apiRenameBoard(board.id, board.name, color);
      await reload();
    } catch (e) {
      useToast.getState().show(friendlyMessage(e));
    }
  };

  const saveName = async () => {
    if (!name.trim() || !board) return;
    try {
      await apiRenameBoard(board.id, name.trim(), board.color);
      setEditingName(false);
      setDraftName(null);
      await reload();
    } catch (e) {
      useToast.getState().show(friendlyMessage(e));
    }
  };

  const shareInvite = async () => {
    if (!board) return;
    try {
      const { token } = await getInviteLink(boardId);
      await Share.share({ message: inviteMessage(board.name, token) });
    } catch (e) {
      useToast.getState().show(friendlyMessage(e));
    }
  };

  const openRemoved = async () => {
    try {
      setRemoved(await fetchRemovedItems(boardId));
    } catch (e) {
      useToast.getState().show(friendlyMessage(e));
    }
  };

  const undoRemoved = async (item: ItemWithAuthor) => {
    try {
      await apiRestoreItem(item.id);
      setRemoved((prev) => (prev ? prev.filter((i) => i.id !== item.id) : prev));
      await reload();
    } catch (e) {
      useToast.getState().show(friendlyMessage(e));
    }
  };

  const confirmLeave = () => {
    Alert.alert('Leave this board?', 'You can rejoin with an invite link.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiLeaveBoard(boardId);
            router.replace('/');
          } catch (e) {
            useToast.getState().show(friendlyMessage(e));
          }
        },
      },
    ]);
  };

  const confirmDelete = () => {
    Alert.alert('Delete this board?', 'The board and all its posts will be removed for everyone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete board',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiDeleteBoard(boardId);
            router.replace('/');
          } catch (e) {
            useToast.getState().show(friendlyMessage(e));
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader title="Board settings" />
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <View style={[styles.idCard, { backgroundColor: boardColors[board?.color ?? 'sage'] }]}>
          <View style={styles.idTop}>
            <Text style={styles.idName} numberOfLines={2}>{board?.name ?? ''}</Text>
            {isOwner ? (
              <Pressable hitSlop={12} onPress={() => { setDraftName(board?.name ?? ''); setEditingName(true); }}>
                <MaterialCommunityIcons name="pencil-outline" size={22} color={colors.ink} />
              </Pressable>
            ) : null}
          </View>
          <Pressable style={styles.idPeople} onPress={() => router.push(`/board/${boardId}/people`)}>
            <View style={styles.stack}>
              {members.slice(0, 4).map((m, i) => (
                <View key={m.userId} style={[styles.stackAvatar, i > 0 && styles.stackOverlap]}>
                  <Avatar name={m.user.displayName} size={30} />
                </View>
              ))}
            </View>
            <Text style={styles.idCount}>
              {memberCount} {memberCount === 1 ? 'person' : 'people'}
            </Text>
          </Pressable>
        </View>

        {editingName ? (
          <View style={styles.editor}>
            <TextInput
              style={styles.editorInput}
              value={name}
              onChangeText={setDraftName}
              placeholder="Board name"
              placeholderTextColor={colors.inkFaint}
              maxLength={60}
              autoFocus
            />
            <View style={styles.editorActions}>
              <Pressable onPress={() => { setEditingName(false); setDraftName(null); }}>
                <Text style={styles.editorCancelText}>Cancel</Text>
              </Pressable>
              <Pressable onPress={saveName} style={styles.editorSave}>
                <Text style={styles.editorSaveText}>Save</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {isOwner ? (
          <>
            <Text style={styles.sectionLabel}>Board colour</Text>
            <View style={styles.swatches}>
              {boardColorKeys.map((k) => (
                <Pressable
                  key={k}
                  onPress={() => pickColor(k)}
                  accessibilityLabel={`${k} board colour`}
                  style={[
                    styles.swatch,
                    { backgroundColor: boardColors[k] },
                    board?.color === k && styles.swatchActive,
                  ]}
                />
              ))}
            </View>
          </>
        ) : null}

        <Text style={styles.sectionLabel}>Board</Text>
        <View style={styles.group}>
          <Pressable style={styles.row} onPress={() => router.push(`/board/${boardId}/people`)}>
            <Text style={styles.rowLabel}>People</Text>
            <Text style={styles.rowValue}>{memberCount} members ›</Text>
          </Pressable>
          <View style={styles.divider} />
          <Pressable style={styles.row} onPress={shareInvite}>
            <Text style={styles.rowLabel}>Invite someone</Text>
            <MaterialCommunityIcons name="share-outline" size={22} color={colors.inkSoft} />
          </Pressable>
          <View style={styles.divider} />
          <Pressable style={styles.row} onPress={openRemoved}>
            <Text style={styles.rowLabel}>Removed posts</Text>
            <Text style={styles.rowValue}>Restore ›</Text>
          </Pressable>
        </View>

        {removed ? (
          <View style={styles.removedList}>
            {removed.length === 0 ? (
              <Text style={styles.rowValue}>Nothing removed in the last 30 days.</Text>
            ) : (
              removed.map((item) => (
                <View key={item.id} style={styles.removedRow}>
                  <Text style={styles.removedText} numberOfLines={1}>
                    {item.title ?? item.body ?? 'Post'}
                  </Text>
                  <Pressable onPress={() => undoRemoved(item)} hitSlop={8}>
                    <Text style={styles.restore}>Restore</Text>
                  </Pressable>
                </View>
              ))
            )}
          </View>
        ) : null}

        <Text style={styles.sectionLabel}>Board access</Text>
        <View style={styles.group}>
          {memberCount > 1 ? (
            <Pressable style={styles.row} onPress={confirmLeave}>
              <Text style={[styles.rowLabel, styles.dangerText]}>Leave board</Text>
            </Pressable>
          ) : null}
          {isOwner ? (
            <>
              {memberCount > 1 ? <View style={styles.divider} /> : null}
              <Pressable style={styles.row} onPress={confirmDelete}>
                <Text style={[styles.rowLabel, styles.dangerText]}>Delete board</Text>
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
  idCard: { borderRadius: 20, paddingHorizontal: 18, paddingVertical: 16 },
  idTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  idName: { flex: 1, fontFamily: fonts.hand.bold, fontSize: 30, lineHeight: 32, color: colors.ink },
  idPeople: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  stack: { flexDirection: 'row', alignItems: 'center' },
  stackAvatar: { borderRadius: 17, borderWidth: 2, borderColor: colors.avatarRing },
  stackOverlap: { marginLeft: -10 },
  idCount: { fontFamily: fonts.ui.regular, fontSize: 14, color: colors.inkSoft },
  editor: { marginTop: 14, gap: 10 },
  editorInput: {
    height: 50,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    fontFamily: fonts.ui.semibold,
    fontSize: 16,
    color: colors.ink,
  },
  editorActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  editorCancelText: { fontFamily: fonts.ui.semibold, fontSize: 15, color: colors.inkSoft, paddingVertical: 10, paddingHorizontal: 14 },
  editorSave: { paddingVertical: 10, paddingHorizontal: 22, borderRadius: 14, backgroundColor: colors.ink },
  editorSaveText: { fontFamily: fonts.ui.bold, fontSize: 15, color: colors.background },
  sectionLabel: { fontFamily: fonts.ui.regular, fontSize: 17, color: colors.ink, marginTop: 26, marginBottom: 10, paddingLeft: 4 },
  swatches: { flexDirection: 'row', gap: 12, paddingLeft: 4 },
  swatch: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: 'transparent' },
  swatchActive: { borderColor: colors.ink },
  group: { backgroundColor: colors.surface, borderRadius: 18, paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 15 },
  rowLabel: { fontFamily: fonts.ui.semibold, fontSize: 16, color: colors.ink, flexShrink: 1 },
  rowValue: { fontFamily: fonts.ui.regular, fontSize: 15, color: colors.inkSoft },
  chevron: { fontSize: 22, color: colors.inkFaint },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  removedList: { marginTop: 12, gap: 8 },
  removedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  removedText: { flex: 1, fontFamily: fonts.ui.semibold, fontSize: 15, color: colors.ink },
  restore: { fontFamily: fonts.ui.bold, fontSize: 14, color: colors.accentDeep },
  dangerText: { color: colors.danger },
});
