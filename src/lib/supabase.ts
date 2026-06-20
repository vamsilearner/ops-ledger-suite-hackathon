import { createClient } from '@supabase/supabase-js';

// Fallback to the requested credentials directly if env variables are not loaded/configured yet
const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || 'https://odzkvgfefdxhswkqiatm.supabase.co';
const supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || 'sb_publishable_LVvfkNjlO4E7ciEh_RHkig_N8bvrJET';


export const supabase = createClient(supabaseUrl, supabaseAnonKey);
