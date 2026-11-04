import {
  IPairRepository,
  IMessageRepository,
  IPlaceRepository,
} from '../../application/ports/repositories';
import { Pair, PairStatus } from '../../domain/pairing/pair';
import { Place } from '../../domain/places/place';
import { CiphertextEnvelope } from '../../domain/messaging/ciphertext-envelope';

/**
 * Interface unifying SQLite execution across node:sqlite (unit testing)
 * and expo-sqlite (native device runtime).
 */
export interface ISqliteExecutor {
  exec(sql: string): void;
  run(sql: string, params?: unknown[]): void;
  all<T>(sql: string, params?: unknown[]): T[];
  get<T>(sql: string, params?: unknown[]): T | null;
}

/**
 * Universal adapter for SQLite engines supporting prepared statements.
 */
export class SqliteDatabaseAdapter implements ISqliteExecutor {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(private readonly engine: any) {}

  public exec(sql: string): void {
    if (typeof this.engine.exec === 'function') {
      this.engine.exec(sql);
    } else if (typeof this.engine.execSync === 'function') {
      this.engine.execSync(sql);
    }
  }

  public run(sql: string, params: unknown[] = []): void {
    if (typeof this.engine.prepare === 'function') {
      const stmt = this.engine.prepare(sql);
      stmt.run(...params);
    } else if (typeof this.engine.runSync === 'function') {
      this.engine.runSync(sql, params);
    }
  }

  public all<T>(sql: string, params: unknown[] = []): T[] {
    if (typeof this.engine.prepare === 'function') {
      const stmt = this.engine.prepare(sql);
      return stmt.all(...params) as T[];
    } else if (typeof this.engine.getAllSync === 'function') {
      return this.engine.getAllSync(sql, params) as T[];
    }
    return [];
  }

  public get<T>(sql: string, params: unknown[] = []): T | null {
    if (typeof this.engine.prepare === 'function') {
      const stmt = this.engine.prepare(sql);
      const res = stmt.get(...params);
      return (res as T) ?? null;
    } else if (typeof this.engine.getFirstSync === 'function') {
      const res = this.engine.getFirstSync(sql, params);
      return (res as T) ?? null;
    }
    return null;
  }
}

/**
 * SQLite implementation of IPairRepository.
 */
export class SqlitePairRepository implements IPairRepository {
  constructor(private readonly db: ISqliteExecutor) {}

  public async getActivePair(): Promise<Pair | null> {
    interface PairRow {
      id: string;
      local_device_id: string;
      peer_device_id: string;
      peer_public_key: string;
      status: string;
      created_at: number;
    }

    const row = this.db.get<PairRow>(
      'SELECT * FROM pairs WHERE status = ? LIMIT 1',
      [PairStatus.Active]
    );

    if (!row) return null;

    return new Pair({
      id: row.id,
      localDeviceId: row.local_device_id,
      peerDeviceId: row.peer_device_id,
      peerPublicKey: row.peer_public_key,
      status: row.status as PairStatus,
      createdAt: row.created_at,
    });
  }

  public async getAllPairs(): Promise<Pair[]> {
    interface PairRow {
      id: string;
      local_device_id: string;
      peer_device_id: string;
      peer_public_key: string;
      status: string;
      created_at: number;
    }

    const rows = this.db.all<PairRow>(
      'SELECT * FROM pairs ORDER BY created_at DESC'
    );

    return rows.map(
      (row) =>
        new Pair({
          id: row.id,
          localDeviceId: row.local_device_id,
          peerDeviceId: row.peer_device_id,
          peerPublicKey: row.peer_public_key,
          status: row.status as PairStatus,
          createdAt: row.created_at,
        })
    );
  }

  public async getPairCount(): Promise<number> {
    const row = this.db.get<{ count: number }>(
      'SELECT COUNT(*) as count FROM pairs'
    );
    return row?.count ?? 0;
  }

