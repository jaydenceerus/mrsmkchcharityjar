import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

// ---------- CONFIG ----------
const SUPABASE_URL = "https://eaivuhgvzdvvxscqqqji.supabase.co"; // replace
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVhaXZ1aGd2emR2dnhzY3FxcWppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU1OTMxNDIsImV4cCI6MjA3MTE2OTE0Mn0.ru1S0ZiYQluFFzYkrbFxqzk2v315xAA29iXlviy3Y1E";                          // replace
// ----------------------------

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// LocalStorage keys are no longer needed for primary data
const LS_ACTIVE_USER = 'wishjar_active_user';
let currentUser = null;


// In wishjarv1/js/admin.js

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
supabase.auth.onAuthStateChange(async (event, session) => {
  const user = session?.user;

  if (!user) {
    console.log("Auth Guard: No user session found. Redirecting.");
    window.location.href = 'index.html';
    return;
  }

  console.log("Auth Guard: User found, checking admin status for user ID:", user.id);
  const isAdmin = await isUserAdmin(user.id);
  console.log("Auth Guard: Is user admin?", isAdmin); // This will tell you the result

  if (!isAdmin) {
    console.log("Auth Guard: Access denied. User is not an admin. Redirecting.");
    alert('Admin access only. Redirecting to login.');
    await supabase.auth.signOut(); 
    window.location.href = 'index.html';
  } else {
    console.log("Auth Guard: Access granted. Proceeding to render admin panel.");
    currentUser = user;
    renderAdmin();
    renderAdminInbox();
  }
});

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
    const { data, error } = await supabase.from('wishes').insert([wishData]).select();
    if (error) {
        console.error("Error adding wish:", error);
        return null;
    }
    return data[0];
}

async function updateWish(wishId, updates) {
    const { data, error } = await supabase.from('wishes').update(updates).eq('id', wishId);
    if (error) console.error("Error updating wish:", error);
    return data;
}

async function loadDonations() {
  const { data, error } = await supabase.from('donations').select('*').order('created_at', { ascending: false });
  if (error) { console.error("Error loading donations:", error); return []; }
  return data;
}

async function updateDonation(code, updates) {
    const { data, error } = await supabase.from('donations').update(updates).eq('code', code);
    if (error) console.error("Error updating donation:", error);
    return data;
}

