const LS_ACTIVE_USER = 'wishjar_active_user';
let currentUser = null;

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

// ---------- CONFIG ----------
const SUPABASE_URL = "https://eaivuhgvzdvvxscqqqji.supabase.co"; // replace
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVhaXZ1aGd2emR2dnhzY3FxcWppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU1OTMxNDIsImV4cCI6MjA3MTE2OTE0Mn0.ru1S0ZiYQluFFzYkrbFxqzk2v315xAA29iXlviy3Y1E";                          // replace
// ----------------------------

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// LocalStorage keys are no longer needed for primary data

// --- DATABASE CONNECTION TEST ---
// This code will run automatically as soon as admin.js is loaded

let activeChannel = null;

function subscribeToMessages(conversationId, userId, senderLabel, containerId) {
  // remove old channel if it exists
  if (activeChannel) {
    supabase.removeChannel(activeChannel);
    activeChannel = null;
  }

  activeChannel = supabase
    .channel(`messages-${conversationId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`
      },
      (payload) => {
        const m = payload.new;
        const isMine = m.sender_id === userId;

        const msgContainer = document.getElementById(containerId);
        const bubble = document.createElement('div');
        bubble.className = `p-3 rounded-lg max-w-[80%] my-1 ${
          isMine
            ? (senderLabel === 'Admin'
                ? 'bg-indigo-600 ml-auto text-white'
                : 'bg-blue-500 ml-auto text-white')
            : 'bg-white/10 text-white'
        }`;
        bubble.innerHTML = `
          <div class="text-xs opacity-80">
            ${isMine ? `You (${senderLabel})` : m.sender_name || 'Other'}
            • ${new Date(m.created_at).toLocaleString()}
          </div>
          <div class="mt-1">${m.body.replace(/</g, "&lt;")}</div>
        `;
        msgContainer.appendChild(bubble);
        msgContainer.scrollTop = msgContainer.scrollHeight;
      }
    )
    .subscribe((status) => {
      console.log("Realtime channel status:", status);
    });
}

async function uploadFile(file, folder = 'wishes') {
  if (!file) return null;
  try {
    // unique name: timestamp + original name
    const ts = Date.now();
    const safeName = `${ts}_${file.name.replace(/\s+/g,'_')}`;
    const path = `${folder}/${safeName}`;

    // upload
    const { data: uploadData, error: uploadErr } = await supabase
      .storage
      .from('wishes')            // <-- bucket name
      .upload(path, file, { upsert: false });

    if (uploadErr) {
      console.error('Upload error:', uploadErr);
      return null;
    }

    // get public URL
    const { data: urlData } = supabase
      .storage
      .from('wishes')
      .getPublicUrl(path);

    return urlData?.publicUrl || null;
  } catch (err) {
    console.error('Unexpected upload error', err);
    return null;
  }
}

function generateRandomNickname() {
  const adjectives = ["Star", "Brave", "Happy", "Gentle", "Wise", "Lucky", "Kind", "Shiny", "Mighty", "Calm"];
  const animals = ["Panda", "Tiger", "Eagle", "Dolphin", "Fox", "Owl", "Lion", "Rabbit", "Whale", "Koala"];
  
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const animal = animals[Math.floor(Math.random() * animals.length)];
  
  return `${adj} ${animal}`;
}


  async function isUserAdmin(userId) {
    if (!userId) {
      console.log("isUserAdmin check failed: No userId provided.");
      return false;
    }

    try {
      console.log("isUserAdmin: Querying database for user:", userId);
      
      const { data, error, count } = await supabase
        .from('admins')
        .select('user_id', { count: 'exact' })
        .eq('user_id', userId);

      // This will now run if the query succeeds
      console.log("isUserAdmin: Query returned. Error:", error, "Count:", count);

      if (error) {
        console.error("Error checking admin status inside try/catch:", error);
        return false;
      }

      return count > 0;

    } catch (e) {
      // This will catch any unexpected errors, like network failures
      console.error("A critical, unexpected error occurred in isUserAdmin:", e);
      return false;
    }
  }


// --- Auth Guard ---
document.addEventListener('DOMContentLoaded', () => {
    initializeAdminPage();
});

async function initializeAdminPage() {
    // 1. Explicitly fetch the current user to ensure the session is fully validated.
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
        console.log("Auth Guard: No verified user session found. Redirecting.");
        window.location.href = 'index.html';
        return;
    }

    // 2. Now that we have a verified user, check if they are an admin.
    const isAdmin = await isUserAdmin(user.id);

    if (!isAdmin) {
        console.log("Auth Guard: Access denied. User is not an admin.");
        alert('Admin access only. Redirecting to login.');
        await supabase.auth.signOut();
        window.location.href = 'index.html';
    } else {
        // 3. If they are an admin, store the user and set up the page.
        console.log("Auth Guard: Access granted for", user.email);
        currentUser = user;
        renderAdmin(); // Initial data load
        renderAdminInbox();
    }
}

// Ensure logout works early
const logoutBtnEl = document.getElementById('logoutBtn');
if (logoutBtnEl) {
  logoutBtnEl.addEventListener('click', () => {
    supabase.auth.signOut();
    // Clear any remaining local storage for good measure
    localStorage.clear();
    window.location.href = 'index.html';
  });
}


