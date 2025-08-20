// js/register-supabase.js
// Frontend registration using Supabase Auth + profiles table.
// - Validates the form
// - Checks username availability (via profiles table)
// - Signs up user via supabase.auth.signUp
// - Inserts profile row (id = auth.user.id) if signup returns an immediate user
// - If email confirmation is enabled (no immediate user), stores a pending profile in localStorage.
// - When the user later signs in (after email confirmation), the onAuthStateChange handler will attempt to insert the pending profile.
//
// IMPORTANT:
// 1) Replace SUPABASE_URL and SUPABASE_ANON_KEY with values from your Supabase project (Settings → API).
// 2) Run the SQL provided (below) to create 'profiles' and RLS policies.
// 3) For privacy: review the RLS policies suggested in the SQL section.

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

console.log("✅ register-supabase.js loa22ded");

// ---------- EDIT THESE to your Supabase project ----------
const SUPABASE_URL = 'https://eaivuhgvzdvvxscqqqji.supabase.co';     // <- replace
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVhaXZ1aGd2emR2dnhzY3FxcWppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU1OTMxNDIsImV4cCI6MjA3MTE2OTE0Mn0.ru1S0ZiYQluFFzYkrbFxqzk2v315xAA29iXlviy3Y1E';             // <- replace
// -------------------------------------------------------

console.log("✅ register-supabase.js loaded");

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
  // Note: this requires public read/select on profiles (see SQL/RLS instructions).
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', username)
    .limit(1);

  if (error) {
    console.error('Username check error', error);
    // If you don't want to allow public reads in production, consider creating an RPC or server endpoint.
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
    }], { returning: 'minimal' }); // we don't need the inserted row returned

  if (error) {
    console.error('Profile insert error', error);
    throw error;
  }
  return true;
}

// If the user signs in (after confirming email), create pending profile if present
supabase.auth.onAuthStateChange(async (event, session) => {
  // event examples: 'SIGNED_IN', 'SIGNED_OUT', 'PASSWORD_RECOVERY', ...
  if (event === 'SIGNED_IN' && session?.user) {
    try {
      const pendingRaw = localStorage.getItem(PENDING_PROFILE_KEY);
      if (!pendingRaw) return;
      const pending = JSON.parse(pendingRaw);
      if (!pending || !pending.email) return;

      // Only insert if profile not already present
      const uid = session.user.id;
      const { data: existing } = await supabase.from('profiles').select('id').eq('id', uid).limit(1);
      if (existing && existing.length) {
        localStorage.removeItem(PENDING_PROFILE_KEY);
        return;
      }

      // Insert profile now that we have an auth user id
      await insertProfile(uid, pending);
      localStorage.removeItem(PENDING_PROFILE_KEY);
      console.log('Inserted pending profile after sign-in.');
    } catch (err) {
      console.error('Error inserting pending profile after sign-in', err);
    }
  }
});

// Main form handler
$('registerForm').addEventListener('submit', async (ev) => {
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
    // NOTE: metadata can include public fields; don't put secrets here.
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp(
      { email, password },
      { data: { username } } // optional metadata
    );

    if (signUpError) {
      console.error('SignUp error', signUpError);
      show('apiError', signUpError.message || 'Unable to create account.');
      btn.disabled = false;
      btn.textContent = origText;
      return;
    }

    // If signUpData.user exists immediately (no e-mail confirmation required),
    // we can insert the profile right away.
    const createdUser = signUpData?.user ?? null;
    if (createdUser && createdUser.id) {
      try {
        await insertProfile(createdUser.id, { username, fullName, hideFullName, phone, affiliation });
        alert('Registration successful. You may now sign in.');
        window.location.href = 'index.html';
        return;
      } catch (err) {
        // If profile insertion fails but auth exists, show message. Cleaning up the auth user
        // requires the service_role key (we avoid that on client). You can manually remove user
        // from Supabase dashboard if needed.
        show('apiError', err.message || 'Profile save failed. Contact admin.');
        btn.disabled = false;
        btn.textContent = origText;
        return;
      }
    }

    // If we reach here, signUp did not return a user (likely because email confirmation is required).
    // Save a pending profile in localStorage and prompt the user to confirm email.
    const pending = { email, username, fullName, hideFullName, phone, affiliation };
    localStorage.setItem(PENDING_PROFILE_KEY, JSON.stringify(pending));

    alert('Registration initiated. Please check your email and confirm your address. After confirming, sign in and your profile will be created automatically.');
    window.location.href = 'index.html';
  } catch (err) {
    console.error('Unexpected error', err);
    show('apiError', err.message || 'Unexpected error');
  } finally {
    btn.disabled = false;
    btn.textContent = origText;
  }
});
