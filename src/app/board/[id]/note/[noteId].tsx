import { useMemo, useState } from 'react';
import { View, Pressable, StyleSheet, ActivityIndicator, useWindowDimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../../../theme';
import { NotePaper } from '../../../../components/NotePaper';
import { useNotes } from '../../../../hooks/useBoard';
import { REF_W, computeBoardLayout, widthFracForNote } from '../../../../utils/layout';

/** Cap so a tiny note never balloons past this when scaled up. */
const MAX_SCALE = 2.8;

/**
 * A read-only zoom of a single post. The note is rendered exactly as it sits
 * on the board (same width and tilt) and then scaled up to fill a centred
 * popup. Tapping anywhere dismisses it.
 */
export default function NoteDetailScreen() {
  const { id, noteId } = useLocalSearchParams<{ id: string; noteId: string }>();
  const boardId = id as string;
  const { notes } = useNotes(boardId);
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

  // Match the board exactly: same paper width and same tilt.
  const placement = layout.get(note.id);
  const naturalW = (placement?.w ?? widthFracForNote(note)) * REF_W;
  const rotation = placement?.rotation ?? note.rotation;

  const maxW = Math.min(screenW - 48, 340);
  const maxH = screenH - insets.top - insets.bottom - 140;
  const scale = Math.min(maxW / naturalW, noteH > 0 ? maxH / noteH : MAX_SCALE, MAX_SCALE);

  return (
    <Pressable style={styles.container} onPress={() => router.back()}>
      <View style={styles.center} pointerEvents="none">
        <View
          style={{ width: naturalW, transform: [{ scale }, { rotate: `${rotation}deg` }] }}
          onLayout={(e) => setNoteH(e.nativeEvent.layout.height)}
        >
          <NotePaper note={note} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
