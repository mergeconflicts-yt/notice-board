import { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Share, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { colors, fonts } from '../../../theme';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { Avatar } from '../../../components/Avatar';
import { useBoard } from '../../../hooks/useBoard';
import { useSession } from '../../../store/session';
import { useToast } from '../../../store/toast';
import { friendlyMessage, getInviteLink, removeMember, resetInviteLink } from '../../../lib/api';
import { inviteCodeMessage, inviteMessage } from '../../../lib/inviteLinks';

export default function PeopleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const boardId = id as string;
  const { board, members, reload } = useBoard(boardId);
  const me = useSession((s) => s.user);
  const [invite, setInvite] = useState<{ token: string; code: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const myMembership = me ? members.find((m) => m.userId === me.id) : undefined;
  const isOwner = myMembership?.role === 'owner';

  const loadInvite = async () => {
    setLoading(true);
    try {
      const link = await getInviteLink(boardId);
      setInvite({ token: link.token, code: link.code });
    } catch (e) {
      useToast.getState().show(friendlyMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const shareLink = async () => {
    if (!board || !invite) return;
    try {
      await Share.share({ message: inviteMessage(board.name, invite.token) });
    } catch {
      // The sheet was dismissed or is unavailable — nothing to report.
    }
  };

  const shareCode = async () => {
    if (!board || !invite) return;
    try {
      await Share.share({ message: inviteCodeMessage(board.name, invite.code) });
    } catch {
      // The sheet was dismissed or is unavailable — nothing to report.
    }
  };

  const resetLink = async () => {
    if (!board) return;
    Alert.alert('Reset the invite link?', 'The current link and code stop working immediately.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: async () => {
          try {
            await resetInviteLink(boardId);
            setInvite(null);
            await loadInvite();
          } catch (e) {
            useToast.getState().show(friendlyMessage(e));
          }
        },
      },
    ]);
  };

  const confirmRemove = (userId: string, name: string) => {
    Alert.alert(`Remove ${name}?`, 'They can rejoin with an invite link.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await removeMember(boardId, userId);
            await reload();
          } catch (e) {
            useToast.getState().show(friendlyMessage(e));
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader title="People" />
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.list}>
          {members.map((m) => (
            <View key={m.userId} style={styles.row}>
              <Avatar name={m.user.displayName} size={40} />
              <View style={styles.rowText}>
                <Text style={styles.name}>{m.user.displayName}</Text>
                <Text style={styles.role}>{m.role === 'owner' ? 'Owner' : 'Member'}</Text>
              </View>
              {isOwner && m.userId !== me?.id ? (
                <Pressable hitSlop={8} onPress={() => confirmRemove(m.userId, m.user.displayName)}>
                  <Text style={styles.remove}>Remove</Text>
                </Pressable>
              ) : null}
            </View>
          ))}
        </View>

        <View style={styles.invite}>
          <Text style={styles.inviteLabel}>Invite someone</Text>
          <Text style={styles.inviteHint}>Everyone shares the same link. Share it any way you like.</Text>

          {invite ? (
            <>
              <View style={styles.codeCard}>
                <Text style={styles.code}>{invite.code}</Text>
              </View>
              <Pressable onPress={shareLink} style={styles.shareBtn}>
                <Text style={styles.shareText}>Share link</Text>
              </Pressable>
              <Pressable onPress={shareCode} style={styles.shareBtnGhost}>
                <Text style={styles.shareText}>Share code</Text>
              </Pressable>
              {isOwner ? (
                <Pressable onPress={resetLink} style={styles.shareBtnGhost}>
                  <Text style={styles.resetText}>Reset link</Text>
                </Pressable>
              ) : null}
            </>
          ) : (
            <Pressable onPress={loadInvite} disabled={loading} style={styles.shareBtn}>
              {loading ? <ActivityIndicator color={colors.ink} /> : <Text style={styles.shareText}>Get invite link</Text>}
            </Pressable>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  body: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 32 },
  list: { gap: 6 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowText: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  name: { fontFamily: fonts.ui.bold, fontSize: 16, color: colors.ink },
  role: {
    fontFamily: fonts.ui.semibold,
    fontSize: 11,
    color: colors.accentDeep,
    backgroundColor: colors.highlight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    overflow: 'hidden',
  },
  remove: { fontFamily: fonts.ui.bold, fontSize: 14, color: colors.danger },
  invite: { marginTop: 28 },
  inviteLabel: { fontFamily: fonts.hand.bold, fontSize: 24, color: colors.ink },
  inviteHint: { fontFamily: fonts.ui.regular, fontSize: 13, color: colors.inkSoft, marginTop: 4 },
  codeCard: {
    marginTop: 14,
    backgroundColor: colors.ink,
    borderRadius: 18,
    paddingVertical: 20,
    alignItems: 'center',
  },
  code: { fontFamily: fonts.ui.extraBold, fontSize: 30, letterSpacing: 3, color: colors.background },
  shareBtn: {
    marginTop: 14,
    height: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  shareBtnGhost: {
    marginTop: 10,
    height: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareText: { fontFamily: fonts.ui.bold, fontSize: 16, color: colors.ink },
  resetText: { fontFamily: fonts.ui.bold, fontSize: 14, color: colors.danger },
});
