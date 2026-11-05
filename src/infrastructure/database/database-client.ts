import {
  ISqliteExecutor,
  SqliteDatabaseAdapter,
  SqlitePairRepository,
  SqliteMessageRepository,
  SqlitePlaceRepository,
} from './sqlite-repositories';
import {
  IPairRepository,
  IMessageRepository,
  IPlaceRepository,
} from '../../application/ports/repositories';

export interface RepositoriesBundle {
  pairRepo: IPairRepository;
  messageRepo: IMessageRepository;
  placeRepo: IPlaceRepository;
}

/**
 * Universal Database Client for PairSync.
 * Works seamlessly with `expo-sqlite` on iOS/Android devices and `node:sqlite` in Vitest.
 * Adheres to ADR 0004 (Local-First SQLite Engine).
 */
export class DatabaseClient {
  private executor: ISqliteExecutor;
  private repositories: RepositoriesBundle;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(customEngine?: any) {
    let engine = customEngine;

    if (!engine) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const SQLite = require('expo-sqlite');
        if (typeof SQLite.openDatabaseSync === 'function') {
          engine = SQLite.openDatabaseSync('pairsync.db');
        }
      } catch {
        // Non-expo environment or test fallback
      }

      if (!engine) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const { DatabaseSync } = require('node:sqlite');
          if (typeof DatabaseSync === 'function') {
            engine = new DatabaseSync(':memory:');
          }
        } catch {
          // Fallback if node:sqlite is not available
        }
      }
    }

    this.executor = new SqliteDatabaseAdapter(engine);
    this.repositories = {
      pairRepo: new SqlitePairRepository(this.executor),
      messageRepo: new SqliteMessageRepository(this.executor),
      placeRepo: new SqlitePlaceRepository(this.executor),
    };
  }

  /**
   * Initializes SQLite tables if they do not exist.
   */
  public initializeTables(): void {
    const ddl = `
      CREATE TABLE IF NOT EXISTS pairs (
        id TEXT PRIMARY KEY,
        local_device_id TEXT NOT NULL,
        peer_device_id TEXT NOT NULL,
        peer_public_key TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        sender_device_id TEXT NOT NULL,
        recipient_device_id TEXT NOT NULL,
        iv TEXT NOT NULL,
        ciphertext TEXT NOT NULL,
        sequence_number INTEGER NOT NULL,
        ratchet_public_key TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        delivery_status TEXT NOT NULL DEFAULT 'pending',
        direction TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS places (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        radius_meters REAL NOT NULL,
        icon TEXT DEFAULT 'location',
        created_at INTEGER NOT NULL
      );

      -- Purge any legacy mock/demo records so new user logins are strictly empty & real
      DELETE FROM pairs WHERE id = 'pair-primary' OR peer_device_id = 'device-remote-peer';
      DELETE FROM places WHERE id IN ('1', '2', '3', 'place-home', 'place-office', 'place-gym');
      DELETE FROM messages WHERE id IN ('init-1', 'init-2');
    `;

    this.executor.exec(ddl);

    try {
      this.executor.exec("ALTER TABLE places ADD COLUMN icon TEXT DEFAULT 'location'");
    } catch {
      // Column already exists
    }
  }

  public getRepositories(): RepositoriesBundle {
    return this.repositories;
  }

  public getExecutor(): ISqliteExecutor {
    return this.executor;
  }
}

// Singleton instance for app runtime
let defaultClientInstance: DatabaseClient | null = null;

export function getDatabaseClient(): DatabaseClient {
  if (!defaultClientInstance) {
    defaultClientInstance = new DatabaseClient();
    try {
      defaultClientInstance.initializeTables();
    } catch (err) {
      console.warn('[DatabaseClient] Table initialization deferred:', err);
    }
  }
  return defaultClientInstance;
}
