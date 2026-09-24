import { View, Text, StyleSheet } from 'react-native';
import { colors, noteColorKeys, noteColors } from '../theme';

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

const FALLBACK = ['🐻', '🦊', '🐰', '🐼', '🐨', '🦁', '🐸', '🦉', '🐳', '🐢'];

function emojiFor(name: string): string {
  return FALLBACK[hash(name) % FALLBACK.length];
}

type Props = {
  name: string;
  size?: number;
};

export function Avatar({ name, size = 26 }: Props) {
  const glyph = emojiFor(name);
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
    borderColor: colors.avatarRing,
  },
});
