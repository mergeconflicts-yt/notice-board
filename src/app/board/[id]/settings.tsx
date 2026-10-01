import { useState } from 'react';
import { View, Text, TextInput, ScrollView, Pressable, StyleSheet, Alert, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { offeredBoardColors, boardColors, colors, doorInk, doorSoft, fonts } from '../../../theme';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { Avatar } from '../../../components/Avatar';
import { useBoard } from '../../../hooks/useBoard';
import { useSession } from '../../../store/session';
import { useToast } from '../../../store/toast';
import {
  deleteBoard as apiDeleteBoard,
  friendlyMessage,
  getInviteLink,
  leaveBoard as apiLeaveBoard,
  renameBoard as apiRenameBoard,
} from '../../../lib/api';
import { inviteMessage } from '../../../lib/inviteLinks';
import { BoardColor } from '../../../types';

export default function BoardSettingsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const boardId = id as string;
  const { board, members, reload } = useBoard(boardId);
  const user = useSession((s) => s.user);
  const [draftName, setDraftName] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);

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

  const confirmLeave = () => {
    Alert.alert('Leave this fridge?', 'You can rejoin with an invite link.', [
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
    Alert.alert('Delete this fridge?', 'The fridge and all its posts will be removed for everyone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete fridge',
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
      <StatusBar style="dark" />
      <ScreenHeader title="Fridge settings" />
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <View style={[styles.idCard, { backgroundColor: boardColors[board?.color ?? 'sage'] }]}>
          <View style={styles.idTop}>
            <Text style={[styles.idName, { color: doorInk(board?.color ?? 'sage') }]} numberOfLines={2}>{board?.name ?? ''}</Text>
            {isOwner ? (
              <Pressable hitSlop={12} onPress={() => { setDraftName(board?.name ?? ''); setEditingName(true); }}>
                <MaterialCommunityIcons name="pencil-outline" size={22} color={doorInk(board?.color ?? 'sage')} />
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
            <Text style={[styles.idCount, { color: doorSoft(board?.color ?? 'sage') }]}>
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
              placeholder="Fridge name"
              placeholderTextColor={colors.pine}
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
            <Text style={styles.sectionLabel}>Fridge colour</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.swatches}
            >
              {offeredBoardColors.map((k) => (
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
            </ScrollView>
          </>
        ) : null}

        <Text style={styles.sectionLabel}>Fridge</Text>
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
        </View>

        <Text style={styles.sectionLabel}>Fridge access</Text>
        <View style={styles.group}>
          {memberCount > 1 ? (
            <Pressable style={styles.row} onPress={confirmLeave}>
              <Text style={[styles.rowLabel, styles.dangerText]}>Leave fridge</Text>
            </Pressable>
          ) : null}
          {isOwner ? (
            <>
              {memberCount > 1 ? <View style={styles.divider} /> : null}
              <Pressable style={styles.row} onPress={confirmDelete}>
                <Text style={[styles.rowLabel, styles.dangerText]}>Delete fridge</Text>
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
    backgroundColor: colors.leaf,
    borderRadius: 14,
    paddingHorizontal: 14,
    fontFamily: fonts.ui.semibold,
    fontSize: 16,
    color: colors.pine,
  },
  editorActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  editorCancelText: { fontFamily: fonts.ui.semibold, fontSize: 15, color: colors.inkSoft, paddingVertical: 10, paddingHorizontal: 14 },
  editorSave: { paddingVertical: 10, paddingHorizontal: 22, borderRadius: 14, backgroundColor: colors.accent },
  editorSaveText: { fontFamily: fonts.ui.bold, fontSize: 15, color: colors.background },
  sectionLabel: { fontFamily: fonts.ui.regular, fontSize: 17, color: colors.pine, marginTop: 26, marginBottom: 10, paddingLeft: 4 },
  swatches: { flexDirection: 'row', gap: 12, paddingLeft: 4 },
  swatch: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: 'transparent' },
  swatchActive: { borderColor: colors.accent },
  group: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 18, paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 15 },
  rowLabel: { fontFamily: fonts.ui.semibold, fontSize: 16, color: colors.ink, flexShrink: 1 },
  rowValue: { fontFamily: fonts.ui.regular, fontSize: 15, color: colors.inkSoft },
  chevron: { fontSize: 22, color: colors.inkFaint },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  dangerText: { color: colors.danger },
});
