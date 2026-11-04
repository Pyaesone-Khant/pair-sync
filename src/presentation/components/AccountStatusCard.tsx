import React, { useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../stores/auth-store';
import { getSupabaseAuthService } from '../../infrastructure/auth/supabase-auth-service';
import { DesignTokens } from '../../constants/theme';

/**
 * Account Status & Google Sign-In Card.
 * Manages Google OAuth via Supabase while adhering to ADR 0006 (Hybrid Identity).
 * Designed according to frontend-design and Vercel design principles.
 */
export const AccountStatusCard: React.FC = () => {
  const {
    account,
    isAuthenticated,
    isLoading,
    error,
    signInWithGoogle,
    signOut,
    checkSession,
    setAccount,
  } = useAuthStore();

  const authService = getSupabaseAuthService();

  useEffect(() => {
    checkSession(authService);

    const unsubscribe = authService.onAuthStateChanged((userAccount) => {
      setAccount(userAccount);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const handleGoogleSignIn = async () => {
    try {
      const user = await signInWithGoogle(authService);
      if (user) {
        Alert.alert(
          'Google Account Connected',
          `Welcome back, ${user.getDisplayName()}! Your identity has been verified with Supabase.`
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sign in failed';
      Alert.alert('Sign-In Error', msg);
    }
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out of Google',
      'Are you sure you want to sign out? Your physical 1:1 hardware pair will remain in local SQLite.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await signOut(authService);
          },
        },
      ]
    );
  };

  return (
    <View style={styles.card}>
      {isAuthenticated && account ? (
        <View style={styles.authenticatedRow}>
          {/* Avatar / Initials */}
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarInitials}>{account.getInitials()}</Text>
          </View>

          {/* User Info */}
          <View style={styles.userInfoCol}>
            <View style={styles.nameRow}>
              <Text style={styles.userName} numberOfLines={1}>
                {account.getDisplayName()}
              </Text>
              <View style={styles.verifiedBadge}>
                <Ionicons name="checkmark-circle" size={12} color={DesignTokens.colors.accentEmerald} />
                <Text style={styles.verifiedBadgeText}>Google Verified</Text>
              </View>
            </View>
            <Text style={styles.userEmail} numberOfLines={1}>
              {account.email}
            </Text>
          </View>

          {/* Sign Out Button */}
          <TouchableOpacity
            style={styles.signOutBtn}
            onPress={handleSignOut}
            activeOpacity={0.7}
            accessibilityLabel="Sign Out">
            <Ionicons name="log-out-outline" size={16} color={DesignTokens.colors.accentRose} />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.unauthenticatedCol}>
          <View style={styles.unauthHeaderRow}>
            <View style={styles.gLogoCircle}>
              <Ionicons name="logo-google" size={18} color="#EA4335" />
            </View>
            <View style={styles.unauthTextContainer}>
              <Text style={styles.cardTitle}>Google Account Identity</Text>
              <Text style={styles.cardSubtitle}>
                Authenticate via Supabase to authorize silent push sync & blind relay.
              </Text>
            </View>
          </View>

          {error && <Text style={styles.errorText}>{error}</Text>}

          <TouchableOpacity
            style={styles.googleBtn}
            onPress={handleGoogleSignIn}
            disabled={isLoading}
            activeOpacity={0.8}
            accessibilityLabel="Sign in with Google">
            {isLoading ? (
              <ActivityIndicator size="small" color="#0B0F17" />
            ) : (
              <>
                <Ionicons name="logo-google" size={18} color="#0B0F17" />
                <Text style={styles.googleBtnText}>Continue with Google</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: DesignTokens.colors.bgCard,
    borderRadius: DesignTokens.radii.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: DesignTokens.colors.borderSubtle,
    marginBottom: 16,
  },
  authenticatedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: DesignTokens.colors.bgElevated,
    borderWidth: 1.5,
    borderColor: DesignTokens.colors.accentCyan,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: 16,
    fontWeight: '700',
    color: DesignTokens.colors.accentCyan,
  },
  userInfoCol: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  userName: {
    fontSize: 15,
    fontWeight: '600',
    color: DesignTokens.colors.textPrimary,
    letterSpacing: -0.2,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: DesignTokens.radii.full,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  verifiedBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: DesignTokens.colors.accentEmerald,
  },
  userEmail: {
    fontSize: 12,
    color: DesignTokens.colors.textSecondary,
    marginTop: 2,
  },
  signOutBtn: {
    padding: 8,
    borderRadius: DesignTokens.radii.sm,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
  },
  unauthenticatedCol: {
    gap: 12,
  },
  unauthHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  gLogoCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  unauthTextContainer: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: DesignTokens.colors.textPrimary,
    letterSpacing: -0.2,
  },
  cardSubtitle: {
    fontSize: 12,
    color: DesignTokens.colors.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },
  errorText: {
    fontSize: 12,
    color: DesignTokens.colors.accentRose,
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: DesignTokens.radii.md,
    paddingVertical: 12,
    gap: 8,
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  googleBtnText: {
    color: '#0B0F17',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
});
