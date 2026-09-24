import { useState } from 'react';
import { View, Text, TextInput, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { colors, fonts } from '../theme';
import { Button } from '../components/Button';
import { ScreenHeader } from '../components/ScreenHeader';
import { getBackendV2 } from '../services';
import { normalizeInviteCode } from '../utils/id';

export default function JoinBoardScreen() {
  const [code, setCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const join = async () => {
    const clean = normalizeInviteCode(code);
    if (!clean || joining) return;
    setJoining(true);
    setError(null);
    try {
      const boardId = await getBackendV2().acceptInvite(clean);
      router.replace(`/board/${boardId}`);
    } catch (e) {
      setError(
        e instanceof Error && /fully used/.test(e.message)
          ? 'That invite has already been fully used.'
          : 'Hmm, that code doesn’t match any board.',
      );
      setJoining(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScreenHeader title="Join a board" />
        <View style={styles.body}>
          <Text style={styles.label}>Invite code</Text>
          <TextInput
            style={styles.input}
            placeholder="AB12-CD34"
            placeholderTextColor={colors.inkFaint}
            value={code}
            onChangeText={setCode}
            autoCapitalize="characters"
            autoCorrect={false}
            autoFocus
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Text style={styles.hint}>
            Ask someone on the board for their invite code.
          </Text>
          <Button
            label="Join"
            onPress={join}
            disabled={!normalizeInviteCode(code) || joining}
            style={styles.join}
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
    fontFamily: fonts.ui.bold,
    fontSize: 20,
    letterSpacing: 1,
    color: colors.ink,
  },
  error: {
    fontFamily: fonts.ui.regular,
    color: colors.danger,
    fontSize: 13,
    marginTop: 12,
  },
  hint: {
    fontFamily: fonts.ui.regular,
    color: colors.inkFaint,
    fontSize: 13,
    marginTop: 14,
  },
  join: { marginTop: 24 },
});
