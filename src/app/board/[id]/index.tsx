import { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { colors, fonts } from '../../../theme';
import { BoardNote } from '../../../components/BoardNote';
import { Avatar } from '../../../components/Avatar';
import { AddNoteSheet, NoteSheetInput } from '../../../components/AddNoteSheet';
import { useBoard, useNotes, useMembers } from '../../../hooks/useBoard';
import { useSession } from '../../../store/session';
import { REF_W, computeBoardLayout } from '../../../utils/layout';
import { getBackend } from '../../../services';
import { NoteWithAuthor } from '../../../types';

/** Scroll distance below which the viewer counts as "already at the top". */
const NEAR_TOP_Y = 140;

export default function BoardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const boardId = id as string;
  const insets = useSafeAreaInsets();
  const { board, loading: boardLoading, missing } = useBoard(boardId);
  const { notes, loading: notesLoading, addNote } = useNotes(boardId);
  const { members } = useMembers(boardId);
  const user = useSession((s) => s.user);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [boardW, setBoardW] = useState(0);
  const [entering, setEntering] = useState<Set<string>>(() => new Set());
  const [chipVisible, setChipVisible] = useState(false);

  const scrollRef = useRef<ScrollView>(null);
  const nearTopRef = useRef(true);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const firstLoadRef = useRef(true);
  const chipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openNote = (note: NoteWithAuthor) => {
    router.push(`/board/${boardId}/note/${note.id}`);
  };

  // Every device derives the identical board from note metadata alone.
  const layout = useMemo(() => computeBoardLayout(notes ?? []), [notes]);
  const ordered = useMemo(
    () => [...(notes ?? [])].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [notes],
  );

  // React to realtime arrivals: animate fresh papers, and only hijack the
  // viewport when the viewer is already near the top.
  useEffect(() => {
    if (!notes) return;
    const ids = new Set(notes.map((n) => n.id));
    if (firstLoadRef.current) {
      firstLoadRef.current = false;
      seenIdsRef.current = ids;
      return;
    }
    const added = notes.filter((n) => !seenIdsRef.current.has(n.id));
    seenIdsRef.current = ids;
    if (added.length === 0) return;

    setEntering(new Set(added.map((n) => n.id)));

    const fromOthers = added.some((n) => n.authorId !== user?.id);
    if (!fromOthers) return;
    if (nearTopRef.current) {
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    } else {
      setChipVisible(true);
      if (chipTimerRef.current) clearTimeout(chipTimerRef.current);
      chipTimerRef.current = setTimeout(() => setChipVisible(false), 4000);
    }
  }, [notes, user]);

  useEffect(
    () => () => {
      if (chipTimerRef.current) clearTimeout(chipTimerRef.current);
    },
    [],
  );

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    nearTopRef.current = e.nativeEvent.contentOffset.y < NEAR_TOP_Y;
  };

  const handleAdd = async (input: NoteSheetInput) => {
    setSubmitting(true);
    try {
      let imageUrl = input.imageUrl;
      if (imageUrl && !imageUrl.startsWith('http')) {
        imageUrl = await getBackend().uploadImage(imageUrl);
      }
      await addNote({ ...input, imageUrl });
      setSheetOpen(false);
      requestAnimationFrame(() => scrollRef.current?.scrollTo({ y: 0, animated: true }));
    } catch (e) {
      console.error('add note failed', e);
    } finally {
      setSubmitting(false);
    }
  };

  const scale = boardW > 0 ? boardW / REF_W : 1;
  const canvasH = useMemo(() => {
    let bottom = 0;
    layout.forEach((p) => {
      bottom = Math.max(bottom, p.y + p.h);
    });
    return Math.max(1100 * scale, bottom * scale + 90);
  }, [layout, scale]);

  if (boardLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  if (missing || !board) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.missingTitle}>This board is gone</Text>
          <Text style={styles.missingSub}>It may have been deleted by its owner.</Text>
          <Pressable onPress={() => router.replace('/')} style={styles.missingBtn}>
            <Text style={styles.missingBtnText}>Back to start</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const isLoading = notesLoading;
  const isEmpty = notes && notes.length === 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable
          hitSlop={8}
          onPress={() => router.push(`/board/${boardId}/people`)}
          style={styles.peopleBtn}
        >
          {(members ?? []).slice(0, 3).map((m, i) => (
            <View key={m.userId} style={[styles.avatarStack, { zIndex: 10 - i, marginLeft: i === 0 ? 0 : -8 }]}>
              <Avatar name={m.user.displayName} emoji={m.user.avatar} size={26} />
            </View>
          ))}
          {members && members.length > 3 ? (
            <View style={[styles.avatarStack, styles.moreStack, { marginLeft: -8 }]}>
              <Text style={styles.moreText}>+{members.length - 3}</Text>
            </View>
          ) : null}
        </Pressable>

        <Pressable
          onPress={() => router.push(`/board/${boardId}/settings`)}
          style={styles.boardTitle}
        >
          <Text style={styles.boardName} numberOfLines={1}>{board.name}</Text>
          <Text style={styles.boardSubtitle}>Shared board</Text>
        </Pressable>

        <Pressable
          hitSlop={8}
          onPress={() => router.push(`/board/${boardId}/settings`)}
          style={styles.settingsBtn}
        >
          <Text style={styles.settingsGlyph}>⚙︎</Text>
        </Pressable>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : isEmpty ? (
        <View style={styles.empty}>
          <Text style={styles.emptyHand}>✍️</Text>
          <Text style={styles.emptyTitle}>Leave the first note</Text>
          <Text style={styles.emptySub}>Pin something up — everyone here will see it.</Text>
          <Pressable onPress={() => setSheetOpen(true)} style={styles.emptyBtn}>
            <Text style={styles.emptyBtnText}>+ Add note</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.boardContent}
          showsVerticalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
        >
          <View
            style={[styles.canvas, { minHeight: 1100 * scale, height: canvasH }]}
            onLayout={(e) => setBoardW(e.nativeEvent.layout.width)}
          >
            {boardW > 0
              ? ordered.map((n) => {
                  const p = layout.get(n.id);
                  if (!p) return null;
                  return (
                    <BoardNote
                      key={n.id}
                      note={n}
                      left={p.x * boardW}
                      top={p.y * scale}
                      width={p.w * boardW}
                      rotation={p.rotation}
                      animateIn={entering.has(n.id)}
                      onPress={openNote}
                    />
                  );
                })
              : null}
          </View>
        </ScrollView>
      )}

      {chipVisible && (
        <Pressable
          onPress={() => {
            setChipVisible(false);
            scrollRef.current?.scrollTo({ y: 0, animated: true });
          }}
          style={[styles.chip, { top: insets.top + 60 }]}
        >
          <Text style={styles.chipText}>New note added ↑</Text>
        </Pressable>
      )}

      {!isEmpty && (
        <Pressable
          onPress={() => setSheetOpen(true)}
          style={({ pressed }) => [
            styles.fab,
            { bottom: insets.bottom + 24 },
            pressed && styles.fabPressed,
          ]}
        >
          <Text style={styles.fabGlyph}>+</Text>
        </Pressable>
      )}

      <AddNoteSheet
        visible={sheetOpen}
        submitting={submitting}
        onClose={() => setSheetOpen(false)}
        onSubmit={handleAdd}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 56,
  },
  peopleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 96,
  },
  avatarStack: {
    borderRadius: 15,
    borderWidth: 2,
    borderColor: colors.background,
  },
  moreStack: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  moreText: {
    fontFamily: fonts.ui.bold,
    fontSize: 11,
    color: colors.inkSoft,
  },
  boardName: {
    textAlign: 'center',
    fontFamily: fonts.hand.bold,
    fontSize: 24,
    color: colors.ink,
    paddingHorizontal: 8,
  },
  boardTitle: { flex: 1, alignItems: 'center' },
  boardSubtitle: {
    fontFamily: fonts.ui.regular,
    fontSize: 11,
    color: colors.inkFaint,
    marginTop: -2,
  },
  settingsBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  settingsGlyph: {
    fontSize: 18,
    color: colors.inkSoft,
  },
  boardContent: {
    paddingHorizontal: 10,
    paddingBottom: 120,
  },
  canvas: {
    position: 'relative',
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingBottom: 60,
  },
  emptyHand: { fontSize: 40, marginBottom: 12 },
  emptyTitle: {
    fontFamily: fonts.hand.bold,
    fontSize: 32,
    color: colors.ink,
    marginBottom: 6,
  },
  emptySub: {
    fontFamily: fonts.ui.regular,
    fontSize: 15,
    color: colors.inkSoft,
    textAlign: 'center',
  },
  emptyBtn: {
    marginTop: 22,
    backgroundColor: colors.ink,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 16,
  },
  emptyBtnText: {
    fontFamily: fonts.ui.bold,
    fontSize: 16,
    color: colors.background,
  },
  fab: {
    position: 'absolute',
    right: 22,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.shadow,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  fabPressed: { transform: [{ scale: 0.94 }] },
  fabGlyph: {
    fontSize: 34,
    lineHeight: 38,
    color: '#fff',
    marginTop: -2,
  },
  chip: {
    position: 'absolute',
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: colors.ink,
    shadowColor: colors.shadow,
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  chipText: {
    fontFamily: fonts.ui.bold,
    fontSize: 13,
    color: colors.background,
  },
  missingTitle: {
    fontFamily: fonts.hand.bold,
    fontSize: 30,
    color: colors.ink,
  },
  missingSub: {
    fontFamily: fonts.ui.regular,
    fontSize: 14,
    color: colors.inkSoft,
    marginTop: 6,
  },
  missingBtn: {
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: colors.ink,
  },
  missingBtnText: {
    fontFamily: fonts.ui.bold,
    color: colors.background,
  },
});
