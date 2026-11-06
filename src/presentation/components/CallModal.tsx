import React, { useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { RTCView } from 'react-native-webrtc';
import { useCallStore } from '../stores/call-store';
import { usePairStore } from '../stores/pair-store';
import { useWebRTCCall } from '../hooks/useWebRTCCall';
import { getSoundService } from '../../infrastructure/audio/sound-service';
import { DesignTokens } from '../../constants/theme';

export interface CallModalProps {
  onHangupSignal?: (callId: string) => void;
  onAnswerSignal?: (callId: string) => void;
}

/**
 * End-to-End Encrypted WebRTC In-Call HUD Modal.
 * Supports private voice calls and high-fidelity P2P video streaming using native RTCView,
 * Picture-in-Picture (PiP) local camera preview, remote partner video feed,
 * camera flip, mic/video toggles, and duration timers.
 * Strictly adheres to ADR 0005, frontend-design, and Vercel design principles.
 */
export const CallModal: React.FC<CallModalProps> = ({
  onHangupSignal,
  onAnswerSignal,
}) => {
  const insets = useSafeAreaInsets();
  const localDeviceId = usePairStore((state) => state.activePair?.localDeviceId ?? 'local-device');

  const {
    status,
    callId,
    partnerName,
    isVideo,
    isCaller,
    incomingSdp,
    durationSeconds,
    isSpeakerOn,
    acceptCall,
    declineCall,
    endCall,
    toggleSpeaker,
    incrementDuration,
    reset,
  } = useCallStore();

  const {
    localStream,
    remoteStream,
    isFrontCamera,
    isAudioMuted,
    isVideoMuted,
    isPartnerVideoMuted,
    switchCamera,
    toggleAudio,
    toggleVideo,
    hangupCall,
  } = useWebRTCCall({
    callId,
    status,
    isVideo,
    isCaller,
    localDeviceId,
    incomingSdp,
    onEndCall: () => {
      endCall();
    },
  });

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
    getSoundService().stopIncomingRingtone();
    hangupCall();
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
    getSoundService().stopIncomingRingtone();
    acceptCall();
    if (callId && onAnswerSignal) {
      onAnswerSignal(callId);
    }
  };

  return (
    <Modal
      visible={status !== 'idle'}
      animationType="slide"
      transparent={false}
      onRequestClose={handleEndOrDecline}>
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" />

        {/* Top Header Floating Security Badge */}
        <View style={styles.topHeader}>
          <View style={styles.secureBadge}>
            <Ionicons name="lock-closed" size={13} color={DesignTokens.colors.accentEmerald} />
            <Text style={styles.secureBadgeText}>
              {isVideo ? 'E2EE Video Call' : 'E2EE Voice Call'}
            </Text>
          </View>
        </View>

        {/* Video Mode Body */}
        {isVideo ? (
          <View style={styles.videoBodyContainer}>
            {/* Main Remote Partner Video Viewport */}
            <View style={styles.videoStreamContainer}>
              {remoteStream && !isPartnerVideoMuted ? (
                <RTCView
                  streamURL={remoteStream.toURL()}
                  style={StyleSheet.absoluteFill}
                  objectFit="cover"
                  zOrder={0}
                  mirror={false}
                />
              ) : remoteStream && isPartnerVideoMuted ? (
                <View style={styles.videoStreamBackground}>
                  <View style={styles.remotePartnerCard}>
                    <View style={styles.remoteAvatarCircle}>
                      <Text style={styles.remoteAvatarText}>
                        {partnerName.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <Text style={styles.remotePartnerName}>{partnerName}</Text>

                    <View style={styles.camMutedBadge}>
                      <Ionicons name="videocam-off" size={14} color="#F59E0B" />
                      <Text style={styles.camMutedText}>Partner turned off camera</Text>
                    </View>

                    <Text style={styles.streamSpecsText}>
                      Audio remains live & E2EE encrypted
                    </Text>
                  </View>
                </View>
              ) : (
                <View style={styles.videoStreamBackground}>
                  <View style={styles.remotePartnerCard}>
                    <View style={styles.remoteAvatarCircle}>
                      <Text style={styles.remoteAvatarText}>
                        {partnerName.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <Text style={styles.remotePartnerName}>{partnerName}</Text>

                    <View style={styles.hdStreamBadge}>
                      <ActivityIndicator size="small" color="#38BDF8" style={{ marginRight: 6 }} />
                      <Text style={styles.hdStreamText}>
                        {status === 'connected' ? 'Connecting video stream...' : 'Calling partner...'}
                      </Text>
                    </View>

                    <Text style={styles.streamSpecsText}>
                      {status === 'connected'
                        ? 'Negotiating WebRTC P2P link'
                        : 'Encrypted via DTLS-SRTP'}
                    </Text>
                  </View>
                </View>
              )}

              {/* Status Duration Indicator on Video View */}
              <View style={styles.videoDurationPill}>
                {status === 'outgoing_ringing' && (
                  <>
                    <Ionicons name="radio" size={13} color="#38BDF8" />
                    <Text style={styles.videoDurationText}>Calling partner...</Text>
                  </>
                )}
                {status === 'incoming_ringing' && (
                  <>
                    <Ionicons name="videocam" size={13} color="#10B981" />
                    <Text style={styles.videoDurationText}>Incoming Video Call</Text>
                  </>
                )}
                {status === 'connected' && (
                  <>
                    <View style={styles.connectedDot} />
                    <Text style={styles.videoDurationTextTimer}>
                      {formatDuration(durationSeconds)}
                    </Text>
                  </>
                )}
                {status === 'ended' && (
                  <Text style={styles.statusPillEnded}>Call Disconnected</Text>
                )}
              </View>

              {/* Floating Local PiP Camera Self-View */}
              <View style={styles.pipContainer}>
                {localStream && !isVideoMuted ? (
                  <>
                    <RTCView
                      streamURL={localStream.toURL()}
                      style={StyleSheet.absoluteFill}
                      objectFit="cover"
                      zOrder={1}
                      mirror={isFrontCamera}
                    />
                    <View style={styles.pipOverlayHeader}>
                      <View style={styles.pipDot} />
                      <Text style={styles.pipText}>You</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.pipFlipBtn}
                      onPress={switchCamera}
                      activeOpacity={0.8}
                      accessibilityLabel="Flip selfie camera">
                      <Ionicons name="camera-reverse-outline" size={14} color="#FFFFFF" />
                    </TouchableOpacity>
                  </>
                ) : (
                  <View style={styles.pipCameraOff}>
                    <Ionicons
                      name="videocam-off"
                      size={22}
                      color="#64748B"
                    />
                    <Text style={styles.pipCameraOffText}>
                      Cam Off
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        ) : (
          /* Audio Mode Body */
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
                  <Text style={styles.statusPillText}>Incoming Audio Call</Text>
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
        )}

        {/* Bottom Call Controls */}
        <View style={[styles.bottomControls, { paddingBottom: Math.max(insets.bottom + 16, 28) }]}>
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
          ) : isVideo ? (
            /* Controls for Video Call */
            <View style={styles.inCallControlsRow}>
              {/* Flip Camera */}
              <TouchableOpacity
                style={styles.controlRoundBtn}
                onPress={switchCamera}
                activeOpacity={0.7}
                disabled={status === 'ended' || isVideoMuted}
                accessibilityLabel="Flip Camera">
                <Ionicons name="camera-reverse-outline" size={22} color="#F8FAFC" />
                <Text style={styles.controlBtnLabel}>Flip</Text>
              </TouchableOpacity>

              {/* Video On / Off Toggle */}
              <TouchableOpacity
                style={[
                  styles.controlRoundBtn,
                  isVideoMuted && styles.controlRoundBtnActive,
                ]}
                onPress={toggleVideo}
                activeOpacity={0.7}
                disabled={status === 'ended'}
                accessibilityLabel="Toggle Camera Video">
                <Ionicons
                  name={isVideoMuted ? 'videocam-off' : 'videocam'}
                  size={22}
                  color={isVideoMuted ? '#EF4444' : '#38BDF8'}
                />
                <Text style={styles.controlBtnLabel}>
                  {isVideoMuted ? 'Video Off' : 'Video On'}
                </Text>
              </TouchableOpacity>

              {/* End Call Button */}
              <TouchableOpacity
                style={[styles.actionCircleBtn, styles.hangupBtn]}
                onPress={handleEndOrDecline}
                activeOpacity={0.8}
                disabled={status === 'ended'}
                accessibilityLabel="End Call">
                <Ionicons
                  name="call"
                  size={28}
                  color="#FFFFFF"
                  style={{ transform: [{ rotate: '135deg' }] }}
                />
              </TouchableOpacity>

              {/* Mic Mute */}
              <TouchableOpacity
                style={[
                  styles.controlRoundBtn,
                  isAudioMuted && styles.controlRoundBtnActive,
                ]}
                onPress={toggleAudio}
                activeOpacity={0.7}
                disabled={status === 'ended'}
                accessibilityLabel="Mute Microphone">
                <Ionicons
                  name={isAudioMuted ? 'mic-off' : 'mic'}
                  size={22}
                  color={isAudioMuted ? '#EF4444' : '#F8FAFC'}
                />
                <Text style={styles.controlBtnLabel}>
                  {isAudioMuted ? 'Muted' : 'Mic'}
                </Text>
              </TouchableOpacity>

              {/* Speaker Toggle */}
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
                  size={22}
                  color={isSpeakerOn ? DesignTokens.colors.accentCyan : '#F8FAFC'}
                />
                <Text style={styles.controlBtnLabel}>Speaker</Text>
              </TouchableOpacity>
            </View>
          ) : (
            /* Controls for Voice Call */
            <View style={styles.inCallControlsRow}>
              {/* Mute Button */}
              <TouchableOpacity
                style={[
                  styles.controlRoundBtn,
                  isAudioMuted && styles.controlRoundBtnActive,
                ]}
                onPress={toggleAudio}
                activeOpacity={0.7}
                disabled={status === 'ended'}
                accessibilityLabel="Mute Microphone">
                <Ionicons
                  name={isAudioMuted ? 'mic-off' : 'mic'}
                  size={24}
                  color={isAudioMuted ? '#EF4444' : '#F8FAFC'}
                />
                <Text style={styles.controlBtnLabel}>
                  {isAudioMuted ? 'Muted' : 'Mute'}
                </Text>
              </TouchableOpacity>

              {/* End Call Button */}
              <TouchableOpacity
                style={[styles.actionCircleBtn, styles.hangupBtn]}
                onPress={handleEndOrDecline}
                activeOpacity={0.8}
                disabled={status === 'ended'}
                accessibilityLabel="End Call">
                <Ionicons
                  name="call"
                  size={28}
                  color="#FFFFFF"
                  style={{ transform: [{ rotate: '135deg' }] }}
                />
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
    backgroundColor: '#0B0F17',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  topHeader: {
    alignItems: 'center',
    paddingTop: 12,
    zIndex: 10,
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
  videoBodyContainer: {
    flex: 1,
    marginVertical: 14,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#1E293B',
    position: 'relative',
    backgroundColor: '#0F172A',
  },
  videoStreamContainer: {
    flex: 1,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoStreamBackground: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#0B0F17',
    justifyContent: 'center',
    alignItems: 'center',
  },
  remotePartnerCard: {
    alignItems: 'center',
    gap: 10,
  },
  remoteAvatarCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#E11D48',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#E11D48',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  remoteAvatarText: {
    fontSize: 40,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  remotePartnerName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#F8FAFC',
    letterSpacing: -0.3,
  },
  hdStreamBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  hdLiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  hdStreamText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#10B981',
  },
  camMutedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.35)',
  },
  camMutedText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#F59E0B',
  },
  streamSpecsText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  videoDurationPill: {
    position: 'absolute',
    top: 16,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    gap: 6,
  },
  videoDurationText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '500',
  },
  videoDurationTextTimer: {
    color: '#38BDF8',
    fontSize: 14,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  pipContainer: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 112,
    height: 156,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#1E293B',
    borderWidth: 1.5,
    borderColor: 'rgba(56, 189, 248, 0.5)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  pipOverlayHeader: {
    position: 'absolute',
    top: 6,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    zIndex: 10,
  },
  pipDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#10B981',
  },
  pipText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#F8FAFC',
  },
  pipFlipBtn: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  pipCameraOff: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#151B26',
    gap: 4,
    padding: 8,
  },
  pipCameraOffText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500',
  },
  centerSection: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
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
    paddingTop: 8,
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
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 6,
  },
  actionCircleBtn: {
    width: 66,
    height: 66,
    borderRadius: 33,
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
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#151B26',
    borderWidth: 1,
    borderColor: '#232B3A',
  },
  controlRoundBtnActive: {
    backgroundColor: '#1E293B',
    borderColor: '#38BDF8',
  },
  controlBtnLabel: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 3,
    fontWeight: '500',
  },
});
