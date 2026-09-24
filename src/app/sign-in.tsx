import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, fonts } from '../theme';
import { Button } from '../components/Button';
import { ScreenHeader } from '../components/ScreenHeader';
import { friendlyMessage, signInEmail, signInProvider } from '../lib/api';
import { useSession } from '../store/session';

/**
 * Restore an existing account (e.g. on a new phone). Signing in replaces the
 * anonymous session, so the boards saved under the account come back.
 */
export default function SignInScreen() {
  const init = useSession((s) => s.init);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const finish = async () => {
    // The auth session changed underneath; reload the profile.
    await init();
    router.replace('/');
  };

  const withProvider = async (provider: 'apple' | 'google') => {
    setBusy(true);
    setError(null);
    try {
      await signInProvider(provider);
      await finish();
    } catch (e) {
      setError(friendlyMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const withEmail = async () => {
    if (!email.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await signInEmail(email.trim());
      setSent(true);
    } catch (e) {
      setError(friendlyMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScreenHeader title="Sign in" />
        <View style={styles.body}>
          <Text style={styles.lead}>Welcome back. Sign in to bring your boards to this device.</Text>

          {Platform.OS === 'ios' ? (
            <Pressable style={styles.linkBtn} onPress={() => withProvider('apple')} disabled={busy}>
              <MaterialCommunityIcons name="apple" size={20} color={colors.ink} />
              <Text style={styles.linkText}>Continue with Apple</Text>
            </Pressable>
          ) : null}
          <Pressable style={styles.linkBtn} onPress={() => withProvider('google')} disabled={busy}>
            <MaterialCommunityIcons name="google" size={20} color={colors.ink} />
            <Text style={styles.linkText}>Continue with Google</Text>
          </Pressable>

          <Text style={styles.or}>or</Text>

          {sent ? (
            <Text style={styles.sent}>Check your email for a sign-in link.</Text>
          ) : (
            <>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor={colors.inkFaint}
                autoCapitalize="none"
                keyboardType="email-address"
                autoCorrect={false}
              />
              <Button
                label={busy ? 'Sending…' : 'Email me a link'}
                variant="soft"
                onPress={withEmail}
                disabled={!email.trim() || busy}
                style={styles.emailBtn}
              />
            </>
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Text style={styles.hint}>
            Your boards stay on the same account — nothing moves.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  body: { flex: 1, paddingHorizontal: 24, paddingTop: 20 },
  lead: {
    fontFamily: fonts.ui.regular,
    fontSize: 15,
    color: colors.inkSoft,
    marginBottom: 20,
  },
  linkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginBottom: 10,
  },
  linkText: { fontFamily: fonts.ui.bold, fontSize: 16, color: colors.ink },
  or: {
    fontFamily: fonts.ui.regular,
    fontSize: 13,
    color: colors.inkFaint,
    textAlign: 'center',
    marginVertical: 10,
  },
  input: {
    height: 52,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    fontFamily: fonts.ui.semibold,
    fontSize: 16,
    color: colors.ink,
  },
  emailBtn: { marginTop: 10 },
  sent: { fontFamily: fonts.ui.semibold, fontSize: 15, color: colors.accentDeep, textAlign: 'center' },
  error: { fontFamily: fonts.ui.regular, color: colors.danger, fontSize: 13, marginTop: 12 },
  hint: { fontFamily: fonts.ui.regular, fontSize: 12, color: colors.inkFaint, marginTop: 18 },
});
