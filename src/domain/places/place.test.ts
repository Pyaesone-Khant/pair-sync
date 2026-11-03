import { describe, it, expect } from 'vitest';
import { Place, GeographicCoordinate } from './place';

describe('Place Entity & Boundary Calculation (ADR 0008)', () => {
  const homeCoordinate: GeographicCoordinate = {
    latitude: 37.7749,
    longitude: -122.4194,
  };

  it('instantiates a valid Place with name, coordinate, and perimeter radius', () => {
    const home = new Place({
      id: 'place-1',
      name: 'Home',
      coordinate: homeCoordinate,
      radiusMeters: 100,
    });

    expect(home.id).toBe('place-1');
    expect(home.name).toBe('Home');
    expect(home.radiusMeters).toBe(100);
  });

  it('rejects place creation with invalid radius <= 0', () => {
    expect(() => {
      new Place({
        id: 'place-invalid',
        name: 'Invalid Place',
        coordinate: homeCoordinate,
        radiusMeters: 0,
      });
    }).toThrow('Perimeter radius must be greater than zero');
  });

  it('correctly detects when a coordinate is inside the boundary perimeter', () => {
    const home = new Place({
      id: 'place-1',
      name: 'Home',
      coordinate: homeCoordinate,
      radiusMeters: 100,
    });

    // A point ~30 meters away
    const insidePoint: GeographicCoordinate = {
      latitude: 37.7751,
      longitude: -122.4194,
    };

    expect(home.containsCoordinate(insidePoint)).toBe(true);
  });

  it('correctly detects when a coordinate is outside the boundary perimeter', () => {
    const home = new Place({
      id: 'place-1',
      name: 'Home',
      coordinate: homeCoordinate,
      radiusMeters: 100,
    });

    // A point ~500 meters away
    const outsidePoint: GeographicCoordinate = {
      latitude: 37.7800,
      longitude: -122.4194,
    };

    expect(home.containsCoordinate(outsidePoint)).toBe(false);
  });
});
