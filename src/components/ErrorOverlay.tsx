import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts } from '../theme';
import { useErrorStore } from '../store/errors';

/**
 * Renders the most recent globally-captured error as a dismissible card, so a
 * crash is readable instead of just closing the app.
 */
export function ErrorOverlay() {
  const message = useErrorStore((s) => s.message);
  const stack = useErrorStore((s) => s.stack);
  const clear = useErrorStore((s) => s.clear);
  const insets = useSafeAreaInsets();

  if (!message) return null;

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 12 }]} pointerEvents="box-none">
      <Pressable style={styles.card} onPress={clear}>
        <Text style={styles.title}>App error — tap to dismiss</Text>
        <ScrollView style={styles.scroll}>
          <Text style={styles.message}>{message}</Text>
          {stack ? <Text style={styles.stack}>{stack}</Text> : null}
        </ScrollView>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 12,
  },
  card: {
    backgroundColor: '#FBE3E0',
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: 14,
    padding: 12,
    maxHeight: '60%',
    shadowColor: colors.shadow,
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  title: { fontFamily: fonts.ui.bold, fontSize: 13, color: colors.danger, marginBottom: 6 },
  scroll: { flexGrow: 0 },
  message: { fontFamily: fonts.ui.semibold, fontSize: 13, color: colors.ink, marginBottom: 6 },
  stack: { fontFamily: fonts.ui.regular, fontSize: 11, color: colors.inkSoft },
});
