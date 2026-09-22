import { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts } from '../../../../theme';
import { NotePaper } from '../../../../components/NotePaper';
import { Avatar } from '../../../../components/Avatar';
import { Button } from '../../../../components/Button';
import { AddNoteSheet, NoteSheetInput } from '../../../../components/AddNoteSheet';
import { useNotes } from '../../../../hooks/useBoard';
import { useSession } from '../../../../store/session';
import { getBackend } from '../../../../services';
import { relativeTime, clockTime } from '../../../../utils/time';
import { parseListItems } from '../../../../utils/note';

export default function NoteDetailScreen() {
  const { id, noteId } = useLocalSearchParams<{ id: string; noteId: string }>();
  const boardId = id as string;
  const { notes, updateNote, deleteNote } = useNotes(boardId);
  const me = useSession((s) => s.user);
  const insets = useSafeAreaInsets();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const note = notes?.find((n) => n.id === noteId);

  if (!note) {
    return (
      <View style={styles.scrim}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  const isCreator = !!me && me.id === note.authorId;
  const isList =
    note.kind === 'list' || parseListItems(note.text).items.length > 0;

  const toggleDone = async () => {
    if (!isCreator) return;
    await updateNote(note.id, {
      completedAt: note.completedAt ? null : new Date().toISOString(),
    });
  };

  const toggleListItem = async (index: number) => {
    const { title, items } = parseListItems(note.text);
    const target = items[index];
    if (!target) return;
    const next = items.map((it, i) =>
      i === index ? { ...it, done: !it.done } : it,
    );
    const lines = [
      ...(title ? [title] : []),
      ...next.map((it) => `${it.done ? '☑' : '☐'} ${it.text}`),
    ];
    await updateNote(note.id, {
      text: lines.join('\n'),
      data: { ...((note.data as Record<string, unknown> | null) ?? {}), items: next },
    });
  };

  const handleDelete = () => {
    if (!isCreator) return;
    Alert.alert('Delete this note?', 'It will disappear from the board for everyone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteNote(note.id);
          router.back();
        },
      },
    ]);
  };

  const handleEdit = async (input: NoteSheetInput) => {
    if (!isCreator) return;
    setSaving(true);
    try {
      let imageUrl = input.imageUrl;
      if (imageUrl && !imageUrl.startsWith('http')) {
        imageUrl = await getBackend().uploadImage(imageUrl);
      }
      await updateNote(note.id, {
        text: input.text.trim(),
        imageUrl,
        expiresAt: input.expiresAt,
        kind: input.kind,
        data: input.data,
        color: input.color,
      });
      setEditing(false);
    } catch (e) {
      console.error('edit failed', e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <Pressable style={styles.scrim} onPress={() => router.back()} />

      <View style={[styles.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          bounces={false}
          showsVerticalScrollIndicator={false}
        >
          <View style={{ transform: [{ rotate: `${note.rotation * 0.4}deg` }] }}>
            <NotePaper note={note} large onToggleItem={isList ? toggleListItem : undefined} />
          </View>

          <View style={styles.meta}>
            {note.author ? (
              <View style={styles.authorRow}>
                <Avatar name={note.author.displayName} emoji={note.author.avatar} size={30} />
                <Text style={styles.authorName}>{note.author.displayName}</Text>
              </View>
            ) : null}
            <Text style={styles.metaText}>
              Created {relativeTime(note.createdAt)} · {clockTime(note.createdAt)}
            </Text>
          </View>

          {isCreator ? (
            <View style={styles.actions}>
              <Button
                label={note.completedAt ? 'Undo' : 'Mark done'}
                variant={note.completedAt ? 'primary' : 'soft'}
                onPress={toggleDone}
              />
              <Button label="Edit" variant="soft" onPress={() => setEditing(true)} />
              <Button label="Delete" variant="ghost" onPress={handleDelete} textStyle={styles.deleteText} />
            </View>
          ) : null}
        </ScrollView>
      </View>

      <AddNoteSheet
        visible={editing && isCreator}
        submitting={saving}
        submitLabel="Save note"
        initial={{ text: note.text, imageUrl: note.imageUrl, expiresAt: note.expiresAt, kind: note.kind, data: note.data, color: note.color }}
        onClose={() => setEditing(false)}
        onSubmit={handleEdit}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'flex-end' },
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(62, 54, 46, 0.5)',
  },
  content: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '88%',
  },
  scroll: {
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
  meta: {
    marginTop: 18,
    gap: 8,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  authorName: {
    fontFamily: fonts.ui.bold,
    fontSize: 16,
    color: colors.ink,
  },
  metaText: {
    fontFamily: fonts.ui.regular,
    fontSize: 13,
    color: colors.inkSoft,
  },
  actions: {
    gap: 12,
    marginTop: 24,
  },
  deleteText: {
    color: colors.danger,
  },
});
