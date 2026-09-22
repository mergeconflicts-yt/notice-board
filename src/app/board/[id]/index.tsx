import { useCallback, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { colors, fonts } from '../../../theme';
import { DraggableNote } from '../../../components/DraggableNote';
import { Avatar } from '../../../components/Avatar';
import { AddNoteSheet, NoteSheetInput } from '../../../components/AddNoteSheet';
import { useBoard, useNotes, useMembers } from '../../../hooks/useBoard';
import { useSession } from '../../../store/session';
import { REF_W, findSpot, noteRefHeight, placedDims, widthFracForNote } from '../../../utils/layout';
import { getBackend } from '../../../services';
import { NoteWithAuthor } from '../../../types';

export default function BoardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const boardId = id as string;
  const insets = useSafeAreaInsets();
  const { board, loading: boardLoading, missing } = useBoard(boardId);
  const { notes, loading: notesLoading, addNote, updateNote } = useNotes(boardId);
  const { members } = useMembers(boardId);
  const user = useSession((s) => s.user);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [boardW, setBoardW] = useState(0);
  const [scrollEnabled, setScrollEnabled] = useState(true);

  const openNote = (note: NoteWithAuthor) => {
    router.push(`/board/${boardId}/note/${note.id}`);
  };

  const handleDrop = useCallback(
    async (id: string, x: number, y: number) => {
      try {
        await updateNote(id, { positionX: x, positionY: y });
      } catch (e) {
        console.error('move note failed', e);
      }
    },
    [updateNote],
  );

  const handleAdd = async (input: NoteSheetInput) => {
    setSubmitting(true);
    try {
      let imageUrl = input.imageUrl;
      if (imageUrl && !imageUrl.startsWith('http')) {
        imageUrl = await getBackend().uploadImage(imageUrl);
      }
      const authorId = user?.id ?? '';
      const spot = findSpot(placedDims(notes ?? []), {
        text: input.text,
        imageUrl,
        kind: input.kind,
        authorId,
      });
      await addNote({ ...input, imageUrl, positionX: spot.x, positionY: spot.y });
      setSheetOpen(false);
    } catch (e) {
      console.error('add note failed', e);
    } finally {
      setSubmitting(false);
    }
  };

  const scale = boardW > 0 ? boardW / REF_W : 1;
  const ordered = useMemo(
    () => [...(notes ?? [])].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [notes],
  );
  const canvasH = useMemo(() => {
    let bottom = 0;
    for (const n of ordered) {
      const f = widthFracForNote(n);
      bottom = Math.max(bottom, n.positionY + noteRefHeight(n, f));
    }
    return Math.max(1100 * scale, bottom * scale + 90);
  }, [ordered, scale]);

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
          contentContainerStyle={styles.boardContent}
          showsVerticalScrollIndicator={false}
          scrollEnabled={scrollEnabled}
        >
          <View
            style={[styles.canvas, { minHeight: 1100 * scale, height: canvasH }]}
            onLayout={(e) => setBoardW(e.nativeEvent.layout.width)}
          >
            {boardW > 0
              ? ordered.map((n) => {
                  const frac = widthFracForNote(n);
                  return (
                    <DraggableNote
                      key={n.id}
                      note={n}
                      left={n.positionX * boardW}
                      top={n.positionY * scale}
                      width={frac * boardW}
                      frac={frac}
                      boardW={boardW}
                      scale={scale}
                      onPress={openNote}
                      onDrop={handleDrop}
                      onDragStateChange={(dragging) => setScrollEnabled(!dragging)}
                    />
                  );
                })
              : null}
          </View>
        </ScrollView>
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
