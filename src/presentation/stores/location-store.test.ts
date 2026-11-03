import { describe, it, expect, beforeEach } from 'vitest';
import { useLocationStore } from './location-store';

describe('useLocationStore (ADR 0009 Ephemeral Streams)', () => {
  beforeEach(() => {
    useLocationStore.getState().reset();
  });

  it('initializes with clean default telemetry states', () => {
    const state = useLocationStore.getState();

    expect(state.myTelemetry.coordinate).toBeNull();
    expect(state.peerTelemetry.coordinate).toBeNull();
    expect(state.isPeerViewingMe).toBe(false);
    expect(state.isFocusingOnPeer).toBe(false);
  });

  it('updates local device telemetry independently', () => {
    useLocationStore.getState().updateMyTelemetry({
      coordinate: { latitude: 37.7749, longitude: -122.4194 },
      batteryPercent: 82,
      isCharging: false,
      motionActivity: 'Walking',
    });

    const state = useLocationStore.getState();
    expect(state.myTelemetry.coordinate?.latitude).toBe(37.7749);
    expect(state.myTelemetry.batteryPercent).toBe(82);
    expect(state.myTelemetry.motionActivity).toBe('Walking');
    expect(state.myTelemetry.timestamp).toBeGreaterThan(0);
  });

  it('updates peer telemetry when receiving real-time coordinate broadcasts', () => {
    useLocationStore.getState().updatePeerTelemetry({
      coordinate: { latitude: 37.7899, longitude: -122.4014 },
      batteryPercent: 14,
      isCharging: true,
      motionActivity: 'Driving',
    });

    const state = useLocationStore.getState();
    expect(state.peerTelemetry.coordinate?.latitude).toBe(37.7899);
    expect(state.peerTelemetry.batteryPercent).toBe(14);
    expect(state.peerTelemetry.isCharging).toBe(true);
    expect(state.peerTelemetry.motionActivity).toBe('Driving');
  });

  it('toggles live gaze tracking states', () => {
    useLocationStore.getState().setPeerViewingMe(true);
    expect(useLocationStore.getState().isPeerViewingMe).toBe(true);

    useLocationStore.getState().setFocusingOnPeer(true);
    expect(useLocationStore.getState().isFocusingOnPeer).toBe(true);
  });
});
