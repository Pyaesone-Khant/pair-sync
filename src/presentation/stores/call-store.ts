import { create } from 'zustand';

export type CallStatus =
  | 'idle'
  | 'outgoing_ringing'
  | 'incoming_ringing'
  | 'connected'
  | 'ended';

export interface CallStoreState {
  status: CallStatus;
  callId: string | null;
  partnerName: string;
  isVideo: boolean;
  durationSeconds: number;
  isMuted: boolean;
  isSpeakerOn: boolean;

  startOutgoingCall: (partnerName: string, isVideo?: boolean) => string;
  receiveIncomingCall: (callId: string, partnerName: string, isVideo?: boolean) => void;
  acceptCall: () => void;
  declineCall: () => void;
  endCall: () => void;
  toggleMute: () => void;
  toggleSpeaker: () => void;
  incrementDuration: () => void;
  reset: () => void;
}

export const useCallStore = create<CallStoreState>((set) => ({
  status: 'idle',
  callId: null,
  partnerName: 'My Partner',
  isVideo: false,
  durationSeconds: 0,
  isMuted: false,
  isSpeakerOn: false,

  startOutgoingCall: (partnerName: string, isVideo = false) => {
    const callId = `call_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    set({
      status: 'outgoing_ringing',
      callId,
      partnerName,
      isVideo,
      durationSeconds: 0,
      isMuted: false,
      isSpeakerOn: false,
    });
    return callId;
  },

  receiveIncomingCall: (callId: string, partnerName: string, isVideo = false) => {
    set({
      status: 'incoming_ringing',
      callId,
      partnerName,
      isVideo,
      durationSeconds: 0,
      isMuted: false,
      isSpeakerOn: false,
    });
  },

  acceptCall: () => {
    set({ status: 'connected' });
  },

  declineCall: () => {
    set({ status: 'ended' });
  },

  endCall: () => {
    set({ status: 'ended' });
  },

  toggleMute: () => {
    set((state) => ({ isMuted: !state.isMuted }));
  },

  toggleSpeaker: () => {
    set((state) => ({ isSpeakerOn: !state.isSpeakerOn }));
  },

  incrementDuration: () => {
    set((state) => ({ durationSeconds: state.durationSeconds + 1 }));
  },

  reset: () => {
    set({
      status: 'idle',
      callId: null,
      partnerName: 'My Partner',
      isVideo: false,
      durationSeconds: 0,
      isMuted: false,
      isSpeakerOn: false,
    });
  },
}));
