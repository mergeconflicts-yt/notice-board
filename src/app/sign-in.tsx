import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, fonts } from '../theme';
import { Button } from '../components/Button';
import { ScreenHeader } from '../components/ScreenHeader';
import { Turnstile } from '../components/Turnstile';
import { turnstileSiteKey } from '../lib/supabase';
import { AuthCancelledError, friendlyMessage, signInEmail, signInProvider } from '../lib/api';
import { useSession } from '../store/session';
import { useMyBoards } from '../hooks/useBoards';

/**
 * Restore an existing account (e.g. on a new phone). Signing in replaces the
 * anonymous session, so the boards saved under the account come back.
 */
export default function SignInScreen() {
  const user = useSession((s) => s.user);
  const init = useSession((s) => s.init);
  const { boards } = useMyBoards();
  const [email, setEmail] = useState('');
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const captchaNeeded = Boolean(turnstileSiteKey) && !captchaToken;

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
      if (!(e instanceof AuthCancelledError)) setError(friendlyMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const withEmail = async () => {
    if (!email.trim() || captchaNeeded) return;
    setBusy(true);
    setError(null);
    try {
      await signInEmail(email.trim(), captchaToken ?? undefined);
      setSent(true);
    } catch (e) {
      if (!(e instanceof AuthCancelledError)) setError(friendlyMessage(e));
    } finally {
      setBusy(false);
    }
  };

  // Signing in abandons this phone's anonymous identity, so warn first if it
  // already has boards (which signing in will NOT move).
  const guard = (proceed: () => void) => {
    if (user?.isAnonymous && boards.length > 0) {
      Alert.alert(
        'Boards on this phone will be lost',
        'Boards you made here belong to this phone’s identity, and signing in won’t move them. Save this account instead to keep them.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Save account instead', onPress: () => router.push('/profile') },
          { text: 'Sign in anyway', style: 'destructive', onPress: proceed },
        ],
      );
      return;
    }
    proceed();
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScreenHeader title="Sign in" />
        <View style={styles.body}>
          <Text style={styles.lead}>Welcome back. Sign in to bring your account’s boards to this device.</Text>

          {Platform.OS === 'ios' ? (
            <Pressable
              style={styles.linkBtn}
              onPress={() => guard(() => withProvider('apple'))}
              disabled={busy}
            >
              <MaterialCommunityIcons name="apple" size={20} color={colors.ink} />
              <Text style={styles.linkText}>Continue with Apple</Text>
            </Pressable>
          ) : null}
          <Pressable
            style={styles.linkBtn}
            onPress={() => guard(() => withProvider('google'))}
            disabled={busy}
          >
            <MaterialCommunityIcons name="google" size={20} color={colors.ink} />
            <Text style={styles.linkText}>Continue with Google</Text>
          </Pressable>

          <Text style={styles.or}>or</Text>

          {sent ? (
            <Text style={styles.sent}>Check your email for a sign-in link.</Text>
          ) : (
            <>
              {captchaNeeded ? (
                <View style={styles.captcha}>
                  <Turnstile
                    siteKey={turnstileSiteKey!}
                    onToken={setCaptchaToken}
                    onError={() => setCaptchaToken(null)}
                  />
                </View>
              ) : null}
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
                onPress={() => guard(withEmail)}
                disabled={!email.trim() || busy || captchaNeeded}
                style={styles.emailBtn}
              />
            </>
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Text style={styles.hint}>
            Only an existing account can sign in here. Boards made on this phone stay with this
            phone’s identity — use “Save your account” on the You screen to keep them.
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
  captcha: { marginBottom: 10 },
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