// --- Supabase Storage Helpers ---
async function loadWishes() {
  const { data, error } = await supabase.from('wishes').select('*').order('created_at', { ascending: false });
  console.log(data);
  if (error) { console.error("Error loading wishes:", error); return []; }
  return data;
}

async function addWish(wishData) {
  // 1. Get the highest numeric part of id (strip 'w' and cast to int)
  const { data: existing, error: fetchError } = await supabase
    .from('wishes')
    .select('id')
    .order('id', { ascending: false }) // fallback
    .limit(1000); // fetch enough to manually parse

  if (fetchError) {
    console.error("Error fetching last wish:", fetchError);
    return null;
  }

  let newId = "w1"; // default if no wishes exist
  if (existing && existing.length > 0) {
    // Extract numbers from all IDs
    const nums = existing
      .map(w => parseInt(w.id.replace("w", ""), 10))
      .filter(n => !isNaN(n));

    const maxNum = Math.max(...nums, 0);
    newId = "w" + (maxNum + 1);
  }

  // 2. Insert wish with new ID
  const { data, error } = await supabase
    .from('wishes')
    .insert([{ ...wishData, id: newId }])
    .select();

  if (error) {
    console.error("Error adding wish:", error);
    return null;
  }

  return data[0];
}



async function updateWish(id, updates) {
  try {
    const { data, error } = await supabase
      .from('wishes')
      .update(updates)
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) {
      console.error('updateWish error', error);
      return null;
    }
    return data;
  } catch (err) {
    console.error(err);
    return null;
  }
}


async function loadDonations() {
  const { data, error } = await supabase.from('donations').select('*').order('pledged_at', { ascending: false });
  if (error) { console.error("Error loading donations:", error); return []; }
  return data;
}

async function updateDonation(code, updates) {
    const { data, error } = await supabase.from('donations').update(updates).eq('code', code);
    if (error) console.error("Error updating donation:", error);
    return data;
}

