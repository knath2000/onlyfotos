import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { LibraryProvider } from '@/library/LibraryProvider';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <LibraryProvider>
        <StatusBar style="auto" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="viewer/[id]" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
        </Stack>
      </LibraryProvider>
    </GestureHandlerRootView>
  );
}
