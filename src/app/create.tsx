import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { boardColorKeys, boardColors, colors, fonts } from '../theme';
import { Button } from '../components/Button';
import { ScreenHeader } from '../components/ScreenHeader';
import { createBoard, friendlyMessage } from '../lib/api';
import { BoardColor } from '../types';

export default function CreateBoardScreen() {
  const [name, setName] = useState('');
  const [color, setColor] = useState<BoardColor>('sage');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async () => {
    if (!name.trim() || creating) return;
    setCreating(true);
    setError(null);
    try {
      // The board's time zone drives date expiry (day after the event).
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      const board = await createBoard(name.trim(), color, timeZone);
      router.replace(`/board/${board.id}`);
    } catch (e) {
      setError(friendlyMessage(e));
      setCreating(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScreenHeader title="Create a board" />
        <View style={styles.body}>
          <Text style={styles.label}>Board name</Text>
          <TextInput
            style={styles.input}
            placeholder="Kranti Family"
            placeholderTextColor={colors.inkFaint}
            value={name}
            onChangeText={setName}
            maxLength={60}
            autoFocus
          />
          <Text style={[styles.label, styles.colorLabel]}>Colour</Text>
          <View style={styles.swatches}>
            {boardColorKeys.map((k) => (
              <Pressable
                key={k}
                onPress={() => setColor(k)}
                accessibilityLabel={`${k} board colour`}
                accessibilityState={{ selected: k === color }}
                style={[
                  styles.swatch,
                  { backgroundColor: boardColors[k] },
                  k === color && styles.swatchActive,
                ]}
              />
            ))}
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button
            label="Create"
            onPress={create}
            disabled={!name.trim() || creating}
            style={styles.create}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  body: { flex: 1, paddingHorizontal: 24, paddingTop: 24 },
  label: { fontFamily: fonts.ui.semibold, fontSize: 13, color: colors.inkSoft, marginBottom: 10 },
  colorLabel: { marginTop: 24 },
  input: {
    height: 56,
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    fontFamily: fonts.ui.semibold,
    fontSize: 18,
    color: colors.ink,
  },
  swatches: { flexDirection: 'row', gap: 12 },
  swatch: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: 'transparent' },
  swatchActive: { borderColor: colors.ink },
  error: { fontFamily: fonts.ui.regular, color: colors.danger, fontSize: 13, marginTop: 12 },
  create: { marginTop: 28 },
});