async function loadConversations() {
  const { data, error } = await supabase
    .from('conversations')
    .select(`
      id,
      title,
      created_at,
      donor_id,
      donations!fk_conversations_donor ( donor )
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error("Error loading conversations:", error);
    return [];
  }

  return data;
}


async function loadMessages(conversationId) {
    const { data, error } = await supabase.from('messages').select('*').eq('conversation_id', conversationId).order('created_at');
    if (error) { console.error("Error loading messages:", error); return []; }
    return data;
}

async function sendMessage(conversationId, text) {
    const { data, error } = await supabase.from('messages').insert([{
        conversation_id: conversationId,
        sender_id: currentUser.id,
        body: text
    }]);
    if (error) console.error("Error sending message:", error);
    return data;
}

// --- Donor Directory Loader ---
async function loadDonorDirectory() {
  console.log("attempt to log");
  const { data: donations, error } = await supabase
    .from('donations')
    .select(`
      donor_id,
      donor,
      wish_nickname,
      timestamp
    `)
    .order('timestamp', { ascending: true });

  if (error) {
    console.error("Error loading donor directory:", error);
    return;
  }

  // Group by donor_id
  const grouped = {};
  donations.forEach(d => {
    if (!d.donor_id) return;
    if (!grouped[d.donor_id]) {
      grouped[d.donor_id] = {
        donor: d.donor,
        wishes: []
      };
    }
    if (d.wish_nickname) grouped[d.donor_id].wishes.push(d.wish_nickname);
  });

  const donorList = document.getElementById("donorList");
  donorList.innerHTML = "";

  Object.values(grouped).forEach(d => {
    const info = d.donor || {};
    const wishes = d.wishes.length ? d.wishes.join(", ") : "No wishes yet";

    const card = document.createElement("div");
    card.className =
      "p-4 bg-white/10 rounded-xl border border-white/10";

    card.innerHTML = `
      <div class="font-semibold text-lg">${info.displayName || info.fullName || info.nickname || "Anonymous"}</div>
      <div class="text-sm text-white/80">${info.email || "No email"}</div>
      <div class="text-sm text-white/80">${info.phone || "No phone"}</div>
      <div class="mt-2 text-sm"><span class="font-medium">Type:</span> ${info.type || "N/A"}</div>
      ${info.amount ? `<div class="text-sm"><span class="font-medium">Amount:</span> ${info.amount}</div>` : ""}
      ${info.message ? `<div class="text-sm italic text-white/70">"${info.message}"</div>` : ""}
      ${info.timeline ? `<div class="text-sm"><span class="font-medium">Timeline:</span> ${info.timeline}</div>` : ""}
      <div class="mt-2 text-sm">
        <span class="font-medium">Wishes granted:</span> ${wishes}
      </div>
    `;

    donorList.appendChild(card);
  });
}

document.getElementById("donorSearch").addEventListener("input", e => {
  const term = e.target.value.toLowerCase();
  document.querySelectorAll("#donorList > div").forEach(card => {
    card.style.display = card.textContent.toLowerCase().includes(term) ? "" : "none";
  });
});

async function findOrCreateConversationForDonation(donation) {
    // Check if a conversation already exists for this donation code
    let { data: existing, error: findError } = await supabase
        .from('conversations')
        .select('id, title')
        .eq('title', `Wish: ${donation.wish_nickname} • ${donation.code}`)
        .limit(1);

    if (findError) {
        console.error("Error finding conversation", findError);
        return null;
    }

    if (existing && existing.length > 0) {
        return existing[0]; // Return existing conversation
    }

    // If not, create one
    const { data: newConvo, error: createError } = await supabase
        .from('conversations')
        .insert({
            donor_id: donation.donor_id,
            title: `Wish: ${donation.wish_nickname} • ${donation.code}`
        })
        .select()
        .single();

    if (createError) {
        console.error("Error creating conversation", createError);
        return null;
    }
    return newConvo;
}


// --- UI Rendering and Event Handlers ---

// Admin tabs + pages
const adminTabs = document.querySelectorAll('.adminTab');
const adminPages = {
  track: document.getElementById('admin-track'),
  manage: document.getElementById('admin-manage'),
  donors: document.getElementById('admin-donors'),
  inbox: document.getElementById('admin-inbox')
};

function switchAdminTab(tab) {
  Object.entries(adminPages).forEach(([k, el]) => el.classList.toggle('hidden', k !== tab));
  adminTabs.forEach(b => {
    const isSelected = b.dataset.tab === tab;
    b.classList.toggle('bg-white', isSelected);
    b.classList.toggle('text-indigo-700', isSelected);
    b.classList.toggle('font-semibold', isSelected);
    b.classList.toggle('bg-white/10', !isSelected);
  });
  if (tab === 'inbox') renderAdminInbox();
  if (tab === 'manage') renderManageWishes();
  if (tab === "donors") {
    document.getElementById("admin-donors").classList.remove("hidden");
    loadDonorDirectory();
  }
}
adminTabs.forEach(b => b.addEventListener('click', () => switchAdminTab(b.dataset.tab)));


// Render admin track + donations + wishes
// In wishjarv1/js/admin.js

async function renderAdmin() {
  const adminWishes = document.getElementById('adminWishes');
  const adminDonations = document.getElementById('adminDonations');

  if (!adminWishes || !adminDonations) {
    console.error("Critical Error: Could not find 'adminWishes' or 'adminDonations' containers in the DOM.");
    return;
  }

  try {
    const [wishes, donations] = await Promise.all([loadWishes(), loadDonations()]);
    console.log('Black');

// --- Render Wishes Summary ---
adminWishes.innerHTML = '';
if (wishes && wishes.length > 0) {
  wishes.forEach(w => {
    const isGranted = donations && donations.some(d => d.wish_id === w.id && d.status_phase === 2);
    const block = document.createElement('div');
    block.className = 'rounded-xl bg-white/10 p-4 mb-3';
    block.innerHTML = `
      <div class="flex items-center justify-between">
        <div>
          <div class="font-semibold">${w.nickname} 
            <span class="text-xs opacity-70">(${w.category}, ${w.emotion || 'hope'})</span>
          </div>
          <div class="text-sm opacity-80">${w.wish}</div>
        </div>
        <div class="flex items-center gap-2">
          <span class="px-3 py-1 rounded-full ${isGranted ? 'bg-green-400 text-green-900' : 'bg-white/20'} font-semibold text-sm">
            ${isGranted ? 'Granted' : 'Pending'}
          </span> 
          <button 
            class="showStudentBtn px-3 py-1 text-xs rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white"
            data-wishid="${w.id}">
            Show Student
          </button>
        </div>
      </div>
      <div class="studentDetails hidden mt-2 p-2 rounded-lg bg-white/5 text-sm"></div>
    `;
    adminWishes.appendChild(block);
  });

  // ✅ match the class correctly
  adminWishes.querySelectorAll('.showStudentBtn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const wishId = btn.dataset.wishid;
      // ✅ use the sibling details div instead of getElementById
      const detailsDiv = btn.closest('.rounded-xl').querySelector('.studentDetails');

      if (!detailsDiv.classList.contains('hidden')) {
        detailsDiv.classList.add('hidden');
        detailsDiv.innerHTML = '';
        btn.textContent = 'Show Student';
        return;
      }

      // Fetch student details
      const { data, error } = await supabase
        .from('wishes')
        .select('studentname, student_class')
        .eq('id', wishId)
        .maybeSingle();

      if (error) {
        detailsDiv.innerHTML = `<div class="text-red-400">Failed to load student details.</div>`;
      } else if (data) {
        detailsDiv.innerHTML = `
          <div><span class="font-medium">Student:</span> ${data.studentname || 'Unknown'}</div>
          <div><span class="font-medium">Class:</span> ${data.student_class || 'Unknown'}</div>
        `;
      } else {
        detailsDiv.innerHTML = `<div class="text-yellow-400">No student details found.</div>`;
      }

      detailsDiv.classList.remove('hidden');
      btn.textContent = 'Hide Student';
    });
  });

} else {
  adminWishes.innerHTML = `<div class="text-white/80 p-4">No wishes yet!</div>`;
}

    // --- Render Donations Management ---
    adminDonations.innerHTML = '';
    if (donations && donations.length > 0) {
      for (const d of donations) {
        const row = document.createElement('div');
        row.className = 'rounded-2xl bg-white/10 p-5 space-y-3';
        row.innerHTML = `
  <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
    <div>
      <div class="font-semibold">${d.code}</div>
      <div class="text-sm opacity-80">Wish: ${d.wish_nickname}</div>
    </div>
    <div>
      <div class="text-sm opacity-80">Donor</div>
      <div>${d.donor.displayName || '-'} <span class="opacity-70">(${d.donor.type})</span></div>
    </div>
    <div>
      <span class="px-3 py-1 rounded-full ${d.status_phase === 2 ? 'bg-green-400 text-green-900' : d.status_phase === 1 ? 'bg-blue-300 text-blue-900' : 'bg-yellow-300 text-yellow-900'} font-semibold text-sm">
        ${d.status_phase === 2 ? 'Granted' : d.status_phase === 1 ? 'Received' : 'Pledged'}
      </span>
    </div>
  </div>
  <div class="flex items-center gap-3">
    <span class="text-xs">Pledged</span>
    <input data-slider="${d.code}" type="range" min="0" max="2" step="1" value="${d.status_phase ?? 0}" class="w-full accent-amber-300">
    <span class="text-xs">Granted</span>
    <button data-open-thread='${d.code}' data-donor-id='${d.donor_id}' class="ml-3 px-3 py-2 rounded-lg bg-white/10 text-sm">Chat</button>
    <button data-delete-donation='${d.code}' class="ml-2 px-3 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm">🗑️ Delete</button>
  </div>
`;

  const thanks = await loadThanks(d.code);
  if (thanks.length > 0) {
    const thanksDiv = document.createElement("div");
    thanksDiv.className = "mt-3 p-3 rounded-xl bg-green-100/10";
    thanksDiv.innerHTML = `
      <div class="font-semibold mb-1">Student Thank-you</div>
      ${thanks
        .map(
          t => `
          <div class="text-sm mb-2">
            💌 ${t.message}
            ${t.image_url ? `<img src="${t.image_url}" class="mt-1 rounded-lg max-h-40" />` : ""}
          </div>`
        )
        .join("")}
    `;
    row.appendChild(thanksDiv);
  }

        adminDonations.appendChild(row);
      };

      // --- Chat Button Logic ---
      document.querySelectorAll('[data-open-thread]').forEach(btn => {
        btn.addEventListener('click', async () => {
        const donationCode = btn.getAttribute('data-open-thread');
        const donorId = btn.getAttribute('data-donor-id');

    // 1. Check if conversation already exists
    const { data: existingConversation, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('donation_code', donationCode)
      .maybeSingle();

    if (error) {
      console.error("Error checking conversation:", error);
      return;
    }

    let conversation;
    if (existingConversation) {
      conversation = existingConversation;
      console.log("Opening existing conversation:", conversation);
    } else {
      console.log(donorId);
      const { data: newConversation, error: insertErr } = await supabase
        .from('conversations')
        .insert([{ donation_code: donationCode, title: `Donation ${donationCode}`, donor_id: donorId }])
        .select()
        .single();

      if (insertErr) {
        console.error("Error creating conversation:", insertErr);
        return;
      }
      conversation = newConversation;
      console.log("Created new conversation:", conversation);
    }

    // ✅ Switch to inbox and open the conversation
    switchAdminTab('inbox');
    openAdminThread(conversation.id, conversation.title || `Donation ${donationCode}`);
  });
});

      // --- Delete Button Logic ---
document.querySelectorAll('[data-delete-donation]').forEach(btn => {
  btn.addEventListener('click', async () => {
    const donationCode = btn.getAttribute('data-delete-donation');
    if (!confirm(`Are you sure you want to delete donation ${donationCode}?`)) return;
    console.log(donationCode);
    const { error: delErr } = await supabase
      .from('donations')
      .delete()
      .eq('code', donationCode);

    if (delErr) {
      console.error("Error deleting donation:", delErr);
      alert("Failed to delete donation.");
    } else {
      // remove from UI
      btn.closest('.rounded-2xl').remove();
    }
  });
});

// --- Slider Logic ---
document.querySelectorAll('[data-slider]').forEach(slider => {
  slider.addEventListener('input', async () => {
    const donationCode = slider.getAttribute('data-slider');
    const newPhase = parseInt(slider.value, 10);

    console.log("changing", donationCode, newPhase);

    // update donation status_phase
    const { error: updateErr } = await supabase
      .from('donations')
      .update({ status_phase: newPhase })
      .eq('code', donationCode);

    if (updateErr) {
      console.error("Error updating status:", updateErr);
      alert("Failed to update donation status.");
      return;
    }

    // UI: update the status badge immediately
    const badge = slider.closest('.rounded-2xl')
      .querySelector('span.px-3'); // status badge span
    if (badge) {
      badge.textContent =
        newPhase === 2 ? 'Granted' :
        newPhase === 1 ? 'Received' : 'Pledged';
      badge.className =
        `px-3 py-1 rounded-full font-semibold text-sm ${
          newPhase === 2 ? 'bg-green-400 text-green-900' :
          newPhase === 1 ? 'bg-blue-300 text-blue-900' :
          'bg-yellow-300 text-yellow-900'
        }`;
    }

    // If the donation was moved to "Granted", update wish + profile totals
    if (newPhase === 2) {
      try {
        // 1) Fetch the donation to get donor_id and wish_id & donor.amount
        const { data: donation, error: dErr } = await supabase
          .from('donations')
          .select('*')
          .eq('code', donationCode)
          .maybeSingle();

        if (dErr) {
          console.error("Failed to fetch donation for post-grant updates:", dErr);
        } else if (donation) {
          const donorId = donation.donor_id;
          const wishId = donation.wish_id;

          // 2) Mark wish as granted and store donation code on wish
          if (wishId) {
            const { error: wishErr } = await supabase
              .from('wishes')
              .update({ granted: true })
              .eq('id', wishId);
            if (wishErr) console.error("Failed to update wish.granted:", wishErr);
          }

          // 3) Update profile counters for donor (if donor_id exists)
          if (donorId) {
            // Fetch current profile counters
            const { data: profile, error: pErr } = await supabase
              .from('profiles')
              .select('wishes_granted, total_pledges, total_donated')
              .eq('id', donorId)
              .maybeSingle();

            if (pErr) {
              console.error("Error loading profile for donor:", pErr);
            } else {
              // parse donation amount from donation.donor.amount (safe parsing)
              let donationAmount = 0;
              try {
                const raw = (donation.donor && donation.donor.amount) ? String(donation.donor.amount) : '';
                donationAmount = parseFloat(raw.replace(/[^0-9.-]+/g, '')) || 0;
              } catch (e) { donationAmount = 0; }

              const newWishesGranted = (profile?.wishes_granted || 0) + 1;
              const newTotalPledges = (profile?.total_pledges || 0) + 1;
              const newTotalDonated = (parseFloat(profile?.total_donated || 0) || 0) + donationAmount;

              const { error: updErr } = await supabase
                .from('profiles')
                .update({
                  wishes_granted: newWishesGranted,
                  total_pledges: newTotalPledges,
                  total_donated: newTotalDonated
                })
                .eq('id', donorId);

              if (updErr) console.error("Error updating profile counters:", updErr);
            }
          } else {
            console.log("Donation has no donor_id; skipping profile updates.");
          }
        } else {
          console.warn("Donation not found when trying to perform grant-side updates.");
        }
      } catch (e) {
        console.error("Unexpected error while performing grant updates:", e);
      }
    }
  });
});


    }
  } catch (error) {
    console.error("An error occurred while rendering the admin panel:", error);
    adminWishes.innerHTML = `<div class="text-red-300 p-4">Error loading wishes.</div>`;
    adminDonations.innerHTML = `<div class="text-red-300 p-4">Error loading donations.</div>`;
  }
}

// Thank You Form
const thankyouForm = document.getElementById("thankyouForm");
if (thankyouForm) {
  thankyouForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const donationCode = document.getElementById("tyCode").value.trim();
    const message = document.getElementById("tyNote").value.trim();
    const imageFile = document.getElementById("tyImage").files[0];

    if (!donationCode || !message) {
      alert("Please enter a donation code and message.");
      return;
    }

    let imageUrl = null;
    if (imageFile) {
      // Upload image to Supabase Storage (bucket: "thanks")
      const filePath = `thanks/${donationCode}-${Date.now()}-${imageFile.name}`;
      const { error: uploadErr } = await supabase.storage
        .from("thanks")
        .upload(filePath, imageFile);

      if (uploadErr) {
        console.error("Image upload error:", uploadErr);
        alert("Failed to upload image.");
        return;
      }

      const { data: publicUrlData } = supabase.storage
        .from("thanks")
        .getPublicUrl(filePath);

      imageUrl = publicUrlData.publicUrl;
    }

    // Insert thank-you into DB
    const { data, error } = await supabase
      .from("thanks")
      .insert([{ donation_code: donationCode, message, image_url: imageUrl }])
      .select()
      .single();

    if (error) {
      console.error("Error saving thank-you:", error);
      alert("Failed to save thank-you note.");
      return;
    }

    alert("Thank-you saved!");
    thankyouForm.reset();
  });
}

async function loadThanks(donationCode) {
  const { data, error } = await supabase
    .from("thanks")
    .select("*")
    .eq("donation_code", donationCode)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error loading thanks:", error);
    return [];
  }
  return data;
}




// Add Wish Form
const addWishForm = document.getElementById('addWishForm');
if (addWishForm) {
  addWishForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(addWishForm);
    const nickname = formData.get('nickname').trim() || generateRandomNickname();

    const newWish = {
      nickname,
      category: formData.get('category'),
      emotion: formData.get('emotion'),
      batch: formData.get('batch'),
      situation: formData.get('situation').trim(),
      wish: formData.get('wish').trim(),
      studentname: formData.get('studentName').trim(),
      student_class: formData.get('studentClass').trim(),
      granted: false
};


    const added = await addWish(newWish);
    if(added){
        addWishForm.reset();
        renderManageWishes(); // Refresh list
        alert('New wish has been added to the database.');
    } else {
        alert('Failed to add wish.');
    }
  });
}

async function renderManageWishes() {
    const wishes = await loadWishes();
    const listEl = document.getElementById('manageWishesList');
    if (!listEl) return;
    listEl.innerHTML = '';
    wishes.forEach(w => {
        const item = document.createElement('div');
        item.className = 'p-3 rounded-lg bg-white/5 flex items-center justify-between';
        item.innerHTML = `
            <div>
                <span class="font-semibold">${w.nickname}</span>
                <span class="text-xs opacity-70">(${w.batch || 'no batch'})</span>
                <p class="text-sm">${w.wish}</p>
            </div>
            <div class="flex gap-2 items-center">
              <button data-edit-id="${w.id}" class="px-3 py-1 text-xs rounded-lg bg-indigo-500/20 text-indigo-200 hover:bg-indigo-500/40">Edit</button>
              <button data-delete-id="${w.id}" class="px-3 py-1 text-xs rounded-lg bg-red-500/20 text-red-200 hover:bg-red-500/50">Delete</button>
            </div>
        `;
        listEl.appendChild(item);
    });

    // Edit listeners
    listEl.querySelectorAll('[data-edit-id]').forEach(btn => {
        btn.onclick = async () => {
            const id = btn.dataset.editId;
            // find the wish object
            const wishesLocal = await loadWishes();
            const w = wishesLocal.find(x => x.id === id);
            if (!w) { alert('Could not load wish for editing.'); return; }
            openEditWishModal(w);
        };
    });

    // Delete listeners (preserves existing delete logic)
    listEl.querySelectorAll('[data-delete-id]').forEach(btn => {
        btn.onclick = async () => {
            const id = btn.dataset.deleteId;
            if (confirm(`Are you sure you want to delete wish ${id}? This cannot be undone.`)) {
                const { error } = await supabase.from('wishes').delete().eq('id', id);
                if (error) {
                    alert('Error deleting wish: ' + (error.message || error));
                } else {
                    renderManageWishes(); // Refresh
                }
            }
        };
    });
}

function openEditWishModal(wish) {
  // close any existing modal
  closeEditModal();

  const modal = document.createElement('div');
  modal.id = 'editWishModal';
  modal.className = 'fixed inset-0 z-50 flex items-center justify-center p-4';

  modal.innerHTML = `
    <div
      class="absolute inset-0"
      style="
        background: rgba(0,0,0,0.45);
        -webkit-backdrop-filter: blur(6px);
        backdrop-filter: blur(6px);
      "
    ></div>

    <div class="relative w-full max-w-2xl bg-white/5 rounded-2xl shadow-xl flex flex-col max-h-[90vh]">
      <!-- Header -->
      <div class="flex justify-between items-center p-6 border-b border-white/10 flex-shrink-0">
        <h3 class="text-lg font-semibold">Edit Wish — ${wish.id}</h3>
        <button id="closeEditBtn" class="px-2 py-1 rounded bg-white/10">✕</button>
      </div>

         <!-- Scrollable content -->
      <div class="overflow-y-auto p-6 space-y-3 text-sm flex-1">
        <form id="editWishForm" class="space-y-3" enctype="multipart/form-data">
          <div class="grid grid-cols-2 gap-3">
            <label class="block">
              <div class="text-xs opacity-80">Nickname</div>
              <input name="nickname" value="${(wish.nickname||'').replace(/"/g,'&quot;')}" class="w-full p-2 rounded bg-white/10" />
            </label>
            <label class="block">
              <div class="text-xs opacity-80">Category</div>
              <input name="category" value="${(wish.category||'').replace(/"/g,'&quot;')}" class="w-full p-2 rounded bg-white/10" />
            </label>
            <label class="block">
              <div class="text-xs opacity-80">Emotion</div>
              <input name="emotion" value="${(wish.emotion||'').replace(/"/g,'&quot;')}" class="w-full p-2 rounded bg-white/10" />
            </label>
            <label class="block">
              <div class="text-xs opacity-80">Batch</div>
              <input name="batch" value="${(wish.batch||'').replace(/"/g,'&quot;')}" class="w-full p-2 rounded bg-white/10" />
            </label>
          </div>

          <label class="block">
            <div class="text-xs opacity-80">Situation (short)</div>
            <input name="situation" value="${(wish.situation||'').replace(/"/g,'&quot;')}" class="w-full p-2 rounded bg-white/10" />
          </label>

          <label class="block">
            <div class="text-xs opacity-80">Wish (detailed)</div>
            <textarea name="wish" class="w-full p-2 rounded bg-white/10" rows="3">${(wish.wish||'').replace(/</g,'&lt;')}</textarea>
          </label>

          <div class="grid grid-cols-2 gap-3">
            <label class="block">
              <div class="text-xs opacity-80">Student name</div>
              <input name="studentname" value="${(wish.studentname||'').replace(/"/g,'&quot;')}" class="w-full p-2 rounded bg-white/10" />
            </label>
            <label class="block">
              <div class="text-xs opacity-80">Student class</div>
              <input name="student_class" value="${(wish.student_class||'').replace(/"/g,'&quot;')}" class="w-full p-2 rounded bg-white/10" />
            </label>
          </div>

          <label class="flex items-center gap-2">
            <input type="checkbox" name="granted" ${wish.granted ? 'checked' : ''} />
            <span class="text-xs opacity-80">Granted</span>
          </label>

          <!-- CURRENT IMAGES -->
          <div class="grid grid-cols-2 gap-4 mt-2">
            <div>
              <div class="text-xs opacity-80">Current student photo</div>
              ${wish.student_image_url ? 
                `<img id="currentStudentImage" src="${wish.student_image_url}" class="w-28 h-28 object-cover rounded mt-2" />` :
                `<div id="currentStudentImage" class="w-28 h-28 bg-white/5 rounded mt-2 flex items-center justify-center text-xs">No photo</div>`
              }
            </div>
            <div>
              <div class="text-xs opacity-80">Current situation photo</div>
              ${wish.situation_image_url ? 
                `<img id="currentSituationImage" src="${wish.situation_image_url}" class="w-28 h-28 object-cover rounded mt-2" />` :
                `<div id="currentSituationImage" class="w-28 h-28 bg-white/5 rounded mt-2 flex items-center justify-center text-xs">No photo</div>`
              }
            </div>
          </div>

          <!-- FILE INPUTS -->
          <div>
            <div class="text-xs opacity-80">Replace student photo (optional)</div>
            <input type="file" id="editStudentImage" name="student_image" accept="image/*" class="mt-1" />
            <div id="editStudentImagePreview" class="mt-2"></div>
          </div>

          <div>
            <div class="text-xs opacity-80">Replace situation photo (optional)</div>
            <input type="file" id="editSituationImage" name="situation_image" accept="image/*" class="mt-1" />
            <div id="editSituationImagePreview" class="mt-2"></div>
          </div>

          <div class="flex justify-end gap-2 pt-4">
            <button type="button" id="cancelEditBtn" class="px-4 py-2 rounded bg-white/10">Cancel</button>
            <button type="submit" class="px-4 py-2 rounded bg-indigo-600 text-white">Save changes</button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // close handlers
  document.getElementById('closeEditBtn').onclick = closeEditModal;
  document.getElementById('cancelEditBtn').onclick = closeEditModal;

  // --- preview helpers (same as before) ---
  const studentInput = document.getElementById('editStudentImage');
  const situationInput = document.getElementById('editSituationImage');
  const studentPreview = document.getElementById('editStudentImagePreview');
  const situationPreview = document.getElementById('editSituationImagePreview');

  function showPreview(file, targetPreview, replaceCurrentId) {
    targetPreview.innerHTML = '';
    if (!file) return;
    const url = URL.createObjectURL(file);
    targetPreview.innerHTML = `<img src="${url}" class="w-28 h-28 object-cover rounded" />`;
    const current = document.getElementById(replaceCurrentId);
    if (current) current.style.display = 'none';
  }

  studentInput?.addEventListener('change', (e) =>
    showPreview(e.target.files?.[0], studentPreview, 'currentStudentImage')
  );
  situationInput?.addEventListener('change', (e) =>
    showPreview(e.target.files?.[0], situationPreview, 'currentSituationImage')
  );

  // --- submit handler (your existing update logic) ---
  const form = document.getElementById('editWishForm');
  form.onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(form);

    const studentFile = studentInput?.files?.[0] || null;
    const situationFile = situationInput?.files?.[0] || null;

    let studentUrl = null, situationUrl = null;
    try {
      const [sUrl, sitUrl] = await Promise.all([
        studentFile ? uploadFile(studentFile, 'student_images') : null,
        situationFile ? uploadFile(situationFile, 'situation_images') : null,
      ]);
      studentUrl = sUrl; situationUrl = sitUrl;
    } catch (err) {
      console.error('Edit image upload error', err);
      alert('Failed to upload images.');
      return;
    }

    const updates = {
      nickname: (fd.get('nickname') || '').trim(),
      category: (fd.get('category') || '').trim(),
      emotion: (fd.get('emotion') || '').trim(),
      batch: (fd.get('batch') || '').trim(),
      situation: (fd.get('situation') || '').trim(),
      wish: (fd.get('wish') || '').trim(),
      studentname: (fd.get('studentname') || '').trim(),
      student_class: (fd.get('student_class') || '').trim(),
      granted: !!fd.get('granted'),
    };
    if (studentUrl) updates.student_image_url = studentUrl;
    if (situationUrl) updates.situation_image_url = situationUrl;

    try {
      const res = await updateWish(wish.id, updates);
      if (res) {
        alert('Wish updated successfully.');
        closeEditModal();
        renderManageWishes();
      } else {
        alert('Failed to update wish.');
      }
    } catch (err) {
      console.error('Error updating wish:', err);
      alert('Unexpected error.');
    }
  };
} 


