import { describe, it, expect } from 'vitest';
import { calculateProximityRadar } from './radar';

describe('calculateProximityRadar (Radar & Distance Telemetry)', () => {
  it('returns unavailable state when coordinates are missing', () => {
    const result = calculateProximityRadar(null, null);

    expect(result.distanceMeters).toBeNull();
    expect(result.formattedDistance).toBe('Distance unavailable');
    expect(result.walkingEtaMinutes).toBeNull();
    expect(result.drivingEtaMinutes).toBeNull();
  });

  it('calculates accurate distance in meters and formats correctly under 1 km', () => {
    const origin = { latitude: 37.7749, longitude: -122.4194 };
    // ~350m away
    const destination = { latitude: 37.778, longitude: -122.4194 };

    const result = calculateProximityRadar(origin, destination);

    expect(result.distanceMeters).toBeGreaterThan(300);
    expect(result.distanceMeters).toBeLessThan(400);
    expect(result.formattedDistance).toMatch(/\d+ m away/);
    expect(result.walkingEtaMinutes).toBeGreaterThan(0);
  });

  it('formats distance in kilometers when distance exceeds 1 km', () => {
    const origin = { latitude: 37.7749, longitude: -122.4194 };
    // ~3.5 km away
    const destination = { latitude: 37.805, longitude: -122.4194 };

    const result = calculateProximityRadar(origin, destination);

    expect(result.distanceMeters).toBeGreaterThan(3000);
    expect(result.formattedDistance).toMatch(/\d+\.\d+ km away/);
    expect(result.drivingEtaMinutes).toBeGreaterThan(0);
  });
});
