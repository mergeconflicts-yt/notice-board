import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { colors, boardColors, fonts } from '../../../theme';
import { BoardSection } from '../../../components/BoardSection';
import { PinnedStrip } from '../../../components/PinnedStrip';
import { Avatar } from '../../../components/Avatar';
import { AddNoteSheet, NoteDraft } from '../../../components/AddNoteSheet';
import { useBoard, randomId } from '../../../hooks/useBoard';
import { useToast } from '../../../store/toast';
import { friendlyMessage, signedPhotoUrl, uploadPhoto } from '../../../lib/api';
import { ItemWithAuthor } from '../../../types';

/** Share of the board height reserved for the pinned-forever strip. */
const PINNED_FLEX = 2;
const REST_FLEX = 8;

export default function BoardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const boardId = id as string;
  const insets = useSafeAreaInsets();
  const {
    board,
    members,
    items,
    entries,
    loading,
    error,
    createItem,
    moveItem,
  } = useBoard(boardId);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [entering, setEntering] = useState<Set<string>>(() => new Set());
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const seenIdsRef = useRef<Set<string>>(new Set());
  const firstLoadRef = useRef(true);

  const openItem = (item: ItemWithAuthor) => router.push(`/board/${boardId}/note/${item.id}`);

  // Two board regions: pinned-forever posts up top (30%), everything else below.
  const pinnedItems = useMemo(() => items.filter((i) => i.pinned), [items]);
  const restItems = useMemo(() => items.filter((i) => !i.pinned), [items]);

  // Animate freshly-arrived items, ignoring the first paint.
  useEffect(() => {
    const ids = new Set(items.map((i) => i.id));
    if (firstLoadRef.current) {
      firstLoadRef.current = false;
      seenIdsRef.current = ids;
      return;
    }
    const added = items.filter((i) => !seenIdsRef.current.has(i.id));
    seenIdsRef.current = ids;
    if (added.length > 0) setEntering(new Set(added.map((i) => i.id)));
  }, [items]);

  // Resolve signed URLs once per photo path.
  useEffect(() => {
    const missing = items
      .filter((i) => i.photoPath && !(i.photoPath in photoUrls))
      .map((i) => i.photoPath as string);
    if (missing.length === 0) return;
    let alive = true;
    void (async () => {
      const pairs = await Promise.all(
        missing.map(async (path) => [path, await signedPhotoUrl(path)] as const),
      );
      if (!alive) return;
      setPhotoUrls((prev) => {
        const next = { ...prev };
        for (const [path, url] of pairs) if (url) next[path] = url;
        return next;
      });
    })();
    return () => {
      alive = false;
    };
  }, [items, photoUrls]);

  const handleMove = (item: ItemWithAuthor, x: number, y: number) => {
    moveItem(item, x, y).catch(() => {});
  };

  const handleAdd = async (draft: NoteDraft) => {
    setSubmitting(true);
    try {
      const itemId = randomId();
      let photoPath: string | null = null;
      if (draft.type === 'photo' && draft.photoUri) {
        photoPath = await uploadPhoto(boardId, itemId, draft.photoUri);
      }
      await createItem({
        id: itemId,
        boardId,
        type: draft.type,
        color: draft.color,
        body: draft.body || null,
        title: draft.title || null,
        eventAt: draft.eventAt,
        place: draft.place || null,
        photoPath,
        entries: draft.type === 'list' ? draft.entries : undefined,
      });
      setSheetOpen(false);
    } catch (e) {
      console.error('add post failed', e);
      useToast.getState().show(friendlyMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && !board) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  if (!board) {
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

  const isEmpty = items.length === 0;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: boardColors[board.color] }]} edges={['top']}>
      <View style={styles.header}>
        <Pressable
          hitSlop={8}
          onPress={() => router.push(`/board/${boardId}/people`)}
          style={styles.peopleBtn}
        >
          {members.slice(0, 3).map((m, i) => (
            <View key={m.userId} style={[styles.avatarStack, { zIndex: 10 - i, marginLeft: i === 0 ? 0 : -8 }]}>
              <Avatar name={m.user.displayName} size={26} />
            </View>
          ))}
          {members.length > 3 ? (
            <View style={[styles.avatarStack, styles.moreStack, { marginLeft: -8 }]}>
              <Text style={styles.moreText}>+{members.length - 3}</Text>
            </View>
          ) : null}
        </Pressable>

        <Pressable onPress={() => router.push(`/board/${boardId}/settings`)} style={styles.boardTitle}>
          <Text style={styles.boardName} numberOfLines={1}>{board.name}</Text>
          <Text style={styles.boardSubtitle}>Shared board</Text>
        </Pressable>

        <Pressable
          hitSlop={8}
          onPress={() => router.push(`/board/${boardId}/settings`)}
          style={styles.settingsBtn}
          accessibilityLabel="Board settings"
        >
          <Text style={styles.settingsGlyph}>⚙︎</Text>
        </Pressable>
      </View>

      {error ? <Text style={styles.banner}>{error}</Text> : null}

      {isEmpty ? (
        <View style={styles.empty}>
          <Text style={styles.emptyHand}>✍️</Text>
          <Text style={styles.emptyTitle}>Leave the first note</Text>
          <Text style={styles.emptySub}>Pin something up — everyone here will see it.</Text>
          <Pressable onPress={() => setSheetOpen(true)} style={styles.emptyBtn}>
            <Text style={styles.emptyBtnText}>+ Add note</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.sections}>
          <View style={styles.pinnedSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>📌 Pinned forever</Text>
            </View>
            <PinnedStrip
              items={pinnedItems}
              entries={entries}
              photoUrls={photoUrls}
              onOpen={openItem}
            />
          </View>

          <View style={styles.sectionDivider} />

          <View style={styles.restSection}>
            <BoardSection
              items={restItems}
              entries={entries}
              photoUrls={photoUrls}
              entering={entering}
              onOpen={openItem}
              onMove={handleMove}
              emptyHint="Everything else lives here."
            />
          </View>
        </View>
      )}

      {!isEmpty ? (
        <Pressable
          onPress={() => setSheetOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Add note"
          style={({ pressed }) => [
            styles.fab,
            { bottom: insets.bottom + 24 },
            pressed && styles.fabPressed,
          ]}
        >
          <Text style={styles.fabGlyph}>+</Text>
        </Pressable>
      ) : null}

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
  peopleBtn: { flexDirection: 'row', alignItems: 'center', width: 96 },
  avatarStack: { borderRadius: 15, borderWidth: 2, borderColor: 'rgba(255,255,255,0.85)' },
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
  moreText: { fontFamily: fonts.ui.bold, fontSize: 11, color: colors.inkSoft },
  boardName: {
    textAlign: 'center',
    fontFamily: fonts.hand.bold,
    fontSize: 24,
    color: colors.ink,
    paddingHorizontal: 8,
  },
  boardTitle: { flex: 1, alignItems: 'center' },
  boardSubtitle: { fontFamily: fonts.ui.regular, fontSize: 11, color: colors.inkSoft, marginTop: -2 },
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
  settingsGlyph: { fontSize: 18, color: colors.inkSoft },
  banner: {
    fontFamily: fonts.ui.semibold,
    fontSize: 13,
    color: colors.danger,
    textAlign: 'center',
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  sections: { flex: 1 },
  pinnedSection: { flex: PINNED_FLEX },
  restSection: { flex: REST_FLEX },
  sectionHeader: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 2 },
  sectionTitle: {
    fontFamily: fonts.ui.bold,
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.inkSoft,
  },
  sectionDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(62, 54, 46, 0.28)',
    marginHorizontal: 16,
    marginVertical: 6,
  },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingBottom: 60 },
  emptyHand: { fontSize: 40, marginBottom: 12 },
  emptyTitle: { fontFamily: fonts.hand.bold, fontSize: 32, color: colors.ink, marginBottom: 6 },
  emptySub: { fontFamily: fonts.ui.regular, fontSize: 15, color: colors.inkSoft, textAlign: 'center' },
  emptyBtn: {
    marginTop: 22,
    backgroundColor: colors.ink,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 16,
  },
  emptyBtnText: { fontFamily: fonts.ui.bold, fontSize: 16, color: colors.background },
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
  fabGlyph: { fontSize: 34, lineHeight: 38, color: '#fff', marginTop: -2 },
  missingTitle: { fontFamily: fonts.hand.bold, fontSize: 30, color: colors.ink },
  missingSub: { fontFamily: fonts.ui.regular, fontSize: 14, color: colors.inkSoft, marginTop: 6 },
  missingBtn: {
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: colors.ink,
  },
  missingBtnText: { fontFamily: fonts.ui.bold, color: colors.background },
});
