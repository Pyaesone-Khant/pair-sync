import { create } from 'zustand';
import { GeographicCoordinate } from '../../domain/places/place';

export type MotionActivityType = 'Stationary' | 'Walking' | 'Driving';

export interface DeviceTelemetry {
  coordinate: GeographicCoordinate | null;
  batteryPercent: number | null;
  isCharging: boolean;
  motionActivity: MotionActivityType;
  timestamp: number | null;
}

export interface LocationStoreState {
  myTelemetry: DeviceTelemetry;
  peerTelemetry: DeviceTelemetry;
  isPeerViewingMe: boolean;
  isFocusingOnPeer: boolean;

  updateMyTelemetry: (update: Partial<DeviceTelemetry>) => void;
  updatePeerTelemetry: (update: Partial<DeviceTelemetry>) => void;
  setPeerViewingMe: (isViewing: boolean) => void;
  setFocusingOnPeer: (isFocusing: boolean) => void;
  reset: () => void;
}

const defaultTelemetry: DeviceTelemetry = {
  coordinate: null,
  batteryPercent: null,
  isCharging: false,
  motionActivity: 'Stationary',
  timestamp: null,
};

/**
 * Zustand micro-store managing high-frequency ephemeral telemetry streams
 * (GPS coordinates, motion sensors, battery metrics) without causing
 * full-tree React component re-render thrashing.
 * Strictly adheres to ADR 0009 and CONTEXT.md.
 */
export const useLocationStore = create<LocationStoreState>((set) => ({
  myTelemetry: { ...defaultTelemetry },
  peerTelemetry: { ...defaultTelemetry },
  isPeerViewingMe: false,
  isFocusingOnPeer: false,

  updateMyTelemetry: (update) =>
    set((state) => ({
      myTelemetry: {
        ...state.myTelemetry,
        ...update,
        timestamp: update.timestamp ?? Date.now(),
      },
    })),

  updatePeerTelemetry: (update) =>
    set((state) => ({
      peerTelemetry: {
        ...state.peerTelemetry,
        ...update,
        timestamp: update.timestamp ?? Date.now(),
      },
    })),

  setPeerViewingMe: (isViewing) =>
    set(() => ({
      isPeerViewingMe: isViewing,
    })),

  setFocusingOnPeer: (isFocusing) =>
    set(() => ({
      isFocusingOnPeer: isFocusing,
    })),

  reset: () =>
    set(() => ({
      myTelemetry: { ...defaultTelemetry },
      peerTelemetry: { ...defaultTelemetry },
      isPeerViewingMe: false,
      isFocusingOnPeer: false,
    })),
}));
