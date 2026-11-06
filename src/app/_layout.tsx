import React, { useEffect } from 'react';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme, View, ActivityIndicator, StyleSheet } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import PinpointScreen from './pinpoint';
import { LoginScreen } from '../presentation/screens/LoginScreen';
import { CallModal } from '../presentation/components/CallModal';
import { useAuthStore } from '../presentation/stores/auth-store';
import { useCallStore } from '../presentation/stores/call-store';
import { usePairStore } from '../presentation/stores/pair-store';
import { usePinpointStore } from '../presentation/stores/pinpoint-store';
import { getNotificationService } from '../infrastructure/notifications/expo-notification-service';
import { getSoundService } from '../infrastructure/audio/sound-service';
import { getSupabaseAuthService } from '../infrastructure/auth/supabase-auth-service';
import { getSignalingChannel } from '../infrastructure/network/supabase-signaling-channel';
import { DesignTokens } from '../constants/theme';

// Complete WebBrowser OAuth session if returning from Google / Supabase redirect
WebBrowser.maybeCompleteAuthSession();
SplashScreen.preventAutoHideAsync();

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { isAuthenticated, isInitialized, checkSession, setAccount } = useAuthStore();
  const isPinpointOpen = usePinpointStore((state) => state.isOpen);
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

      // Handle dev login deep link for automated verification & UI testing
      if (url.includes('login=1') || url.includes('dev_login=1')) {
        const { Account } = await import('../domain/auth/account');
        const testAccount = new Account({
          id: 'test-user-id',
          email: 'test@pairsync.app',
          fullName: 'Test User',
          avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80',
          createdAt: Date.now(),
        });
        useAuthStore.getState().setAccount(testAccount);
        console.log('[TabLayout] Test user logged in via deep link');
      }

      // Handle call simulation deep links for verification & testing (ADR 0005)
      if (url.includes('call=start') || url.includes('call/start')) {
        const isVideo = url.includes('video=1') || url.includes('video=true');
        useCallStore.getState().startOutgoingCall('My Partner', isVideo);
        console.log('[TabLayout] Outgoing call triggered via deep link');
      }
      if (url.includes('call=incoming') || url.includes('call/incoming')) {
        const isVideo = url.includes('video=1') || url.includes('video=true');
        useCallStore.getState().receiveIncomingCall('call-sim-123', 'My Partner', isVideo);
        console.log('[TabLayout] Incoming call triggered via deep link');
      }
      if (url.includes('call=end') || url.includes('call/end')) {
        useCallStore.getState().endCall();
        console.log('[TabLayout] Call ended via deep link');
      }

      // Handle out-of-band Pairing ceremony invitation link (ADR 0006)
      if (url.includes('pair?') || url.includes('pair/invite')) {
        try {
          const queryString = url.includes('?') ? url.split('?')[1] : '';
          const params = new URLSearchParams(queryString);
          const peerDeviceId = params.get('deviceId');
          const peerPublicKey = params.get('publicKey');
          if (peerDeviceId && peerPublicKey) {
            const { Pair } = await import('../domain/pairing/pair');
            const { getOrCreateLocalDeviceId } = await import('../infrastructure/security/device-key-manager');
            const localDeviceId = await getOrCreateLocalDeviceId();
            const newPair = new Pair({
              id: `pair-${Date.now()}`,
              localDeviceId,
              peerDeviceId,
              peerPublicKey,
            });
            await usePairStore.getState().setPair(newPair);
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

  // Global Pair & WebRTC P2P Call Signaling Listener (ADR 0001, ADR 0005, ADR 0006)
  const activePair = usePairStore((state) => state.activePair);

  useEffect(() => {
    if (!isAuthenticated) {
      usePairStore.getState().reset();
      return;
    }

    // Load active pair from local encrypted SQLite on login
    usePairStore.getState().loadPair();
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || !activePair) return;

    let callUnsub: (() => void) | null = null;
    let envelopeUnsub: (() => void) | null = null;
    let roomJoined: string | null = null;

    async function initSignaling() {
      const signaling = getSignalingChannel();
      roomJoined = activePair!.getPairRoomId();
      await signaling.joinPairRoom(roomJoined);

      callUnsub = signaling.onCallSignalReceived((signal) => {
        if (!activePair || signal.senderDeviceId === activePair.localDeviceId) return;
        if (signal.type === 'offer') {
          const currentCall = useCallStore.getState();
          if (currentCall.status === 'incoming_ringing' && currentCall.callId === signal.callId) {
            if (signal.sdp) {
              currentCall.setIncomingSdp(signal.sdp);
            }
          } else if (currentCall.status === 'idle') {
            useCallStore.getState().receiveIncomingCall(signal.callId, 'Partner', signal.isVideo, signal.sdp);
          }
        } else if (signal.type === 'answer') {
          useCallStore.getState().acceptCall();
        } else if (signal.type === 'hangup' || signal.type === 'reject') {
          useCallStore.getState().endCall();
        }
      });

      // Global incoming message listener for sound & notifications (ADR 0004, ADR 0006)
      envelopeUnsub = signaling.onEnvelopeReceived(async (envelope) => {
        if (!activePair || envelope.senderDeviceId === activePair.localDeviceId) return;
        console.log('[RootLayout] Incoming encrypted envelope received');

        // Play crisp chime & haptic feedback
        await getSoundService().playMessageChime();

        // Dispatch local notification banner
        await getNotificationService().sendLocalNotification({
          title: 'Partner',
          body: 'New encrypted message',
          data: { type: 'chat_message', id: envelope.id },
          sound: true,
        });
      });
    }

    initSignaling();

    return () => {
      if (callUnsub) callUnsub();
      if (envelopeUnsub) envelopeUnsub();
    };
  }, [isAuthenticated, activePair]);

  // Reactive Incoming Call Ringtone & Telephony Alert Controller (ADR 0005)
  const callStatus = useCallStore((state) => state.status);
  const isVideoCall = useCallStore((state) => state.isVideo);

  useEffect(() => {
    if (callStatus === 'incoming_ringing') {
      getSoundService().startIncomingRingtone();
      getNotificationService().sendLocalNotification({
        title: isVideoCall ? 'Incoming Video Call 📹' : 'Incoming Audio Call 📞',
        body: 'Partner is calling you. Tap to answer.',
        data: { type: 'call' },
        sound: true,
      });
    } else {
      getSoundService().stopIncomingRingtone();
    }
  }, [callStatus, isVideoCall]);

  return (
    <SafeAreaProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <AnimatedSplashOverlay />
        {!isInitialized ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={DesignTokens.colors.accentCyan} />
          </View>
        ) : !isAuthenticated ? (
          <LoginScreen />
        ) : (
          <>
            <AppTabs />
            <CallModal
              onHangupSignal={(callId) => {
                getSignalingChannel().sendCallSignal({
                  type: 'hangup',
                  callId,
                  senderDeviceId: activePair?.localDeviceId ?? 'local-device',
                  timestamp: Date.now(),
                });
              }}
              onAnswerSignal={(callId) => {
                getSignalingChannel().sendCallSignal({
                  type: 'answer',
                  callId,
                  senderDeviceId: activePair?.localDeviceId ?? 'local-device',
                  timestamp: Date.now(),
                });
              }}
            />
            {isPinpointOpen && <PinpointScreen />}
          </>
        )}
      </ThemeProvider>
    </SafeAreaProvider>
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
