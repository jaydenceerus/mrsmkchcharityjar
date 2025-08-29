// js/login-supabase.js
// Plug-and-play Supabase login integration with pending-profile handling.
// - Uses email + password sign-in via Supabase
// - After sign-in, attempts to move a locally-stored pending profile (wishjar_pending_profile)
//   into the 'profiles' table as id = auth user id (so it satisfies RLS).
// - Stores a small local session (LS_ROLE, LS_ACTIVE_USER) and routes admin -> admin.html else donor.html
//
// IMPORTANT: update SUPABASE_URL and SUPABASE_ANON_KEY below.

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

console.log('✅ login-supabase.js loaded');

// ---------- EDIT THESE ----------
const SUPABASE_URL = 'https://eaivuhgvzdvvxscqqqji.supabase.co';         // <- replace if needed
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVhaXZ1aGd2emR2dnhzY3FxcWppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU1OTMxNDIsImV4cCI6MjA3MTE2OTE0Mn0.ru1S0ZiYQluFFzYkrbFxqzk2v315xAA29iXlviy3Y1E';                      // <- replace if needed
// Add emails that should be considered "admin" accounts (lowercase is recommended)
const ADMIN_EMAILS = ['christianoben294@gmail.com'];                     // <- replace with your admin email(s)
// -------------------------------

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// localStorage keys (keeps parity with your old demo)
const LS_ROLE = 'wishjar_role';
const LS_ACTIVE_USER = 'wishjar_active_user';
const PENDING_KEY = 'wishjar_pending_profile';

// helpers
const $ = id => document.getElementById(id);
const show = (id, text) => { const e = $(id); if(!e) return; e.classList.remove('hidden'); if (text) e.textContent = text; };
const hide = id => { const e = $(id); if(!e) return; e.classList.add('hidden'); };
const setLS = (k,v) => { try { localStorage.setItem(k, v); } catch(e){} };

async function isUserAdmin(userId) {
  if (!userId) return false;
  const { data, error, count } = await supabase
    .from('admins')
    .select('user_id', { count: 'exact' })
    .eq('user_id', userId);
  if (error) {
    console.error("Error checking admin status during login:", error);
    return false;
  }
  return count > 0;
}

// Show pending banner if pending profile exists (small UX)
document.addEventListener('DOMContentLoaded', () => {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    if (!raw) return;
    const pending = JSON.parse(raw);
    const banner = $('pendingBanner');
    const txt = $('pendingBannerText');
    const clearBtn = $('clearPendingBtn');
    if (banner && txt && clearBtn) {
      const emailText = pending?.email ? `Pending registration for ${pending.email}.` : 'You have a pending registration.';
      txt.textContent = `${emailText} Please confirm your email, then sign in to finish creating your profile.`;
      banner.classList.remove('hidden');
      clearBtn.addEventListener('click', () => {
        localStorage.removeItem(PENDING_KEY);
        banner.classList.add('hidden');
      });
    }
  } catch(e) {
    console.error('Pending banner error', e);
  }
});

// Helper: get profile by user id
async function fetchProfileById(uid){
  const { data, error } = await supabase.from('profiles').select('*').eq('id', uid).limit(1).single();
  if (error) {
    // if RLS prevents select, data will be null and error present
    console.warn('fetchProfileById error', error);
    return null;
  }
  return data;
}

/**
 * tryInsertPendingProfile(user)
 * - user: Supabase user object returned after sign-in (contains .id and .email)
 *
 * Behavior:
 * - reads pending profile from localStorage (key 'wishjar_pending_profile')
 * - verifies pending.email matches the signed-in user's email (best-effort check)
 * - inserts profile row with id = user.id
 * - on success: removes pending from localStorage
 * - on RLS / other failure: keeps pending and returns a reason so caller can act
 */
