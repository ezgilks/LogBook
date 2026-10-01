import 'expo-sqlite/localStorage/install';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import * as AppleAuthentication from 'expo-apple-authentication';
import { AppState, Platform } from 'react-native';
import { create } from 'zustand';
import { syncRepo } from '../db/client';
import { track } from '../lib/analytics';
import { useLog } from '../store/log';
import { syncOnce } from './client';

// Accounts + cloud backup. Entirely optional: with no env vars set, the app is
// local-only and none of this UI appears.

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const SYNC_URL = process.env.EXPO_PUBLIC_SYNC_URL;

export const syncEnabled = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY && SYNC_URL && syncRepo && Platform.OS === 'ios');

const supabase: SupabaseClient | null = syncEnabled
  ? createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, { auth: { storage: localStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false } })
  : null;

type Status = 'idle' | 'syncing' | 'error';

interface AccountState {
  email: string | null;
  signedIn: boolean;
  status: Status;
  lastSyncedAt: number | null;
  error: string | null;
  init(): Promise<void>;
  signInWithApple(): Promise<void>;
  signOut(): Promise<void>;
  syncNow(): Promise<void>;
}

export const useAccount = create<AccountState>((set, get) => ({
  email: null,
  signedIn: false,
  status: 'idle',
  lastSyncedAt: null,
  error: null,

  async init() {
    if (!supabase) return;
    const { data } = await supabase.auth.getSession();
    set({ signedIn: !!data.session, email: data.session?.user.email ?? null });
    supabase.auth.onAuthStateChange((_e, session) => set({ signedIn: !!session, email: session?.user.email ?? null }));
    AppState.addEventListener('change', (s) => {
      if (s === 'active') get().syncNow();
    });
    if (data.session) get().syncNow();
  },

  async signInWithApple() {
    if (!supabase) return;
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [AppleAuthentication.AppleAuthenticationScope.EMAIL],
      });
      if (!credential.identityToken) throw new Error('No identity token from Apple');
      const { error } = await supabase.auth.signInWithIdToken({ provider: 'apple', token: credential.identityToken });
      if (error) throw error;
      track('signed_in');
      await get().syncNow();
    } catch (e: unknown) {
      if ((e as { code?: string }).code === 'ERR_REQUEST_CANCELED') return;
      set({ error: e instanceof Error ? e.message : String(e) });
    }
  },

  async signOut() {
    await supabase?.auth.signOut();
    set({ signedIn: false, email: null, lastSyncedAt: null });
  },

  async syncNow() {
    if (!supabase || !syncRepo || get().status === 'syncing') return;
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;
    set({ status: 'syncing', error: null });
    try {
      const res = await syncOnce({ repo: syncRepo, baseUrl: SYNC_URL!, token });
      if (res.pulled > 0) await useLog.getState().load();
      set({ status: 'idle', lastSyncedAt: Date.now() });
    } catch (e) {
      set({ status: 'error', error: e instanceof Error ? e.message : String(e) });
    }
  },
}));
