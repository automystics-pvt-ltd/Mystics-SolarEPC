import React, { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { Redirect, Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { setBaseUrl, setAuthTokenGetter } from '@workspace/api-client-react';
import { AuthProvider, useAuth, getTokenSync } from '@/context/AuthContext';
import { OfflineProvider } from '@/context/OfflineContext';

// Configure API client for Expo — runs outside the web proxy, needs absolute URL
const domain = process.env.EXPO_PUBLIC_DOMAIN;
if (domain) {
  setBaseUrl(`https://${domain}`);
}
setAuthTokenGetter(getTokenSync);

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 1,
    },
  },
});

function RootLayoutNav() {
  const { token, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !token) {
      router.replace('/login');
    }
  }, [token, isLoading, router]);

  if (isLoading) return null;

  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen
        name="grn/new"
        options={{
          title: 'New GRN',
          headerStyle: { backgroundColor: '#0B1229' },
          headerTintColor: '#FFFFFF',
          headerTitleStyle: { fontFamily: 'Inter_600SemiBold', fontSize: 16 },
        }}
      />
      <Stack.Screen
        name="mr/new"
        options={{
          title: 'New Request',
          headerStyle: { backgroundColor: '#0B1229' },
          headerTintColor: '#FFFFFF',
          headerTitleStyle: { fontFamily: 'Inter_600SemiBold', fontSize: 16 },
        }}
      />
      <Stack.Screen
        name="po/[id]"
        options={{
          title: 'Purchase Order',
          headerStyle: { backgroundColor: '#0B1229' },
          headerTintColor: '#FFFFFF',
          headerTitleStyle: { fontFamily: 'Inter_600SemiBold', fontSize: 16 },
        }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <OfflineProvider>
              <GestureHandlerRootView style={{ flex: 1 }}>
                <KeyboardProvider>
                  <RootLayoutNav />
                </KeyboardProvider>
              </GestureHandlerRootView>
            </OfflineProvider>
          </AuthProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
