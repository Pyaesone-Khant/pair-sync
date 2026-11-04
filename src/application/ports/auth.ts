import { Account } from '../../domain/auth/account';

/**
 * Port interface for account-level authentication.
 * Adheres to ADR 0006 and Clean Architecture.
 */
export interface IAuthPort {
  signInWithGoogle(customRedirectUri?: string): Promise<Account>;
  signOut(): Promise<void>;
  getCurrentAccount(): Promise<Account | null>;
  onAuthStateChanged(callback: (account: Account | null) => void): () => void;
}
