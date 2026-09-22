import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet } from 'react-native';
import { useFonts, Nunito_400Regular, Nunito_600SemiBold, Nunito_700Bold, Nunito_800ExtraBold } from '@expo-google-fonts/nunito';
import { Caveat_400Regular, Caveat_600SemiBold, Caveat_700Bold } from '@expo-google-fonts/caveat';
import { colors } from '../theme';
import { useSession } from '../store/session';

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

  if (!fontsLoaded) {
    return <View style={styles.loading} />;
  }

  return (
    <View style={styles.root}>
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
        <Stack.Screen
          name="board/[id]/index"
          options={{ animation: 'fade', gestureEnabled: false }}
        />
        <Stack.Screen name="board/[id]/people" options={{ presentation: 'card' }} />
        <Stack.Screen name="board/[id]/settings" options={{ presentation: 'card' }} />
        <Stack.Screen
          name="board/[id]/note/[noteId]"
          options={{ presentation: 'transparentModal', animation: 'fade' }}
        />
      </Stack>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  loading: { flex: 1, backgroundColor: colors.background },
});
