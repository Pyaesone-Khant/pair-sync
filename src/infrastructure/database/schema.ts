import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

/**
 * Local-First SQLite tables for PairSync.
 * Adheres to ADR 0004 and Clean Architecture.
 */

export const pairsTable = sqliteTable('pairs', {
  id: text('id').primaryKey(),
  localDeviceId: text('local_device_id').notNull(),
  peerDeviceId: text('peer_device_id').notNull(),
  peerPublicKey: text('peer_public_key').notNull(),
  status: text('status').notNull(),
  createdAt: integer('created_at').notNull(),
});

export const messagesTable = sqliteTable('messages', {
  id: text('id').primaryKey(),
  senderDeviceId: text('sender_device_id').notNull(),
  recipientDeviceId: text('recipient_device_id').notNull(),
  iv: text('iv').notNull(),
  ciphertext: text('ciphertext').notNull(),
  sequenceNumber: integer('sequence_number').notNull(),
  ratchetPublicKey: text('ratchet_public_key').notNull(),
  timestamp: integer('timestamp').notNull(),
  deliveryStatus: text('delivery_status').notNull().default('pending'),
  direction: text('direction').notNull(), // 'incoming' | 'outgoing'
});

export const placesTable = sqliteTable('places', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  latitude: real('latitude').notNull(),
  longitude: real('longitude').notNull(),
  radiusMeters: real('radius_meters').notNull(),
  createdAt: integer('created_at').notNull(),
});
