import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { initServices } from '../lib/services';
import { colors } from '../lib/theme';
import { useLog } from '../store/log';
import { useAccount } from '../sync/account';

initServices();

const theme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: colors.bg, card: colors.bg, text: colors.text, border: colors.border, primary: colors.grow },
};

export default function RootLayout() {
  const loaded = useLog((s) => s.loaded);
  const load = useLog((s) => s.load);
  const tick = useLog((s) => s.tick);

  useEffect(() => {
    load().then(() => useAccount.getState().init());
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [load, tick]);

  if (!loaded) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.grow} />
      </View>
    );
  }

  return (
    <ThemeProvider value={theme}>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerStyle: { backgroundColor: colors.bg }, headerTintColor: colors.text, headerShadowVisible: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="workout/index" options={{ title: 'Workout', gestureEnabled: false }} />
        <Stack.Screen name="workout/pick" options={{ title: 'Add exercise', presentation: 'modal' }} />
        <Stack.Screen name="workout/[id]" options={{ title: 'Recap' }} />
        <Stack.Screen name="activity/new" options={{ title: 'Log activity', presentation: 'modal' }} />
        <Stack.Screen name="exercise/[id]" options={{ title: '' }} />
        <Stack.Screen name="muscle/[id]" options={{ title: '' }} />
      </Stack>
    </ThemeProvider>
  );
}
