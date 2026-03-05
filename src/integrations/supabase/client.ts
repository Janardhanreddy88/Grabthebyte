// Supabase client - Updated 2026-03-05 with new publishable key
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Use the new publishable key (legacy keys were disabled on 2026-03-05)
const SUPABASE_URL = "https://dlaudfrhokdjtcmnhhap.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_xsjV6J-agD86nPZgOCwj5g_tgk0vBPG";

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});
