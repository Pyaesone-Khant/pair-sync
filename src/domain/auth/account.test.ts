import { describe, it, expect } from 'vitest';
import { Account } from './account';

describe('Account Domain Entity (ADR 0006 & CONTEXT.md)', () => {
  it('creates an Account with valid email and properties', () => {
    const account = new Account({
      id: 'usr-uuid-1234',
      email: 'alex.rivera@example.com',
      fullName: 'Alex Rivera',
      avatarUrl: 'https://lh3.googleusercontent.com/a/photo.jpg',
      createdAt: 1700000000000,
    });

    expect(account.id).toBe('usr-uuid-1234');
    expect(account.email).toBe('alex.rivera@example.com');
    expect(account.fullName).toBe('Alex Rivera');
    expect(account.getDisplayName()).toBe('Alex Rivera');
    expect(account.getInitials()).toBe('AR');
  });

  it('falls back to email prefix for displayName when fullName is missing', () => {
    const account = new Account({
      id: 'usr-uuid-5678',
      email: 'jordan@example.com',
      fullName: null,
      avatarUrl: null,
      createdAt: 1700000000000,
    });

    expect(account.getDisplayName()).toBe('jordan');
    expect(account.getInitials()).toBe('J');
  });

  it('validates email format', () => {
    expect(
      () =>
        new Account({
          id: 'usr-1',
          email: 'invalid-email-address',
          fullName: 'Test',
          avatarUrl: null,
          createdAt: Date.now(),
        })
    ).toThrow('Invalid email format');
  });
});
