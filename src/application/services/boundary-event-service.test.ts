import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BoundaryEventService } from './boundary-event-service';
import { Place } from '../../domain/places/place';
import { IPlaceRepository } from '../ports/repositories';
import { ISignalingPort } from '../ports/signaling';

class FakePlaceRepo implements IPlaceRepository {
  constructor(public places: Place[] = []) {}
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

describe('BoundaryEventService (ADR 0008 Client-Side Geofencing)', () => {
  let placeRepo: FakePlaceRepo;
  let homePlace: Place;
  let workPlace: Place;
  let service: BoundaryEventService;

  beforeEach(() => {
    // Home: 37.7749, -122.4194 (radius 100m)
    homePlace = new Place({
      id: 'place-home',
      name: 'Home',
      coordinate: { latitude: 37.7749, longitude: -122.4194 },
      radiusMeters: 100,
    });

    // Work: 37.7899, -122.4014 (radius 150m)
    workPlace = new Place({
      id: 'place-work',
      name: 'Office',
      coordinate: { latitude: 37.7899, longitude: -122.4014 },
      radiusMeters: 150,
    });

    placeRepo = new FakePlaceRepo([homePlace, workPlace]);
    service = new BoundaryEventService(placeRepo);
  });

  it('detects arrival when moving from outside to inside a place perimeter', async () => {
    const onEvent = vi.fn();
    service.onBoundaryEvent(onEvent);

    // Initial position far outside home: ~1 km away (37.7833, -122.4167)
    await service.evaluateCoordinateChange('peer', { latitude: 37.7833, longitude: -122.4167 });
    expect(onEvent).not.toHaveBeenCalled();

    // Now peer moves right into home center: (37.7749, -122.4194)
    await service.evaluateCoordinateChange('peer', { latitude: 37.7749, longitude: -122.4194 });

    expect(onEvent).toHaveBeenCalledTimes(1);
    const event = onEvent.mock.calls[0][0];
    expect(event.type).toBe('arrived');
    expect(event.placeName).toBe('Home');
    expect(event.subject).toBe('peer');
  });

  it('detects departure when moving from inside to outside a place perimeter', async () => {
    const onEvent = vi.fn();
    service.onBoundaryEvent(onEvent);

    // Initial position inside Home
    await service.evaluateCoordinateChange('peer', { latitude: 37.7749, longitude: -122.4194 });
    // First evaluation inside registers presence without spurious arrival
    onEvent.mockClear();

    // Now moves outside Home: 1 km away
    await service.evaluateCoordinateChange('peer', { latitude: 37.7833, longitude: -122.4167 });

    expect(onEvent).toHaveBeenCalledTimes(1);
    const event = onEvent.mock.calls[0][0];
    expect(event.type).toBe('departed');
    expect(event.placeName).toBe('Home');
    expect(event.subject).toBe('peer');
  });

  it('does not trigger duplicate events while remaining inside perimeter', async () => {
    const onEvent = vi.fn();
    service.onBoundaryEvent(onEvent);

    // Move into office
    await service.evaluateCoordinateChange('me', { latitude: 37.7899, longitude: -122.4014 });
    onEvent.mockClear();

    // Small move inside office (10 meters away, still inside 150m)
    await service.evaluateCoordinateChange('me', { latitude: 37.78995, longitude: -122.40145 });

    expect(onEvent).not.toHaveBeenCalled();
  });
});