  public async savePair(pair: Pair): Promise<void> {
    this.db.run(
      `INSERT OR REPLACE INTO pairs (id, local_device_id, peer_device_id, peer_public_key, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        pair.id,
        pair.localDeviceId,
        pair.peerDeviceId,
        pair.peerPublicKey,
        pair.status,
        pair.createdAt,
      ]
    );
  }

  public async updatePairStatus(id: string, status: PairStatus): Promise<void> {
    this.db.run('UPDATE pairs SET status = ? WHERE id = ?', [status, id]);
  }
}

/**
 * SQLite implementation of IMessageRepository.
 */
export class SqliteMessageRepository implements IMessageRepository {
  constructor(private readonly db: ISqliteExecutor) {}

  public async saveEnvelope(
    envelope: CiphertextEnvelope,
    direction: 'incoming' | 'outgoing'
  ): Promise<void> {
    this.db.run(
      `INSERT OR REPLACE INTO messages
       (id, sender_device_id, recipient_device_id, iv, ciphertext, sequence_number, ratchet_public_key, timestamp, delivery_status, direction)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        envelope.id,
        envelope.senderDeviceId,
        envelope.recipientDeviceId,
        envelope.iv,
        envelope.ciphertext,
        envelope.sequenceNumber,
        envelope.ratchetPublicKey,
        envelope.timestamp,
        'pending',
        direction,
      ]
    );
  }

  public async getRecentEnvelopes(limit = 50): Promise<CiphertextEnvelope[]> {
    interface MessageRow {
      id: string;
      sender_device_id: string;
      recipient_device_id: string;
      iv: string;
      ciphertext: string;
      sequence_number: number;
      ratchet_public_key: string;
      timestamp: number;
    }

    const rows = this.db.all<MessageRow>(
      'SELECT * FROM messages ORDER BY timestamp ASC LIMIT ?',
      [limit]
    );

    return rows.map(
      (r) =>
        new CiphertextEnvelope({
          id: r.id,
          senderDeviceId: r.sender_device_id,
          recipientDeviceId: r.recipient_device_id,
          iv: r.iv,
          ciphertext: r.ciphertext,
          sequenceNumber: r.sequence_number,
          ratchetPublicKey: r.ratchet_public_key,
          timestamp: r.timestamp,
        })
    );
  }

  public async markDelivered(id: string): Promise<void> {
    this.db.run('UPDATE messages SET delivery_status = ? WHERE id = ?', [
      'delivered',
      id,
    ]);
  }
}

/**
 * SQLite implementation of IPlaceRepository.
 */
export class SqlitePlaceRepository implements IPlaceRepository {
  constructor(private readonly db: ISqliteExecutor) {}

  public async getAllPlaces(): Promise<Place[]> {
    interface PlaceRow {
      id: string;
      name: string;
      latitude: number;
      longitude: number;
      radius_meters: number;
    }

    const rows = this.db.all<PlaceRow>('SELECT * FROM places ORDER BY name ASC');
    return rows.map(
      (r) =>
        new Place({
          id: r.id,
          name: r.name,
          coordinate: { latitude: r.latitude, longitude: r.longitude },
          radiusMeters: r.radius_meters,
        })
    );
  }

  public async getPlaceById(id: string): Promise<Place | null> {
    interface PlaceRow {
      id: string;
      name: string;
      latitude: number;
      longitude: number;
      radius_meters: number;
    }

    const row = this.db.get<PlaceRow>('SELECT * FROM places WHERE id = ?', [id]);
    if (!row) return null;

    return new Place({
      id: row.id,
      name: row.name,
      coordinate: { latitude: row.latitude, longitude: row.longitude },
      radiusMeters: row.radius_meters,
    });
  }

  public async savePlace(place: Place): Promise<void> {
    this.db.run(
      `INSERT OR REPLACE INTO places (id, name, latitude, longitude, radius_meters, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        place.id,
        place.name,
        place.coordinate.latitude,
        place.coordinate.longitude,
        place.radiusMeters,
        Date.now(),
      ]
    );
  }

  public async deletePlace(id: string): Promise<void> {
    this.db.run('DELETE FROM places WHERE id = ?', [id]);
  }
}
