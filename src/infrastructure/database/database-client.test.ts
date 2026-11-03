import { describe, it, expect, beforeEach } from 'vitest';
import { DatabaseClient } from './database-client';
import { DatabaseSync } from 'node:sqlite';
import { Place } from '../../domain/places/place';

describe('DatabaseClient', () => {
  let memoryDb: DatabaseSync;
  let client: DatabaseClient;

  beforeEach(() => {
    memoryDb = new DatabaseSync(':memory:');
    client = new DatabaseClient(memoryDb);
    client.initializeTables();
  });

  it('creates tables successfully and provides repositories', async () => {
    const { placeRepo } = client.getRepositories();
    const places = await placeRepo.getAllPlaces();
    expect(places).toEqual([]);
  });

  it('persists and retrieves safe places via placeRepo', async () => {
    const { placeRepo } = client.getRepositories();
    const place = new Place({
      id: 'test-safe-place',
      name: 'San Francisco Base',
      coordinate: { latitude: 37.7749, longitude: -122.4194 },
      radiusMeters: 150,
    });

    await placeRepo.savePlace(place);

    const fetched = await placeRepo.getPlaceById('test-safe-place');
    expect(fetched).not.toBeNull();
    expect(fetched?.name).toBe('San Francisco Base');
    expect(fetched?.coordinate.latitude).toBe(37.7749);
    expect(fetched?.radiusMeters).toBe(150);
  });

  it('deletes safe places via placeRepo', async () => {
    const { placeRepo } = client.getRepositories();
    const place = new Place({
      id: 'place-to-delete',
      name: 'Temporary Point',
      coordinate: { latitude: 37.8, longitude: -122.4 },
      radiusMeters: 50,
    });

    await placeRepo.savePlace(place);
    await placeRepo.deletePlace('place-to-delete');

    const fetched = await placeRepo.getPlaceById('place-to-delete');
    expect(fetched).toBeNull();
  });
});
