import { create } from 'zustand';
import { supabase } from './supabase';
import type { User } from '@supabase/supabase-js';

export type UserRole = 'estudiante' | 'docente' | 'superadministrador';

export interface Profile {
  id: string;
  full_name: string | null;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

interface AuthState {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  profileError: string | null;
  setUser: (user: User | null) => void;
  setProfile: (profile: Profile | null) => void;
  fetchProfile: (userId: string) => Promise<Profile | null>;
  signOut: () => Promise<void>;
  initialize: () => Promise<() => void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  profile: null,
  loading: true,
  profileError: null,

  setUser: (user) => set({ user }),
  setProfile: (profile) => set({ profile }),

  fetchProfile: async (userId: string) => {
    set({ profileError: null });

    // Retry logic — Supabase can occasionally fail on cold start
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      attempts++;
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (data) {
        const profile = data as Profile;
        set({ profile });
        return profile;
      }

      if (error) {
        console.error(`[Auth] fetchProfile attempt ${attempts}/${maxAttempts}:`, error.message);
        // If it's a 500 (server error), retry after a short delay
        if (attempts < maxAttempts && (error.code === 'PGRST301' || error.message?.includes('500'))) {
          await new Promise((r) => setTimeout(r, 500 * attempts));
          continue;
        }
        set({ profileError: error.message });
      }

      break;
    }

    return null;
  },

  signOut: async () => {
    // scope: 'local' ensures localStorage is cleared even if the API call fails
    await supabase.auth.signOut({ scope: 'local' });
    set({ user: null, profile: null, profileError: null });
  },

  initialize: async () => {
    set({ loading: true });

    // Session persistence logic
    // Get existing session (persisted by Supabase)
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session?.user) {
      // Valid session
      set({ user: session.user });
      get().fetchProfile(session.user.id); // No await, so we don't block the initial render
    }

    set({ loading: false });

    // Listen for auth changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        set({ user: session.user });
        // Only fetch profile if not already loaded for this user
        const currentProfile = get().profile;
        if (!currentProfile || currentProfile.id !== session.user.id) {
          await get().fetchProfile(session.user.id);
        }
      } else if (event === 'SIGNED_OUT') {
        set({ user: null, profile: null, profileError: null });
      }
    });

    return () => subscription.unsubscribe();
  },
}));
