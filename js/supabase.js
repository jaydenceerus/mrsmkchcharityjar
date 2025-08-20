// js/supabase.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL      = 'https://eaivuhgvzdvvxscqqqji.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOi...';  // your anon key

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