async function tryInsertPendingProfile(user) {
  if (!user || !user.id) return null;

  try {
    const raw = localStorage.getItem(PENDING_KEY);
    if (!raw) return null; // nothing to do

    const pending = JSON.parse(raw);
    if (!pending || !pending.email) return null;

    // Safety check: ensure the pending email matches the signed-in user's email
    const signedInEmail = (user.email || '').toLowerCase();
    const pendingEmail = (pending.email || '').toLowerCase();

    if (signedInEmail && pendingEmail && signedInEmail !== pendingEmail) {
      console.warn('Pending profile email does not match signed-in user email; skipping auto-insert.');
      return { ok: false, reason: 'email_mismatch' };
    }

    // Build insert payload and run the insert (id = user.id to satisfy RLS policy)
    const payload = {
      id: user.id,
      username: pending.username,
      full_name: pending.fullName,
      hide_full_name: !!pending.hideFullName,
      phone: pending.phone,
      affiliation: pending.affiliation
    };
    console.log(payload);
    const { data, error } = await supabase
      .from('profiles')
      .insert([payload], { returning: 'minimal' });

    if (error) {
      console.error('Error inserting pending profile:', error);

      // Normalize error detection
      const code = error?.code || error?.status || null;
      const msg = (error?.message || '').toString();

      // RLS blocked it (shouldn't happen if user is signed in and id matches), keep pending
      if (code === '42501' || /row[-\s]?level security/i.test(msg) || /violates row-level security/i.test(msg)) {
        console.warn('Insert blocked by RLS. Pending profile retained.');
        return { ok: false, reason: 'rls', error };
      }

      // Unique constraint / duplicate (Postgres: 23505) — username or email conflict
      if (error?.code === '23505' || /unique/i.test(msg) || /duplicate/i.test(msg)) {
        console.warn('Unique constraint conflict for pending profile.', msg);
        return { ok: false, reason: 'unique', error };
      }

      // Other error: keep pending and return
      return { ok: false, reason: 'other', error };
    }

    // Success: remove pending localStorage and return success
    try { localStorage.removeItem(PENDING_KEY); } catch(e){ console.warn('Could not remove pending profile from localStorage', e); }
    console.log('Pending profile inserted successfully for user', user.id);
    return { ok: true };
  } catch (err) {
    console.error('Unexpected error in tryInsertPendingProfile:', err);
    return { ok: false, reason: 'exception', error: err };
  }
}

// Main login handler
const form = $('loginForm');
if (!form) {
  console.error('loginForm not found. Make sure login-supabase.js is loaded after the form and the script tag uses type="module".');
} else {
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    hide('loginApiError'); hide('emailError'); hide('passwordError');

    const email = ($('email').value || '').trim();
    const password = ($('password').value || '').trim();
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) { show('emailError'); return; }
    if (!password) { show('passwordError'); return; }

    const btn = $('signinBtn');
    const orig = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Signing in...';

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        console.error('Sign in error', error);
        show('loginApiError', 'Invalid email or password.');
        btn.disabled = false;
        btn.textContent = orig;
        return;
      }

      const user = data?.user ?? null;
      if (!user) {
        show('loginApiError', 'Sign-in failed. Please try again.');
        btn.disabled = false;
        btn.textContent = orig;
        return;
      }

      // ✅ Try to insert any pending profile (from register.js)
      const result = await tryInsertPendingProfile(user);

      if (result && !result.ok) {
        console.warn('Pending profile could not be inserted:', result.reason);
        // optional: show user-friendly message
        // show('loginApiError', 'We could not finish setting up your profile. Please contact support.');
      }

      // --- ADMIN CHECK ---
      const isAdmin = await isUserAdmin(user.id);

      // redirect based on role
      if (isAdmin) {
        window.location.href = 'admin.html';
      } else {
        window.location.href = 'donor.html';
      }

    } catch (err) {
      console.error('Unexpected login error', err);
      show('loginApiError', 'An unexpected error occurred. Please try again.');
      btn.disabled = false;
      btn.textContent = orig;
    }
  });
}
