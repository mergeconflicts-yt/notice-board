import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts, memberColors } from '../theme';

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

type Props = {
  /** Stable colour key — the user id when known, else the display name. */
  seed: string;
  name: string;
  size?: number;
};

/** Solid initial dot identifying a member (board header, post attribution). */
export function MemberDot({ seed, name, size = 24 }: Props) {
  const bg = memberColors[hash(seed) % memberColors.length];
  const initial = (name.trim()[0] ?? '?').toUpperCase();
  return (
    <View
      style={[
        styles.dot,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: bg },
      ]}
    >
      <Text style={[styles.initial, { fontSize: size * 0.5, lineHeight: size * 0.62 }]}>
        {initial}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  dot: { alignItems: 'center', justifyContent: 'center' },
  initial: { color: colors.white, fontFamily: fonts.ui.bold },
});
