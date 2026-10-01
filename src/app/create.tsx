import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { offeredBoardColors, boardColors, colors, fonts } from '../theme';
import { Button } from '../components/Button';
import { ScreenHeader } from '../components/ScreenHeader';
import { createBoard, friendlyMessage } from '../lib/api';
import { useSession } from '../store/session';
import { BoardColor } from '../types';

export default function CreateBoardScreen() {
  const [name, setName] = useState('');
  const [color, setColor] = useState<BoardColor>('sage');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Nameless guests answer "who are you?" right here instead of a separate
  // sheet, so creating a first fridge is one screen.
  const user = useSession((s) => s.user);
  const setDisplayName = useSession((s) => s.setDisplayName);
  const [yourName, setYourName] = useState('');
  const needsName = !user || user.displayName === 'Someone';

  const create = async () => {
    if (!name.trim() || creating) return;
    if (needsName && !yourName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      if (needsName) {
        try {
          await setDisplayName(yourName.trim());
        } catch {
          setError('Couldn’t save your name. Check your connection and try again.');
          setCreating(false);
          return;
        }
      }
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
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScreenHeader title="Create a fridge" />
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.label}>Fridge name</Text>
          <TextInput
            style={styles.input}
            placeholder="Jack Family"
            testID="fridge-name-field"
            placeholderTextColor={colors.inkFaint}
            value={name}
            onChangeText={setName}
            maxLength={60}
            autoFocus
          />
          {needsName ? (
            <>
              <Text style={[styles.label, styles.colorLabel]}>Your name</Text>
              <TextInput
                style={styles.input}
                placeholder="What do people call you?"
                placeholderTextColor={colors.inkFaint}
                value={yourName}
                onChangeText={setYourName}
                maxLength={40}
              />
            </>
          ) : null}
          <Text style={[styles.label, styles.colorLabel]}>Colour</Text>
          <View
            style={styles.swatchesWrap}
          >
              {offeredBoardColors.map((k) => (
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
            disabled={!name.trim() || (needsName && !yourName.trim()) || creating}
            style={styles.create}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  body: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 24, paddingBottom: 24 },
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
  swatchesWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  swatch: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: 'transparent' },
  swatchActive: { borderColor: colors.accent },
  error: { fontFamily: fonts.ui.regular, color: colors.danger, fontSize: 13, marginTop: 12 },
  create: { marginTop: 28 },
});
