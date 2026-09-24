import { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts } from '../theme';
import { NotePaper } from './NotePaper';
import { ErrorBoundary } from './ErrorBoundary';
import { AddNoteSheet, NoteSheetInput } from './AddNoteSheet';
import { BoardLayout, REF_W, widthFracForNote } from '../utils/layout';
import { BoardMembership, NotePatch, NoteWithAuthor, User } from '../types';

/** Cap so a tiny note never balloons past this when scaled up. */
const MAX_SCALE = 2.8;

const noop = () => {};

type Props = {
  note: NoteWithAuthor;
  members: BoardMembership[] | null;
  me: User | null;
  layout: BoardLayout;
  onClose: () => void;
  onToggleEntry: (itemId: string, index: number) => void;
  onUpdateNote: (id: string, patch: NotePatch) => Promise<void>;
  onSaveEdit: (id: string, input: NoteSheetInput) => Promise<void>;
};

/**
 * An in-board zoom of a single post — no navigation, no native modal screen,
 * so it can't take the app down with it. Renders the note at its board width,
 * scaled up to read, with list rows tappable and an edit sheet on demand.
 */
export function NoteOverlay({
  note,
  members,
  me,
  layout,
  onClose,
  onToggleEntry,
  onUpdateNote,
  onSaveEdit,
}: Props) {
  const { width: screenW, height: screenH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [noteH, setNoteH] = useState(0);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  // The tap that opened this can land on the backdrop as it appears; ignore
  // dismiss taps for a moment.
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setArmed(true), 450);
    return () => clearTimeout(t);
  }, []);

  // Only a chosen list gets checkboxes: guessing from the text produced
  // rows with no backing entries whose taps silently did nothing.
  const isList = note.kind === 'list';
  const isCreator = !!me && me.id === note.authorId;
  const done = Boolean(note.completedAt);

  const completedById = (note.data as { completedBy?: unknown } | null)?.completedBy;
  const completedByName =
    typeof completedById === 'string'
      ? ((members ?? []).find((m) => m.userId === completedById)?.user?.displayName ?? null)
      : null;

  const placement = layout.get(note.id);
  const naturalW = (placement?.w ?? widthFracForNote(note)) * REF_W;

  const maxW = Math.min(screenW - 48, 340);
  const maxH = screenH - insets.top - insets.bottom - 140;
  const scale = Math.min(maxW / naturalW, noteH > 0 ? maxH / noteH : MAX_SCALE, MAX_SCALE);
  // The paper scales around its centre, so it spills past its layout box;
  // push anything below it clear of the enlarged visual.
  const belowTop = noteH > 0 ? (noteH * (scale - 1)) / 2 + 12 : 12;

  const handleEdit = async (input: NoteSheetInput) => {
    if (!isCreator) return;
    setSaving(true);
    try {
      await onSaveEdit(note.id, input);
      setEditing(false);
    } catch (e) {
      console.error('edit failed', e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ErrorBoundary>
      <View style={styles.container}>
        <Pressable
          style={[StyleSheet.absoluteFill, styles.backdrop]}
          onPress={() => {
            if (armed) onClose();
          }}
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
                onToggleItem={isList ? (i) => onToggleEntry(note.id, i) : undefined}
              />
            </View>
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
                      onPress={() =>
                        onUpdateNote(note.id, {
                          completedAt: done ? null : new Date().toISOString(),
                        }).catch((e) => console.error('toggle done failed', e))
                      }
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
          </Pressable>
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
      </View>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backdrop: {
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
