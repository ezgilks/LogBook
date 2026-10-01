import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router/js-tabs';
import type { ColorValue } from 'react-native';
import { colors } from '../../lib/theme';

type IconName = keyof typeof Ionicons.glyphMap;

function icon(name: IconName) {
  return ({ color, size }: { color: ColorValue; size: number }) => <Ionicons name={name} color={color as string} size={size} />;
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: colors.bg, borderTopColor: colors.border },
        tabBarActiveTintColor: colors.grow,
        tabBarInactiveTintColor: colors.faint,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Today', tabBarIcon: icon('pulse') }} />
      <Tabs.Screen name="body" options={{ title: 'Body', tabBarIcon: icon('body') }} />
      <Tabs.Screen name="history" options={{ title: 'History', tabBarIcon: icon('calendar') }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: icon('options') }} />
    </Tabs>
  );
}
