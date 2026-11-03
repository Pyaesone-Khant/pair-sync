import { GeographicCoordinate } from '../../domain/places/place';

export interface ProximityRadarResult {
  distanceMeters: number | null;
  formattedDistance: string;
  walkingEtaMinutes: number | null;
  drivingEtaMinutes: number | null;
}

/**
 * Calculates geodesic distance and estimated arrival times (ETA) between
 * the user and their paired peer.
 */
export function calculateProximityRadar(
  origin: GeographicCoordinate | null,
  destination: GeographicCoordinate | null
): ProximityRadarResult {
  if (!origin || !destination) {
    return {
      distanceMeters: null,
      formattedDistance: 'Distance unavailable',
      walkingEtaMinutes: null,
      drivingEtaMinutes: null,
    };
  }

  const earthRadiusMeters = 6371000;
  const toRadians = (deg: number) => (deg * Math.PI) / 180;

  const deltaLat = toRadians(destination.latitude - origin.latitude);
  const deltaLon = toRadians(destination.longitude - origin.longitude);

  const lat1 = toRadians(origin.latitude);
  const lat2 = toRadians(destination.latitude);

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.sin(deltaLon / 2) *
      Math.sin(deltaLon / 2) *
      Math.cos(lat1) *
      Math.cos(lat2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distanceMeters = Math.round(earthRadiusMeters * c);

  let formattedDistance = '';
  if (distanceMeters < 1000) {
    formattedDistance = `${distanceMeters} m away`;
  } else {
    formattedDistance = `${(distanceMeters / 1000).toFixed(1)} km away`;
  }

  // Walking: ~4.5 km/h = 75 m/min
  const walkingEtaMinutes = Math.max(1, Math.ceil(distanceMeters / 75));

  // Urban Driving: ~35 km/h = 583 m/min
  const drivingEtaMinutes = Math.max(1, Math.ceil(distanceMeters / 583));

  return {
    distanceMeters,
    formattedDistance,
    walkingEtaMinutes,
    drivingEtaMinutes,
  };
}
