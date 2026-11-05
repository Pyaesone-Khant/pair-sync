import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { getSupabaseAuthService } from '@/infrastructure/auth/supabase-auth-service';
import { useAuthStore } from '@/presentation/stores/auth-store';

/**
 * OAuth Redirect Callback Handler (ADR 0006)
 * Handles incoming deep links from Supabase / Google OAuth (pairsync://auth/callback).
 * Completes token exchange and redirects immediately to root.
 */
export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    let mounted = true;

    async function processCallback() {
      try {
        const url = await Linking.getInitialURL();
        if (url) {
          const authService = getSupabaseAuthService();
          await authService.handleAuthRedirectUrl(url);
          const currentAccount = await authService.getCurrentAccount();
          if (currentAccount && mounted) {
            useAuthStore.getState().setAccount(currentAccount);
          }
        }
      } catch (err) {
        console.warn('[AuthCallback] Error processing auth callback:', err);
      } finally {
        if (mounted) {
          router.replace('/');
        }
      }
    }

    processCallback();

    return () => {
      mounted = false;
    };
  }, [router]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#38BDF8" />
      <Text style={styles.text}>Completing sign in...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0F17',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  text: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '500',
  },
});
