import { describe, it, expect, beforeEach, vi } from 'vitest';
import { usePairStore } from './pair-store';
import { Pair, PairStatus } from '../../domain/pairing/pair';
import { getDatabaseClient } from '../../infrastructure/database/database-client';

describe('usePairStore', () => {
  beforeEach(async () => {
    usePairStore.getState().reset();
    const { pairRepo } = getDatabaseClient().getRepositories();
    const current = await pairRepo.getActivePair();
    if (current) {
      await pairRepo.deletePair(current.id);
    }
  });

  it('initializes with null activePair and 0 count', () => {
    const state = usePairStore.getState();
    expect(state.activePair).toBeNull();
    expect(state.pairCount).toBe(0);
    expect(state.isLoading).toBe(false);
  });

  it('loads pair from SQLite database', async () => {
    const { pairRepo } = getDatabaseClient().getRepositories();
    const mockPair = new Pair({
      id: 'pair-unit-1',
      localDeviceId: 'dev-alice',
      peerDeviceId: 'dev-bob',
      peerPublicKey: 'pk-bob-1234',
      status: PairStatus.Active,
    });
    await pairRepo.savePair(mockPair);

    const loaded = await usePairStore.getState().loadPair();
    expect(loaded).not.toBeNull();
    expect(loaded?.peerDeviceId).toBe('dev-bob');
    expect(usePairStore.getState().pairCount).toBe(1);
    expect(usePairStore.getState().activePair?.id).toBe('pair-unit-1');
  });

  it('sets and activates pair, writing to database and updating state reactively', async () => {
    const newPair = new Pair({
      id: 'pair-unit-2',
      localDeviceId: 'dev-alice',
      peerDeviceId: 'dev-charlie',
      peerPublicKey: 'pk-charlie-9999',
    });

    await usePairStore.getState().setPair(newPair);

    expect(usePairStore.getState().activePair?.id).toBe('pair-unit-2');
    expect(usePairStore.getState().activePair?.status).toBe(PairStatus.Active);
    expect(usePairStore.getState().pairCount).toBe(1);

    const { pairRepo } = getDatabaseClient().getRepositories();
    const saved = await pairRepo.getActivePair();
    expect(saved?.id).toBe('pair-unit-2');
  });

  it('unpairs, removing from database and resetting state', async () => {
    const mockPair = new Pair({
      id: 'pair-unit-3',
      localDeviceId: 'dev-alice',
      peerDeviceId: 'dev-dave',
      peerPublicKey: 'pk-dave-4444',
      status: PairStatus.Active,
    });
    await usePairStore.getState().setPair(mockPair);
    expect(usePairStore.getState().activePair).not.toBeNull();

    await usePairStore.getState().unpair();

    expect(usePairStore.getState().activePair).toBeNull();
    expect(usePairStore.getState().pairCount).toBe(0);

    const { pairRepo } = getDatabaseClient().getRepositories();
    const stored = await pairRepo.getActivePair();
    expect(stored).toBeNull();
  });
});
