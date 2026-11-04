import { describe, it, expect, beforeEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { Pair, PairStatus } from '../../domain/pairing/pair';
import { Place } from '../../domain/places/place';
import { CiphertextEnvelope } from '../../domain/messaging/ciphertext-envelope';
import {
  SqliteDatabaseAdapter,
  SqlitePairRepository,
  SqliteMessageRepository,
  SqlitePlaceRepository,
} from './sqlite-repositories';

describe('Local-First SQLite Repositories (ADR 0004 & ADR 0009)', () => {
  let db: DatabaseSync;
  let adapter: SqliteDatabaseAdapter;
  let pairRepo: SqlitePairRepository;
  let messageRepo: SqliteMessageRepository;
  let placeRepo: SqlitePlaceRepository;

  beforeEach(() => {
    db = new DatabaseSync(':memory:');
    adapter = new SqliteDatabaseAdapter(db);

    // Initialize table schemas
    db.exec(`
      CREATE TABLE pairs (
        id TEXT PRIMARY KEY,
        local_device_id TEXT NOT NULL,
        peer_device_id TEXT NOT NULL,
        peer_public_key TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE messages (
        id TEXT PRIMARY KEY,
        sender_device_id TEXT NOT NULL,
        recipient_device_id TEXT NOT NULL,
        iv TEXT NOT NULL,
        ciphertext TEXT NOT NULL,
        sequence_number INTEGER NOT NULL,
        ratchet_public_key TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        delivery_status TEXT NOT NULL,
        direction TEXT NOT NULL
      );

      CREATE TABLE places (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        radius_meters REAL NOT NULL,
        created_at INTEGER NOT NULL
      );
    `);

    pairRepo = new SqlitePairRepository(adapter);
    messageRepo = new SqliteMessageRepository(adapter);
    placeRepo = new SqlitePlaceRepository(adapter);
  });

  describe('SqlitePairRepository', () => {
    it('saves and retrieves active Pair entity', async () => {
      const pair = new Pair({
        id: 'pair-1',
        localDeviceId: 'dev-alice',
        peerDeviceId: 'dev-bob',
        peerPublicKey: 'bob-key-pub',
      });

      await pairRepo.savePair(pair);

      // Initially PendingHandshake
      const initial = await pairRepo.getActivePair();
      expect(initial).toBeNull();

      // Activate pair
      await pairRepo.updatePairStatus('pair-1', PairStatus.Active);

      const active = await pairRepo.getActivePair();
      expect(active).not.toBeNull();
      expect(active?.id).toBe('pair-1');
      expect(active?.status).toBe(PairStatus.Active);
      expect(active?.peerDeviceId).toBe('dev-bob');
    });

    it('retrieves all pairs and returns accurate total pair count', async () => {
      expect(await pairRepo.getPairCount()).toBe(0);

      const pair1 = new Pair({
        id: 'pair-1',
        localDeviceId: 'dev-alice',
        peerDeviceId: 'dev-bob',
        peerPublicKey: 'bob-key-pub',
      });
      const pair2 = new Pair({
        id: 'pair-2',
        localDeviceId: 'dev-alice',
        peerDeviceId: 'dev-carol',
        peerPublicKey: 'carol-key-pub',
      });

      await pairRepo.savePair(pair1);
      await pairRepo.savePair(pair2);

      const all = await pairRepo.getAllPairs();
      expect(all).toHaveLength(2);
      expect(await pairRepo.getPairCount()).toBe(2);
    });

    it('deletes a pair record and decrements total pair count', async () => {
      const pair = new Pair({
        id: 'pair-to-delete',
        localDeviceId: 'dev-alice',
        peerDeviceId: 'dev-bob',
        peerPublicKey: 'bob-key-pub',
      });
      pair.activate();
      await pairRepo.savePair(pair);

      expect(await pairRepo.getPairCount()).toBe(1);
      expect(await pairRepo.getActivePair()).not.toBeNull();

      await pairRepo.deletePair('pair-to-delete');

      expect(await pairRepo.getPairCount()).toBe(0);
      expect(await pairRepo.getActivePair()).toBeNull();
    });
  });

  describe('SqliteMessageRepository', () => {
    it('persists encrypted CiphertextEnvelopes and retrieves them chronologically', async () => {
      const env1 = new CiphertextEnvelope({
        id: 'msg-1',
        senderDeviceId: 'dev-alice',
        recipientDeviceId: 'dev-bob',
        iv: 'aXYx',
        ciphertext: 'Y2lwaGVyMQ==',
        sequenceNumber: 0,
        ratchetPublicKey: 'cmF0Y2hldDE=',
        timestamp: 1000,
      });

      const env2 = new CiphertextEnvelope({
        id: 'msg-2',
        senderDeviceId: 'dev-bob',
        recipientDeviceId: 'dev-alice',
        iv: 'aXYy',
        ciphertext: 'Y2lwaGVyMg==',
        sequenceNumber: 1,
        ratchetPublicKey: 'cmF0Y2hldDI=',
        timestamp: 2000,
      });

      await messageRepo.saveEnvelope(env1, 'outgoing');
      await messageRepo.saveEnvelope(env2, 'incoming');

      const recent = await messageRepo.getRecentEnvelopes(10);
      expect(recent.length).toBe(2);
      expect(recent[0].id).toBe('msg-1');
      expect(recent[1].id).toBe('msg-2');
    });

    it('marks envelope as delivered', async () => {
      const env = new CiphertextEnvelope({
        id: 'msg-10',
        senderDeviceId: 'dev-alice',
        recipientDeviceId: 'dev-bob',
        iv: 'aXYx',
        ciphertext: 'Y2lwaGVy',
        sequenceNumber: 0,
        ratchetPublicKey: 'cmF0Y2hldA==',
        timestamp: 1000,
      });

      await messageRepo.saveEnvelope(env, 'outgoing');
      await expect(messageRepo.markDelivered('msg-10')).resolves.not.toThrow();
    });
  });

  describe('SqlitePlaceRepository', () => {
    it('saves, queries, and deletes geofenced Places', async () => {
      const home = new Place({
        id: 'place-home',
        name: 'Home',
        coordinate: { latitude: 37.7749, longitude: -122.4194 },
        radiusMeters: 80,
      });

      const office = new Place({
        id: 'place-office',
        name: 'Office',
        coordinate: { latitude: 37.7899, longitude: -122.4014 },
        radiusMeters: 120,
      });

      await placeRepo.savePlace(home);
      await placeRepo.savePlace(office);

      const allPlaces = await placeRepo.getAllPlaces();
      expect(allPlaces.length).toBe(2);
      expect(allPlaces.map((p) => p.name)).toContain('Home');
      expect(allPlaces.map((p) => p.name)).toContain('Office');

      const fetched = await placeRepo.getPlaceById('place-home');
      expect(fetched?.name).toBe('Home');
      expect(fetched?.radiusMeters).toBe(80);

      await placeRepo.deletePlace('place-home');
      const remaining = await placeRepo.getAllPlaces();
      expect(remaining.length).toBe(1);
      expect(remaining[0].name).toBe('Office');
    });
  });
});
