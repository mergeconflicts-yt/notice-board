import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { colors, fonts, noteColors } from '../theme';
import { Button } from '../components/Button';
import { IdentitySheet } from '../components/IdentitySheet';
import { useSession } from '../store/session';
import { useMyBoards } from '../hooks/useBoards';

type Deco = { text: string; color: keyof typeof noteColors; top: string; left: string; rotate: string; size: number };

const DECOS: Deco[] = [
  { text: 'Dentist — Thu 🦷', color: 'sky', top: '6%', left: '4%', rotate: '-6deg', size: 16 },
  { text: 'Dinner is in\nthe fridge 🍲', color: 'butter', top: '14%', left: '58%', rotate: '5deg', size: 15 },
  { text: 'Milk 🥛', color: 'blush', top: '2%', left: '40%', rotate: '3deg', size: 14 },
  { text: '❤️', color: 'sage', top: '22%', left: '78%', rotate: '-4deg', size: 20 },
];

export default function StartScreen() {
  const user = useSession((s) => s.user);
  const status = useSession((s) => s.status);
  const setDisplayName = useSession((s) => s.setDisplayName);
  const { boards, error: boardsError } = useMyBoards();
  const [identityFor, setIdentityFor] = useState<'create' | 'join' | null>(null);
  const [identitySaving, setIdentitySaving] = useState(false);
  const [identityError, setIdentityError] = useState<string | null>(null);
  const [showSavePrompt, setShowSavePrompt] = useState(false);

  // Dismissible "save your account" nudge: 2+ boards, or 7 days after first
  // launch (docs/plan.md §8 step 4). Never blocking.
  useEffect(() => {
    if (status !== 'ready') return;
    let alive = true;
    void (async () => {
      const dismissed = await AsyncStorage.getItem('notice.savePromptDismissed');
      if (!alive || dismissed) return;
      const first = await AsyncStorage.getItem('notice.firstLaunchAt');
      if (!first) {
        await AsyncStorage.setItem('notice.firstLaunchAt', new Date().toISOString());
        return;
      }
      const old = Date.now() - new Date(first).getTime() > 7 * 24 * 3600 * 1000;
      if (boards.length >= 2 || old) setShowSavePrompt(true);
    })();
    return () => {
      alive = false;
    };
  }, [status, boards.length]);

  const dismissSavePrompt = () => {
    setShowSavePrompt(false);
    void AsyncStorage.setItem('notice.savePromptDismissed', '1');
  };

  const needsName = !user || user.displayName === 'Someone';

  const startCreate = () => {
    if (user && !needsName) router.push('/create');
    else {
      setIdentityError(null);
      setIdentityFor('create');
    }
  };
  const startJoin = () => {
    if (user && !needsName) router.push('/join');
    else {
      setIdentityError(null);
      setIdentityFor('join');
    }
  };

  const handleIdentity = async (name: string) => {
    const target = identityFor;
    if (identitySaving) return;
    setIdentitySaving(true);
    setIdentityError(null);
    try {
      await setDisplayName(name);
    } catch {
      setIdentityError('Couldn’t reach the board server. Check your connection and try again.');
      setIdentitySaving(false);
      return;
    }
    setIdentitySaving(false);
    setIdentityFor(null);
    if (target === 'create') router.push('/create');
    else if (target === 'join') router.push('/join');
  };

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
              <Text style={[styles.decoText, { fontSize: d.size, color: noteColors[d.color].ink }]}>
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
          {showSavePrompt ? (
            <View style={styles.prompt}>
              <Text style={styles.promptText}>Save your account so you don’t lose your boards.</Text>
              <View style={styles.promptActions}>
                <Pressable onPress={dismissSavePrompt} hitSlop={8}>
                  <Text style={styles.promptDismiss}>Not now</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    dismissSavePrompt();
                    router.push('/profile');
                  }}
                  hitSlop={8}
                >
                  <Text style={styles.promptSave}>Save account</Text>
                </Pressable>
              </View>
            </View>
          ) : null}
          {boardsError ? <Text style={styles.boardsError}>{boardsError}</Text> : null}
          {boards.length > 0 ? (
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
                  <Text style={styles.boardRowChevron}>›</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          <Button label="Create a board" onPress={startCreate} />
          <Button label="Join a board" variant="soft" onPress={startJoin} />
          <Pressable onPress={() => router.push('/profile')} style={styles.you} hitSlop={8}>
            <Text style={styles.youText}>You · {user?.displayName ?? 'Someone'}</Text>
          </Pressable>
        </View>
      </ScrollView>

      <IdentitySheet
        visible={identityFor !== null}
        onDone={handleIdentity}
        submitting={identitySaving}
        error={identityError}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1, justifyContent: 'space-between', paddingHorizontal: 24 },
  hero: { flex: 1, justifyContent: 'center', paddingVertical: 60 },
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
  decoText: { fontFamily: fonts.hand.semibold, textAlign: 'center', lineHeight: 20 },
  heroTextWrap: { paddingHorizontal: 4 },
  kicker: {
    fontFamily: fonts.ui.bold,
    fontSize: 13,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.accentDeep,
    marginBottom: 12,
  },
  headline: { fontFamily: fonts.hand.bold, fontSize: 54, lineHeight: 56, color: colors.ink },
  subhead: { fontFamily: fonts.ui.regular, fontSize: 17, color: colors.inkSoft, marginTop: 14 },
  footer: { gap: 12, paddingBottom: 24 },
  boardsError: {
    fontFamily: fonts.ui.regular,
    fontSize: 13,
    color: colors.danger,
    marginBottom: 8,
  },
  boardsBlock: { gap: 8, marginBottom: 8 },
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
  boardRowName: { flex: 1, fontFamily: fonts.hand.bold, fontSize: 22, color: colors.ink },
  boardRowChevron: { fontSize: 22, color: colors.inkFaint },
  prompt: {
    backgroundColor: colors.highlight,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  promptText: { fontFamily: fonts.ui.semibold, fontSize: 14, color: colors.ink },
  promptActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 18, marginTop: 10 },
  promptDismiss: { fontFamily: fonts.ui.semibold, fontSize: 14, color: colors.inkSoft },
  promptSave: { fontFamily: fonts.ui.bold, fontSize: 14, color: colors.accentDeep },
  you: { alignSelf: 'center', paddingVertical: 10 },
  youText: { fontFamily: fonts.ui.semibold, fontSize: 14, color: colors.inkSoft },
});
