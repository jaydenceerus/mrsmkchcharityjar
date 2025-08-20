// js/register-supabase.js
// Frontend registration using Supabase Auth + profiles table.
// Handles three cases:
//  - signUp returns error -> show friendly message (handles "User already registered")
//  - signUp returns data.user -> immediate account (no email confirm): insert profile now
//  - signUp returns no user (email confirmation required): save pending profile & prompt user to confirm
//
// IMPORTANT: replace SUPABASE_URL and SUPABASE_ANON_KEY with your project values.

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

console.log("✅ register-supabase.js loaded");

// ---------- EDIT THESE to your Supabase project ----------
const SUPABASE_URL = 'https://eaivuhgvzdvvxscqqqji.supabase.co';     // <- replace
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVhaXZ1aGd2emR2dnhzY3FxcWppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU1OTMxNDIsImV4cCI6MjA3MTE2OTE0Mn0.ru1S0ZiYQluFFzYkrbFxqzk2v315xAA29iXlviy3Y1E';             // <- replace
// -------------------------------------------------------

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Utility helpers
const $ = id => document.getElementById(id);
const show = (id, text) => { const e = $(id); if(!e) return; e.classList.remove('hidden'); if (text) e.textContent = text; };
const hide = id => { const e = $(id); if(!e) return; e.classList.add('hidden'); };

// Pending-profile storage key (used when e-mail confirmation is required)
const PENDING_PROFILE_KEY = 'wishjar_pending_profile';

// validate inputs client-side
function validate(values){
  let ok = true;
  hide('fullnameError'); hide('usernameError'); hide('emailError'); hide('phoneError');
  hide('affiliationError'); hide('passwordError'); hide('confirmError'); hide('apiError');

  if (!values.fullName) { show('fullnameError'); ok = false; }
  if (!values.username) { show('usernameError', 'Username is required.'); ok = false; }
  if (!values.email || !/^\S+@\S+\.\S+$/.test(values.email)) { show('emailError'); ok = false; }
  if (!values.phone) { show('phoneError'); ok = false; }
  if (!values.affiliation) { show('affiliationError'); ok = false; }
  if (!values.password || values.password.length < 8) { show('passwordError'); ok = false; }
  if (values.password !== values.confirmPassword) { show('confirmError'); ok = false; }
  return ok;
}

// check username exists in profiles table (returns true if taken)
async function isUsernameTaken(username){
  const { data, error } = await supabase
    .from('profiles')
    .select('username')
    .eq('username', username)
    .limit(1);

  if (error) {
    console.error('Username check error', error);
    throw new Error('Could not validate username availability.');
  }

  return (Array.isArray(data) && data.length > 0);
}

// Insert profile row. Expects userId (uuid).
async function insertProfile(userId, { username, fullName, hideFullName, phone, affiliation }){
  const { data, error } = await supabase
    .from('profiles')
    .insert([{
      id: userId,
      username,
      full_name: fullName,
      hide_full_name: !!hideFullName,
      phone,
      affiliation
    }], { returning: 'minimal' });

  if (error) {
    console.error('Profile insert error', error);
    throw error;
  }
  return true;
}

// If the user signs in (after confirming email), create pending profile if present
supabase.auth.onAuthStateChange(async (event, session) => {
  if (event === 'SIGNED_IN' && session?.user) {
    try {
      const pendingRaw = localStorage.getItem(PENDING_PROFILE_KEY);
      if (!pendingRaw) return;
      const pending = JSON.parse(pendingRaw);
      if (!pending || !pending.email) return;

      // Only insert if profile not already present
      const uid = session.user.id;
      const { data: existing, error: existErr } = await supabase.from('profiles').select('id').eq('id', uid).limit(1);
      if (existErr) {
        console.error('Error checking existing profile after sign-in', existErr);
        // don't remove pending - try again later or admin can inspect
        return;
      }
      if (existing && existing.length) {
        localStorage.removeItem(PENDING_PROFILE_KEY);
        return;
      }

      // Insert profile now that we have an auth user id
      try {
        await insertProfile(uid, pending);
        localStorage.removeItem(PENDING_PROFILE_KEY);
        console.log('Inserted pending profile after sign-in.');
      } catch (err) {
        // Normalize error info
        console.error('Error inserting pending profile after sign-in', err);
        const code = err?.code || err?.status || null;
        const msg = (err && err.message) ? err.message.toString() : String(err);
        const isRls = (code === '42501') || /row[-\s]?level security/i.test(msg) || /violates row-level security/i.test(msg);

        if (isRls) {
          // This is the RLS insert failure: keep pending so we can retry later and inform the user via console
          console.warn('Pending profile insertion blocked by RLS. Will keep pending profile for retry after next sign-in.');
          // Optionally notify the user in-app (do not spam)
          // show('apiError', 'Your profile could not be created yet. Please contact support if this persists.');
          return;
        }

        // other errors: surface message for admin/debug
        // You may choose to show a UI error, but avoid leaking internals to users
        show('apiError', msg || 'Could not save profile after sign-in.');
        return;
      }
    } catch (err) {
      console.error('Unexpected error in onAuthStateChange handler', err);
    }
  }
});