function closeEditModal() {
    const existing = document.getElementById('editWishModal');
    if (existing) existing.remove();
}


// Reset Demo
const resetBtn = document.getElementById('resetDemo');
if (resetBtn) resetBtn.addEventListener('click', async () => {
  if (!confirm('This will delete ALL wishes, donations, and messages from the database. Are you absolutely sure?')) return;
  
  // You would typically create a Supabase Function with the service_role key to do this securely.
  // The following is NOT recommended for production but demonstrates the client-side calls.
  console.log("Attempting to clear data...");
  const { error: msgErr } = await supabase.from('messages').delete().neq('id', 0);
  const { error: convoErr } = await supabase.from('conversations').delete().neq('id', 0);
  const { error: thanksErr } = await supabase.from('thanks').delete().neq('id', 0);
  const { error: donErr } = await supabase.from('donations').delete().neq('id', 0);
  const { error: wishErr } = await supabase.from('wishes').delete().neq('id', 0);

  if (msgErr || convoErr || donErr || wishErr || thanksErr) {
      alert('An error occurred. Check RLS policies. Some data may not be cleared.');
      console.error({ msgErr, convoErr, donErr, wishErr, thanksErr });
  } else {
      alert('Database tables have been cleared.');
  }
  renderAdmin();
  renderAdminInbox();
});


