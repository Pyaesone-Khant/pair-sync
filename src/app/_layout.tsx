import React, { useEffect } from 'react';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme, View, ActivityIndicator, StyleSheet } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { LoginScreen } from '../presentation/screens/LoginScreen';
import { useAuthStore } from '../presentation/stores/auth-store';
import { getNotificationService } from '../infrastructure/notifications/expo-notification-service';
import { getSupabaseAuthService } from '../infrastructure/auth/supabase-auth-service';
import { DesignTokens } from '../constants/theme';

// Complete WebBrowser OAuth session if returning from Google / Supabase redirect
WebBrowser.maybeCompleteAuthSession();
SplashScreen.preventAutoHideAsync();

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { isAuthenticated, isInitialized, checkSession, setAccount } = useAuthStore();
  const authService = getSupabaseAuthService();

  useEffect(() => {
    // 1. Check existing Supabase session and listen for auth state changes
    checkSession(authService);

    const authUnsub = authService.onAuthStateChanged((account) => {
      setAccount(account);
    });

    // 2. Initialize notification listeners and permissions once authenticated
    if (isAuthenticated) {
      const notificationService = getNotificationService();
      notificationService.registerForPushNotifications().then((token) => {
        if (token) {
          console.log('[TabLayout] Push notifications token registered:', token);
        }
      });
    }

    // 3. Handle deep-links (OAuth callback & peer pairing invitation)
    const handleDeepLink = async (event: { url: string }) => {
      const { url } = event;
      if (!url) return;

      console.log('[TabLayout] Deep link received:', url);

      // Handle OAuth redirect callback
      if (url.includes('auth/callback') || url.includes('access_token')) {
        await authService.handleAuthRedirectUrl(url);
      }

      // Handle logout deep link
      if (url.includes('logout=1')) {
        await authService.signOut();
        useAuthStore.getState().signOut(authService);
        console.log('[TabLayout] User logged out via deep link');
      }

      // Handle demo authentication for rapid verification
      if (url.includes('auth/demo') || url.includes('demo=1')) {
        const { Account } = await import('../domain/auth/account');
        const demoAccount = new Account({
          id: 'google-usr-demo-alex',
          email: 'alex.morgan@gmail.com',
          fullName: 'Alex Morgan',
          avatarUrl: null,
          createdAt: Date.now(),
        });
        setAccount(demoAccount);
        console.log('[TabLayout] Demo user authenticated via deep link');
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
      authUnsub();
      urlSub.remove();
    };
  }, []);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      {!isInitialized ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={DesignTokens.colors.accentCyan} />
        </View>
      ) : !isAuthenticated ? (
        <LoginScreen />
      ) : (
        <AppTabs />
      )}
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0B0F17',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
