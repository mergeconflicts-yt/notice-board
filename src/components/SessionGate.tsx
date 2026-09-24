import { View, Text, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
  const init = useSession((s) => s.init);
  const signOut = useSession((s) => s.signOut);

  if (status === 'ready') return null;

  const confirmSignOut = () => {
    Alert.alert(
      'Sign out?',
      'You’ll lose this account and every board you’re on. This can’t be undone.',
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

  if (status === 'expired') {
    return (
      <SafeAreaView style={[styles.overlay, styles.center]}>
        <Text style={styles.title}>Session expired</Text>
        <Text style={styles.sub}>{error ?? 'Please sign out and start again.'}</Text>
        <Button label="Sign out" onPress={confirmSignOut} style={styles.btn} />
      </SafeAreaView>
    );
  }

  if (status === 'offline') {
    return (
      <SafeAreaView style={[styles.overlay, styles.center]}>
        <Text style={styles.title}>Can’t reach the board</Text>
        <Text style={styles.sub}>{error ?? 'Check your connection and try again.'}</Text>
        <Button label="Retry" onPress={() => void init()} style={styles.btn} />
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
