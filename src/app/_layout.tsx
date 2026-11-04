import React, { useEffect } from 'react';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { getNotificationService } from '../infrastructure/notifications/expo-notification-service';
import { getSupabaseAuthService } from '../infrastructure/auth/supabase-auth-service';

// Complete WebBrowser OAuth session if returning from Google / Supabase redirect
WebBrowser.maybeCompleteAuthSession();
SplashScreen.preventAutoHideAsync();

export default function TabLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    // 1. Initialize notification listeners and permissions
    const notificationService = getNotificationService();
    notificationService.registerForPushNotifications().then((token) => {
      if (token) {
        console.log('[TabLayout] Push notifications token registered:', token);
      }
    });

    // 2. Handle deep-links (e.g. pairsync://auth/callback#... or pairsync://pair/invite)
    const handleDeepLink = async (event: { url: string }) => {
      const { url } = event;
      if (!url) return;

      console.log('[TabLayout] Deep link received:', url);

      // Handle OAuth redirect callback
      if (url.includes('auth/callback') || url.includes('access_token')) {
        const authService = getSupabaseAuthService();
        await authService.handleAuthRedirectUrl(url);
      }

      // Handle out-of-band Pairing ceremony invitation link (ADR 0006)
      if (url.includes('pair?') || url.includes('pair/invite')) {
        try {
          const queryString = url.includes('?') ? url.split('?')[1] : '';
          const params = new URLSearchParams(queryString);
          const peerDeviceId = params.get('deviceId');
          const peerPublicKey = params.get('publicKey');
          if (peerDeviceId && peerPublicKey) {
            const { getDatabaseClient } = await import('../infrastructure/database/database-client');
            const { Pair } = await import('../domain/pairing/pair');
            const pairRepo = getDatabaseClient().getRepositories().pairRepo;
            const newPair = new Pair({
              id: `pair-${Date.now()}`,
              localDeviceId: 'device-local-user',
              peerDeviceId,
              peerPublicKey,
            });
            newPair.activate();
            await pairRepo.savePair(newPair);
            console.log('[TabLayout] Peer paired successfully via deep link invite!');
          }
        } catch (err) {
          console.warn('[TabLayout] Failed to parse pairing deep link:', err);
        }
      }
    };

    const urlSub = Linking.addEventListener('url', handleDeepLink);

    // Check initial launch URL
    Linking.getInitialURL().then((initialUrl) => {
      if (initialUrl) {
        handleDeepLink({ url: initialUrl });
      }
    });

    return () => {
      urlSub.remove();
    };
  }, []);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      <AppTabs />
    </ThemeProvider>
  );
}
