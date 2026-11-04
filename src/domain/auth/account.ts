/**
 * Domain entity representing an authenticated account identity record.
 * Strictly adheres to ADR 0006 and CONTEXT.md.
 */
export interface AccountProperties {
  id: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
  createdAt: number;
}

export class Account {
  public readonly id: string;
  public readonly email: string;
  public readonly fullName: string | null;
  public readonly avatarUrl: string | null;
  public readonly createdAt: number;

  constructor(props: AccountProperties) {
    if (!props.email || !props.email.includes('@')) {
      throw new Error('Invalid email format');
    }

    this.id = props.id;
    this.email = props.email.trim().toLowerCase();
    this.fullName = props.fullName ? props.fullName.trim() : null;
    this.avatarUrl = props.avatarUrl;
    this.createdAt = props.createdAt;
  }

  public getDisplayName(): string {
    if (this.fullName && this.fullName.length > 0) {
      return this.fullName;
    }
    return this.email.split('@')[0];
  }

  public getInitials(): string {
    if (this.fullName) {
      const parts = this.fullName.split(' ').filter(Boolean);
      if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      }
      if (parts.length === 1 && parts[0].length > 0) {
        return parts[0][0].toUpperCase();
      }
    }
    return this.email.charAt(0).toUpperCase();
  }
}
