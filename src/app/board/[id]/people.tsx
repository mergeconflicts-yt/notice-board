import { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Share, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { colors, fonts } from '../../../theme';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { Avatar } from '../../../components/Avatar';
import { useBoardDetails, useBoardMembers, useInvites } from '../../../hooks/useBoardV2';

function roleLabel(role: string) {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

function inviteMeta(invites: { useCount: number; maxUses: number | null; expiresAt: string | null }) {
  const uses = invites.maxUses ? `${invites.useCount}/${invites.maxUses} used` : `${invites.useCount} used`;
  if (!invites.expiresAt) return uses;
  const d = new Date(invites.expiresAt);
  return `${uses} · expires ${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
}

export default function PeopleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const boardId = id as string;
  const { board } = useBoardDetails(boardId);
  const { members } = useBoardMembers(boardId);
  const { invites, createInvite, revokeInvite } = useInvites(boardId);
  const [creating, setCreating] = useState(false);
  const [freshToken, setFreshToken] = useState<string | null>(null);

  const activeInvites = (invites ?? []).filter(
    (inv) => !inv.revokedAt && (!inv.expiresAt || new Date(inv.expiresAt) > new Date()),
  );

  const handleCreate = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const created = await createInvite({});
      setFreshToken(created.token);
    } catch (e) {
      console.error('create invite failed', e);
    } finally {
      setCreating(false);
    }
  };

  const shareToken = async (token: string) => {
    if (!board) return;
    await Share.share({
      message: `Join my board “${board.name}” on Notice Board! Invite code: ${token}`,
    });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader title="People" />
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.list}>
          {(members ?? []).map((m) => (
            <View key={m.userId} style={styles.row}>
              <Avatar name={m.user.displayName} emoji={m.user.avatar} size={40} />
              <View style={styles.rowText}>
                <Text style={styles.name}>{m.user.displayName}</Text>
                <Text style={styles.role}>{roleLabel(m.role)}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.invite}>
          <Text style={styles.inviteLabel}>Invite someone</Text>
          <Text style={styles.inviteHint}>
            Codes are shown once — share one right after creating it.
          </Text>

          {freshToken ? (
            <>
              <View style={styles.codeCard}>
                <Text style={styles.code}>{freshToken}</Text>
              </View>
              <Pressable onPress={() => shareToken(freshToken)} style={styles.shareBtn}>
                <Text style={styles.shareText}>Share invite</Text>
              </Pressable>
            </>
          ) : (
            <Pressable
              onPress={handleCreate}
              disabled={creating}
              style={[styles.shareBtn, creating && styles.shareDisabled]}
            >
              {creating ? (
                <ActivityIndicator color={colors.ink} />
              ) : (
                <Text style={styles.shareText}>Create invite code</Text>
              )}
            </Pressable>
          )}

          {activeInvites.length > 0 ? (
            <View style={styles.activeList}>
              <Text style={styles.activeLabel}>Active invites</Text>
              {activeInvites.map((inv) => (
                <View key={inv.id} style={styles.activeRow}>
                  <Text style={styles.activeMeta}>{inviteMeta(inv)}</Text>
                  <Pressable
                    hitSlop={8}
                    onPress={() => revokeInvite(inv.id).catch((e) => console.error('revoke failed', e))}
                  >
                    <Text style={styles.revoke}>Revoke</Text>
                  </Pressable>
                </View>
              ))}
              <Pressable onPress={handleCreate} disabled={creating} hitSlop={8}>
                <Text style={styles.another}>+ New code</Text>
              </Pressable>
            </View>
          ) : null}
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
  name: {
    fontFamily: fonts.ui.bold,
    fontSize: 16,
    color: colors.ink,
  },
  role: {
    fontFamily: fonts.ui.semibold,
    fontSize: 11,
    color: colors.accentDeep,
    backgroundColor: '#FFF0E4',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    overflow: 'hidden',
  },
  invite: {
    marginTop: 28,
  },
  inviteLabel: {
    fontFamily: fonts.hand.bold,
    fontSize: 24,
    color: colors.ink,
  },
  inviteHint: {
    fontFamily: fonts.ui.regular,
    fontSize: 13,
    color: colors.inkSoft,
    marginTop: 4,
  },
  codeCard: {
    marginTop: 14,
    backgroundColor: colors.ink,
    borderRadius: 18,
    paddingVertical: 20,
    alignItems: 'center',
  },
  code: {
    fontFamily: fonts.ui.extraBold,
    fontSize: 30,
    letterSpacing: 3,
    color: colors.background,
  },
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
  shareDisabled: { opacity: 0.6 },
  shareText: {
    fontFamily: fonts.ui.bold,
    fontSize: 16,
    color: colors.ink,
  },
  activeList: { marginTop: 18, gap: 8 },
  activeLabel: {
    fontFamily: fonts.ui.bold,
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.inkFaint,
  },
  activeRow: {
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
  activeMeta: {
    fontFamily: fonts.ui.semibold,
    fontSize: 14,
    color: colors.inkSoft,
  },
  revoke: {
    fontFamily: fonts.ui.bold,
    fontSize: 14,
    color: colors.danger,
  },
  another: {
    fontFamily: fonts.ui.bold,
    fontSize: 14,
    color: colors.accentDeep,
    marginTop: 2,
  },
});
