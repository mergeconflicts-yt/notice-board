import { useState } from 'react';
import { View, Text, TextInput, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { colors, fonts } from '../theme';
import { Button } from '../components/Button';
import { ScreenHeader } from '../components/ScreenHeader';
import { getBackendV2 } from '../services';

export default function CreateBoardScreen() {
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async () => {
    if (!name.trim() || creating) return;
    setCreating(true);
    setError(null);
    try {
      const board = await getBackendV2().createBoard(name.trim());
      router.replace(`/board/${board.id}`);
    } catch {
      setError('Could not create the board. Please try again.');
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
            autoFocus
          />
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
  label: {
    fontFamily: fonts.ui.semibold,
    fontSize: 13,
    color: colors.inkSoft,
    marginBottom: 10,
  },
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
  error: {
    fontFamily: fonts.ui.regular,
    color: colors.danger,
    fontSize: 13,
    marginTop: 12,
  },
  create: { marginTop: 24 },
});
