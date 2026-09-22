import { useEffect, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts } from '../theme';
import { useToast } from '../store/toast';

/**
 * A single, app-wide snackbar. Rendered once at the root so a toast raised
 * right before navigating (e.g. an Undo after deleting a note) survives the
 * screen change and stays tappable.
 */
export function ToastHost() {
  const message = useToast((s) => s.message);
  const action = useToast((s) => s.action);
  const duration = useToast((s) => s.duration);
  const key = useToast((s) => s.key);
  const hide = useToast((s) => s.hide);
  const insets = useSafeAreaInsets();
  const [anim] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!message) return;
    anim.setValue(0);
    Animated.spring(anim, {
      toValue: 1,
      friction: 9,
      tension: 90,
      useNativeDriver: true,
    }).start();
    const timer = setTimeout(() => {
      Animated.timing(anim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) hide();
      });
    }, duration);
    return () => clearTimeout(timer);
  }, [key, message, duration, anim, hide]);

  if (!message) return null;

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] });

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.wrap,
        { bottom: insets.bottom + 24, opacity: anim, transform: [{ translateY }] },
      ]}
    >
      <View style={styles.toast}>
        <Text style={styles.message} numberOfLines={2}>
          {message}
        </Text>
        {action ? (
          <Pressable
            onPress={action.onPress}
            hitSlop={10}
            accessibilityRole="button"
            style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
          >
            <Text style={styles.actionText}>{action.label}</Text>
          </Pressable>
        ) : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    maxWidth: 440,
    paddingLeft: 18,
    paddingRight: 8,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: colors.ink,
    shadowColor: colors.shadow,
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  message: {
    flexShrink: 1,
    fontFamily: fonts.ui.semibold,
    fontSize: 15,
    color: colors.background,
  },
  action: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  actionPressed: { opacity: 0.6 },
  actionText: {
    fontFamily: fonts.ui.bold,
    fontSize: 15,
    color: colors.accent,
  },
});
