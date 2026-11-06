import { useState, useEffect, useRef, useCallback } from 'react';
import { Platform, PermissionsAndroid } from 'react-native';
import {
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  mediaDevices,
  MediaStream,
} from 'react-native-webrtc';
import { getSignalingChannel } from '../../infrastructure/network/supabase-signaling-channel';
import { CallStatus } from '../stores/call-store';

const RTC_CONFIGURATION = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

export interface UseWebRTCCallOptions {
  callId: string | null;
  status: CallStatus;
  isVideo: boolean;
  isCaller: boolean;
  localDeviceId: string;
  incomingSdp: string | null;
  onEndCall: () => void;
}

export interface UseWebRTCCallResult {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isConnected: boolean;
  isFrontCamera: boolean;
  isAudioMuted: boolean;
  isVideoMuted: boolean;
  switchCamera: () => void;
  toggleAudio: () => void;
  toggleVideo: () => void;
  hangupCall: () => void;
}

/**
 * End-to-End Encrypted WebRTC P2P Call Hook.
 * Manages RTCPeerConnection lifecycle, camera & mic capture, ICE exchange,
 * and high-fidelity video stream transmission over direct STUN signaling.
 * Strictly adheres to ADR 0005 and production standards.
 */
export function useWebRTCCall({
  callId,
  status,
  isVideo,
  isCaller,
  localDeviceId,
  incomingSdp,
  onEndCall,
}: UseWebRTCCallOptions): UseWebRTCCallResult {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isFrontCamera, setIsFrontCamera] = useState<boolean>(true);
  const [isAudioMuted, setIsAudioMuted] = useState<boolean>(false);
  const [isVideoMuted, setIsVideoMuted] = useState<boolean>(false);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pendingCandidatesRef = useRef<any[]>([]);
  const hasRemoteDescriptionRef = useRef<boolean>(false);
  const localStreamRef = useRef<MediaStream | null>(null);
  const initializedCallIdRef = useRef<string | null>(null);

  // Sync ref
  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  const drainPendingCandidates = async () => {
    if (!pcRef.current) return;
    while (pendingCandidatesRef.current.length > 0) {
      const cand = pendingCandidatesRef.current.shift();
      if (cand) {
        try {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(cand));
        } catch (err) {
          console.warn('[useWebRTCCall] Error adding pending ICE candidate:', err);
        }
      }
    }
  };

  const cleanup = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (track as any).release?.();
        } catch (err) {
          console.warn('[useWebRTCCall] Error stopping local track:', err);
        }
      });
      setLocalStream(null);
      localStreamRef.current = null;
    }

    if (remoteStream) {
      remoteStream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (err) {
          console.warn('[useWebRTCCall] Error stopping remote track:', err);
        }
      });
      setRemoteStream(null);
    }

    if (pcRef.current) {
      try {
        pcRef.current.close();
      } catch (err) {
        console.warn('[useWebRTCCall] Error closing peer connection:', err);
      }
      pcRef.current = null;
    }

    pendingCandidatesRef.current = [];
    hasRemoteDescriptionRef.current = false;
    initializedCallIdRef.current = null;
    setIsConnected(false);
  }, [remoteStream]);

  // Request Android runtime permissions
  const requestAndroidPermissions = async (video: boolean): Promise<boolean> => {
    if (Platform.OS !== 'android') return true;
    try {
      const permissionsToRequest: (typeof PermissionsAndroid.PERMISSIONS[keyof typeof PermissionsAndroid.PERMISSIONS])[] = [
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      ];
      if (video) {
        permissionsToRequest.push(PermissionsAndroid.PERMISSIONS.CAMERA);
      }
      const results = await PermissionsAndroid.requestMultiple(permissionsToRequest);
      const audioGranted = results[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] === PermissionsAndroid.RESULTS.GRANTED;
      const cameraGranted = !video || results[PermissionsAndroid.PERMISSIONS.CAMERA] === PermissionsAndroid.RESULTS.GRANTED;
      return audioGranted && cameraGranted;
    } catch (err) {
      console.warn('[useWebRTCCall] Android permission error:', err);
      return false;
    }
  };

  // Acquire local media stream
  const acquireLocalStream = async (video: boolean): Promise<MediaStream | null> => {
    try {
      await requestAndroidPermissions(video);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const constraints: any = {
        audio: true,
        video: video ? { facingMode: 'user', width: 640, height: 480, frameRate: 25 } : false,
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const stream = (await mediaDevices.getUserMedia(constraints)) as unknown as MediaStream;
      setLocalStream(stream);
      localStreamRef.current = stream;
      return stream;
    } catch (err) {
      console.error('[useWebRTCCall] Failed to acquire media stream:', err);
      return null;
    }
  };

  // Create and configure RTCPeerConnection
  const setupPeerConnection = (stream: MediaStream, activeCallId: string): RTCPeerConnection => {
    const pc = new RTCPeerConnection(RTC_CONFIGURATION);
    pcRef.current = pc;

    // Add local tracks
    stream.getTracks().forEach((track) => {
      pc.addTrack(track, stream);
    });

    // Remote track listener
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pc.ontrack = (event: any) => {
      console.log('[useWebRTCCall] Received remote track:', event.track?.kind);
      if (event.streams && event.streams[0]) {
        setRemoteStream(event.streams[0]);
      }
    };

    // ICE candidate listener
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pc.onicecandidate = (event: any) => {
      if (event.candidate) {
        getSignalingChannel().sendCallSignal({
          type: 'ice-candidate',
          callId: activeCallId,
          senderDeviceId: localDeviceId,
          candidate: event.candidate,
          timestamp: Date.now(),
        }).catch((err) => {
          console.warn('[useWebRTCCall] Error sending ICE candidate:', err);
        });
      }
    };

    // ICE connection state listener
    pc.oniceconnectionstatechange = () => {
      console.log('[useWebRTCCall] ICE Connection State:', pc.iceConnectionState);
      if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        setIsConnected(true);
      } else if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
        console.warn('[useWebRTCCall] ICE Connection lost or disconnected');
      }
    };

    return pc;
  };

  // Main Call Lifecycle Effect
  useEffect(() => {
    if (status === 'idle' || !callId) {
      cleanup();
      return;
    }

    if (status === 'ended') {
      cleanup();
      return;
    }

    const signaling = getSignalingChannel();

    // 1. Caller flow: start capture and create offer immediately
    if (isCaller && status === 'outgoing_ringing' && initializedCallIdRef.current !== callId) {
      initializedCallIdRef.current = callId;

      (async () => {
        const stream = await acquireLocalStream(isVideo);
        if (!stream) return;

        const pc = setupPeerConnection(stream, callId);

        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const offer = await pc.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: isVideo,
          } as any);
          await pc.setLocalDescription(offer);

          await signaling.sendCallSignal({
            type: 'offer',
            callId,
            senderDeviceId: localDeviceId,
            isVideo,
            sdp: JSON.stringify(offer),
            timestamp: Date.now(),
          });
          console.log('[useWebRTCCall] Caller generated and broadcasted initial SDP offer');
        } catch (err) {
          console.error('[useWebRTCCall] Error creating SDP offer:', err);
        }
      })();
    }

    // 2. Callee flow: upon answering ('connected'), initialize stream and answer
    if (!isCaller && status === 'connected' && initializedCallIdRef.current !== callId) {
      initializedCallIdRef.current = callId;

      (async () => {
        const stream = await acquireLocalStream(isVideo);
        if (!stream) return;

        const pc = setupPeerConnection(stream, callId);

        if (incomingSdp) {
          try {
            const sdpObj = typeof incomingSdp === 'string' ? JSON.parse(incomingSdp) : incomingSdp;
            await pc.setRemoteDescription(new RTCSessionDescription(sdpObj));
            hasRemoteDescriptionRef.current = true;
            await drainPendingCandidates();

            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            await signaling.sendCallSignal({
              type: 'answer',
              callId,
              senderDeviceId: localDeviceId,
              isVideo,
              sdp: JSON.stringify(answer),
              timestamp: Date.now(),
            });
            console.log('[useWebRTCCall] Callee generated and broadcasted SDP answer');
          } catch (err) {
            console.error('[useWebRTCCall] Error handling incoming SDP on answer:', err);
          }
        } else {
          // No SDP offer received yet, broadcast 'ready' to prompt caller
          console.log('[useWebRTCCall] No incoming SDP yet; broadcasting ready signal to caller');
          await signaling.sendCallSignal({
            type: 'ready',
            callId,
            senderDeviceId: localDeviceId,
            isVideo,
            timestamp: Date.now(),
          });
        }
      })();
    }

    // 3. Signaling listener for in-call WebRTC events
    const unsub = signaling.onCallSignalReceived(async (signal) => {
      if (signal.senderDeviceId === localDeviceId) return;
      if (signal.callId !== callId) return;

      console.log(`[useWebRTCCall] Received call signal [${signal.type}]`);

      // Ready: Caller resends or sends local offer
      if (signal.type === 'ready') {
        if (isCaller && pcRef.current) {
          try {
            let offerSdp = pcRef.current.localDescription;
            if (!offerSdp) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const newOffer = await pcRef.current.createOffer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: isVideo,
              } as any);
              await pcRef.current.setLocalDescription(newOffer);
              offerSdp = newOffer;
            }
            if (offerSdp) {
              await signaling.sendCallSignal({
                type: 'offer',
                callId,
                senderDeviceId: localDeviceId,
                isVideo,
                sdp: JSON.stringify(offerSdp),
                timestamp: Date.now(),
              });
              console.log('[useWebRTCCall] Resent SDP offer in response to ready signal');
            }
          } catch (err) {
            console.warn('[useWebRTCCall] Error responding to ready signal:', err);
          }
        }
      }

      // Offer: Callee receives SDP offer
      if (signal.type === 'offer' && signal.sdp) {
        if (!isCaller && pcRef.current) {
          try {
            const sdpObj = typeof signal.sdp === 'string' ? JSON.parse(signal.sdp) : signal.sdp;
            await pcRef.current.setRemoteDescription(new RTCSessionDescription(sdpObj));
            hasRemoteDescriptionRef.current = true;
            await drainPendingCandidates();

            if (!pcRef.current.localDescription) {
              const answer = await pcRef.current.createAnswer();
              await pcRef.current.setLocalDescription(answer);
              await signaling.sendCallSignal({
                type: 'answer',
                callId,
                senderDeviceId: localDeviceId,
                isVideo,
                sdp: JSON.stringify(answer),
                timestamp: Date.now(),
              });
              console.log('[useWebRTCCall] Answered incoming SDP offer');
            }
          } catch (err) {
            console.warn('[useWebRTCCall] Error processing incoming offer:', err);
          }
        }
      }

      // Answer: Caller receives SDP answer
      if (signal.type === 'answer' && signal.sdp) {
        if (isCaller && pcRef.current && !hasRemoteDescriptionRef.current) {
          try {
            const sdpObj = typeof signal.sdp === 'string' ? JSON.parse(signal.sdp) : signal.sdp;
            await pcRef.current.setRemoteDescription(new RTCSessionDescription(sdpObj));
            hasRemoteDescriptionRef.current = true;
            await drainPendingCandidates();
            console.log('[useWebRTCCall] Caller set remote description from SDP answer');
          } catch (err) {
            console.warn('[useWebRTCCall] Error setting remote answer:', err);
          }
        }
      }

      // ICE Candidate exchange
      if (signal.type === 'ice-candidate' && signal.candidate) {
        try {
          const candObj = typeof signal.candidate === 'string' ? JSON.parse(signal.candidate) : signal.candidate;
          if (!hasRemoteDescriptionRef.current || !pcRef.current?.remoteDescription) {
            pendingCandidatesRef.current.push(candObj);
          } else {
            await pcRef.current.addIceCandidate(new RTCIceCandidate(candObj));
          }
        } catch (err) {
          console.warn('[useWebRTCCall] Error adding ICE candidate:', err);
        }
      }

      // Hangup / Reject
      if (signal.type === 'hangup' || signal.type === 'reject') {
        console.log('[useWebRTCCall] Peer terminated the call');
        cleanup();
        onEndCall();
      }
    });

    return () => {
      unsub();
    };
  }, [
    status,
    callId,
    isVideo,
    isCaller,
    localDeviceId,
    incomingSdp,
    cleanup,
    onEndCall,
  ]);

  // Controls
  const switchCamera = useCallback(() => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (videoTrack && typeof (videoTrack as any)._switchCamera === 'function') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (videoTrack as any)._switchCamera();
        setIsFrontCamera((prev) => !prev);
      }
    }
  }, []);

  const toggleAudio = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioMuted(!audioTrack.enabled);
      }
    }
  }, []);

  const toggleVideo = useCallback(() => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoMuted(!videoTrack.enabled);
      }
    }
  }, []);

  const hangupCall = useCallback(() => {
    if (callId) {
      getSignalingChannel().sendCallSignal({
        type: 'hangup',
        callId,
        senderDeviceId: localDeviceId,
        timestamp: Date.now(),
      }).catch(() => {});
    }
    cleanup();
    onEndCall();
  }, [callId, localDeviceId, cleanup, onEndCall]);

  return {
    localStream,
    remoteStream,
    isConnected,
    isFrontCamera,
    isAudioMuted,
    isVideoMuted,
    switchCamera,
    toggleAudio,
    toggleVideo,
    hangupCall,
  };
}
