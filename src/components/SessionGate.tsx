import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, usePathname } from 'expo-router';
import { colors, fonts } from '../theme';
import { Button } from './Button';
import { Turnstile } from './Turnstile';
import { turnstileSiteKey } from '../lib/supabase';
import { INVITE_BASE_URL } from '../lib/inviteLinks';
import { friendlyMessage } from '../lib/api';
import { useSession } from '../store/session';

/**
 * A root-level overlay shown until the session is ready. Because it covers the
 * whole app, a cold-start deep link (e.g. straight into `/board/…`) is handled
 * too — otherwise only index / the invite screen would show the session state.
 * Renders `null` once the session is ready.
 */
export function SessionGate() {
  const status = useSession((s) => s.status);
  const error = useSession((s) => s.error);
  const user = useSession((s) => s.user);
  const init = useSession((s) => s.init);
  const signOut = useSession((s) => s.signOut);
  const startFresh = useSession((s) => s.startFresh);
  const pathname = usePathname();

  // Captcha failures must NOT call init() again: that remounts the challenge,
  // which fails again, forever. Keep the error here and retry the challenge
  // (with growing backoff) instead.
  const [captchaError, setCaptchaError] = useState<string | null>(null);
  const [captchaNonce, setCaptchaNonce] = useState(0);
  const captchaDelay = useRef(1000);
  const captchaTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearCaptchaTimer = useCallback(() => {
    if (captchaTimer.current) clearTimeout(captchaTimer.current);
    captchaTimer.current = null;
  }, []);
  useEffect(() => clearCaptchaTimer, [clearCaptchaTimer]);

  const handleCaptchaToken = useCallback(
    (token: string) => {
      clearCaptchaTimer();
      captchaDelay.current = 1000;
      setCaptchaError(null);
      void init(token);
    },
    [clearCaptchaTimer, init],
  );

  const handleCaptchaError = useCallback((message: string) => {
    setCaptchaError(message);
    if (captchaTimer.current) return;
    captchaTimer.current = setTimeout(() => {
      captchaTimer.current = null;
      setCaptchaError(null);
      setCaptchaNonce((n) => n + 1);
    }, captchaDelay.current);
    captchaDelay.current = Math.min(captchaDelay.current * 2, 30000);
  }, []);

  const retryCaptcha = useCallback(() => {
    clearCaptchaTimer();
    captchaDelay.current = 1000;
    setCaptchaError(null);
    setCaptchaNonce((n) => n + 1);
  }, [clearCaptchaTimer]);

  // The overlay must not cover the screens that resolve it.
  const exempt = pathname === '/sign-in' || pathname === '/auth';
  if (status === 'ready' || exempt) return null;

  const confirmSignOut = () => {
    // Wording depends on whether signing out loses boards (anonymous) or just
    // ends the session (linked).
    const anonymous = user?.isAnonymous ?? true;
    Alert.alert(
      'Sign out?',
      anonymous
        ? 'You’ll lose this account and every board you’re on. This can’t be undone.'
        : 'You’ll be signed out. Sign back in to get your boards again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign out',
          style: 'destructive',
          onPress: () => {
            void signOut()
              .then(() => init())
              .catch((e) =>
                useSession.setState({ status: 'offline', error: friendlyMessage(e) }),
              );
          },
        },
      ],
    );
  };

  const confirmStartFresh = () => {
    Alert.alert(
      'Start fresh?',
      'You won’t be able to get the old account’s boards back. This can’t be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Start fresh', style: 'destructive', onPress: () => void startFresh() },
      ],
    );
  };

  if (status === 'needsCaptcha' && turnstileSiteKey) {
    if (!INVITE_BASE_URL) {
      return (
        <SafeAreaView style={[styles.overlay, styles.center]}>
          <Text style={styles.title}>One quick check</Text>
          <Text style={styles.sub}>
            This build is missing EXPO_PUBLIC_INVITE_BASE_URL, so the human check can’t load.
          </Text>
        </SafeAreaView>
      );
    }
    return (
      <SafeAreaView style={[styles.overlay, styles.center]}>
        <Text style={styles.title}>One quick check</Text>
        <Text style={styles.sub}>
          {captchaError ? 'Couldn’t load the check.' : 'Confirm you’re human to continue.'}
        </Text>
        {captchaError ? (
          <Button label="Retry" onPress={retryCaptcha} style={styles.btn} />
        ) : (
          <Turnstile
            key={captchaNonce}
            siteKey={turnstileSiteKey}
            onToken={handleCaptchaToken}
            onError={handleCaptchaError}
          />
        )}
      </SafeAreaView>
    );
  }

  if (status === 'signedout') {
    return (
      <SafeAreaView style={[styles.overlay, styles.center]}>
        <Text style={styles.title}>Sign in to restore your boards</Text>
        <Text style={styles.sub}>
          {error ?? 'This device was signed in before. Sign in to get your boards back.'}
        </Text>
        <Button label="Sign in" onPress={() => router.push('/sign-in')} style={styles.btn} />
        <Button label="Start fresh" variant="soft" onPress={confirmStartFresh} style={styles.btn} />
      </SafeAreaView>
    );
  }

  if (status === 'offline') {
    return (
      <SafeAreaView style={[styles.overlay, styles.center]}>
        <Text style={styles.title}>Can’t reach the board</Text>
        <Text style={styles.sub}>{error ?? 'Check your connection and try again.'}</Text>
        <Button label="Retry" onPress={() => void init(undefined, true)} style={styles.btn} />
        <Button label="Sign in" variant="soft" onPress={() => router.push('/sign-in')} style={styles.btn} />
        <Button label="Sign out" variant="soft" onPress={confirmSignOut} style={styles.btn} />
      </SafeAreaView>
    );
  }

  // loading
  return (
    <View style={[styles.overlay, styles.center]}>
      <ActivityIndicator color={colors.accent} />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.background,
    paddingHorizontal: 32,
    zIndex: 100,
    elevation: 100,
  },
  center: { alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fonts.hand.bold, fontSize: 30, color: colors.ink },
  sub: {
    fontFamily: fonts.ui.regular,
    fontSize: 15,
    color: colors.inkSoft,
    textAlign: 'center',
    marginTop: 8,
  },
  btn: { marginTop: 22, alignSelf: 'stretch' },
});
