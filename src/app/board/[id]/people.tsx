import { View, Text, ScrollView, Pressable, StyleSheet, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { colors, fonts } from '../../../theme';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { Avatar } from '../../../components/Avatar';
import { useBoard, useMembers } from '../../../hooks/useBoard';

export default function PeopleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const boardId = id as string;
  const { board } = useBoard(boardId);
  const { members } = useMembers(boardId);

  const share = async () => {
    if (!board) return;
    await Share.share({
      message: `Join my board “${board.name}” on Notice Board! Invite code: ${board.inviteCode}`,
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
                {board && m.userId === board.ownerId ? (
                  <Text style={styles.owner}>Owner</Text>
                ) : null}
              </View>
            </View>
          ))}
        </View>

        {board ? (
          <View style={styles.invite}>
            <Text style={styles.inviteLabel}>Invite someone</Text>
            <Text style={styles.inviteHint}>
              Share this code — they’ll land right on this board.
            </Text>
            <View style={styles.codeCard}>
              <Text style={styles.code}>{board.inviteCode}</Text>
            </View>
            <Pressable onPress={share} style={styles.shareBtn}>
              <Text style={styles.shareText}>Share invite</Text>
            </Pressable>
          </View>
        ) : null}
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
  owner: {
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
  shareText: {
    fontFamily: fonts.ui.bold,
    fontSize: 16,
    color: colors.ink,
  },
});
