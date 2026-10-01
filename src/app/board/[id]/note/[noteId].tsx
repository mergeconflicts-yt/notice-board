import { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Alert, Animated, useWindowDimensions } from 'react-native';
import { BlurView } from 'expo-blur';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, fonts } from '../../../../theme';
import { NotePaper } from '../../../../components/NotePaper';
import { AddNoteSheet, NoteDraft } from '../../../../components/AddNoteSheet';
import { useBoard } from '../../../../hooks/useBoard';
import { useSession } from '../../../../store/session';
import { useToast } from '../../../../store/toast';
import { friendlyMessage, reportPost, signedPhotoUrl } from '../../../../lib/api';
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
  const [keeping, setKeeping] = useState(false);
  const [expiryFlash, setExpiryFlash] = useState(false);
  const [expiryPulse] = useState(() => new Animated.Value(0));
  const prevExpiryRef = useRef<string | null>(null);
  const { width: screenW, height: screenH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [noteH, setNoteH] = useState(0);

  const item = items.find((i) => i.id === noteId) ?? null;
  const itemEntries = entries.filter((e) => e.itemId === noteId);

  const isCreator = !!me && me.id === item?.createdBy;
  const done = Boolean(item?.doneAt);
  const completedBy = item?.doneBy
    ? (members.find((m) => m.userId === item?.doneBy)?.user.displayName ?? null)
    : null;
  const expiry = keepUntilLabel(item?.keepUntil ?? null);

  // Pop the Leaves chip whenever the date actually moves (e.g. after Keep),
  // so the subtle text change is impossible to miss.
  useEffect(() => {
    const prev = prevExpiryRef.current;
    prevExpiryRef.current = expiry;
    if (prev !== null && expiry !== null && prev !== expiry) {
      setExpiryFlash(true);
      expiryPulse.setValue(0);
      Animated.sequence([
        Animated.spring(expiryPulse, { toValue: 1, friction: 5, tension: 140, useNativeDriver: true }),
        Animated.timing(expiryPulse, { toValue: 0, duration: 350, useNativeDriver: true }),
      ]).start();
      const t = setTimeout(() => setExpiryFlash(false), 1800);
      return () => clearTimeout(t);
    }
  }, [expiry, expiryPulse]);

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
          <Text style={styles.goneBtnText}>Back to fridge</Text>
        </View>
      </Pressable>
    );
  }

  const canMarkDone = item.type === 'note' || item.type === 'date';
  const canKeepLonger = !item.pinned && item.type !== 'list';

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
        // The composer has no notes field: leave any existing body untouched.
        await editList(item, { title: draft.title, color: draft.color, adds, edits, removes });
      } else {
        await editItem(item, {
          body: item.type === 'note' || item.type === 'photo' ? draft.body : undefined,
          title: item.type === 'date' ? draft.title : undefined,
          eventAt: item.type === 'date' ? draft.eventAt : undefined,
          // The composer has no place field: leave any existing place untouched.
          place: undefined,
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

  // Quiet report: the post stays up, the board owner sees it in Fridge
  // settings, and the reporter only gets a thank-you (no details leak).
  const handleReport = () => {
    if (!item) return;
    Alert.alert('Report this post?', 'The fridge owner will take a look. The person who posted it won’t be told.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Report',
        onPress: () => {
          void reportPost(item.id)
            .then(() => useToast.getState().show('Thanks — the fridge owner will take a look.'))
            .catch((e) => useToast.getState().show(friendlyMessage(e)));
        },
      },
    ]);
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

        {done || expiry ? (
          <View style={[styles.metaRow, { marginTop: belowTop }]}>
            {done ? (
              <View style={[styles.chip, styles.doneChip]}>
                <MaterialCommunityIcons name="check-circle" size={14} color={colors.accentDeep} />
                <Text style={styles.doneChipText}>
                  {completedBy ? `Done · ${completedBy}` : 'Done'}
                </Text>
              </View>
            ) : null}
            {expiry ? (
              <Animated.View
                style={[
                  styles.chip,
                  expiryFlash && styles.chipFlash,
                  {
                    transform: [
                      {
                        scale: expiryPulse.interpolate({
                          inputRange: [0, 1],
                          outputRange: [1, 1.12],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name="clock-outline"
                  size={14}
                  color={expiryFlash ? colors.accentDeep : colors.inkSoft}
                />
                <Text style={[styles.chipText, expiryFlash && styles.chipTextFlash]}>{expiry}</Text>
              </Animated.View>
            ) : null}
          </View>
        ) : (
          <View style={{ height: belowTop }} />
        )}

        <View style={styles.actionBar}>
          {canMarkDone ? (
            <ActionButton
              icon={done ? 'undo' : 'check-circle-outline'}
              label={done ? 'Reopen' : 'Done'}
              active={done}
              onPress={() => setDone(item, !done).catch(noop)}
            />
          ) : null}
          <ActionButton
            icon={item.pinned ? 'pin-off-outline' : 'pin-outline'}
            label={item.pinned ? 'Unpin' : 'Pin'}
            active={item.pinned}
            onPress={() => setPinned(item, !item.pinned).catch(noop)}
          />
          {canKeepLonger ? (
            <ActionButton
              icon="clock-plus-outline"
              label={keeping ? 'Keeping…' : 'Keep'}
              busy={keeping}
              onPress={() => {
                if (keeping) return;
                setKeeping(true);
                keepLonger(item)
                  .catch(noop)
                  .finally(() => setKeeping(false));
              }}
            />
          ) : null}
          {isCreator ? (
            <ActionButton
              icon="pencil-outline"
              label="Edit"
              onPress={() => {
                setEditSnapshot(itemEntries);
                setEditing(true);
              }}
            />
          ) : (
            <ActionButton icon="flag-outline" label="Report" onPress={handleReport} />
          )}
          <ActionButton
            icon="trash-can-outline"
            label="Remove"
            destructive
            onPress={handleRemove}
          />
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

function ActionButton({
  icon,
  label,
  onPress,
  destructive = false,
  active = false,
  busy = false,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  onPress: () => void;
  destructive?: boolean;
  active?: boolean;
  busy?: boolean;
}) {
  const tint = destructive ? colors.danger : active ? colors.accentDeep : colors.ink;
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      disabled={busy}
      style={[styles.actionBtn, busy && styles.actionBtnBusy]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={[styles.actionIconWrap, active && styles.actionIconActive]}>
        <MaterialCommunityIcons name={icon} size={22} color={tint} />
      </View>
      <Text style={[styles.actionLabel, { color: tint }]}>{label}</Text>
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
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, flexWrap: 'wrap', paddingHorizontal: 24 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: colors.overlay,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipText: { fontFamily: fonts.ui.semibold, fontSize: 12, color: colors.inkSoft },
  chipFlash: { backgroundColor: colors.highlight, borderColor: colors.accentDeep, borderWidth: 1.5 },
  chipTextFlash: { color: colors.accentDeep, fontFamily: fonts.ui.bold },
  doneChip: { backgroundColor: colors.highlight, borderColor: colors.border },
  doneChipText: { fontFamily: fonts.ui.bold, fontSize: 12, color: colors.accentDeep },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'center',
    gap: 2,
    marginTop: 12,
    marginHorizontal: 24,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: colors.overlay,
    borderWidth: 1,
    borderColor: colors.border,
    boxShadow: '0 8px 20px -8px rgba(20,30,25,0.35)',
  },
  actionBtn: { alignItems: 'center', justifyContent: 'center', gap: 3, minWidth: 62, paddingVertical: 8, paddingHorizontal: 8, borderRadius: 14 },
  actionIconWrap: { alignItems: 'center', justifyContent: 'center', width: 40, height: 40, borderRadius: 20, backgroundColor: colors.accentWash },
  actionIconActive: { backgroundColor: colors.selected },
  actionLabel: { fontFamily: fonts.ui.bold, fontSize: 11 },
  actionBtnBusy: { opacity: 0.6 },
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
