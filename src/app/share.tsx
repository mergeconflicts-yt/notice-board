import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIncomingShare } from 'expo-sharing';
import { colors, fonts } from '../theme';
import {
  friendlyMessage,
  getMyBoards,
  postSharedItem,
} from '../lib/api';
import { recallBoard } from '../lib/lastBoard';
import { randomId } from '../hooks/useBoard';
import { useToast } from '../store/toast';
import type { Board } from '../types';

/**
 * "Post to…" screen for OS shares (WhatsApp long-press → Share → Fridge
 * Board). The user picks a board, optionally edits the text and the
 * "Shared from <app> · <author>" attribution, and posts it as a normal note.
 * The OS never tells us the source app or sender, so both stay editable.
 */
export default function ShareScreen() {
  const insets = useSafeAreaInsets();
  const { sharedPayloads, clearSharedPayloads } = useIncomingShare();
  const [boards, setBoards] = useState<Board[] | null>(null);
  const [boardId, setBoardId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // The shared text, taken from the raw payload (immediate, no network).
  // Tiny array; computed inline so there's nothing to memoize.
  let incomingText = '';
  for (const p of sharedPayloads ?? []) {
    if ((p.shareType === 'text' || p.shareType === 'url') && p.value?.trim()) {
      incomingText = p.value.trim().slice(0, 2000);
      break;
    }
  }

  const [text, setText] = useState('');
  const [lastAdopted, setLastAdopted] = useState('');
  // Adopt the incoming text once (then it's the user's to edit). This is the
  // endorsed render-phase adjustment for "props changed" (not an effect), so
  // a late-arriving share still lands in the field without clobbering edits.
  if (incomingText && incomingText !== lastAdopted && text === lastAdopted) {
    setLastAdopted(incomingText);
    setText(incomingText);
  }

  const [fromApp, setFromApp] = useState('');
  const [fromAuthor, setFromAuthor] = useState('');
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const [mine, last] = await Promise.all([getMyBoards(), recallBoard()]);
        if (!alive) return;
        setBoards(mine);
        setBoardId(mine.some((b) => b.id === last) ? last : (mine[0]?.id ?? null));
      } catch (e) {
        if (!alive) return;
        setLoadError(friendlyMessage(e));
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const canPost = text.trim().length > 0 && boardId !== null && !posting;

  const handlePost = async () => {
    if (!canPost || !boardId) return;
    setPosting(true);
    try {
      await postSharedItem({
        id: randomId(),
        boardId,
        type: 'note',
        color: 'butter',
        body: text.trim(),
        sharedFromApp: fromApp.trim() || null,
        sharedFromAuthor: fromAuthor.trim() || null,
      });
      clearSharedPayloads();
      router.replace(`/board/${boardId}`);
    } catch (e) {
      useToast.getState().show(friendlyMessage(e));
      setPosting(false);
    }
  };

  return (
    <View style={[styles.safe, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ title: 'Post to fridge' }} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
        <Text style={styles.title}>Post to fridge</Text>

        {boards === null ? (
          loadError ? (
            <Text style={styles.error}>{loadError}</Text>
          ) : (
            <ActivityIndicator color={colors.accent} />
          )
        ) : boards.length === 0 ? (
          <Text style={styles.empty}>You are not on any fridge yet. Join or create one first.</Text>
        ) : (
          <>
            <Text style={styles.label}>Message</Text>
            <TextInput
              value={text}
              onChangeText={setText}
              multiline
              maxLength={2000}
              placeholder={incomingText ? '' : 'Nothing was shared. Type a note instead.'}
              style={styles.message}
            />

            <Text style={styles.label}>Fridge</Text>
            <View style={styles.boards}>
              {boards.map((b) => (
                <Pressable
                  key={b.id}
                  onPress={() => setBoardId(b.id)}
                  style={[styles.boardChip, boardId === b.id && styles.boardChipOn]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: boardId === b.id }}
                  accessibilityLabel={b.name}
                >
                  <Text style={[styles.boardChipText, boardId === b.id && styles.boardChipTextOn]}>
                    {b.name}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.label}>Shared from (optional)</Text>
            <View style={styles.row}>
              <TextInput
                value={fromApp}
                onChangeText={setFromApp}
                placeholder="WhatsApp"
                maxLength={120}
                style={[styles.input, styles.flex]}
              />
              <TextInput
                value={fromAuthor}
                onChangeText={setFromAuthor}
                placeholder="Paul"
                maxLength={120}
                style={[styles.input, styles.flex]}
              />
            </View>
            <Text style={styles.hint}>Shows under the note as “Shared from WhatsApp · Paul”.</Text>

            <Pressable
              onPress={handlePost}
              disabled={!canPost}
              style={[styles.postBtn, !canPost && styles.postBtnOff]}
              accessibilityRole="button"
              accessibilityLabel="Post to fridge"
            >
              {posting ? (
                <ActivityIndicator color={colors.background} />
              ) : (
                <Text style={styles.postText}>Post</Text>
              )}
            </Pressable>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 20, paddingTop: 12, gap: 10 },
  title: { fontFamily: fonts.hand.bold, fontSize: 30, color: colors.ink },
  label: { fontFamily: fonts.ui.bold, fontSize: 13, color: colors.ink, marginTop: 8 },
  message: {
    minHeight: 110,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.surface,
    padding: 14,
    fontFamily: fonts.hand.semibold,
    fontSize: 20,
    color: colors.ink,
    textAlignVertical: 'top',
  },
  boards: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  boardChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  boardChipOn: { backgroundColor: colors.pine, borderColor: colors.pine },
  boardChipText: { fontFamily: fonts.ui.semibold, fontSize: 14, color: colors.ink },
  boardChipTextOn: { color: colors.onPine },
  row: { flexDirection: 'row', gap: 8 },
  flex: { flex: 1 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: fonts.ui.regular,
    fontSize: 15,
    color: colors.ink,
  },
  hint: { fontFamily: fonts.ui.regular, fontSize: 12, color: colors.inkSoft },
  postBtn: {
    marginTop: 12,
    borderRadius: 16,
    backgroundColor: colors.accent,
    paddingVertical: 15,
    alignItems: 'center',
  },
  postBtnOff: { opacity: 0.45 },
  postText: { fontFamily: fonts.ui.bold, fontSize: 16, color: colors.background },
  error: { fontFamily: fonts.ui.semibold, fontSize: 14, color: colors.danger },
  empty: { fontFamily: fonts.ui.regular, fontSize: 15, color: colors.inkSoft },
});
