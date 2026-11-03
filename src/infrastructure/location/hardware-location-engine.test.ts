import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HardwareLocationEngine } from './hardware-location-engine';
import { LocationStateMode, LocationTrackingStateMachine } from '../../domain/location/location-state-machine';

describe('HardwareLocationEngine (ADR 0003 & Live GPS Engine)', () => {
  let mockLocationModule: any;
  let mockBatteryModule: any;
  let mockSignalingPort: any;
  let mockStoreUpdate: any;
  let stateMachine: LocationTrackingStateMachine;

  beforeEach(() => {
    stateMachine = new LocationTrackingStateMachine();

    mockLocationModule = {
      requestForegroundPermissionsAsync: vi.fn(() =>
        Promise.resolve({ status: 'granted' })
      ),
      requestBackgroundPermissionsAsync: vi.fn(() =>
        Promise.resolve({ status: 'granted' })
      ),
      watchPositionAsync: vi.fn((_options, callback) => {
        // Return a mock subscription with remove method
        return Promise.resolve({
          remove: vi.fn(),
          triggerMockUpdate: (coords: { latitude: number; longitude: number; speed?: number }) => {
            callback({
              coords: {
                latitude: coords.latitude,
                longitude: coords.longitude,
                speed: coords.speed ?? 1.2,
                heading: 0,
                altitude: 10,
                accuracy: 5,
              },
              timestamp: Date.now(),
            });
          },
        });
      }),
      Accuracy: {
        High: 5,
        Balanced: 3,
        Lowest: 1,
      },
    };

    mockBatteryModule = {
      getBatteryLevelAsync: vi.fn(() => Promise.resolve(0.85)),
      getBatteryStateAsync: vi.fn(() => Promise.resolve(2)), // 2 = charging in expo-battery
      BatteryState: {
        UNPLUGGED: 1,
        CHARGING: 2,
        FULL: 3,
      },
    };

    mockSignalingPort = {
      broadcastLocation: vi.fn(() => Promise.resolve()),
    };

    mockStoreUpdate = vi.fn();
  });

  it('requests foreground and background permissions on start', async () => {
    const engine = new HardwareLocationEngine({
      locationModule: mockLocationModule,
      batteryModule: mockBatteryModule,
      signalingPort: mockSignalingPort,
      onTelemetryUpdated: mockStoreUpdate,
      stateMachine,
    });

    const success = await engine.start();

    expect(success).toBe(true);
    expect(mockLocationModule.requestForegroundPermissionsAsync).toHaveBeenCalled();
    expect(mockLocationModule.requestBackgroundPermissionsAsync).toHaveBeenCalled();
  });

  it('updates local store and broadcasts location when hardware GPS emits coordinate', async () => {
    const engine = new HardwareLocationEngine({
      locationModule: mockLocationModule,
      batteryModule: mockBatteryModule,
      signalingPort: mockSignalingPort,
      onTelemetryUpdated: mockStoreUpdate,
      stateMachine,
    });

    await engine.start();

    // Trigger mock GPS coordinate
    const subscription = await mockLocationModule.watchPositionAsync.mock.results[0].value;
    subscription.triggerMockUpdate({ latitude: 37.7749, longitude: -122.4194, speed: 1.5 });

    // Allow promise ticks for battery reading
    await new Promise((r) => setTimeout(r, 10));

    expect(mockStoreUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        coordinate: { latitude: 37.7749, longitude: -122.4194 },
        batteryPercent: 85,
        isCharging: true,
      })
    );

    expect(mockSignalingPort.broadcastLocation).toHaveBeenCalledWith(
      expect.objectContaining({
        latitude: 37.7749,
        longitude: -122.4194,
        batteryPercent: 85,
        isCharging: true,
      })
    );
  });

  it('stops subscription cleanly when stopped', async () => {
    const engine = new HardwareLocationEngine({
      locationModule: mockLocationModule,
      batteryModule: mockBatteryModule,
      signalingPort: mockSignalingPort,
      onTelemetryUpdated: mockStoreUpdate,
      stateMachine,
    });

    await engine.start();
    const subscription = await mockLocationModule.watchPositionAsync.mock.results[0].value;

    await engine.stop();

    expect(subscription.remove).toHaveBeenCalled();
    expect(engine.isRunning()).toBe(false);
  });
});
