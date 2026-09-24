import { View, Text, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { colors, fonts } from '../theme';

type Props = {
  title?: string;
};

export function ScreenHeader({ title }: Props) {
  return (
    <View style={styles.row}>
      <Pressable hitSlop={12} onPress={() => router.back()} style={styles.back}>
        <Text style={styles.backGlyph}>‹</Text>
      </Pressable>
      {title ? <Text style={styles.title}>{title}</Text> : <View style={styles.flex} />}
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
  title: {
    flex: 1,
    textAlign: 'center',
    fontFamily: fonts.ui.bold,
    fontSize: 17,
    color: colors.ink,
  },
  flex: { flex: 1 },
  rightSpacer: { width: 40 },
});
