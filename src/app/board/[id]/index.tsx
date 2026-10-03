import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  AppState,
  useWindowDimensions,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { setStatusBarStyle } from 'expo-status-bar';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { boardColors, colors, darkDoors, doorInk, doorSoft, fonts } from '../../../theme';
import { BoardSection } from '../../../components/BoardSection';
import { PinnedStrip } from '../../../components/PinnedStrip';
import { FridgeDoor } from '../../../components/FridgeDoor';
import { MemberDot } from '../../../components/MemberDot';
import { AddNoteSheet, NoteDraft } from '../../../components/AddNoteSheet';
import { BoardSwitcher } from '../../../components/BoardSwitcher';
import { MagnetLayer } from '../../../components/MagnetLayer';
import { DecorationsTray } from '../../../components/DecorationsTray';
import { useBoard, randomId } from '../../../hooks/useBoard';
import { useDecorations } from '../../../hooks/useDecorations';
import { useSession } from '../../../store/session';
import { useToast } from '../../../store/toast';
import { friendlyMessage, keepLonger as apiKeepLonger, uploadPhoto } from '../../../lib/api';
import { cachedPhotoUri, dropCachedPhoto } from '../../../lib/photoCache';
import { rememberBoard } from '../../../lib/lastBoard';
import { ItemWithAuthor, Magnet } from '../../../types';

/** Share of the board height reserved for the pinned-forever strip. */
const PINNED_FLEX = 3.2;
const REST_FLEX = 7;

/** Height of the drag-to-delete target at the bottom of the screen. */
const DELETE_ZONE_HEIGHT = 96;

/** Fingerprint of a post draft: two submits may share a client id only when
 *  they are the same type with the same content. */
function draftKey(draft: NoteDraft): string {
  return JSON.stringify({
    t: draft.type,
    b: draft.body,
    ti: draft.title,
    e: draft.eventAt,
    p: draft.place,
    u: draft.photoUri,
    entries: draft.entries,
    pinned: draft.pinned,
    keepExtra: draft.keepExtra,
  });
}

