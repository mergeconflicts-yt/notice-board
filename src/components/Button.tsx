import { Pressable, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { colors, fonts } from '../theme';

type Variant = 'primary' | 'soft' | 'ghost' | 'danger';

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
};

export function Button({ label, onPress, variant = 'primary', disabled, style, textStyle }: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      <Text style={[styles.text, styles[`${variant}Text` as keyof typeof styles], textStyle]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  primary: {
    backgroundColor: colors.ink,
  },
  soft: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  danger: {
    backgroundColor: colors.danger,
  },
  text: {
    fontFamily: fonts.ui.bold,
    fontSize: 16,
  },
  primaryText: {
    color: colors.background,
  },
  softText: {
    color: colors.ink,
  },
  ghostText: {
    color: colors.inkSoft,
  },
  dangerText: {
    color: colors.white,
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.5,
  },
});