// ----------------------
// Admin Inbox functions
// ----------------------
async function renderAdminInbox() {
  const { data: threads, error } = await supabase
  .from('conversations')
  .select(`
    id,
    title,
    created_at,
    donation_code,
    donations!conversations_donation_code_fkey (
      code,
      donor
    )
  `)
  .order('created_at', { ascending: false });

  const listEl = document.getElementById('adminThreadList');
  const badge = document.getElementById('adminInboxBadge');

  if (!listEl) return;
  if (error) {
    console.error("Error loading conversations:", error);
    listEl.innerHTML = `<div class="p-4 text-red-400">Failed to load inbox.</div>`;
    return;
  }

  listEl.innerHTML = threads.length ? '' : `<div class="p-4 text-white/80">No conversations yet.</div>`;

  for (const t of threads) {
     const donorJson = t.donations?.donor || {};
    const donorName = donorJson.displayName || donorJson.fullName || donorJson.nickname || "Anonymous Donor";

    // --- Fetch last message preview ---
    const { data: lastMsg } = await supabase
      .from('messages')
      .select('body, created_at, sender_name')
      .eq('conversation_id', t.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const previewText = lastMsg ? lastMsg.body.slice(0, 40) : "No messages yet";
    const previewSender = lastMsg ? (lastMsg.sender_name || "Donor") : "";

    const el = document.createElement('div');
    el.className = 'px-4 py-3 hover:bg-white/5 flex justify-between items-center';

    el.innerHTML = `
      <div class="cursor-pointer w-full">
        <div class="font-semibold">${t.title}</div>
        <div class="text-xs opacity-80">Donor: ${donorName}</div>
        <div class="text-xs opacity-70">
          ${previewSender ? previewSender + ": " : ""}${previewText}
        </div>
        <div class="text-xs opacity-50">${new Date(t.created_at).toLocaleString()}</div>
      </div>
      <button class="delete-convo px-2 py-1 rounded-md bg-red-600/80 hover:bg-red-700 text-white text-xs" data-id="${t.id}">
        🗑️
      </button>
    `;

    // --- open conversation ---
    el.querySelector('div.cursor-pointer').addEventListener('click', () =>
      openAdminThread(t.id, t.title)
    );

    listEl.appendChild(el);
  }

  // --- delete handlers ---
  document.querySelectorAll('.delete-convo').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const convoId = btn.getAttribute('data-id');
      if (!confirm("Are you sure you want to delete this conversation?")) return;

      const { error } = await supabase.from('conversations').delete().eq('id', convoId);
      if (error) {
        console.error("Failed to delete conversation:", error);
        alert("Could not delete conversation.");
      } else {
        btn.closest('div').remove();
        renderAdminInbox(); // re-render after deletion
      }
    });
  });

  if (badge) badge.textContent = `${threads.length} thread(s)`;
  if (!activeChannel) clearAdminChatView();
}



