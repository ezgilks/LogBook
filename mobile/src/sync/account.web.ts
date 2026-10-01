import { create } from 'zustand';

// Web preview has no accounts or sync; same shape as account.ts.
export const syncEnabled = false;

interface AccountState {
  email: string | null;
  signedIn: boolean;
  status: 'idle' | 'syncing' | 'error';
  lastSyncedAt: number | null;
  error: string | null;
  init(): Promise<void>;
  signInWithApple(): Promise<void>;
  signOut(): Promise<void>;
  syncNow(): Promise<void>;
}

const noop = async () => {};

export const useAccount = create<AccountState>(() => ({
  email: null,
  signedIn: false,
  status: 'idle',
  lastSyncedAt: null,
  error: null,
  init: noop,
  signInWithApple: noop,
  signOut: noop,
  syncNow: noop,
}));