async function loadConversations() {
    const { data, error } = await supabase.from('conversations').select('*, profiles:donor_id ( username, full_name )').order('created_at', { ascending: false });
    if (error) { console.error("Error loading conversations:", error); return []; }
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
        console.log(w);
        const isGranted = donations && donations.some(d => d.wish_id === w.id && d.status_phase === 2);
        const block = document.createElement('div');
        block.className = 'rounded-xl bg-white/10 p-4';
        block.innerHTML = `
          <div class="flex items-center justify-between">
            <div>
              <div class="font-semibold">${w.nickname} <span class="text-xs opacity-70">(${w.category}, ${w.emotion || 'hope'})</span></div>
              <div class="text-sm opacity-80">${w.wish}</div>
            </div>
            <div>
              <span class="px-3 py-1 rounded-full ${isGranted ? 'bg-green-400 text-green-900' : 'bg-white/20'} font-semibold text-sm">
                ${isGranted ? 'Granted' : 'Pending'}
              </span>
            </div>
          </div>`;
        adminWishes.appendChild(block);
      });
    } else {
      adminWishes.innerHTML = `<div class="text-white/80 p-4">No wishes yet!</div>`;
    }

    // --- Render Donations Management (FIXED: Moved inside the try block) ---
    adminDonations.innerHTML = '';
    if (donations && donations.length > 0) {
      donations.forEach(d => {
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
            <button data-open-thread='${JSON.stringify(d)}' class="ml-3 px-3 py-2 rounded-lg bg-white/10 text-sm">Chat</button>
          </div>
        `;
        adminDonations.appendChild(row);
      });

      // Event listeners for the newly created donation elements
      document.querySelectorAll('button[data-open-thread]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const donationData = JSON.parse(btn.dataset.openThread);
          const conversation = await findOrCreateConversationForDonation(donationData);
          if (conversation) {
            switchAdminTab('inbox');
            setTimeout(() => openAdminThread(conversation.id, conversation.title), 80);
          }
        });
      });

      document.querySelectorAll('input[type="range"][data-slider]').forEach(r => {
        r.addEventListener('input', async () => {
          const code = r.dataset.slider;
          const val = Number(r.value);
          const originalDonation = donations.find(d => d.code === code);
          if (!originalDonation) return;

          const updates = { status_phase: val };
          if (val >= 1 && !originalDonation.received_at) updates.received_at = new Date().toISOString();
          if (val >= 2 && !originalDonation.granted_at) {
            updates.granted_at = new Date().toISOString();
            await updateWish(originalDonation.wish_id, { granted: true });
          }
          await updateDonation(code, updates);
          renderAdmin();
        });
      });

    } else {
      adminDonations.innerHTML = `<div class="text-white/80 p-4">No donations yet!</div>`;
    }

  } catch (error) {
    console.error("An error occurred while rendering the admin panel:", error);
    adminWishes.innerHTML = `<div class="text-red-300 p-4">Error loading wishes.</div>`;
    adminDonations.innerHTML = `<div class="text-red-300 p-4">Error loading donations.</div>`;
  }
}
// Add Wish Form
const addWishForm = document.getElementById('addWishForm');
if (addWishForm) {
  addWishForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(addWishForm);
    const nickname = formData.get('nickname').trim() || `Student${Math.floor(100 + Math.random() * 900)}`;

    const newWish = {
      nickname,
      category: formData.get('category'),
      emotion: formData.get('emotion'),
      batch: formData.get('batch'),
      situation: formData.get('situation').trim(),
      wish: formData.get('wish').trim(),
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
            <button data-delete-id="${w.id}" class="px-3 py-1 text-xs rounded-lg bg-red-500/20 text-red-200 hover:bg-red-500/50">Delete</button>
        `;
        listEl.appendChild(item);
    });

    // Add delete listeners
    listEl.querySelectorAll('[data-delete-id]').forEach(btn => {
        btn.onclick = async () => {
            const id = btn.dataset.deleteId;
            if (confirm(`Are you sure you want to delete wish ${id}? This cannot be undone.`)) {
                const { error } = await supabase.from('wishes').delete().eq('id', id);
                if (error) {
                    alert('Error deleting wish: ' + error.message);
                } else {
                    renderManageWishes(); // Refresh
                }
            }
        };
    });
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
  const threads = await loadConversations();
  const listEl = document.getElementById('adminThreadList');
  const badge = document.getElementById('adminInboxBadge');
  if (!listEl) return;
  
  listEl.innerHTML = threads.length ? '' : `<div class="p-4 text-white/80">No conversations yet.</div>`;
  threads.forEach(t => {
    const el = document.createElement('div');
    el.className = 'px-4 py-3 hover:bg-white/5 cursor-pointer';
    el.innerHTML = `<div class="font-semibold">${t.title}</div><div class="text-xs opacity-80">${new Date(t.created_at).toLocaleString()}</div>`;
    el.addEventListener('click', () => openAdminThread(t.id, t.title));
    listEl.appendChild(el);
  });
  
  if (badge) badge.textContent = `${threads.length} thread(s)`;
  clearAdminChatView();
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
    div.className = `p-3 rounded-lg max-w-[80%] ${isAdmin ? 'bg-indigo-600 ml-auto' : 'bg-white/10'}`;
    div.innerHTML = `
      <div class="text-xs opacity-80">${isAdmin ? 'You (Admin)' : 'Donor'} • ${new Date(m.created_at).toLocaleString()}</div>
      <div class="mt-1">${m.body.replace(/</g, "&lt;")}</div>
    `;
    msgContainer.appendChild(div);
  });
  msgContainer.scrollTop = msgContainer.scrollHeight;

  const chatForm = document.getElementById('adminChatForm');
  chatForm.onsubmit = async (e) => {
    e.preventDefault();
    const input = document.getElementById('adminChatInput');
    const txt = input.value.trim();
    if (!txt) return;

    await sendMessage(conversationId, txt);
    input.value = '';
    openAdminThread(conversationId, title); // Re-render
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

// Initial render calls
switchAdminTab('track');