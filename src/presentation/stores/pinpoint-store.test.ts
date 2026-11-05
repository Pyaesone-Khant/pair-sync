import { describe, it, expect, beforeEach, vi } from 'vitest';
import { usePinpointStore } from './pinpoint-store';

describe('PinpointStore', () => {
  beforeEach(() => {
    usePinpointStore.getState().reset();
  });

  it('initializes with default closed state', () => {
    const state = usePinpointStore.getState();
    expect(state.isOpen).toBe(false);
    expect(state.radiusMeters).toBe(100);
    expect(state.onConfirmCallback).toBeNull();
    expect(state.onCancelCallback).toBeNull();
  });

  it('opens pinpoint mode with custom params', () => {
    const testCoord = { latitude: 16.85, longitude: 96.18 };
    const onConfirmMock = vi.fn();
    const onCancelMock = vi.fn();

    usePinpointStore.getState().openPinpoint({
      coordinate: testCoord,
      radiusMeters: 250,
      placeName: 'Gym',
      icon: 'barbell',
      onConfirm: onConfirmMock,
      onCancel: onCancelMock,
    });

    const state = usePinpointStore.getState();
    expect(state.isOpen).toBe(true);
    expect(state.currentCoordinate).toEqual(testCoord);
    expect(state.initialCoordinate).toEqual(testCoord);
    expect(state.radiusMeters).toBe(250);
    expect(state.placeName).toBe('Gym');
    expect(state.icon).toBe('barbell');
  });

  it('updates coordinates when setCoordinate is called', () => {
    usePinpointStore.getState().openPinpoint({
      coordinate: { latitude: 10, longitude: 20 },
      radiusMeters: 100,
      onConfirm: vi.fn(),
    });

    const newCoord = { latitude: 11.5, longitude: 22.3 };
    usePinpointStore.getState().setCoordinate(newCoord);

    expect(usePinpointStore.getState().currentCoordinate).toEqual(newCoord);
  });

  it('updates radius when setRadiusMeters is called', () => {
    usePinpointStore.getState().setRadiusMeters(500);
    expect(usePinpointStore.getState().radiusMeters).toBe(500);
  });

  it('invokes callback and closes upon confirmPinpoint', () => {
    const onConfirmMock = vi.fn();
    const initialCoord = { latitude: 16.8, longitude: 96.1 };
    const updatedCoord = { latitude: 16.82, longitude: 96.15 };

    usePinpointStore.getState().openPinpoint({
      coordinate: initialCoord,
      radiusMeters: 150,
      onConfirm: onConfirmMock,
    });

    usePinpointStore.getState().setCoordinate(updatedCoord);
    usePinpointStore.getState().setRadiusMeters(300);

    usePinpointStore.getState().confirmPinpoint();

    expect(onConfirmMock).toHaveBeenCalledWith(updatedCoord, 300);
    expect(usePinpointStore.getState().isOpen).toBe(false);
    expect(usePinpointStore.getState().onConfirmCallback).toBeNull();
  });

  it('invokes onCancel and closes when closePinpoint is called', () => {
    const onConfirmMock = vi.fn();
    const onCancelMock = vi.fn();
    usePinpointStore.getState().openPinpoint({
      coordinate: { latitude: 16.8, longitude: 96.1 },
      radiusMeters: 150,
      onConfirm: onConfirmMock,
      onCancel: onCancelMock,
    });

    usePinpointStore.getState().closePinpoint();

    expect(onConfirmMock).not.toHaveBeenCalled();
    expect(onCancelMock).toHaveBeenCalled();
    expect(usePinpointStore.getState().isOpen).toBe(false);
  });
});
