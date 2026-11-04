import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAuthStore } from './auth-store';
import { Account } from '../../domain/auth/account';
import { IAuthPort } from '../../application/ports/auth';

class MockAuthService implements IAuthPort {
  public mockUser: Account | null = null;
  public listeners: Set<(account: Account | null) => void> = new Set();

  async signInWithGoogle(): Promise<Account> {
    const account = new Account({
      id: 'google-usr-123',
      email: 'test.user@gmail.com',
      fullName: 'Test Google User',
      avatarUrl: 'https://lh3.googleusercontent.com/test.jpg',
      createdAt: Date.now(),
    });
    this.mockUser = account;
    this.listeners.forEach((l) => l(account));
    return account;
  }

  async signOut(): Promise<void> {
    this.mockUser = null;
    this.listeners.forEach((l) => l(null));
  }

  async getCurrentAccount(): Promise<Account | null> {
    return this.mockUser;
  }

  onAuthStateChanged(callback: (account: Account | null) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }
}

describe('useAuthStore (ADR 0006 Google Auth)', () => {
  let mockAuth: MockAuthService;

  beforeEach(() => {
    mockAuth = new MockAuthService();
    useAuthStore.getState().reset();
  });

  it('starts unauthenticated and uninitialized', () => {
    const state = useAuthStore.getState();
    expect(state.account).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(state.isLoading).toBe(false);
    expect(state.isInitialized).toBe(false);
  });

  it('checks session and sets isInitialized to true', async () => {
    expect(useAuthStore.getState().isInitialized).toBe(false);
    await useAuthStore.getState().checkSession(mockAuth);
    expect(useAuthStore.getState().isInitialized).toBe(true);
    expect(useAuthStore.getState().isAuthenticated).toBe(false);

    // Now with existing user
    await mockAuth.signInWithGoogle();
    await useAuthStore.getState().checkSession(mockAuth);
    expect(useAuthStore.getState().isInitialized).toBe(true);
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(useAuthStore.getState().account?.email).toBe('test.user@gmail.com');
  });

  it('signs in with Google successfully and stores Account entity', async () => {
    await useAuthStore.getState().signInWithGoogle(mockAuth);

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.account).not.toBeNull();
    expect(state.account?.email).toBe('test.user@gmail.com');
    expect(state.account?.getDisplayName()).toBe('Test Google User');
  });

  it('signs out and resets state', async () => {
    await useAuthStore.getState().signInWithGoogle(mockAuth);
    expect(useAuthStore.getState().isAuthenticated).toBe(true);

    await useAuthStore.getState().signOut(mockAuth);
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().account).toBeNull();
  });
});
