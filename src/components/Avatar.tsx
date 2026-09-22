import { View, Text, StyleSheet } from 'react-native';
import { noteColorKeys, noteColors } from '../theme';

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

const FALLBACK = ['🐻', '🦊', '🐰', '🐼', '🐨', '🦁', '🐸', '🦉', '🐳', '🐢'];

export function emojiFor(name: string): string {
  return FALLBACK[hash(name) % FALLBACK.length];
}

type Props = {
  name: string;
  emoji?: string | null;
  size?: number;
};

export function Avatar({ name, emoji, size = 26 }: Props) {
  const glyph = emoji ?? emojiFor(name);
  const bg = noteColors[noteColorKeys[hash(name) % noteColorKeys.length]].bg;
  return (
    <View
      style={[
        styles.wrap,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: bg,
        },
      ]}
    >
      <Text style={{ fontSize: size * 0.55, lineHeight: size * 0.75 }}>{glyph}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.85)',
  },
});
