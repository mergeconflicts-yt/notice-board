import { useState } from 'react';
import { View, Text, TextInput, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { colors, fonts } from '../theme';
import { Button } from '../components/Button';
import { ScreenHeader } from '../components/ScreenHeader';
import { acceptInvite, friendlyMessage, previewInvite } from '../lib/api';
import { parseInviteInput } from '../lib/inviteLinks';
import { useSession } from '../store/session';

export default function JoinBoardScreen() {
  const user = useSession((s) => s.user);
  const [code, setCode] = useState('');
  const [boardName, setBoardName] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Send what the user typed (or pasted), unnormalized: tokens are
  // case-sensitive. The server tries the raw value as a token and a
  // normalized copy as a code.
  const invite = parseInviteInput(code);

  const preview = async () => {
    if (!invite) return;
    setError(null);
    try {
      const info = await previewInvite(invite);
      setBoardName(info?.boardName ?? null);
      if (!info) setError('Hmm, that code doesn’t match any board.');
    } catch (e) {
      setError(friendlyMessage(e));
    }
  };

  const join = async () => {
    if (!invite || joining) return;
    setJoining(true);
    setError(null);
    try {
      const boardId = await acceptInvite(invite, user?.displayName ?? null);
      if (!boardId) {
        setError('That invite isn’t working. Ask for a fresh link.');
        setJoining(false);
        return;
      }
      router.replace(`/board/${boardId}`);
    } catch (e) {
      setError(friendlyMessage(e));
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
            placeholder="AB2DE-FG3HJ"
            placeholderTextColor={colors.inkFaint}
            value={code}
            onChangeText={(v) => {
              setCode(v);
              setBoardName(null);
              setError(null);
            }}
            onBlur={preview}
            autoCapitalize="characters"
            autoCorrect={false}
            autoFocus
          />
          {boardName ? <Text style={styles.board}>Join “{boardName}”</Text> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Text style={styles.hint}>Ask someone on the board for their invite code.</Text>
          <Button
            label="Join"
            onPress={join}
            disabled={!invite || joining}
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
  label: { fontFamily: fonts.ui.semibold, fontSize: 13, color: colors.inkSoft, marginBottom: 10 },
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
  board: { fontFamily: fonts.hand.bold, fontSize: 22, color: colors.ink, marginTop: 14 },
  error: { fontFamily: fonts.ui.regular, color: colors.danger, fontSize: 13, marginTop: 12 },
  hint: { fontFamily: fonts.ui.regular, color: colors.inkFaint, fontSize: 13, marginTop: 14 },
  join: { marginTop: 24 },
});
