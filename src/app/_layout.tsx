import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AppState, View, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useFonts, Nunito_400Regular, Nunito_600SemiBold, Nunito_700Bold, Nunito_800ExtraBold } from '@expo-google-fonts/nunito';
import { Caveat_400Regular, Caveat_600SemiBold, Caveat_700Bold } from '@expo-google-fonts/caveat';
import { colors } from '../theme';
import { useSession } from '../store/session';
import { supabase } from '../lib/supabase';
import { ToastHost } from '../components/Toast';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Nunito_400Regular,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
    Caveat_400Regular,
    Caveat_600SemiBold,
    Caveat_700Bold,
  });

  useEffect(() => {
    useSession.getState().init();
  }, []);

  // Refresh the session token while foregrounded; pause while backgrounded so
  // it doesn't burn battery or fail offline.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void supabase.auth.startAutoRefresh();
      else void supabase.auth.stopAutoRefresh();
    });
    return () => sub.remove();
  }, []);

  if (!fontsLoaded) {
    return <View style={styles.loading} />;
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="create" options={{ presentation: 'card' }} />
        <Stack.Screen name="join" options={{ presentation: 'card' }} />
        <Stack.Screen name="profile" options={{ presentation: 'card' }} />
        <Stack.Screen name="auth" options={{ presentation: 'card' }} />
        <Stack.Screen name="j/[token]" options={{ presentation: 'card' }} />
        <Stack.Screen
          name="board/[id]/index"
          options={{ animation: 'fade', gestureEnabled: false }}
        />
        <Stack.Screen name="board/[id]/people" options={{ presentation: 'card' }} />
        <Stack.Screen name="board/[id]/settings" options={{ presentation: 'card' }} />
        <Stack.Screen
          name="board/[id]/note/[noteId]"
          options={{
            presentation: 'transparentModal',
            animation: 'fade',
            contentStyle: { backgroundColor: 'transparent' },
          }}
        />
      </Stack>
      <ToastHost />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  loading: { flex: 1, backgroundColor: colors.background },
});
