import { useEffect, useState } from 'react';
import { Text, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { colors, fonts } from '../theme';
import { Button } from '../components/Button';
import { supabase } from '../lib/supabase';
import { isAuthFlowActive } from '../lib/api';
import { useSession } from '../store/session';

/**
 * Fallback target for the OAuth redirect (`noticeboard://auth`). Normally
 * `WebBrowser.openAuthSessionAsync` catches the redirect and completes the
 * exchange; this route stops Android from showing "unmatched route" if the
 * redirect lands in the app instead — and skips the exchange when the in-app
 * flow is already doing it, so the same PKCE code isn't redeemed twice.
 */
export default function AuthCallbackScreen() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        // Exchange whenever we hold a code the in-app flow isn't handling — even
        // if a session (typically an anonymous one) already exists. Redeeming
        // the code swaps the session to the confirmed user; otherwise the
        // email tap silently leaves them anonymous.
        if (code && !isAuthFlowActive()) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else if (!code || isAuthFlowActive()) {
          // Either the in-app browser flow is exchanging this same code (wait
          // for its session rather than redeeming it a second time), or there
          // is no code and the user just needs whatever session exists.
          for (let i = 0; i < 20; i++) {
            const { data } = await supabase.auth.getSession();
            if (data.session) break;
            await new Promise((r) => setTimeout(r, 150));
          }
        }
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) throw new Error('no_session');
        await useSession.getState().init();
        router.replace('/');
      } catch {
        setFailed(true);
      }
    })();
  }, [code]);

  if (failed) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.title}>Sign-in didn’t finish</Text>
        <Text style={styles.text}>Please try again from the app.</Text>
        <Button label="Home" onPress={() => router.replace('/')} style={styles.btn} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ActivityIndicator color={colors.accent} />
      <Text style={styles.text}>Finishing sign-in…</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fonts.hand.bold, fontSize: 28, color: colors.ink },
  text: {
    marginTop: 12,
    fontFamily: fonts.ui.regular,
    fontSize: 14,
    color: colors.inkSoft,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  btn: { marginTop: 22 },
});
