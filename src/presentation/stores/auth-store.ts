import { create } from 'zustand';
import { Account } from '../../domain/auth/account';
import { IAuthPort } from '../../application/ports/auth';

export interface AuthState {
  account: Account | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;

  setAccount: (account: Account | null) => void;
  signInWithGoogle: (authService: IAuthPort, redirectUri?: string) => Promise<Account | null>;
  signOut: (authService: IAuthPort) => Promise<void>;
  checkSession: (authService: IAuthPort) => Promise<void>;
  reset: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  account: null,
  isAuthenticated: false,
  isLoading: false,
  isInitialized: false,
  error: null,

  setAccount: (account: Account | null) => {
    set({
      account,
      isAuthenticated: Boolean(account),
      error: null,
      isInitialized: true,
    });
  },

  signInWithGoogle: async (authService: IAuthPort, redirectUri?: string) => {
    set({ isLoading: true, error: null });
    try {
      const account = await authService.signInWithGoogle(redirectUri);
      set({
        account,
        isAuthenticated: true,
        isLoading: false,
        isInitialized: true,
        error: null,
      });
      return account;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Google sign-in failed';
      set({ isLoading: false, error: msg });
      return null;
    }
  },

  signOut: async (authService: IAuthPort) => {
    set({ isLoading: true });
    try {
      await authService.signOut();
      set({
        account: null,
        isAuthenticated: false,
        isLoading: false,
        isInitialized: true,
        error: null,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sign out failed';
      set({ isLoading: false, error: msg });
    }
  },

  checkSession: async (authService: IAuthPort) => {
    // Retain existing in-memory account if already set
    const currentInStore = useAuthStore.getState().account;
    if (currentInStore) {
      set({ isInitialized: true, isLoading: false, isAuthenticated: true });
      return;
    }

    set({ isLoading: true });
    try {
      const current = await authService.getCurrentAccount();
      set({
        account: current,
        isAuthenticated: Boolean(current),
        isLoading: false,
        isInitialized: true,
      });
    } catch {
      set({
        isLoading: false,
        isInitialized: true,
      });
    }
  },

  reset: () => {
    set({
      account: null,
      isAuthenticated: false,
      isLoading: false,
      isInitialized: false,
      error: null,
    });
  },
}));
