import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Faltan variables de entorno de Supabase en .env.local');
}

const runtimeSupabaseUrl =
  import.meta.env.DEV && typeof window !== 'undefined'
    ? `${window.location.origin}/supabase`
    : supabaseUrl;

export const supabase = createClient(runtimeSupabaseUrl, supabaseAnonKey);
