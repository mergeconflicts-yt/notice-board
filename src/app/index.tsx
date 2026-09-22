import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { colors, fonts, noteColors } from '../theme';
import { Button } from '../components/Button';
import { IdentitySheet } from '../components/IdentitySheet';
import { useSession } from '../store/session';
import { useBoards } from '../hooks/useBoard';

type Deco = { text: string; color: keyof typeof noteColors; top: string; left: string; rotate: string; size: number };

const DECOS: Deco[] = [
  { text: 'Dentist — Thu 🦷', color: 'blue', top: '6%', left: '4%', rotate: '-6deg', size: 16 },
  { text: 'Dinner is in\nthe fridge 🍲', color: 'yellow', top: '14%', left: '58%', rotate: '5deg', size: 15 },
  { text: 'Milk 🥛', color: 'pink', top: '2%', left: '40%', rotate: '3deg', size: 14 },
  { text: '❤️', color: 'green', top: '22%', left: '78%', rotate: '-4deg', size: 20 },
];

export default function StartScreen() {
  const user = useSession((s) => s.user);
  const status = useSession((s) => s.status);
  const setIdentity = useSession((s) => s.setIdentity);
  const { boards } = useBoards();
  const [identityFor, setIdentityFor] = useState<'create' | 'join' | null>(null);

  const startCreate = () => {
    if (user) router.push('/create');
    else setIdentityFor('create');
  };
  const startJoin = () => {
    if (user) router.push('/join');
    else setIdentityFor('join');
  };

  const handleIdentity = async (name: string, avatar: string) => {
    const target = identityFor;
    setIdentityFor(null);
    await setIdentity(name, avatar);
    if (target === 'create') router.push('/create');
    else if (target === 'join') router.push('/join');
  };

  if (status === 'loading') {
    return (
      <SafeAreaView style={[styles.safe, styles.loading]}>
        <ActivityIndicator color={colors.accent} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} bounces={false}>
        <View style={styles.hero}>
          {DECOS.map((d) => (
            <View
              key={d.text}
              style={[
                styles.deco,
                {
                  backgroundColor: noteColors[d.color].bg,
                  borderColor: noteColors[d.color].edge,
                  top: d.top as `${number}%`,
                  left: d.left as `${number}%`,
                  transform: [{ rotate: d.rotate }],
                },
              ]}
            >
              <Text
                style={[styles.decoText, { fontSize: d.size, color: noteColors[d.color].ink }]}
              >
                {d.text}
              </Text>
            </View>
          ))}

          <View style={styles.heroTextWrap}>
            <Text style={styles.kicker}>Notice Board</Text>
            <Text style={styles.headline}>A board for{'\n'}your people.</Text>
            <Text style={styles.subhead}>Just notes. No noise.</Text>
          </View>
        </View>

        <View style={styles.footer}>
          {boards && boards.length > 0 ? (
            <View style={styles.boardsBlock}>
              <Text style={styles.boardsLabel}>Your boards</Text>
              {boards.map((b) => (
                <Pressable
                  key={b.id}
                  style={styles.boardRow}
                  onPress={() => router.push(`/board/${b.id}`)}
                >
                  <Text style={styles.boardRowName} numberOfLines={1}>
                    {b.name}
                  </Text>
                  <Text style={styles.boardRowCode}>{b.inviteCode}</Text>
                  <Text style={styles.boardRowChevron}>›</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          <Button label="Create a board" onPress={startCreate} />
          <Button label="Join a board" variant="soft" onPress={startJoin} />
        </View>
      </ScrollView>

      <IdentitySheet
        visible={identityFor !== null}
        onDone={handleIdentity}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  loading: { alignItems: 'center', justifyContent: 'center' },
  scroll: { flexGrow: 1, justifyContent: 'space-between', paddingHorizontal: 24 },
  hero: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 60,
  },
  deco: {
    position: 'absolute',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  decoText: {
    fontFamily: fonts.hand.semibold,
    textAlign: 'center',
    lineHeight: 20,
  },
  heroTextWrap: {
    paddingHorizontal: 4,
  },
  kicker: {
    fontFamily: fonts.ui.bold,
    fontSize: 13,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.accentDeep,
    marginBottom: 12,
  },
  headline: {
    fontFamily: fonts.hand.bold,
    fontSize: 54,
    lineHeight: 56,
    color: colors.ink,
  },
  subhead: {
    fontFamily: fonts.ui.regular,
    fontSize: 17,
    color: colors.inkSoft,
    marginTop: 14,
  },
  footer: {
    gap: 12,
    paddingBottom: 24,
  },
  boardsBlock: {
    gap: 8,
    marginBottom: 8,
  },
  boardsLabel: {
    fontFamily: fonts.ui.bold,
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.inkFaint,
    marginBottom: 2,
  },
  boardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  boardRowName: {
    flex: 1,
    fontFamily: fonts.hand.bold,
    fontSize: 22,
    color: colors.ink,
  },
  boardRowCode: {
    fontFamily: fonts.ui.bold,
    fontSize: 11,
    letterSpacing: 1,
    color: colors.inkFaint,
  },
  boardRowChevron: {
    fontSize: 22,
    color: colors.inkFaint,
  },
});
