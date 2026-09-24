import { useMemo, useState } from 'react';
import { View, Pressable, StyleSheet, ActivityIndicator, useWindowDimensions } from 'react-native';
import { BlurView } from 'expo-blur';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../../../theme';
import { NotePaper } from '../../../../components/NotePaper';
import { useBoardNotes } from '../../../../hooks/useBoardV2';
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
  const { notes, toggleEntry } = useBoardNotes(boardId);
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

  // Checklist taps flip the entry row itself — no text rewriting, so two
  // people toggling at once never clobber each other.
  const toggleListItem = (index: number) => {
    toggleEntry(note.id, index).catch((e) => console.error('toggle failed', e));
  };

  // Match the board's paper width (but present it straight, no tilt).
  const placement = layout.get(note.id);
  const naturalW = (placement?.w ?? widthFracForNote(note)) * REF_W;

  const maxW = Math.min(screenW - 48, 340);
  const maxH = screenH - insets.top - insets.bottom - 140;
  const scale = Math.min(maxW / naturalW, noteH > 0 ? maxH / noteH : MAX_SCALE, MAX_SCALE);

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
      </View>
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
});
