import { GeographicCoordinate } from '../../domain/places/place';

/**
 * Pure mathematical utilities for Coordinate Interpolation and Bearing computation.
 * Strictly adheres to ADR 0007 and CONTEXT.md ("Coordinate Interpolation").
 */

/**
 * Linearly interpolates between two geographic coordinates with fraction clamped to [0, 1].
 */
export function interpolateCoordinate(
  from: GeographicCoordinate,
  to: GeographicCoordinate,
  fraction: number
): GeographicCoordinate {
  const clampedFraction = Math.max(0, Math.min(1, fraction));
  const latitude = from.latitude + (to.latitude - from.latitude) * clampedFraction;
  const longitude = from.longitude + (to.longitude - from.longitude) * clampedFraction;

  return {
    latitude,
    longitude,
  };
}

/**
 * Computes forward azimuth/bearing in degrees (0° - 360°) from coordinate A to coordinate B.
 */
export function calculateBearingDegrees(
  from: GeographicCoordinate,
  to: GeographicCoordinate
): number {
  const toRadians = (deg: number) => (deg * Math.PI) / 180;
  const toDegrees = (rad: number) => (rad * 180) / Math.PI;

  const lat1 = toRadians(from.latitude);
  const lat2 = toRadians(to.latitude);
  const dLon = toRadians(to.longitude - from.longitude);

  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);

  let bearing = toDegrees(Math.atan2(y, x));
  bearing = (bearing + 360) % 360; // Normalize to 0 - 360

  return bearing;
}

/**
 * Generates N discrete intermediate coordinate steps for continuous avatar motion.
 */
export function createCoordinateSteps(
  from: GeographicCoordinate,
  to: GeographicCoordinate,
  subdivisions: number = 10
): GeographicCoordinate[] {
  const steps: GeographicCoordinate[] = [];
  for (let i = 0; i <= subdivisions; i++) {
    const fraction = i / subdivisions;
    steps.push(interpolateCoordinate(from, to, fraction));
  }
  return steps;
}
