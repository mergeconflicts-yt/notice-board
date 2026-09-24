import { useEffect, useState } from 'react';
import { Text, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { colors, fonts } from '../theme';
import { supabase } from '../lib/supabase';
import { useSession } from '../store/session';

/**
 * Fallback target for the OAuth redirect (`noticeboard://auth`). Normally
 * `WebBrowser.openAuthSessionAsync` catches the redirect and completes the
 * exchange; this route stops Android from showing "unmatched route" if the
 * redirect lands in the app instead.
 */
export default function AuthCallbackScreen() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  const [message, setMessage] = useState('Finishing sign-in…');

  useEffect(() => {
    void (async () => {
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          setMessage('Sign-in didn’t finish. Please try again from the app.');
          return;
        }
      }
      // The session changed underneath; reload the profile before home.
      await useSession.getState().init();
      router.replace('/');
    })();
  }, [code]);

  return (
    <SafeAreaView style={styles.safe}>
      <ActivityIndicator color={colors.accent} />
      <Text style={styles.text}>{message}</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  text: {
    marginTop: 12,
    fontFamily: fonts.ui.regular,
    fontSize: 14,
    color: colors.inkSoft,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
});
