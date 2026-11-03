import { Pair, PairStatus } from '../../domain/pairing/pair';
import { Place } from '../../domain/places/place';
import { CiphertextEnvelope } from '../../domain/messaging/ciphertext-envelope';

/**
 * Port for Pair lifecycle and identity storage.
 */
export interface IPairRepository {
  getActivePair(): Promise<Pair | null>;
  savePair(pair: Pair): Promise<void>;
  updatePairStatus(id: string, status: PairStatus): Promise<void>;
}

/**
 * Port for encrypted message persistence.
 */
export interface IMessageRepository {
  saveEnvelope(
    envelope: CiphertextEnvelope,
    direction: 'incoming' | 'outgoing'
  ): Promise<void>;
  getRecentEnvelopes(limit?: number): Promise<CiphertextEnvelope[]>;
  markDelivered(id: string): Promise<void>;
}

/**
 * Port for local geofenced Places persistence.
 */
export interface IPlaceRepository {
  getAllPlaces(): Promise<Place[]>;
  getPlaceById(id: string): Promise<Place | null>;
  savePlace(place: Place): Promise<void>;
  deletePlace(id: string): Promise<void>;
}
