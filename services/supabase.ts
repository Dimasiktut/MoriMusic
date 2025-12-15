import { createClient } from '@supabase/supabase-js';

// Access environment variables safely to prevent runtime crashes
// In some environments import.meta.env might be undefined during initialization
const env = (import.meta as any).env || {};
const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("Supabase keys are missing. Check your .env file or Vercel project settings.");
}

// Use placeholders to prevent 'supabaseUrl is required' error during initialization
// Network requests will fail, but the app will mount and render.
const url = supabaseUrl || 'https://placeholder.supabase.co';
const key = supabaseAnonKey || 'placeholder';

export const supabase = createClient(url, key);