import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const ENV_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Temporary safeguard: some Lovable/Supabase syncs can re-inject the disabled legacy anon JWT.
// Keep frontend stable by preferring a valid publishable key format.
const FALLBACK_PUBLISHABLE_KEY = 'sb_publishable_xsjV6J-agD86nPZgOCwj5g_tgk0vBPG';
const isLegacyJwtKey = (key?: string) => Boolean(key && key.startsWith('eyJ'));
const SUPABASE_PUBLISHABLE_KEY = isLegacyJwtKey(ENV_PUBLISHABLE_KEY)
  ? FALLBACK_PUBLISHABLE_KEY
  : ENV_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  throw new Error('Missing Supabase configuration. Ensure URL and publishable key are configured.');
}

if (isLegacyJwtKey(ENV_PUBLISHABLE_KEY)) {
  console.warn('Legacy Supabase anon key detected; using publishable key fallback. Reconnect/update your Supabase integration key source.');
}

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});
