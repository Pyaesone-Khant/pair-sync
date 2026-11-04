export interface GeographicCoordinate {
  latitude: number;
  longitude: number;
}

export interface PlaceProperties {
  id: string;
  name: string;
  coordinate: GeographicCoordinate;
  radiusMeters: number;
  icon?: string;
}

/**
 * Domain entity representing a personal saved Place and its geofence perimeter.
 * Strictly adheres to CONTEXT.md and ADR 0008.
 */
export class Place {
  public readonly id: string;
  public readonly name: string;
  public readonly coordinate: GeographicCoordinate;
  public readonly radiusMeters: number;
  public readonly icon: string;

  constructor(props: PlaceProperties) {
    if (props.radiusMeters <= 0) {
      throw new Error('Perimeter radius must be greater than zero');
    }

    this.id = props.id;
    this.name = props.name.trim();
    this.coordinate = props.coordinate;
    this.radiusMeters = props.radiusMeters;
    this.icon = props.icon || 'location';
  }

  /**
   * Calculates the geodesic distance to a target coordinate using the Haversine formula
   * and checks if it falls within the geofence radius.
   */
  public containsCoordinate(target: GeographicCoordinate): boolean {
    const distance = this.calculateDistanceMeters(this.coordinate, target);
    return distance <= this.radiusMeters;
  }

  /**
   * Haversine formula for calculating spherical distance between two points on Earth.
   */
  private calculateDistanceMeters(
    coord1: GeographicCoordinate,
    coord2: GeographicCoordinate
  ): number {
    const earthRadiusMeters = 6371000;
    const toRadians = (deg: number) => (deg * Math.PI) / 180;

    const deltaLat = toRadians(coord2.latitude - coord1.latitude);
    const deltaLon = toRadians(coord2.longitude - coord1.longitude);

    const lat1 = toRadians(coord1.latitude);
    const lat2 = toRadians(coord2.latitude);

    const a =
      Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
      Math.sin(deltaLon / 2) *
        Math.sin(deltaLon / 2) *
        Math.cos(lat1) *
        Math.cos(lat2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return earthRadiusMeters * c;
  }
}
