import { describe, it, expect, beforeEach } from 'vitest';
import { ProcessIncomingLocationUseCase } from './process-incoming-location.usecase';
import { IPlaceRepository } from '../ports/repositories';
import { Place, GeographicCoordinate } from '../../domain/places/place';

class FakePlaceRepository implements IPlaceRepository {
  public places: Place[] = [];
  async getAllPlaces(): Promise<Place[]> {
    return this.places;
  }
  async getPlaceById(id: string): Promise<Place | null> {
    return this.places.find((p) => p.id === id) ?? null;
  }
  async savePlace(place: Place): Promise<void> {
    this.places.push(place);
  }
  async deletePlace(id: string): Promise<void> {
    this.places = this.places.filter((p) => p.id !== id);
  }
}

describe('ProcessIncomingLocationUseCase (ADR 0008 & Geofence Boundary Events)', () => {
  let placeRepo: FakePlaceRepository;
  let useCase: ProcessIncomingLocationUseCase;

  beforeEach(() => {
    placeRepo = new FakePlaceRepository();
    placeRepo.places = [
      new Place({
        id: 'place-home',
        name: 'Home',
        coordinate: { latitude: 37.7749, longitude: -122.4194 },
        radiusMeters: 100,
      }),
      new Place({
        id: 'place-work',
        name: 'Office',
        coordinate: { latitude: 37.7899, longitude: -122.4014 },
        radiusMeters: 150,
      }),
    ];

    useCase = new ProcessIncomingLocationUseCase(placeRepo);
  });

  it('detects when Peer is inside a saved Place', async () => {
    // Coordinate ~20m from Home
    const nearHome: GeographicCoordinate = {
      latitude: 37.775,
      longitude: -122.4194,
    };

    const event = await useCase.execute(nearHome);

    expect(event.matchedPlace).not.toBeNull();
    expect(event.matchedPlace?.name).toBe('Home');
    expect(event.summary).toBe('Peer is at Home');
  });

  it('detects when Peer is in transit outside all saved Places', async () => {
    // Coordinate far away from both Home and Office
    const inTransit: GeographicCoordinate = {
      latitude: 37.78,
      longitude: -122.41,
    };

    const event = await useCase.execute(inTransit);

    expect(event.matchedPlace).toBeNull();
    expect(event.summary).toBe('Peer is in transit');
  });
});
