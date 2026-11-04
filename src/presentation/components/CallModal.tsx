import React, { useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCallStore } from '../stores/call-store';
import { DesignTokens } from '../../constants/theme';

export interface CallModalProps {
  onHangupSignal?: (callId: string) => void;
  onAnswerSignal?: (callId: string) => void;
}

/**
 * Clean WebRTC In-Call HUD Modal.
 * Renders private P2P voice/video call session, duration timers, audio mute/speaker toggles,
 * and incoming/outgoing call states.
 * Adheres to ADR 0005, frontend-design, and Vercel design principles.
 */
export const CallModal: React.FC<CallModalProps> = ({
  onHangupSignal,
  onAnswerSignal,
}) => {
  const {
    status,
    callId,
    partnerName,
    isVideo,
    durationSeconds,
    isMuted,
    isSpeakerOn,
    acceptCall,
    declineCall,
    endCall,
    toggleMute,
    toggleSpeaker,
    incrementDuration,
    reset,
  } = useCallStore();

  // Call duration timer
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (status === 'connected') {
      interval = setInterval(() => {
        incrementDuration();
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [status, incrementDuration]);

  // Auto-teardown modal on call ended
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | null = null;
    if (status === 'ended') {
      timeout = setTimeout(() => {
        reset();
      }, 1200);
    }
    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [status, reset]);

  const formatDuration = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleEndOrDecline = () => {
    if (callId && onHangupSignal) {
      onHangupSignal(callId);
    }
    if (status === 'incoming_ringing') {
      declineCall();
    } else {
      endCall();
    }
  };

  const handleAnswer = () => {
    if (callId && onAnswerSignal) {
      onAnswerSignal(callId);
    }
    acceptCall();
  };

  return (
    <Modal
      visible={status !== 'idle'}
      animationType="slide"
      transparent={false}
      onRequestClose={handleEndOrDecline}>
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" />

        {/* Top Header */}
        <View style={styles.topHeader}>
          <View style={styles.secureBadge}>
            <Ionicons name="lock-closed" size={13} color={DesignTokens.colors.accentEmerald} />
            <Text style={styles.secureBadgeText}>Encrypted</Text>
          </View>
        </View>

        {/* Center Calling Avatar & Status */}
        <View style={styles.centerSection}>
          <View style={styles.avatarGlowContainer}>
            <View style={styles.avatarOuterRing} />
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarInitial}>
                {partnerName.charAt(0).toUpperCase()}
              </Text>
            </View>
          </View>

          <Text style={styles.partnerTitle}>{partnerName}</Text>

          <View style={styles.statusPill}>
            {status === 'outgoing_ringing' && (
              <>
                <Ionicons name="radio" size={14} color={DesignTokens.colors.accentCyan} />
                <Text style={styles.statusPillText}>Calling peer directly...</Text>
              </>
            )}
            {status === 'incoming_ringing' && (
              <>
                <Ionicons name="call" size={14} color={DesignTokens.colors.accentEmerald} />
                <Text style={styles.statusPillText}>
                  Incoming {isVideo ? 'Video' : 'Audio'} Call
                </Text>
              </>
            )}
            {status === 'connected' && (
              <>
                <View style={styles.connectedDot} />
                <Text style={styles.statusPillTextTimer}>
                  {formatDuration(durationSeconds)}
                </Text>
              </>
            )}
            {status === 'ended' && (
              <Text style={styles.statusPillEnded}>Call Disconnected</Text>
            )}
          </View>
        </View>

        {/* Bottom Call Controls */}
        <View style={styles.bottomControls}>
          {status === 'incoming_ringing' ? (
            <View style={styles.ringingActionsRow}>
              <TouchableOpacity
                style={[styles.actionCircleBtn, styles.declineBtn]}
                onPress={handleEndOrDecline}
                activeOpacity={0.8}
                accessibilityLabel="Decline Call">
                <Ionicons name="close" size={32} color="#FFFFFF" />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionCircleBtn, styles.acceptBtn]}
                onPress={handleAnswer}
                activeOpacity={0.8}
                accessibilityLabel="Accept Call">
                <Ionicons name="call" size={30} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.inCallControlsRow}>
              {/* Mute Button */}
              <TouchableOpacity
                style={[
                  styles.controlRoundBtn,
                  isMuted && styles.controlRoundBtnActive,
                ]}
                onPress={toggleMute}
                activeOpacity={0.7}
                disabled={status === 'ended'}
                accessibilityLabel="Mute Microphone">
                <Ionicons
                  name={isMuted ? 'mic-off' : 'mic'}
                  size={24}
                  color={isMuted ? '#EF4444' : '#F8FAFC'}
                />
                <Text style={styles.controlBtnLabel}>
                  {isMuted ? 'Muted' : 'Mute'}
                </Text>
              </TouchableOpacity>

              {/* End Call Button */}
              <TouchableOpacity
                style={[styles.actionCircleBtn, styles.hangupBtn]}
                onPress={handleEndOrDecline}
                activeOpacity={0.8}
                disabled={status === 'ended'}
                accessibilityLabel="End Call">
                <Ionicons name="call" size={28} color="#FFFFFF" style={{ transform: [{ rotate: '135deg' }] }} />
              </TouchableOpacity>

              {/* Speaker Button */}
              <TouchableOpacity
                style={[
                  styles.controlRoundBtn,
                  isSpeakerOn && styles.controlRoundBtnActive,
                ]}
                onPress={toggleSpeaker}
                activeOpacity={0.7}
                disabled={status === 'ended'}
                accessibilityLabel="Toggle Speaker">
                <Ionicons
                  name={isSpeakerOn ? 'volume-high' : 'volume-medium-outline'}
                  size={24}
                  color={isSpeakerOn ? DesignTokens.colors.accentCyan : '#F8FAFC'}
                />
                <Text style={styles.controlBtnLabel}>Speaker</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DesignTokens.colors.bgPrimary,
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  topHeader: {
    alignItems: 'center',
    paddingTop: 16,
  },
  secureBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: DesignTokens.radii.full,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
    gap: 6,
  },
  secureBadgeText: {
    color: DesignTokens.colors.accentEmerald,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  centerSection: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarGlowContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  avatarOuterRing: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
    borderWidth: 1.5,
    borderColor: 'rgba(56, 189, 248, 0.25)',
  },
  avatarCircle: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: '#E11D48',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#E11D48',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  avatarInitial: {
    fontSize: 42,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  partnerTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: DesignTokens.colors.textPrimary,
    letterSpacing: -0.4,
    marginBottom: 12,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: DesignTokens.colors.bgCard,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: DesignTokens.radii.full,
    borderWidth: 1,
    borderColor: DesignTokens.colors.borderSubtle,
    gap: 8,
  },
  statusPillText: {
    fontSize: 14,
    color: DesignTokens.colors.textSecondary,
    fontWeight: '500',
  },
  statusPillTextTimer: {
    fontSize: 16,
    color: DesignTokens.colors.accentCyan,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  statusPillEnded: {
    fontSize: 14,
    color: DesignTokens.colors.accentRose,
    fontWeight: '600',
  },
  connectedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: DesignTokens.colors.accentEmerald,
  },
  bottomControls: {
    paddingBottom: 40,
    alignItems: 'center',
  },
  ringingActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    paddingHorizontal: 32,
  },
  inCallControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    width: '100%',
  },
  actionCircleBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
  acceptBtn: {
    backgroundColor: '#10B981',
    shadowColor: '#10B981',
  },
  declineBtn: {
    backgroundColor: '#EF4444',
    shadowColor: '#EF4444',
  },
  hangupBtn: {
    backgroundColor: '#EF4444',
    shadowColor: '#EF4444',
  },
  controlRoundBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: DesignTokens.colors.bgCard,
    borderWidth: 1,
    borderColor: DesignTokens.colors.borderSubtle,
  },
  controlRoundBtnActive: {
    backgroundColor: DesignTokens.colors.bgElevated,
    borderColor: DesignTokens.colors.borderFocus,
  },
  controlBtnLabel: {
    fontSize: 11,
    color: DesignTokens.colors.textSecondary,
    marginTop: 4,
    fontWeight: '500',
  },
});
