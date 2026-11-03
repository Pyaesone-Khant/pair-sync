import type * as LocationType from 'expo-location';
import type * as BatteryType from 'expo-battery';
import { ISignalingPort, LocationTelemetryPayload } from '../../application/ports/signaling';
import { LocationStateMode, LocationTrackingStateMachine } from '../../domain/location/location-state-machine';

export interface ILocationModule {
  requestForegroundPermissionsAsync(): Promise<{ status: string }>;
  requestBackgroundPermissionsAsync(): Promise<{ status: string }>;
  watchPositionAsync(
    options: { accuracy: number; timeInterval: number; distanceInterval: number },
    callback: (location: {
      coords: { latitude: number; longitude: number; speed: number | null };
      timestamp: number;
    }) => void
  ): Promise<{ remove(): void }>;
  Accuracy: {
    High: number;
    Balanced: number;
    Lowest: number;
  };
}

export interface IBatteryModule {
  getBatteryLevelAsync(): Promise<number>;
  getBatteryStateAsync(): Promise<number>;
  BatteryState: {
    UNPLUGGED: number;
    CHARGING: number;
    FULL: number;
  };
}

export interface HardwareLocationEngineDependencies {
  locationModule?: ILocationModule;
  batteryModule?: IBatteryModule;
  signalingPort?: ISignalingPort;
  stateMachine?: LocationTrackingStateMachine;
  onTelemetryUpdated?: (telemetry: {
    coordinate: { latitude: number; longitude: number };
    batteryPercent?: number | null;
    isCharging?: boolean | null;
    motionActivity?: string | null;
  }) => void;
}

/**
 * Production engine binding native device GPS chips and Battery managers to the
 * adaptive battery state machine and blind signaling relay.
 * Adheres to ADR 0003 and Clean Architecture.
 */
export class HardwareLocationEngine {
  private locationModule: ILocationModule | null = null;
  private batteryModule: IBatteryModule | null = null;
  private readonly signalingPort?: ISignalingPort;
  private readonly stateMachine: LocationTrackingStateMachine;
  private readonly onTelemetryUpdated?: HardwareLocationEngineDependencies['onTelemetryUpdated'];

  private watchSubscription: { remove(): void } | null = null;
  private active: boolean = false;

  constructor(deps: HardwareLocationEngineDependencies = {}) {
    if (deps.locationModule) this.locationModule = deps.locationModule;
    if (deps.batteryModule) this.batteryModule = deps.batteryModule;
    this.signalingPort = deps.signalingPort;
    this.stateMachine = deps.stateMachine ?? new LocationTrackingStateMachine();
    this.onTelemetryUpdated = deps.onTelemetryUpdated;
  }

  private async ensureModulesLoaded(): Promise<boolean> {
    if (!this.locationModule) {
      try {
        const Location = await import('expo-location');
        this.locationModule = Location as unknown as ILocationModule;
      } catch (err) {
        console.warn('[HardwareLocationEngine] Failed to load expo-location:', err);
      }
    }
    if (!this.batteryModule) {
      try {
        let isNativeBatteryAvailable = true;
        try {
          const expo = await import('expo');
          if (typeof expo.requireOptionalNativeModule === 'function') {
            const mod = expo.requireOptionalNativeModule('ExpoBattery');
            if (!mod) {
              isNativeBatteryAvailable = false;
            }
          }
        } catch {
          // Fall back gracefully in non-expo environments
        }

        if (isNativeBatteryAvailable) {
          const Battery = await import('expo-battery');
          this.batteryModule = Battery as unknown as IBatteryModule;
        }
      } catch (err) {
        console.warn('[HardwareLocationEngine] Failed to load expo-battery:', err);
      }
    }
    return Boolean(this.locationModule);
  }

  /**
   * Requests foreground & background permissions and attaches the GPS listener.
   */
  public async start(): Promise<boolean> {
    try {
      const loaded = await this.ensureModulesLoaded();
      if (!loaded || !this.locationModule) {
        console.warn('[HardwareLocationEngine] Location module unavailable.');
        return false;
      }

      const fgResult = await this.locationModule.requestForegroundPermissionsAsync();
      if (fgResult.status !== 'granted') {
        console.warn('[HardwareLocationEngine] Foreground location permission denied.');
        return false;
      }

      try {
        await this.locationModule.requestBackgroundPermissionsAsync();
      } catch (bgErr) {
        console.warn('[HardwareLocationEngine] Background location permission skipped or denied:', bgErr);
      }

      const updateInterval = this.stateMachine.getUpdateIntervalSeconds() * 1000;
      const isHighAcc = this.stateMachine.isHighAccuracyGpsActive();

      this.watchSubscription = await this.locationModule.watchPositionAsync(
        {
          accuracy: isHighAcc
            ? this.locationModule.Accuracy.High
            : this.locationModule.Accuracy.Balanced,
          timeInterval: updateInterval,
          distanceInterval: isHighAcc ? 5 : 25,
        },
        async (loc) => {
          await this.handleCoordinateUpdate(loc);
        }
      );

      this.active = true;
      return true;
    } catch (err) {
      console.error('[HardwareLocationEngine] Failed to start hardware location:', err);
      return false;
    }
  }

  /**
   * Processes a new physical GPS coordinate from device hardware.
   */
  private async handleCoordinateUpdate(loc: {
    coords: { latitude: number; longitude: number; speed: number | null };
    timestamp: number;
  }): Promise<void> {
    const { latitude, longitude, speed } = loc.coords;

    // Detect walking/driving motion from hardware GPS speed (m/s)
    let motionActivity = 'Stationary';
    if (speed !== null && speed > 0.8) {
      motionActivity = speed > 5.5 ? 'Driving' : 'Walking';
    }

    // Read real device battery telemetry
    let batteryPercent: number | null = null;
    let isCharging: boolean | null = null;

    if (this.batteryModule) {
      try {
        const level = await this.batteryModule.getBatteryLevelAsync();
        if (typeof level === 'number' && level >= 0) {
          batteryPercent = Math.round(level * 100);
        }
        const state = await this.batteryModule.getBatteryStateAsync();
        isCharging = state === this.batteryModule.BatteryState.CHARGING;
      } catch {
        // Fallback for devices without battery API
      }
    }

    // 1. Update local ephemeral reactive store
    if (this.onTelemetryUpdated) {
      this.onTelemetryUpdated({
        coordinate: { latitude, longitude },
        batteryPercent,
        isCharging,
        motionActivity,
      });
    }

    // 2. Broadcast to peer through blind relay
    if (this.signalingPort) {
      const payload: LocationTelemetryPayload = {
        latitude,
        longitude,
        batteryPercent,
        isCharging,
        motionActivity,
        timestamp: loc.timestamp,
      };
      await this.signalingPort.broadcastLocation(payload);
    }
  }

  /**
   * Stops active hardware GPS watcher.
   */
  public async stop(): Promise<void> {
    if (this.watchSubscription) {
      this.watchSubscription.remove();
      this.watchSubscription = null;
    }
    this.active = false;
  }

  public isRunning(): boolean {
    return this.active;
  }
}
