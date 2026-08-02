// --- LOCATION: src/integrations/supabase/client.ts --- //
import { createClient } from '@supabase/supabase-js';
// 1. Import necessary Capacitor utilities
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import type { Database } from './types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase configuration. Ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set.');
}

// =====================================================================
// 🛡️ NATIVE APP PERSISTENCE SHIELD
// Define custom storage that talks to native OS preferences,
// preventing session deletion when mobile OS cleans RAM/battery.
// =====================================================================
const customNativeStorage = {
  getItem: async (key: string) => {
    const { value } = await Preferences.get({ key });
    return value;
  },
  setItem: async (key: string, value: string) => {
    await Preferences.set({ key, value });
  },
  removeItem: async (key: string) => {
    await Preferences.remove({ key });
  },
};

// =====================================================================
// 🦅 finalized Supabase initialization
// =====================================================================

// Initialize finalized auth config with standard settings
const authOptions: any = {
  persistSession: true,
  autoRefreshToken: true,
};

// IF WE ARE ON A NATIVE PLATFORM (ANDROID/IOS BUILD)
// OVERRIDE STORAGE WITH CUSTOM SHIELD!
if (Capacitor.isNativePlatform()) {
  console.log("🦅 Supabase Native: Activating Persistent Native Storage.");
  authOptions.storage = customNativeStorage; // Use secure native preferences API
  authOptions.detectSessionInUrl = false;  // Prevents native URL conflicts
} else {
  // Website usage: Supabase automatically uses localStorage securely
  console.log("🦅 Supabase Web: Standard persistence activated.");
}

export const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
  auth: authOptions,
});