export default function BoardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const boardId = id as string;
  const me = useSession((s) => s.user);
  const insets = useSafeAreaInsets();
  // Cream doors need dark status icons; the app default is light (pine
  // screens), so restore light when leaving for pine screens.
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle('dark');
      return () => setStatusBarStyle('light');
    }, []),
  );
  const { height: windowH } = useWindowDimensions();
  const {
    board,
    members,
    items,
    entries,
    loading,
    error,
    reload,
    createItem,
    moveItem,
    removeItem,
    restoreItem,
  } = useBoard(boardId);
  const decorations = useDecorations(boardId);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [decorateMode, setDecorateMode] = useState(false);
  const [trayOpen, setTrayOpen] = useState(false);
  const [hideDecorations, setHideDecorations] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [entering, setEntering] = useState<Set<string>>(() => new Set());
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [dragActive, setDragActive] = useState(false);
  const [overDelete, setOverDelete] = useState(false);
  // Bumped when a dropped note's delete fails, so it snaps back to its spot.
  const [dragReset, setDragReset] = useState(0);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const firstLoadRef = useRef(true);
  const overDeleteRef = useRef(false);
  // A failed post keeps its client id + uploaded path, so retrying reuses them
  // instead of creating a second item (post_item is idempotent on p_id).
  // The reuse is keyed to the exact draft: a *different* post must get a
  // fresh id, or its content would be silently dropped onto the old one.
  const pendingDraftRef = useRef<{
    id: string;
    photoPath: string | null;
    photoUri: string | null;
    key: string;
  } | null>(null);

  const openItem = (item: ItemWithAuthor) => router.push(`/board/${boardId}/note/${item.id}`);

  // Remember this board so a returning launch reopens it (see index.tsx).
  useEffect(() => {
    void rememberBoard(boardId);
  }, [boardId]);

  // Two board regions: pinned-forever posts up top (30%), everything else below.
  const pinnedItems = useMemo(() => items.filter((i) => i.pinned), [items]);
  const restItems = useMemo(() => items.filter((i) => !i.pinned), [items]);

  // --- Decorations (magnets) -----------------------------------------------
  const artById = useMemo(
    () => new Map(decorations.art.map((a) => [a.artId, a] as const)),
    [decorations.art],
  );
  const ownerId = useMemo(
    () => members.find((m) => m.role === 'owner')?.userId ?? null,
    [members],
  );
  const canRemoveMagnet = useCallback(
    (m: { placedBy: string | null }) => m.placedBy === (me?.id ?? null) || ownerId === me?.id,
    [me?.id, ownerId],
  );
  // Only magnets on the main door render here: door-anchored ones plus those
  // attached to a main-door note. Attached to a pinned note is a later pass.
  const restItemIds = useMemo(() => new Set(restItems.map((i) => i.id)), [restItems]);
  const doorMagnets = useMemo(
    () => decorations.magnets.filter((m) => m.itemId === null || restItemIds.has(m.itemId)),
    [decorations.magnets, restItemIds],
  );

  const handlePlaceMagnet = useCallback(
    (artId: string) => {
      void decorations
        .place({
          artId,
          // Drop near the top of the main door, fanned out a little.
          x: 0.25 + Math.random() * 0.5,
          y: 40 + Math.random() * 120,
          itemId: null,
          rotation: Math.round((Math.random() * 20 - 10) * 10) / 10,
        })
        .catch(() => {});
    },
    [decorations],
  );

  const handleMoveMagnet = useCallback(
    (m: Magnet, x: number, y: number, itemId: string | null) => {
      void decorations.move(m, x, y, itemId).catch(() => {});
    },
    [decorations],
  );

  const handleTapMagnet = useCallback(
    (m: Magnet) => {
      const label = artById.get(m.artId)?.label ?? 'Magnet';
      const placer = members.find((mm) => mm.userId === m.placedBy)?.user.displayName;
      const parts = [m.giftNote ? `${label} · ${m.giftNote}` : label, placer ? `added by ${placer}` : null];
      useToast.getState().show(parts.filter(Boolean).join(' · '));
    },
    [artById, members],
  );

  const handleOpenUnder = useCallback(
    (itemId: string) => router.push(`/board/${boardId}/note/${itemId}`),
    [boardId],
  );

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

  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  // Paths we've already tried to resolve, so a failure isn't retried until
  // the periodic/foreground refresh.
  const attemptedRef = useRef<Set<string>>(new Set());

  /** Apply resolved photo URIs, returning the SAME object when nothing
   *  changed — a new identity would re-run the effect below and spin forever
   *  on a null result. URIs are stable `file://` cache hits
   *  (src/lib/photoCache.ts), so refreshes never flicker or re-download. */
  const applyUrls = useCallback(
    (pairs: (readonly [string, string | null])[]) => {
      setPhotoUrls((prev) => {
        let changed = false;
        const next = { ...prev };
        for (const [path, url] of pairs) {
          if (url && next[path] !== url) {
            next[path] = url;
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    },
    [],
  );

  const signPaths = useCallback(
    async (paths: string[], force = false) => {
      const unique = [...new Set(paths)].filter((p) => force || !attemptedRef.current.has(p));
      if (unique.length === 0) return;
      for (const p of unique) attemptedRef.current.add(p);
      const pairs = await Promise.all(
        unique.map(async (path) => [path, await cachedPhotoUri(path)] as const),
      );
      applyUrls(pairs);
    },
    [applyUrls],
  );

  // Resolve only photos we don't already have a URI for and haven't already tried,
  // so a live update never refetches (or flickers) images, and a null result
  // (offline / missing file) doesn't loop.
  useEffect(() => {
    const toTry = items
      .map((i) => i.photoPath)
      .filter(
        (p): p is string => !!p && !(p in photoUrls) && !attemptedRef.current.has(p),
      );
    if (toTry.length === 0) return;
    for (const p of toTry) attemptedRef.current.add(p);
    // No cancelled/`alive` guard: applyUrls is a functional update, so letting
    // a batch land after `items` changed is safe. Discarding it (as before)
    // left those paths marked tried forever, so they stayed blank.
    void (async () => {
      const pairs = await Promise.all(
        toTry.map(async (path) => [path, await cachedPhotoUri(path)] as const),
      );
      applyUrls(pairs);
    })();
  }, [items, photoUrls, applyUrls]);

  // Cached URIs are stable disk files, so re-resolving is a cheap hit — but
  // re-resolve everything well before the underlying signed URLs would age
  // out anyway: every 12 hours and on foreground (which also retries
  // previously failed paths).
  useEffect(() => {
    const refreshAll = () => {
      attemptedRef.current.clear();
      void signPaths(
        itemsRef.current.filter((i) => i.photoPath).map((i) => i.photoPath as string),
        true,
      );
    };
    const timer = setInterval(refreshAll, 12 * 60 * 60 * 1000);
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') refreshAll();
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [signPaths]);

  const handleDragStart = () => {
    overDeleteRef.current = false;
    setOverDelete(false);
    setDragActive(true);
  };

  // A drag ended without a real move (long-press in place): nothing to
  // persist, just hide the delete zone again.
  const handleDragEnd = () => {
    overDeleteRef.current = false;
    setOverDelete(false);
    setDragActive(false);
  };

  // The finger counts as "over delete" once it reaches the bottom zone.
  const handleDragUpdate = (_item: ItemWithAuthor, screenY: number) => {
    const over = screenY >= windowH - insets.bottom - DELETE_ZONE_HEIGHT;
    if (over !== overDeleteRef.current) {
      overDeleteRef.current = over;
      setOverDelete(over);
    }
  };

  // A held note was dropped: delete it if it landed in the zone (with undo),
  // otherwise remember the new spot.
  const handleDrop = (item: ItemWithAuthor, x: number, y: number) => {
    const shouldDelete = overDeleteRef.current;
    overDeleteRef.current = false;
    setOverDelete(false);
    setDragActive(false);

    if (shouldDelete) {
      removeItem(item)
        .then(() =>
          useToast.getState().show('Note deleted', {
            label: 'Undo',
            onPress: () => restoreItem(item).catch(() => {}),
          }),
        )
        // useBoard already surfaced the failure; snap the note back.
        .catch(() => setDragReset((n) => n + 1));
      return;
    }
    moveItem(item, x, y).catch(() => {});
  };

  const handleAdd = async (draft: NoteDraft) => {
    setSubmitting(true);
    const pending = pendingDraftRef.current;
    // Same draft retried (e.g. a lost response): keep its id/path. Anything
    // else is a new post and gets a fresh id.
    const reuse = pending !== null && pending.key === draftKey(draft);
    const itemId = reuse ? pending.id : randomId();
    let photoPath: string | null = null;
    if (draft.type === 'photo' && draft.photoUri) {
      if (reuse && pending.photoPath && pending.photoUri === draft.photoUri) {
        photoPath = pending.photoPath;
      } else {
        try {
          photoPath = await uploadPhoto(boardId, itemId, draft.photoUri);
          // The bytes at this path are brand-new (or freshly overwritten on
          // retry): drop any cached file so the board renders them, not a
          // stale copy from an earlier attempt.
          await dropCachedPhoto(photoPath);
        } catch (e) {
          // The upload isn't routed through useBoard, so surface its error here.
          useToast.getState().show(friendlyMessage(e));
          setSubmitting(false);
          return;
        }
      }
    }
    pendingDraftRef.current = { id: itemId, photoPath, photoUri: draft.photoUri, key: draftKey(draft) };
    try {
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
        pinned: draft.pinned,
        entries: draft.type === 'list' ? draft.entries : undefined,
      });
      // Extra keep time the composer asked for: one Keep application per +7d.
      // Pinned and list posts are excluded — the server keeps pinned items
      // forever and rejects Keep for lists.
      if (draft.keepExtra > 0 && !draft.pinned && draft.type !== 'list') {
        for (let i = 0; i < draft.keepExtra; i++) {
          try {
            await apiKeepLonger(itemId);
          } catch (e) {
            useToast.getState().show(friendlyMessage(e));
            break;
          }
        }
      }
      pendingDraftRef.current = null;
      setSheetOpen(false);
    } catch {
      // createItem already surfaced the error via useBoard; keep the pending
      // entry so an unchanged retry doesn't duplicate the post or re-upload.
    } finally {
      setSubmitting(false);
    }
  };

  const handleSheetClose = () => {
    // Dismissing the composer abandons the draft: a later post must not reuse
    // a stale id/path.
    pendingDraftRef.current = null;
    setSheetOpen(false);
  };

  if (loading && !board) {
    return (
      <View style={[styles.safe, { backgroundColor: colors.background }]}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
        </View>
      </View>
    );
  }

  if (!board) {
    if (error) {
      // A failed load is not a missing board — offer a retry instead of
      // claiming the board is gone.
      return (
        <View style={[styles.safe, { backgroundColor: colors.background }]}>
          <View style={styles.center}>
            <Text style={styles.missingTitle}>Can’t open this fridge</Text>
            <Text style={styles.missingSub}>{error}</Text>
            <Pressable onPress={() => void reload()} style={styles.missingBtn}>
              <Text style={styles.missingBtnText}>Retry</Text>
            </Pressable>
            <Pressable onPress={() => router.replace('/')} style={styles.missingBack}>
              <Text style={styles.missingBackText}>Back to start</Text>
            </Pressable>
          </View>
        </View>
      );
    }
    return (
      <View style={[styles.safe, { backgroundColor: colors.background }]}>
        <View style={styles.center}>
          <Text style={styles.missingTitle}>This fridge is gone</Text>
          <Text style={styles.missingSub}>It may have been deleted by its owner.</Text>
          <Pressable onPress={() => router.replace('/')} style={styles.missingBtn}>
            <Text style={styles.missingBtnText}>Back to start</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const isEmpty = items.length === 0;

  return (
    <View style={[styles.safe, { backgroundColor: colors.black }]}>
      <View style={styles.sections}>
        <View style={styles.pinnedSection}>
          <FridgeDoor color={board.color} placement="top">
            <View style={styles.header}>
              <Pressable
                hitSlop={8}
                onPress={() => setSwitcherOpen(true)}
                style={styles.brandBadge}
                accessibilityRole="button"
                accessibilityLabel="Switch fridges"
                testID="switch-fridges"
              >
                <Text
                  style={[
                    styles.boardName,
                    {
                      color: doorInk(board.color),
                      textShadowColor: darkDoors.has(board.color)
                        ? 'rgba(0,0,0,0.45)'
                        : 'rgba(255,255,255,0.55)',
                    },
                  ]}
                  numberOfLines={1}
                >
                  {board.name}
                </Text>
                <MaterialCommunityIcons name="chevron-down" size={16} color={doorSoft(board.color)} />
              </Pressable>

              <Pressable
                hitSlop={8}
                onPress={() => {
                  setDecorateMode((v) => !v);
                  setTrayOpen((v) => !v);
                }}
                style={styles.decorateBtn}
                accessibilityRole="button"
                accessibilityState={{ selected: decorateMode }}
                accessibilityLabel={decorateMode ? 'Finish decorating' : 'Decorate the fridge'}
                testID="decorate-toggle"
              >
                <MaterialCommunityIcons
                  name={decorateMode ? 'check' : 'star-four-points-outline'}
                  size={20}
                  color={doorInk(board.color)}
                />
              </Pressable>

              <Pressable
                hitSlop={8}
                onPress={() => router.push('/profile')}
                style={styles.profileBtn}
                accessibilityRole="button"
                accessibilityLabel="Your profile and settings"
              >
                <MemberDot seed={me?.id ?? 'me'} name={me?.displayName ?? 'Someone'} size={36} />
              </Pressable>
            </View>
            <Text style={[styles.tagline, { color: doorSoft(board.color) }]}>📌 Always here</Text>

            {error ? <Text style={styles.banner}>{error}</Text> : null}

            <PinnedStrip
              items={pinnedItems}
              entries={entries}
              photoUrls={photoUrls}
              onOpen={openItem}
              doorColor={board.color}
            />
          </FridgeDoor>
        </View>

        <View style={styles.restSection}>
          <FridgeDoor color={board.color} placement="bottom">
            {isEmpty ? (
              <View style={styles.empty}>
                <Text style={styles.emptyHand}>✍️</Text>
                <Text style={[styles.emptyTitle, { color: doorInk(board.color) }]}>Leave the first note</Text>
                <Text style={[styles.emptySub, { color: doorSoft(board.color) }]}>Pin something up — everyone here will see it.</Text>
                <Pressable
                  onPress={() => setSheetOpen(true)}
                  style={[styles.emptyBtn, { backgroundColor: boardColors[board.color] }]}
                >
                  <Text style={[styles.emptyBtnText, { color: doorInk(board.color) }]}>+ Add note</Text>
                </Pressable>
              </View>
            ) : (
              <BoardSection
                items={restItems}
              entries={entries}
              photoUrls={photoUrls}
              entering={entering}
              onOpen={openItem}
              onMove={handleDrop}
              onDragStart={handleDragStart}
              onDragUpdate={handleDragUpdate}
              onDragEnd={handleDragEnd}
              resetKey={dragReset}
              emptyHint="Everything else lives here."
              renderOverlay={({ layout, boardW, scale }) => (
                <>
                  {!hideDecorations ? (
                    <MagnetLayer
                      magnets={doorMagnets}
                      artById={artById}
                      layout={layout}
                      boardW={boardW}
                      scale={scale}
                      decorate={decorateMode}
                      canRemove={canRemoveMagnet}
                      onMove={handleMoveMagnet}
                      onRemove={(m) => void decorations.remove(m).catch(() => {})}
                      onTap={handleTapMagnet}
                      onOpenUnder={handleOpenUnder}
                    />
                  ) : null}
                </>
              )}
              />
            )}
          </FridgeDoor>
        </View>
      </View>

      {dragActive ? (
        <View
          pointerEvents="none"
          style={[
            styles.deleteZone,
            { backgroundColor: boardColors[board.color] },
            { bottom: insets.bottom + 20 },
            overDelete && styles.deleteZoneOver,
          ]}
        >
          <MaterialCommunityIcons
            name="trash-can-outline"
            size={22}
            color={overDelete ? colors.white : doorInk(board.color)}
          />
          <Text
            style={[
              styles.deleteZoneText,
              { color: doorInk(board.color) },
              overDelete && styles.deleteZoneTextOver,
            ]}
          >
            {overDelete ? 'Release to delete' : 'Drag here to delete'}
          </Text>
        </View>
      ) : null}

      {!isEmpty && !dragActive ? (
          <Pressable
            onPress={() => setSheetOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Add to fridge"
            style={({ pressed }) => [
              styles.composerBtn,
              { backgroundColor: boardColors[board.color] },
              pressed && styles.composerPressed,
              { bottom: insets.bottom + 20 },
            ]}
          >
            <Text style={[styles.composerGlyph, { color: doorInk(board.color) }]}>+</Text>
            <Text style={[styles.composerText, { color: doorInk(board.color) }]}>Add to Fridge</Text>
          </Pressable>
      ) : null}

      <AddNoteSheet
        visible={sheetOpen}
        submitting={submitting}
        onClose={handleSheetClose}
        onSubmit={handleAdd}
      />
      <BoardSwitcher
        visible={switcherOpen}
        currentBoardId={boardId}
        onClose={() => setSwitcherOpen(false)}
      />
      <DecorationsTray
        visible={trayOpen && decorateMode}
        art={decorations.art}
        hideDecorations={hideDecorations}
        onToggleHide={() => setHideDecorations((v) => !v)}
        onPlace={handlePlaceMagnet}
        onClose={() => {
          setTrayOpen(false);
          setDecorateMode(false);
        }}
      />
    </View>
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
    marginTop: 44,
    height: 56,
  },
  profileBtn: { alignItems: 'center', justifyContent: 'center' },
  decorateBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 36,
    height: 36,
    marginRight: 8,
    borderRadius: 18,
  },
  // Fridge brand badge: the board name embossed straight onto the door
  // enamel, like an appliance logo — uppercase, letterspaced, no plate.
  // Still tappable: opens the fridge switcher.
  brandBadge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginRight: 10,
    paddingVertical: 7,
  },
  boardName: {
    fontFamily: fonts.ui.extraBold,
    fontSize: 21,
    letterSpacing: 3,
    textTransform: 'uppercase',
    color: colors.ink,
    textAlign: 'center',
    textShadowColor: 'rgba(255,255,255,0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  tagline: {
    fontFamily: fonts.ui.regular,
    fontSize: 13,
    color: colors.inkSoft,
    marginTop: 2,
    marginBottom: 6,
  },
  banner: {
    fontFamily: fonts.ui.semibold,
    fontSize: 13,
    color: colors.danger,
    textAlign: 'center',
    paddingBottom: 4,
  },
  sections: { flex: 1 },
  pinnedSection: { flex: PINNED_FLEX },
  restSection: { flex: REST_FLEX, overflow: 'hidden' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingBottom: 60 },
  emptyHand: { fontSize: 40, marginBottom: 12 },
  emptyTitle: { fontFamily: fonts.hand.bold, fontSize: 32, color: colors.ink, marginBottom: 6 },
  emptySub: { fontFamily: fonts.ui.regular, fontSize: 15, color: colors.inkSoft, textAlign: 'center' },
  emptyBtn: {
    marginTop: 22,
    backgroundColor: colors.leaf,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 16,
  },
  emptyBtnText: { fontFamily: fonts.ui.bold, fontSize: 16, color: colors.pine },
  deleteZone: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 999,
    backgroundColor: colors.leaf,
    shadowColor: colors.shadow,
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  deleteZoneOver: {
    backgroundColor: colors.danger,
    borderColor: colors.danger,
  },
  deleteZoneText: {
    fontFamily: fonts.ui.bold,
    fontSize: 15,
    color: colors.pine,
  },
  deleteZoneTextOver: {
    color: colors.white,
  },
  composerBtn: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    backgroundColor: colors.pine,
    paddingHorizontal: 22,
    paddingVertical: 14,
    shadowColor: colors.shadow,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  composerPressed: { transform: [{ scale: 0.96 }] },
  composerGlyph: { fontSize: 22, lineHeight: 24, color: colors.onPine, fontFamily: fonts.ui.bold },
  composerText: { fontFamily: fonts.ui.bold, fontSize: 16, color: colors.onPine },
  missingTitle: { fontFamily: fonts.hand.bold, fontSize: 30, color: colors.ink },
  missingSub: { fontFamily: fonts.ui.regular, fontSize: 14, color: colors.inkSoft, marginTop: 6 },
  missingBtn: {
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: colors.accent,
  },
  missingBtnText: { fontFamily: fonts.ui.bold, color: colors.background },
  missingBack: { marginTop: 12, paddingVertical: 8 },
  missingBackText: { fontFamily: fonts.ui.semibold, fontSize: 14, color: colors.inkSoft },
});