async function openAdminThread(conversationId, title) {
  switchAdminTab('inbox');
  document.querySelector('#adminChatHeader .font-semibold').textContent = title;
  document.getElementById('adminChatMeta').textContent = `ID: ${conversationId}`;
  const msgContainer = document.getElementById('adminChatMessages');
  msgContainer.innerHTML = '<div>Loading messages...</div>';

  const messages = await loadMessages(conversationId);
  msgContainer.innerHTML = '';
  messages.forEach(m => {
    const isAdmin = m.sender_id === currentUser.id;
    const div = document.createElement('div');
    div.className = `p-3 rounded-lg max-w-[80%] my-1 ${
      isAdmin ? 'bg-indigo-600 ml-auto text-white' : 'bg-white/10 text-white'
    }`;
    div.innerHTML = `
      <div class="text-xs opacity-80">${isAdmin ? 'You (Admin)' : m.sender_name || 'Donor'} • ${new Date(m.created_at).toLocaleString()}</div>
      <div class="mt-1">${m.body.replace(/</g, "&lt;")}</div>
    `;
    msgContainer.appendChild(div);
  });
  msgContainer.scrollTop = msgContainer.scrollHeight;

  // subscribe to realtime updates
  subscribeToMessages(conversationId, currentUser.id, 'Admin', 'adminChatMessages');

  // setup form
  const chatForm = document.getElementById('adminChatForm');
  chatForm.onsubmit = async (e) => {
    e.preventDefault();
    const input = document.getElementById('adminChatInput');
    const txt = input.value.trim();
    if (!txt) return;
    await sendMessage(conversationId, txt);
    input.value = '';
  };
}

function clearAdminChatView() {
  const header = document.getElementById('adminChatHeader');
  if (header) header.querySelector('.font-semibold').textContent = 'Select a conversation';
  const messagesEl = document.getElementById('adminChatMessages');
  if (messagesEl) messagesEl.innerHTML = '';
  const meta = document.getElementById('adminChatMeta');
  if (meta) meta.textContent = '';
  const chatForm = document.getElementById('adminChatForm');
  if (chatForm) chatForm.onsubmit = (e) => e.preventDefault();
}

function subscribeToConversations() {
  supabase
    .channel('conversations-realtime')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'conversations' }, 
      (payload) => {
        console.log("New conversation detected:", payload.new);
        renderAdminInbox(); // refresh inbox when new thread arrives
      }
    )
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'conversations' }, 
      (payload) => {
        console.log("Conversation deleted:", payload.old);
        renderAdminInbox(); // refresh inbox on deletion
      }
    )
    .subscribe();
}

// Call once on page init
subscribeToConversations();

// Initial render calls
switchAdminTab('track');