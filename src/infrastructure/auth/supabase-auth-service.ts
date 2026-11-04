import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { IAuthPort } from '../../application/ports/auth';
import { Account } from '../../domain/auth/account';

export interface SupabaseAuthConfig {
  supabaseClient?: SupabaseClient;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  webBrowserModule?: {
    openAuthSessionAsync(url: string, redirectUrl?: string): Promise<{ type: string; url?: string }>;
  };
}

/**
 * Persistent Storage adapter backed by Expo SecureStore (iOS Keychain & Android Keystore).
 * Preserves authentication session across application restarts and device reboots.
 */
export class MobileSecureAuthStorage {
  private inMemoryFallback = new Map<string, string>();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private getSecureStore(): any {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return require('expo-secure-store');
    } catch {
      return null;
    }
  }

  public async getItem(key: string): Promise<string | null> {
    const store = this.getSecureStore();
    if (store && typeof store.getItemAsync === 'function') {
      try {
        const item = await store.getItemAsync(key);
        if (item !== null && item !== undefined) {
          return item;
        }
      } catch (err) {
        console.warn('[MobileSecureAuthStorage] getItem fallback:', err);
      }
    }
    return this.inMemoryFallback.get(key) ?? null;
  }

  public async setItem(key: string, value: string): Promise<void> {
    const store = this.getSecureStore();
    if (store && typeof store.setItemAsync === 'function') {
      try {
        await store.setItemAsync(key, value);
        return;
      } catch (err) {
        console.warn('[MobileSecureAuthStorage] setItem fallback:', err);
      }
    }
    this.inMemoryFallback.set(key, value);
  }

  public async removeItem(key: string): Promise<void> {
    const store = this.getSecureStore();
    if (store && typeof store.deleteItemAsync === 'function') {
      try {
        await store.deleteItemAsync(key);
        return;
      } catch (err) {
        console.warn('[MobileSecureAuthStorage] removeItem fallback:', err);
      }
    }
    this.inMemoryFallback.delete(key);
  }
}

/**
 * Production implementation of IAuthPort using Supabase Google OAuth and Expo WebBrowser.
 * Adheres to ADR 0006 (Hybrid Identity).
 */
export class SupabaseAuthService implements IAuthPort {
  private client: SupabaseClient;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private webBrowser: any = null;

  constructor(config?: SupabaseAuthConfig) {
    if (config?.supabaseClient) {
      this.client = config.supabaseClient;
    } else {
      const url =
        config?.supabaseUrl ||
        process.env.EXPO_PUBLIC_SUPABASE_URL ||
        'https://uqvkhfxnnvnzftvvwlwi.supabase.co';
      const key =
        config?.supabaseAnonKey ||
        process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
        'sb_publishable_B4fWBTYmHyUOXjGikfWn4g_E3F48cWf';

      this.client = createClient(url, key, {
        auth: {
          storage: new MobileSecureAuthStorage(),
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
        },
      });
    }

    if (config?.webBrowserModule) {
      this.webBrowser = config.webBrowserModule;
    }
  }

  private async getWebBrowser() {
    if (this.webBrowser) return this.webBrowser;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      this.webBrowser = require('expo-web-browser');
    } catch {
      // Non-expo environment
    }
    return this.webBrowser;
  }

  public async signInWithGoogle(customRedirectUri?: string): Promise<Account> {
    let redirectUrl = customRedirectUri;
    if (!redirectUrl) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const Linking = require('expo-linking');
        redirectUrl = Linking.createURL('auth/callback');
      } catch {
        redirectUrl = 'pairsync://auth/callback';
      }
    }

    const { data, error } = await this.client.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
        skipBrowserRedirect: true,
      },
    });

    if (error) {
      throw new Error(`Google OAuth initialization failed: ${error.message}`);
    }

    if (!data?.url) {
      throw new Error('Supabase did not return an OAuth authorization URL');
    }

    const browser = await this.getWebBrowser();
    if (browser && typeof browser.openAuthSessionAsync === 'function') {
      const res = await browser.openAuthSessionAsync(data.url, redirectUrl);

      if (res.type === 'success' && res.url) {
        await this.handleAuthRedirectUrl(res.url);
      } else if (res.type === 'cancel' || res.type === 'dismiss') {
        throw new Error('Google sign-in was canceled');
      }
    }

    const currentAccount = await this.getCurrentAccount();
    if (!currentAccount) {
      throw new Error('Failed to retrieve user account following Google authentication');
    }

    return currentAccount;
  }

  public async handleAuthRedirectUrl(url: string): Promise<void> {
    try {
      // Extract tokens from fragment (#access_token=...&refresh_token=...)
      if (url.includes('#')) {
        const hash = url.split('#')[1];
        const params = new URLSearchParams(hash);
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');

        if (accessToken && refreshToken) {
          await this.client.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          return;
        }
      }

      // Extract auth code from query params (?code=...)
      if (url.includes('?')) {
        const query = url.split('?')[1];
        const params = new URLSearchParams(query);
        const code = params.get('code');

        if (code && typeof this.client.auth.exchangeCodeForSession === 'function') {
          await this.client.auth.exchangeCodeForSession(code);
          return;
        }
      }
    } catch (err) {
      console.warn('[SupabaseAuthService] Failed to parse OAuth callback URL:', err);
    }
  }

  public async signOut(): Promise<void> {
    const { error } = await this.client.auth.signOut();
    if (error) {
      throw new Error(`Sign out failed: ${error.message}`);
    }
  }

  public async getCurrentAccount(): Promise<Account | null> {
    try {
      const { data: { session } } = await this.client.auth.getSession();
      if (session?.user) {
        return this.mapUserToAccount(session.user);
      }
      const { data: { user }, error } = await this.client.auth.getUser();
      if (error || !user) {
        return null;
      }
      return this.mapUserToAccount(user);
    } catch {
      return null;
    }
  }

  public onAuthStateChanged(callback: (account: Account | null) => void): () => void {
    const { data: { subscription } } = this.client.auth.onAuthStateChange(
      (event, session) => {
        if (session?.user) {
          callback(this.mapUserToAccount(session.user));
        } else if (event === 'SIGNED_OUT') {
          callback(null);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }

  private mapUserToAccount(user: User): Account {
    const meta = user.user_metadata || {};
    const fullName = meta.full_name || meta.name || null;
    const avatarUrl = meta.avatar_url || meta.picture || null;
    const createdAt = user.created_at ? new Date(user.created_at).getTime() : Date.now();

    return new Account({
      id: user.id,
      email: user.email ?? 'unknown@example.com',
      fullName,
      avatarUrl,
      createdAt,
    });
  }

  public getSupabaseClient(): SupabaseClient {
    return this.client;
  }
}

// Singleton helper
let defaultAuthServiceInstance: SupabaseAuthService | null = null;

export function getSupabaseAuthService(): SupabaseAuthService {
  if (!defaultAuthServiceInstance) {
    defaultAuthServiceInstance = new SupabaseAuthService();
  }
  return defaultAuthServiceInstance;
}
