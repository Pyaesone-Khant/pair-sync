/**
 * Domain representation of location tracking operating modes.
 * Strictly adheres to CONTEXT.md and ADR 0003.
 */
export enum LocationStateMode {
  Stationary = 'Stationary',
  Transit = 'Transit',
  LiveViewing = 'LiveViewing',
}

export interface MotionActivity {
  isMoving: boolean;
  confidence: 'low' | 'medium' | 'high';
}

export interface PeerGazeState {
  isViewing: boolean;
}

/**
 * Adaptive Location Tracking State Machine.
 *
 * Balances all-day battery consumption (<5%) with instant high-accuracy
 * tracking when the paired Peer is actively viewing the map.
 */
export class LocationTrackingStateMachine {
  private currentMode: LocationStateMode = LocationStateMode.Stationary;
  private underlyingMode: LocationStateMode = LocationStateMode.Stationary;
  private isPeerViewing = false;

  /**
   * Returns the currently active operational mode.
   */
  public getCurrentMode(): LocationStateMode {
    return this.currentMode;
  }

  /**
   * Determines whether high-accuracy GPS hardware should be energized.
   */
  public isHighAccuracyGpsActive(): boolean {
    return this.currentMode !== LocationStateMode.Stationary;
  }

  /**
   * Gets the recommended GPS sampling interval in seconds based on current mode.
   */
  public getUpdateIntervalSeconds(): number {
    switch (this.currentMode) {
      case LocationStateMode.LiveViewing:
        return 3;
      case LocationStateMode.Transit:
        return 15;
      case LocationStateMode.Stationary:
      default:
        return 300;
    }
  }

  /**
   * Gets the perimeter radius in meters for the dormant stationary geofence.
   */
  public getGeofenceRadiusMeters(): number {
    return 50;
  }

  /**
   * Evaluates hardware accelerometer/motion sensor changes.
   */
  public onMotionActivityChanged(activity: MotionActivity): void {
    this.underlyingMode = activity.isMoving
      ? LocationStateMode.Transit
      : LocationStateMode.Stationary;

    if (!this.isPeerViewing) {
      this.currentMode = this.underlyingMode;
    }
  }

  /**
   * Evaluates Peer map viewport focus signals received over the signaling channel.
   */
  public onPeerGazeChanged(gaze: PeerGazeState): void {
    this.isPeerViewing = gaze.isViewing;

    if (this.isPeerViewing) {
      this.currentMode = LocationStateMode.LiveViewing;
    } else {
      this.currentMode = this.underlyingMode;
    }
  }
}
