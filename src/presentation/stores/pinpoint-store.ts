import { create } from 'zustand';

export interface PinpointParams {
  coordinate: { latitude: number; longitude: number };
  radiusMeters: number;
  placeName?: string;
  icon?: string;
  onConfirm: (coordinate: { latitude: number; longitude: number }, radiusMeters: number) => void;
  onCancel?: () => void;
}

export interface PinpointStoreState {
  isOpen: boolean;
  initialCoordinate: { latitude: number; longitude: number };
  currentCoordinate: { latitude: number; longitude: number };
  radiusMeters: number;
  placeName?: string;
  icon?: string;
  onConfirmCallback:
    | ((coordinate: { latitude: number; longitude: number }, radiusMeters: number) => void)
    | null;
  onCancelCallback: (() => void) | null;

  openPinpoint: (params: PinpointParams) => void;
  setCoordinate: (coordinate: { latitude: number; longitude: number }) => void;
  setRadiusMeters: (radiusMeters: number) => void;
  confirmPinpoint: () => void;
  closePinpoint: () => void;
  reset: () => void;
}

const DEFAULT_COORDINATE = { latitude: 16.8052, longitude: 96.1561 };

export const usePinpointStore = create<PinpointStoreState>((set, get) => ({
  isOpen: false,
  initialCoordinate: DEFAULT_COORDINATE,
  currentCoordinate: DEFAULT_COORDINATE,
  radiusMeters: 100,
  placeName: undefined,
  icon: undefined,
  onConfirmCallback: null,
  onCancelCallback: null,

  openPinpoint: (params: PinpointParams) => {
    set({
      isOpen: true,
      initialCoordinate: params.coordinate,
      currentCoordinate: params.coordinate,
      radiusMeters: params.radiusMeters,
      placeName: params.placeName,
      icon: params.icon,
      onConfirmCallback: params.onConfirm,
      onCancelCallback: params.onCancel ?? null,
    });
  },

  setCoordinate: (coordinate) => {
    set({ currentCoordinate: coordinate });
  },

  setRadiusMeters: (radiusMeters) => {
    set({ radiusMeters });
  },

  confirmPinpoint: () => {
    const { onConfirmCallback, currentCoordinate, radiusMeters } = get();
    if (onConfirmCallback) {
      onConfirmCallback(currentCoordinate, radiusMeters);
    }
    set({
      isOpen: false,
      onConfirmCallback: null,
      onCancelCallback: null,
    });
  },

  closePinpoint: () => {
    const { onCancelCallback } = get();
    if (onCancelCallback) {
      onCancelCallback();
    }
    set({
      isOpen: false,
      onConfirmCallback: null,
      onCancelCallback: null,
    });
  },

  reset: () => {
    set({
      isOpen: false,
      initialCoordinate: DEFAULT_COORDINATE,
      currentCoordinate: DEFAULT_COORDINATE,
      radiusMeters: 100,
      placeName: undefined,
      icon: undefined,
      onConfirmCallback: null,
      onCancelCallback: null,
    });
  },
}));
