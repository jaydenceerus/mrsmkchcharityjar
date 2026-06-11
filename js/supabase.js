// js/supabase.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL      = 'https://gybcidzljqrmlhpjlxib.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5YmNpZHpsanFybWxocGpseGliIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExNDk4MzAsImV4cCI6MjA5NjcyNTgzMH0.MAy1jhw5cdbaed8I0iXnjpdURJGa8wP-kMN43SCcOMI'  // your anon key

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
