import { createClient } from '@supabase/supabase-js';

// Access environment variables safely to prevent runtime crashes
// In some environments import.meta.env might be undefined during initialization
const env = (import.meta as any).env || {};

// Use environment variables if available, otherwise use the provided hardcoded credentials
const supabaseUrl = env.VITE_SUPABASE_URL || 'https://aoyjsmijrhsaqgsriqgc.supabase.co';
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFveWpzbWlqcmhzYXFnc3JpcWdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU3ODc2NzUsImV4cCI6MjA4MTM2MzY3NX0.6P1LNucg3GXMWS7lue3RqdDuHnLD20uQR9fFzrqXDvI';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("Supabase keys are missing. Check your .env file or Vercel project settings.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);