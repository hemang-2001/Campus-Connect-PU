import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  !supabaseUrl.includes('placeholder') &&
  !supabaseAnonKey.includes('placeholder')
);

if (!isSupabaseConfigured) {
  console.warn(
    '⚠️ Campus Connect: VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is missing in client/.env. ' +
    'Please configure client/.env with your Supabase credentials and restart the Vite dev server.'
  );
}

// API_BASE: defaults to empty string so it leverages the Vite proxy (/api) seamlessly,
// or uses VITE_API_BASE if explicitly provided.
export const API_BASE = import.meta.env.VITE_API_BASE ?? '';
export const API = API_BASE;
export const MOCK_TRACKING = import.meta.env.VITE_MOCK_TRACKING === 'true' || import.meta.env.VITE_MOCK_TRACKING === true;

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  }
);
