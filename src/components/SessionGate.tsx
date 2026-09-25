import { View, Text, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams, usePathname } from 'expo-router';
import { colors, fonts } from '../theme';
import { Button } from './Button';
import { Welcome } from './Welcome';
import { NameStep } from './NameStep';
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
  const markerAnon = useSession((s) => s.markerAnon);
  const init = useSession((s) => s.init);
  const signOut = useSession((s) => s.signOut);
  const pathname = usePathname();
  const { token: inviteToken } = useLocalSearchParams<{ token?: string }>();

  // The overlay must not cover the screens that resolve it.
  const exempt = pathname === '/sign-in' || pathname === '/auth' || pathname === '/welcome';
  if (status === 'ready' || exempt) return null;

  const confirmSignOut = () => {
    // Wording depends on whether signing out loses boards (anonymous) or just
    // ends the session (linked). The live user wins; otherwise the stored
    // marker decides (it may be all we have on the signed-out screen).
    const anonymous = user?.isAnonymous ?? markerAnon ?? true;
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

  if (status === 'welcome' || status === 'signedout') {
    const token = Array.isArray(inviteToken) ? inviteToken[0] : inviteToken;
    // Must be the full-screen overlay: rendered bare it would sit *beside* the
    // home screen instead of covering it (the two-onboarding-screens bug).
    return (
      <View style={styles.fill}>
        <Welcome mode={status === 'signedout' ? 'resume' : 'fresh'} inviteToken={token ?? null} />
      </View>
    );
  }

  if (status === 'name') {
    return <NameStep />;
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
  // Like `overlay` but without the padding: Welcome brings its own.
  fill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.background,
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
