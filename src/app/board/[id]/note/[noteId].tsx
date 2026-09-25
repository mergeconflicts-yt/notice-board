import { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, useWindowDimensions } from 'react-native';
import { BlurView } from 'expo-blur';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts } from '../../../../theme';
import { NotePaper } from '../../../../components/NotePaper';
import { AddNoteSheet, NoteDraft } from '../../../../components/AddNoteSheet';
import { useBoard } from '../../../../hooks/useBoard';
import { useSession } from '../../../../store/session';
import { useToast } from '../../../../store/toast';
import { signedPhotoUrl } from '../../../../lib/api';
import { keepUntilLabel } from '../../../../utils/note';

const MAX_SCALE = 2.4;
const noop = () => {};

export default function ItemDetailScreen() {
  const { id, noteId } = useLocalSearchParams<{ id: string; noteId: string }>();
  const boardId = id as string;
  const { items, entries, members, loading, toggleEntry, setDone, setPinned, keepLonger, removeItem, restoreItem, editItem, editList } =
    useBoard(boardId);
  const me = useSession((s) => s.user);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  // Entries as they were when the editor opened — reconciled against these,
  // not the live list (other members may have added rows since). Updated as a
  // save progresses so a retry after a partial failure resumes rather than
  // repeating work.
  const [editSnapshot, setEditSnapshot] = useState<{ id: string; text: string }[] | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const { width: screenW, height: screenH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [noteH, setNoteH] = useState(0);

  const item = items.find((i) => i.id === noteId) ?? null;
  const itemEntries = entries.filter((e) => e.itemId === noteId);

  useEffect(() => {
    if (item?.photoPath) void signedPhotoUrl(item.photoPath).then(setPhotoUrl).catch(noop);
  }, [item?.photoPath]);

  if (!item) {
    if (loading) {
      return (
        <View style={styles.container}>
          <ActivityIndicator color={colors.accent} />
        </View>
      );
    }
    // Loaded but absent: expired, removed, or the link is stale.
    return (
      <Pressable style={styles.container} onPress={() => router.back()}>
        <Text style={styles.goneTitle}>This post is gone</Text>
        <Text style={styles.goneSub}>It may have expired or been removed.</Text>
        <View style={styles.goneBtn}>
          <Text style={styles.goneBtnText}>Back to board</Text>
        </View>
      </Pressable>
    );
  }

  const isCreator = !!me && me.id === item.createdBy;
  const done = Boolean(item.doneAt);
  const completedBy = item.doneBy
    ? (members.find((m) => m.userId === item.doneBy)?.user.displayName ?? null)
    : null;
  const expiry = keepUntilLabel(item.keepUntil);
  const canMarkDone = item.type === 'note' || item.type === 'date';

  const naturalW = Math.min(screenW - 48, 340);
  const maxH = screenH - insets.top - insets.bottom - 140;
  const scale = Math.min(naturalW / Math.max(naturalW, 1), noteH > 0 ? maxH / noteH : MAX_SCALE, MAX_SCALE);
  const belowTop = noteH > 0 ? (noteH * (scale - 1)) / 2 + 12 : 12;

  const handleEdit = async (draft: NoteDraft) => {
    if (!isCreator) return;
    setSaving(true);
    try {
      if (item.type === 'list') {
        // One atomic RPC: diff the draft against the snapshot and send only
        // the adds/edits/removes, so a failure never leaves a half-applied list.
        const base = editSnapshot ?? itemEntries;
        const baseText = new Map(base.map((e) => [e.id, e.text]));
        const draftIds = new Set(draft.entries.map((r) => r.id));
        const adds: { id: string; text: string }[] = [];
        const edits: { id: string; text: string }[] = [];
        for (const row of draft.entries) {
          const previous = baseText.get(row.id);
          if (previous === undefined) adds.push({ id: row.id, text: row.text });
          else if (previous !== row.text) edits.push({ id: row.id, text: row.text });
        }
        const removes = base.filter((e) => !draftIds.has(e.id)).map((e) => e.id);
        await editList(item, { title: draft.title, color: draft.color, body: draft.body, adds, edits, removes });
      } else {
        await editItem(item, {
          body: item.type === 'note' || item.type === 'photo' ? draft.body : undefined,
          title: item.type === 'date' ? draft.title : undefined,
          eventAt: item.type === 'date' ? draft.eventAt : undefined,
          place: item.type === 'date' ? draft.place : undefined,
          color: draft.color,
        });
      }
      setEditSnapshot(null);
      setEditing(false);
    } catch {
      // useBoard already showed the error; keep the sheet open to retry.
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    const snapshot = item;
    try {
      await removeItem(item);
    } catch {
      // Stay on the screen; useBoard already reported the failure.
      return;
    }
    router.back();
    useToast.getState().show('Removed', {
      label: 'Undo',
      onPress: () => restoreItem(snapshot).catch(noop),
    });
  };

  return (
    <Pressable style={styles.container} onPress={() => router.back()}>
      <BlurView intensity={20} tint="default" pointerEvents="none" style={StyleSheet.absoluteFill} />
      <View style={styles.center}>
        <Pressable onPress={noop}>
          <View
            style={{ width: naturalW, transform: [{ scale }] }}
            onLayout={(e) => setNoteH(e.nativeEvent.layout.height)}
          >
            <NotePaper
              item={item}
              large
              showAllEntries
              entries={itemEntries}
              photoUrl={photoUrl}
              onToggleEntry={item.type === 'list' ? toggleEntry : undefined}
            />
          </View>
        </Pressable>

        <View style={[styles.actions, { marginTop: belowTop }]}>
          {done ? (
            <Text style={styles.doneText}>
              ✓ {completedBy ? `Completed by ${completedBy}` : 'Completed'}
            </Text>
          ) : null}
          {expiry ? <Text style={styles.expiry}>{expiry}</Text> : null}
        </View>

        <View style={styles.buttonRow}>
          {canMarkDone ? (
            <Action label={done ? 'Reopen' : 'Mark done'} onPress={() => setDone(item, !done).catch(noop)} />
          ) : null}
          <Action
            label={item.pinned ? 'Unpin' : 'Pin'}
            onPress={() => setPinned(item, !item.pinned).catch(noop)}
          />
          {!item.pinned && item.type !== 'list' ? (
            <Action label="Keep longer" onPress={() => keepLonger(item).catch(noop)} />
          ) : null}
          {isCreator ? (
            <Action
              label="Edit"
              onPress={() => {
                setEditSnapshot(itemEntries);
                setEditing(true);
              }}
            />
          ) : null}
          <Action label="Remove" destructive onPress={handleRemove} />
        </View>
      </View>

      <AddNoteSheet
        visible={editing && isCreator}
        submitting={saving}
        submitLabel="Save"
        initial={item}
        photoUrl={photoUrl}
        entries={(editSnapshot ?? itemEntries).map((e) => ({ id: e.id, text: e.text }))}
        onClose={() => {
          setEditing(false);
          setEditSnapshot(null);
        }}
        onSubmit={handleEdit}
      />
    </Pressable>
  );
}

function Action({
  label,
  onPress,
  destructive = false,
}: {
  label: string;
  onPress: () => void;
  destructive?: boolean;
}) {
  return (
    <Pressable onPress={onPress} hitSlop={10} style={styles.actionPill} accessibilityRole="button">
      <Text style={[styles.actionText, destructive && styles.actionDanger]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.backdrop,
  },
  center: { alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  doneText: { fontFamily: fonts.ui.semibold, fontSize: 13, color: colors.inkSoft, opacity: 0.85 },
  expiry: { fontFamily: fonts.ui.semibold, fontSize: 12, color: colors.inkSoft, opacity: 0.75 },
  buttonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16, justifyContent: 'center' },
  actionPill: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: colors.overlay,
  },
  actionText: { fontFamily: fonts.ui.bold, fontSize: 14, color: colors.ink },
  actionDanger: { color: colors.danger },
  goneTitle: { fontFamily: fonts.hand.bold, fontSize: 30, color: colors.ink },
  goneSub: { fontFamily: fonts.ui.regular, fontSize: 14, color: colors.inkSoft, marginTop: 6 },
  goneBtn: {
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: colors.ink,
  },
  goneBtnText: { fontFamily: fonts.ui.bold, color: colors.background },
});
