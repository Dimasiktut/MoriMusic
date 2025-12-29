
import { createClient } from '@supabase/supabase-js';

// Robust environment variable detection
const getEnv = (key: string, fallback: string): string => {
  try {
    // Check for Vite-style variables
    if (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env[key]) {
      return (import.meta as any).env[key];
    }
    // Check for Process-style variables
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
      return process.env[key];
    }
  } catch (e) {
    console.warn(`Error accessing environment variable ${key}:`, e);
  }
  return fallback;
};

const supabaseUrl = getEnv('VITE_SUPABASE_URL', 'https://aoyjsmijrhsaqgsriqgc.supabase.co');
const supabaseAnonKey = getEnv('VITE_SUPABASE_ANON_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFveWpzbWlqcmhzYXFnc3JpcWdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU3ODc2NzUsImV4cCI6MjA4MTM2MzY3NX0.6P1LNucg3GXMWS7lue3RqdDuHnLD20uQR9fFzrqXDvI');

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
