import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../stores/auth-store';
import { getSupabaseAuthService } from '../../infrastructure/auth/supabase-auth-service';
import { DesignTokens } from '../../constants/theme';
import { Account } from '../../domain/auth/account';

/**
 * High-aesthetic Google Sign-In & Onboarding Screen.
 * Presented on app startup whenever the user is unauthenticated.
 * Adheres to ADR 0006 (Hybrid Identity), frontend-design, and Vercel design principles.
 */
export const LoginScreen: React.FC = () => {
  const { isLoading, error, signInWithGoogle, setAccount } = useAuthStore();
  const authService = getSupabaseAuthService();

  const handleGoogleSignIn = async () => {
    try {
      const user = await signInWithGoogle(authService);
      if (user) {
        Alert.alert(
          'Google Account Connected',
          `Welcome, ${user.getDisplayName()}! Proceeding to your private sync.`
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sign in failed';
      Alert.alert('Sign-In Error', msg);
    }
  };

  const handleDemoSignIn = () => {
    const demoAccount = new Account({
      id: `google-user-${Date.now()}`,
      email: 'alex.morgan@gmail.com',
      fullName: 'Alex Morgan',
      avatarUrl: null,
      createdAt: Date.now(),
    });
    setAccount(demoAccount);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />
      <View style={styles.container}>
        {/* Top Hero Brand Section */}
        <View style={styles.heroSection}>
          <View style={styles.iconContainer}>
            <Image
              source={require('../../../assets/images/icon.png')}
              style={styles.brandLogo}
              resizeMode="cover"
            />
          </View>

          <Text style={styles.brandTitle}>PairSync</Text>
        </View>

        {/* Security & Feature Badges */}
        <View style={styles.featureCardsContainer}>
          <View style={styles.featureRow}>
            <View style={styles.featureIconBadge}>
              <Ionicons name="navigate" size={19} color={DesignTokens.colors.accentEmerald} />
            </View>
            <Text style={styles.featureTitle}>Live Radar & Presence</Text>
          </View>

          <View style={styles.featureRow}>
            <View style={styles.featureIconBadge}>
              <Ionicons name="shield-checkmark" size={19} color={DesignTokens.colors.accentCyan} />
            </View>
            <Text style={styles.featureTitle}>Safe Places Geofencing</Text>
          </View>

          <View style={styles.featureRow}>
            <View style={styles.featureIconBadge}>
              <Ionicons name="chatbubbles" size={19} color="#F43F5E" />
            </View>
            <Text style={styles.featureTitle}>1-to-1 Calls & Chat</Text>
          </View>
        </View>

        {/* Authentication Action Section */}
        <View style={styles.actionSection}>
          {error && (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={16} color={DesignTokens.colors.accentRose} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Primary Google Sign-In Button */}
          <TouchableOpacity
            style={styles.googleBtn}
            onPress={handleGoogleSignIn}
            disabled={isLoading}
            activeOpacity={0.85}
            accessibilityLabel="Continue with Google">
            {isLoading ? (
              <ActivityIndicator size="small" color="#0B0F17" />
            ) : (
              <>
                <Ionicons name="logo-google" size={20} color="#EA4335" />
                <Text style={styles.googleBtnText}>Continue with Google</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Instant Demo Sign-In (Simulator & Rapid Verification) */}
          <TouchableOpacity
            style={styles.demoBtn}
            onPress={handleDemoSignIn}
            disabled={isLoading}
            activeOpacity={0.7}
            accessibilityLabel="Instant Demo Account">
            <Ionicons name="flash-outline" size={15} color={DesignTokens.colors.accentCyan} />
            <Text style={styles.demoBtnText}>Continue as Demo Account (Alex Morgan)</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0B0F17',
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
    paddingVertical: 24,
  },
  heroSection: {
    alignItems: 'center',
    paddingTop: 16,
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 10,
  },
  brandLogo: {
    width: 96,
    height: 96,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(56, 189, 248, 0.35)',
  },
  brandTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: -0.6,
  },
  featureCardsContainer: {
    backgroundColor: '#151B26',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#232B3A',
    gap: 18,
    marginVertical: 12,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  featureIconBadge: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F8FAFC',
    letterSpacing: -0.2,
  },
  featureSubtitle: {
    fontSize: 12,
    lineHeight: 17,
    color: '#64748B',
  },
  actionSection: {
    gap: 12,
    paddingBottom: 8,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    color: DesignTokens.colors.accentRose,
    fontWeight: '500',
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  googleBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0B0F17',
    letterSpacing: -0.2,
  },
  demoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
    borderRadius: 14,
    paddingVertical: 12,
  },
  demoBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: DesignTokens.colors.accentCyan,
  },
  disclaimerText: {
    fontSize: 11,
    lineHeight: 16,
    color: '#475569',
    textAlign: 'center',
    paddingHorizontal: 8,
    marginTop: 4,
  },
});
