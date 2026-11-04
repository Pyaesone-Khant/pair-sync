import { describe, it, expect, beforeEach } from 'vitest';
import { useCallStore } from './call-store';

describe('useCallStore (ADR 0005 WebRTC Call Session)', () => {
  beforeEach(() => {
    useCallStore.getState().reset();
  });

  it('starts in idle status', () => {
    const state = useCallStore.getState();
    expect(state.status).toBe('idle');
    expect(state.callId).toBeNull();
    expect(state.durationSeconds).toBe(0);
    expect(state.isMuted).toBe(false);
  });

  it('transitions to outgoing_ringing on startOutgoingCall', () => {
    useCallStore.getState().startOutgoingCall('Partner Alice', false);

    const state = useCallStore.getState();
    expect(state.status).toBe('outgoing_ringing');
    expect(state.partnerName).toBe('Partner Alice');
    expect(state.isVideo).toBe(false);
    expect(state.callId).not.toBeNull();
  });

  it('transitions to incoming_ringing on receiveIncomingCall', () => {
    useCallStore.getState().receiveIncomingCall('call-abc-123', 'Partner Bob', true);

    const state = useCallStore.getState();
    expect(state.status).toBe('incoming_ringing');
    expect(state.callId).toBe('call-abc-123');
    expect(state.partnerName).toBe('Partner Bob');
    expect(state.isVideo).toBe(true);
  });

  it('transitions to connected on acceptCall and increments duration', () => {
    useCallStore.getState().receiveIncomingCall('call-abc-123', 'Partner Bob');
    useCallStore.getState().acceptCall();

    let state = useCallStore.getState();
    expect(state.status).toBe('connected');

    useCallStore.getState().incrementDuration();
    state = useCallStore.getState();
    expect(state.durationSeconds).toBe(1);
  });

  it('toggles audio mute and speaker', () => {
    useCallStore.getState().startOutgoingCall('Partner Alice');
    useCallStore.getState().acceptCall();

    useCallStore.getState().toggleMute();
    expect(useCallStore.getState().isMuted).toBe(true);

    useCallStore.getState().toggleSpeaker();
    expect(useCallStore.getState().isSpeakerOn).toBe(true);
  });

  it('ends call and resets to idle', () => {
    useCallStore.getState().startOutgoingCall('Partner Alice');
    useCallStore.getState().acceptCall();
    useCallStore.getState().endCall();

    const state = useCallStore.getState();
    expect(state.status).toBe('ended');

    useCallStore.getState().reset();
    expect(useCallStore.getState().status).toBe('idle');
  });
});
