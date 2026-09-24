import { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, useWindowDimensions } from 'react-native';
import { BlurView } from 'expo-blur';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts } from '../../../../theme';
import { NotePaper } from '../../../../components/NotePaper';
import { AddNoteSheet, NoteSheetInput } from '../../../../components/AddNoteSheet';
import { useBoardMembers, useBoardNotes } from '../../../../hooks/useBoardV2';
import { useSession } from '../../../../store/session';
import { REF_W, computeBoardLayout, widthFracForNote } from '../../../../utils/layout';
import { parseListItems } from '../../../../utils/note';

/** Cap so a tiny note never balloons past this when scaled up. */
const MAX_SCALE = 2.8;

const noop = () => {};

/**
 * A read-only zoom of a single post. The note is rendered exactly as it sits
 * on the board (same width and tilt) and then scaled up to fill a centred
 * popup. List checkboxes stay tappable; tapping the backdrop dismisses it.
 */
export default function NoteDetailScreen() {
  const { id, noteId } = useLocalSearchParams<{ id: string; noteId: string }>();
  const boardId = id as string;
  const { notes, toggleEntry, updateNote, saveEdit } = useBoardNotes(boardId);
  const { members } = useBoardMembers(boardId);
  const me = useSession((s) => s.user);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const { width: screenW, height: screenH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [noteH, setNoteH] = useState(0);

  const layout = useMemo(() => computeBoardLayout(notes ?? []), [notes]);
  const note = notes?.find((n) => n.id === noteId);

  if (!note) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  const isList = note.kind === 'list' || parseListItems(note.text).items.length > 0;
  const isCreator = !!me && me.id === note.authorId;
  const done = Boolean(note.completedAt);

  // Checklist taps flip the entry row itself — no text rewriting, so two
  // people toggling at once never clobber each other.
  const toggleListItem = (index: number) => {
    toggleEntry(note.id, index).catch((e) => console.error('toggle failed', e));
  };

  const toggleDone = () => {
    if (!isCreator) return;
    updateNote(note.id, {
      completedAt: done ? null : new Date().toISOString(),
    }).catch((e) => console.error('toggle done failed', e));
  };

  const completedById = (note.data as { completedBy?: unknown } | null)?.completedBy;
  const completedByName =
    typeof completedById === 'string'
      ? (members ?? []).find((m) => m.userId === completedById)?.user.displayName ?? null
      : null;

  const handleEdit = async (input: NoteSheetInput) => {
    if (!isCreator) return;
    setSaving(true);
    try {
      await saveEdit(note.id, input);
      setEditing(false);
    } catch (e) {
      console.error('edit failed', e);
    } finally {
      setSaving(false);
    }
  };

  // Match the board's paper width (but present it straight, no tilt).
  const placement = layout.get(note.id);
  const naturalW = (placement?.w ?? widthFracForNote(note)) * REF_W;

  const maxW = Math.min(screenW - 48, 340);
  const maxH = screenH - insets.top - insets.bottom - 140;
  const scale = Math.min(maxW / naturalW, noteH > 0 ? maxH / noteH : MAX_SCALE, MAX_SCALE);
  // The paper is scaled around its centre, so it spills past its layout box;
  // push anything below it clear of the enlarged visual.
  const belowTop = noteH > 0 ? (noteH * (scale - 1)) / 2 + 12 : 12;

  return (
    <Pressable style={styles.container} onPress={() => router.back()}>
      <BlurView
        intensity={20}
        tint="default"
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.center}>
        <Pressable onPress={noop}>
          <View
            style={{ width: naturalW, transform: [{ scale }] }}
            onLayout={(e) => setNoteH(e.nativeEvent.layout.height)}
          >
            <NotePaper
              note={note}
              showAllItems
              onToggleItem={isList ? toggleListItem : undefined}
            />
          </View>
        </Pressable>
        {done || isCreator ? (
          <View style={[styles.doneRow, { marginTop: belowTop }]}>
            {done ? (
              <Text style={styles.doneText}>
                ✓ {completedByName ? `Completed by ${completedByName}` : 'Completed'}
              </Text>
            ) : null}
            {isCreator ? (
              <View style={styles.doneActions}>
                <Pressable
                  onPress={toggleDone}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={done ? 'Reopen note' : 'Mark note done'}
                >
                  <Text style={styles.doneAction}>{done ? 'Reopen' : 'Mark done'}</Text>
                </Pressable>
                <Pressable
                  onPress={() => setEditing(true)}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel="Edit note"
                >
                  <Text style={styles.doneAction}>Edit</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>

      <AddNoteSheet
        visible={editing && isCreator}
        submitting={saving}
        submitLabel="Save note"
        initial={{
          text: note.text,
          imageUrl: note.imageUrl,
          expiresAt: note.expiresAt,
          kind: note.kind,
          data: note.data,
          color: note.color,
        }}
        onClose={() => setEditing(false)}
        onSubmit={handleEdit}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(62, 54, 46, 0.12)',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  doneText: {
    fontFamily: fonts.ui.semibold,
    fontSize: 13,
    color: colors.inkSoft,
    opacity: 0.85,
  },
  doneAction: {
    fontFamily: fonts.ui.bold,
    fontSize: 14,
    color: colors.accentDeep,
  },
  doneActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
});
