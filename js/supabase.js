// js/supabase.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL      = 'https://gfkxeplpiojmyibcfbum.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdma3hlcGxwaW9qbXlpYmNmYnVtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzNTQ4MzUsImV4cCI6MjA5NDkzMDgzNX0.E_3BrKvhGFrVBnBiJjc6jnxsakiHtYcbntHp1QEEGQ4'  // your anon key

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
