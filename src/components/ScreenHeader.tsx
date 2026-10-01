import { View, Text, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { colors, fonts } from '../theme';

type Props = {
  title?: string;
  /** Cream (default, board screens) or pine (join/create/profile). */
  tone?: 'cream' | 'pine';
};

export function ScreenHeader({ title, tone = 'cream' }: Props) {
  const pine = tone === 'pine';
  return (
    <View style={styles.row}>
      <Pressable
        hitSlop={12}
        onPress={() => router.back()}
        style={[styles.back, pine && styles.backPine]}
        accessibilityRole="button"
        accessibilityLabel="Back"
        testID="back"
      >
        <Text style={[styles.backGlyph, pine && styles.backGlyphPine]}>‹</Text>
      </Pressable>
      {title ? <Text style={[styles.title, pine && styles.titlePine]}>{title}</Text> : <View style={styles.flex} />}
      <View style={styles.rightSpacer} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
  },
  back: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  backGlyph: {
    fontSize: 26,
    lineHeight: 28,
    color: colors.ink,
    marginTop: -2,
  },
  backPine: { backgroundColor: colors.paper, borderColor: colors.paperEdge },
  backGlyphPine: { color: colors.ink },
  title: {
    flex: 1,
    textAlign: 'center',
    fontFamily: fonts.ui.bold,
    fontSize: 17,
    color: colors.ink,
  },
  titlePine: { color: colors.onPine },
  flex: { flex: 1 },
  rightSpacer: { width: 40 },
});
