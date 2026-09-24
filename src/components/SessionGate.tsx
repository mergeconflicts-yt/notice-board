import { View, Text, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, usePathname } from 'expo-router';
import { colors, fonts } from '../theme';
import { Button } from './Button';
import { Turnstile } from './Turnstile';
import { turnstileSiteKey } from '../lib/supabase';
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
          onPress: () => void signOut().then(() => init()),
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
    return (
      <SafeAreaView style={[styles.overlay, styles.center]}>
        <Text style={styles.title}>One quick check</Text>
        <Text style={styles.sub}>Confirm you’re human to continue.</Text>
        <Turnstile
          siteKey={turnstileSiteKey}
          onToken={(token) => void init(token)}
          onError={() => void init()}
        />
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
        <Button label="Retry" onPress={() => void init()} style={styles.btn} />
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
