import { describe, it, expect } from 'vitest';
import {
  LocationTrackingStateMachine,
  LocationStateMode,
} from './location-state-machine';

describe('LocationTrackingStateMachine (ADR 0003)', () => {
  it('initializes in Stationary State with dormant GPS to preserve battery', () => {
    const sm = new LocationTrackingStateMachine();

    expect(sm.getCurrentMode()).toBe(LocationStateMode.Stationary);
    expect(sm.isHighAccuracyGpsActive()).toBe(false);
    expect(sm.getGeofenceRadiusMeters()).toBe(50);
  });

  it('transitions from Stationary to Transit when significant motion is detected', () => {
    const sm = new LocationTrackingStateMachine();

    sm.onMotionActivityChanged({ isMoving: true, confidence: 'high' });

    expect(sm.getCurrentMode()).toBe(LocationStateMode.Transit);
    expect(sm.isHighAccuracyGpsActive()).toBe(true);
    expect(sm.getUpdateIntervalSeconds()).toBe(15);
  });

  it('reverts back to Stationary when movement ceases', () => {
    const sm = new LocationTrackingStateMachine();
    sm.onMotionActivityChanged({ isMoving: true, confidence: 'high' });
    expect(sm.getCurrentMode()).toBe(LocationStateMode.Transit);

    sm.onMotionActivityChanged({ isMoving: false, confidence: 'high' });
    expect(sm.getCurrentMode()).toBe(LocationStateMode.Stationary);
    expect(sm.isHighAccuracyGpsActive()).toBe(false);
  });

  it('escalates to Live Viewing when Peer focuses map viewport', () => {
    const sm = new LocationTrackingStateMachine();
    expect(sm.getCurrentMode()).toBe(LocationStateMode.Stationary);

    sm.onPeerGazeChanged({ isViewing: true });

    expect(sm.getCurrentMode()).toBe(LocationStateMode.LiveViewing);
    expect(sm.isHighAccuracyGpsActive()).toBe(true);
    expect(sm.getUpdateIntervalSeconds()).toBe(3);
  });

  it('reverts back to underlying state when Peer stops viewing', () => {
    const sm = new LocationTrackingStateMachine();
    sm.onMotionActivityChanged({ isMoving: true, confidence: 'high' });
    expect(sm.getCurrentMode()).toBe(LocationStateMode.Transit);

    // Peer starts watching
    sm.onPeerGazeChanged({ isViewing: true });
    expect(sm.getCurrentMode()).toBe(LocationStateMode.LiveViewing);

    // Peer closes map -> reverts to Transit (because still moving)
    sm.onPeerGazeChanged({ isViewing: false });
    expect(sm.getCurrentMode()).toBe(LocationStateMode.Transit);
    expect(sm.getUpdateIntervalSeconds()).toBe(15);
  });
});
