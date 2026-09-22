import { Pressable, View, StyleSheet } from 'react-native';
import { NoteWithAuthor } from '../types';
import { NotePaper } from './NotePaper';

type Props = {
  note: NoteWithAuthor;
  onPress: (note: NoteWithAuthor) => void;
  /** Canvas mode: no outer margins so absolute placement is exact. */
  flat?: boolean;
};

export function StickyNote({ note, onPress, flat = false }: Props) {
  return (
    <View style={[!flat && styles.wrap, { transform: [{ rotate: `${note.rotation}deg` }] }]}>
      <Pressable
        onPress={() => onPress(note)}
        style={({ pressed }) => [
          styles.press,
          { transform: [{ scale: pressed ? 0.985 : 1 }] },
        ]}
      >
        <NotePaper note={note} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: 6,
    marginVertical: 10,
  },
  press: {
    flex: 1,
  },
});
