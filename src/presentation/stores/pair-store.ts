import { create } from 'zustand';
import { Pair } from '../../domain/pairing/pair';
import { getDatabaseClient } from '../../infrastructure/database/database-client';
import { getSignalingChannel } from '../../infrastructure/network/supabase-signaling-channel';
import { useLocationStore } from './location-store';

export interface PairStoreState {
  activePair: Pair | null;
  pairCount: number;
  isLoading: boolean;
  isRelayConnected: boolean;

  loadPair: () => Promise<Pair | null>;
  setPair: (pair: Pair) => Promise<void>;
  unpair: () => Promise<void>;
  setRelayConnected: (connected: boolean) => void;
  reset: () => void;
}

/**
 * Global reactive Zustand store managing active 1:1 hardware pair bonds.
 * Guarantees instant synchronization across Radar, Chat, Profile, and deep link handlers.
 * Strictly adheres to ADR 0001, ADR 0006, and CONTEXT.md.
 */
export const usePairStore = create<PairStoreState>((set, get) => ({
  activePair: null,
  pairCount: 0,
  isLoading: false,
  isRelayConnected: false,

  loadPair: async () => {
    set({ isLoading: true });
    try {
      const { pairRepo } = getDatabaseClient().getRepositories();
      const [pair, count] = await Promise.all([
        pairRepo.getActivePair(),
        pairRepo.getPairCount(),
      ]);

      set({
        activePair: pair,
        pairCount: count,
        isLoading: false,
      });

      if (pair) {
        const signaling = getSignalingChannel();
        const roomId = pair.getPairRoomId();
        await signaling.joinPairRoom(roomId);
        set({ isRelayConnected: true });
      }

      return pair;
    } catch (err) {
      console.warn('[usePairStore] Failed to load pair:', err);
      set({ isLoading: false });
      return null;
    }
  },

  setPair: async (pair: Pair) => {
    set({ isLoading: true });
    try {
      pair.activate();
      const { pairRepo } = getDatabaseClient().getRepositories();
      await pairRepo.savePair(pair);
      const count = await pairRepo.getPairCount();

      set({
        activePair: pair,
        pairCount: count,
        isLoading: false,
      });

      const signaling = getSignalingChannel();
      const roomId = pair.getPairRoomId();
      await signaling.joinPairRoom(roomId);
      set({ isRelayConnected: true });
    } catch (err) {
      console.warn('[usePairStore] Failed to set pair:', err);
      set({ isLoading: false });
      throw err;
    }
  },

  unpair: async () => {
    set({ isLoading: true });
    try {
      const current = get().activePair;
      if (current) {
        const { pairRepo } = getDatabaseClient().getRepositories();
        await pairRepo.deletePair(current.id);
      }
      const signaling = getSignalingChannel();
      await signaling.leavePairRoom();
      useLocationStore.getState().reset();
      set({
        activePair: null,
        pairCount: 0,
        isLoading: false,
        isRelayConnected: false,
      });
    } catch (err) {
      console.warn('[usePairStore] Failed to unpair:', err);
      set({ isLoading: false });
    }
  },

  setRelayConnected: (connected: boolean) => set({ isRelayConnected: connected }),

  reset: () => {
    set({
      activePair: null,
      pairCount: 0,
      isLoading: false,
      isRelayConnected: false,
    });
  },
}));
