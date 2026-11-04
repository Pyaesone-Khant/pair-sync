import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SupabaseAuthService, MobileSecureAuthStorage } from './supabase-auth-service';
import { Account } from '../../domain/auth/account';

describe('SupabaseAuthService (ADR 0006 Google OAuth Adapter)', () => {
  let mockSupabaseAuth: any;
  let mockWebBrowser: any;
  let authService: SupabaseAuthService;

  beforeEach(() => {
    mockSupabaseAuth = {
      signInWithOAuth: vi.fn(() =>
        Promise.resolve({
          data: { url: 'https://accounts.google.com/o/oauth2/v2/auth?...', provider: 'google' },
          error: null,
        })
      ),
      setSession: vi.fn(() => Promise.resolve({ data: { session: {} }, error: null })),
      getSession: vi.fn(() => Promise.resolve({ data: { session: null }, error: null })),
      getUser: vi.fn(() =>
        Promise.resolve({
          data: {
            user: {
              id: 'google-usr-999',
              email: 'maya.lin@gmail.com',
              user_metadata: {
                full_name: 'Maya Lin',
                avatar_url: 'https://lh3.googleusercontent.com/photo-maya.jpg',
              },
              created_at: '2026-11-04T00:00:00.000Z',
            },
          },
          error: null,
        })
      ),
      signOut: vi.fn(() => Promise.resolve({ error: null })),
      onAuthStateChange: vi.fn((callback) => {
        return {
          data: {
            subscription: {
              unsubscribe: vi.fn(),
            },
          },
        };
      }),
    };

    mockWebBrowser = {
      openAuthSessionAsync: vi.fn(() =>
        Promise.resolve({
          type: 'success',
          url: 'pairsync://auth/callback#access_token=mock_access_token&refresh_token=mock_refresh_token',
        })
      ),
    };

    authService = new SupabaseAuthService({
      supabaseClient: { auth: mockSupabaseAuth } as any,
      webBrowserModule: mockWebBrowser,
    });
  });

  it('initiates Google OAuth flow and retrieves authenticated Account entity', async () => {
    const account = await authService.signInWithGoogle('pairsync://auth/callback');

    expect(mockSupabaseAuth.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: {
        redirectTo: 'pairsync://auth/callback',
        skipBrowserRedirect: true,
      },
    });

    expect(mockWebBrowser.openAuthSessionAsync).toHaveBeenCalledWith(
      'https://accounts.google.com/o/oauth2/v2/auth?...',
      'pairsync://auth/callback'
    );

    expect(account).toBeInstanceOf(Account);
    expect(account.email).toBe('maya.lin@gmail.com');
    expect(account.fullName).toBe('Maya Lin');
  });

  it('retrieves current authenticated account from Supabase session', async () => {
    const current = await authService.getCurrentAccount();
    expect(current).not.toBeNull();
    expect(current?.id).toBe('google-usr-999');
    expect(current?.getDisplayName()).toBe('Maya Lin');
  });

  it('signs out from Supabase auth', async () => {
    await authService.signOut();
    expect(mockSupabaseAuth.signOut).toHaveBeenCalled();
  });

  it('persists and restores auth tokens across sessions via MobileSecureAuthStorage', async () => {
    const storage = new MobileSecureAuthStorage();
    expect(await storage.getItem('sb-token')).toBeNull();

    await storage.setItem('sb-token', 'jwt-token-persistent-abc-123');
    expect(await storage.getItem('sb-token')).toBe('jwt-token-persistent-abc-123');

    await storage.removeItem('sb-token');
    expect(await storage.getItem('sb-token')).toBeNull();
  });
});