// Main form handler
const formEl = $('registerForm');
if (!formEl) {
  console.error('registerForm not found in the DOM. Make sure the script tag is placed after the form or use defer.');
} else {
  formEl.addEventListener('submit', async (ev) => {
    ev.preventDefault();

    const fullName = $('fullname').value.trim();
    const hideFullName = !!$('hideFullName').checked;
    const username = $('username').value.trim();
    const email = $('email').value.trim();
    const phone = $('phone').value.trim();
    const affiliation = $('affiliation').value;
    const password = $('password').value;
    const confirmPassword = $('confirmPassword').value;

    const values = { fullName, username, email, phone, affiliation, password, confirmPassword };

    if (!validate(values)) return;

    // Confirm 18+
    if (!confirm('By continuing you confirm you are 18 years old or older. Proceed?')) return;

    // Disable the button
    const btn = $('submitRegister');
    btn.disabled = true;
    const origText = btn.textContent;
    btn.textContent = 'Creating account...';

    try {
      // Check username availability first (helps avoid creating auth user with taken username)
      const taken = await isUsernameTaken(username);
      if (taken) {
        show('usernameError', 'Username already taken.');
        btn.disabled = false;
        btn.textContent = origText;
        return;
      }

      // Create Auth user in Supabase
      // NOTE: use the v2 style signUp call (object + options)
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { username } }
      });

      if (signUpError) {
        console.error('SignUp error', signUpError);

        // Handle common/known errors more nicely:
        const msg = (signUpError?.message || '').toString();

        if (msg.toLowerCase().includes('already') || msg.toLowerCase().includes('registered')) {
          // User already exists -> suggest login or reset
          show('apiError', 'Email already registered. Try signing in or use password reset.');
          // optionally redirect to login after small delay
          setTimeout(()=> { window.location.href = 'index.html'; }, 1800);
          return;
        }

        // Generic error
        show('apiError', signUpError.message || 'Unable to create account.');
        btn.disabled = false;
        btn.textContent = origText;
        return;
      }

      // No error from signUp. Two possible states:
      // 1) signUpData.user exists => an immediate session created (no email confirm required)
      // 2) signUpData.user is null => email confirmation required (or other flow); we must wait
      const createdUser = signUpData?.user ?? null;

      if (createdUser && createdUser.id) {
  // Case 1: Insert profile immediately (but handle RLS failures gracefully)
  try {
    await insertProfile(createdUser.id, { username, fullName, hideFullName, phone, affiliation });
    alert('Registration successful. You may now sign in.');
    window.location.href = 'index.html';
    return;
  } catch (err) {
    // err may be a Supabase error object or a thrown Error
    console.error('Profile insert after immediate signup failed', err);

    // Normalize error message/code
    const code = err?.code || err?.status || null;
    const msg = (err && err.message) ? err.message.toString() : String(err);

    // Detect RLS/Postgres permission error (code 42501) or message mentioning row-level security
    const isRls = (code === '42501') || /row[-\s]?level security/i.test(msg) || /violates row-level security/i.test(msg);

    if (isRls) {
      // Fall back to Option A: save pending profile locally and ask user to confirm email/sign in.
      const pending = { email, username, fullName, hideFullName, phone, affiliation };
      try { localStorage.setItem(PENDING_PROFILE_KEY, JSON.stringify(pending)); } catch(e){ console.warn('Could not save pending profile locally', e); }

      alert('Account created — please check your email and confirm your address. After confirming, sign in and we will finish creating your profile.');
      window.location.href = 'index.html';
      return;
    }

    // Other errors: show friendly message
    show('apiError', msg || 'Profile save failed. Contact admin.');
    btn.disabled = false;
    btn.textContent = origText;
    return;
  }
}


      // Case 2: Email confirmation required (or no immediate user returned)
      // Save pending profile in localStorage and instruct user to confirm email
      const pending = { email, username, fullName, hideFullName, phone, affiliation };
      localStorage.setItem(PENDING_PROFILE_KEY, JSON.stringify(pending));

      // Friendly alert and redirect to login page
      alert('Registration started. Please check your email and confirm your address. After confirming, sign in and your profile will be created automatically.');
      window.location.href = 'index.html';
      return;

    } catch (err) {
      console.error('Unexpected error', err);
      show('apiError', err.message || 'Unexpected error');
    } finally {
      btn.disabled = false;
      btn.textContent = origText;
    }
  });
}
