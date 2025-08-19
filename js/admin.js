// js/admin.js
const LS_ROLE = 'wishjar_role';
const LS_ACTIVE_USER = 'wishjar_active_user';
const LS_WISHES = 'wishjar_wishes';
const LS_DONATIONS = 'wishjar_donations';
const LS_MESSAGES = 'wishjar_messages';
const LS_THANKS = 'wishjar_thankyou';

// Ensure logout works early
const logoutBtnEl = document.getElementById('logoutBtn');
if (logoutBtnEl) {
  logoutBtnEl.addEventListener('click', () => {
    try { localStorage.removeItem(LS_ROLE); localStorage.removeItem(LS_ACTIVE_USER); } catch(e){}
    window.location.href = 'login.html';
  });
}

// Guard: only continue if admin
if (localStorage.getItem(LS_ROLE) !== 'admin') {
  alert('Admin access only (demo). Redirecting to login.');
  window.location.href = 'login.html';
}

// Storage helpers
function loadWishes() { const raw = localStorage.getItem(LS_WISHES); return raw ? JSON.parse(raw) : []; }
function saveWishes(w){ localStorage.setItem(LS_WISHES, JSON.stringify(w)); }
function loadDonations(){ const raw = localStorage.getItem(LS_DONATIONS); return raw ? JSON.parse(raw) : []; }
function saveDonations(list){ localStorage.setItem(LS_DONATIONS, JSON.stringify(list)); }
function loadMessages(){ const raw = localStorage.getItem(LS_MESSAGES); return raw ? JSON.parse(raw) : []; }
function saveMessages(list){ localStorage.setItem(LS_MESSAGES, JSON.stringify(list)); }
function loadThanks(){ const raw = localStorage.getItem(LS_THANKS); return raw ? JSON.parse(raw) : {}; }
function saveThanks(obj){ localStorage.setItem(LS_THANKS, JSON.stringify(obj)); }

// Admin tabs + pages (includes inbox)
const adminTabs = document.querySelectorAll('.adminTab');
const adminPages = {
  track: document.getElementById('admin-track'),
  manage: document.getElementById('admin-manage'),
  donors: document.getElementById('admin-donors'),
  inbox: document.getElementById('admin-inbox')
};
let currentAdminTab = 'track';
function switchAdminTab(tab){
  currentAdminTab = tab;
  Object.entries(adminPages).forEach(([k,el]) => {
    if (!el) return;
    if (k === tab) el.classList.remove('hidden'); else el.classList.add('hidden');
  });
  adminTabs.forEach(b=>{
    if (b.dataset.tab === tab) {
      b.classList.add('bg-white','text-indigo-700','font-semibold');
      b.classList.remove('bg-white/10');
    } else {
      b.classList.remove('bg-white','text-indigo-700','font-semibold');
      b.classList.add('bg-white/10');
    }
  });

  // load content for inbox when opened
  if (tab === 'inbox') {
    renderAdminInbox();
  }
}
adminTabs.forEach(b => b.addEventListener('click', ()=> switchAdminTab(b.dataset.tab)));
switchAdminTab('track');

// Render admin track + donations + wishes
function renderAdmin(){
  const wishes = loadWishes();
  const donations = loadDonations().slice().reverse();

  const adminWishes = document.getElementById('adminWishes');
  if (adminWishes) {
    adminWishes.innerHTML = '';
    wishes.forEach(w => {
      const dsFor = loadDonations().filter(d => d.wishId === w.id);
      const highest = dsFor.reduce((acc,d)=>Math.max(acc, d.statusPhase ?? 0), 0);
      const completed = highest === 2 || w.granted === true;
      const block = document.createElement('div');
      block.className = 'rounded-2xl bg-white/10 border border-white/10 p-6';
      block.innerHTML = `
        <div class="flex items-center justify-between">
          <div>
            <div class="font-semibold">${w.nickname} <span class="text-xs opacity-70">(${w.category}, ${w.emotion})</span></div>
            <div class="text-sm opacity-80">${w.wish}</div>
            <div class="text-xs opacity-70 mt-1">${dsFor.length} pledge(s) • Batch: ${w.batch || '-'}</div>
          </div>
          <div>
            <span class="px-3 py-1 rounded-full ${completed ? 'bg-green-400 text-green-900' : 'bg-white/20'} font-semibold text-sm">
              ${completed ? 'Granted' : 'In progress'}
            </span>
          </div>
        </div>
      `;
      adminWishes.appendChild(block);
    });
  }

  const adminDonations = document.getElementById('adminDonations');
  if (adminDonations) {
    adminDonations.innerHTML = donations.length ? '' : '<div class="text-white/80">No donations yet.</div>';
    donations.forEach(d => {
      const row = document.createElement('div');
      row.className = 'rounded-2xl bg-white/10 border border-white/10 p-6';
      row.innerHTML = `
        <div class="flex flex-col gap-3">
          <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <div class="text-sm opacity-80">Code</div>
              <div class="font-semibold">${d.code}</div>
              <div class="text-sm opacity-80 mt-1">Wish: ${d.wishNickname}</div>
            </div>
            <div>
              <div class="text-sm opacity-80">Donor</div>
              <div>${d.donor.displayName || '-' } <span class="opacity-70">(${d.donor.type})</span></div>
            </div>
            <div>
              <span class="px-3 py-1 rounded-full ${d.statusPhase === 2 ? 'bg-green-400 text-green-900' : d.statusPhase === 1 ? 'bg-blue-300 text-blue-900' : 'bg-yellow-300 text-yellow-900'} font-semibold text-sm">
                ${d.statusPhase === 2 ? 'Granted' : d.statusPhase === 1 ? 'Received' : 'Pledged'}
              </span>
            </div>
          </div>
          <div class="flex items-center gap-3">
            <span class="text-xs">Pledged</span>
            <input data-slider="${d.code}" type="range" min="0" max="2" step="1" value="${d.statusPhase ?? 0}" class="w-full accent-amber-300">
            <span class="text-xs">Granted</span>
            <button data-open-thread="${d.code}" class="ml-3 px-3 py-2 rounded-lg bg-white/10">Open Thread</button>
          </div>
          <div class="grid grid-cols-3 text-xs opacity-80">
            <div>${d.pledgedAt ? new Date(d.pledgedAt).toLocaleString() : '-'}</div>
            <div class="text-center">${d.receivedAt ? new Date(d.receivedAt).toLocaleString() : '-'}</div>
            <div class="text-right">${d.grantedAt ? new Date(d.grantedAt).toLocaleString() : '-'}</div>
          </div>
        </div>
      `;
      adminDonations.appendChild(row);
    });

    // bind "Open Thread" buttons
    document.querySelectorAll('button[data-open-thread]').forEach(btn=>{
      btn.addEventListener('click', ()=> {
        const code = btn.dataset.openThread;
        // open inbox tab and the thread
        switchAdminTab('inbox');
        // small timeout to ensure inbox rendered
        setTimeout(()=> openAdminThread(code), 80);
      });
    });
  }

  // bind sliders after DOM update
  document.querySelectorAll('input[type="range"][data-slider]').forEach(r=>{
    r.addEventListener('input', ()=>{
      const code = r.dataset.slider;
      const val = Number(r.value);
      const list = loadDonations();
      const idx = list.findIndex(x=>x.code===code);
      if (idx === -1) return;
      list[idx].statusPhase = val;
      if (val >= 1 && !list[idx].receivedAt) list[idx].receivedAt = new Date().toISOString();
      if (val >= 2 && !list[idx].grantedAt) {
        list[idx].grantedAt = new Date().toISOString();
        const wishes = loadWishes();
        const w = wishes.find(x => x.id === list[idx].wishId);
        if (w) w.granted = true;
        saveWishes(wishes);
      }
      saveDonations(list);
      renderAdmin();
    });
  });
}

// Wish form
const wishFormEl = document.getElementById('wishForm');
if (wishFormEl) {
  wishFormEl.addEventListener('submit', (e)=>{
    e.preventDefault();
    const name = document.getElementById('wishStudent').value.trim() || 'Student';
    const item = document.getElementById('wishItem').value.trim() || 'Help';
    const cat = document.getElementById('wishCategory').value;
    const wishes = loadWishes();
    const newid = 'w' + (Math.floor(Math.random()*9000)+1000);
    const w = { id:newid, nickname:name, situation:'(added by admin)', wish:item, category:cat, emotion:'hope', granted:false, batch:''};
    wishes.push(w);
    saveWishes(wishes);
    wishFormEl.reset();
    renderAdmin();
    alert('Wish added (demo).');
  });
}

// Reset demo
const resetBtn = document.getElementById('resetDemo');
if (resetBtn) resetBtn.addEventListener('click', ()=>{
  if(!confirm('Reset demo data? This clears local demo storage.')) return;
  localStorage.removeItem(LS_WISHES);
  localStorage.removeItem(LS_DONATIONS);
  localStorage.removeItem(LS_MESSAGES);
  localStorage.removeItem('wishjar_latest_code');
  localStorage.removeItem(LS_THANKS);
  alert('Demo data cleared. Re-open donor page to repopulate default wishes.');
  renderAdmin();
});

// ----------------------
// Admin Inbox functions
// ----------------------
function renderAdminInbox(){
  const threads = loadMessages().slice().reverse();
  const listEl = document.getElementById('adminThreadList');
  const badge = document.getElementById('adminInboxBadge');
  if (!listEl) return;
  listEl.innerHTML = threads.length ? '' : `<div class="p-4 text-white/80">No conversations yet.</div>`;
  threads.forEach(t => {
    const el = document.createElement('div');
    el.className = 'px-4 py-3 hover:bg-white/5 cursor-pointer';
    el.innerHTML = `<div class="font-semibold">${t.title}</div><div class="text-xs opacity-80">${new Date(t.createdAt).toLocaleString()}</div>`;
    el.addEventListener('click', ()=> openAdminThread(t.threadId));
    listEl.appendChild(el);
  });
  if (badge) badge.textContent = `${threads.length} thread(s)`;
  // clear chat view
  clearAdminChatView();
}

// Open a thread in admin inbox
function openAdminThread(threadId){
  const threads = loadMessages();
  const t = threads.find(x=>x.threadId === threadId);
  if (!t) {
    alert('Thread not found.');
    return;
  }
  // show header
  const header = document.getElementById('adminChatHeader');
  if (header) header.querySelector('.font-semibold').textContent = t.title;
  const meta = document.getElementById('adminChatMeta');
  if (meta) meta.textContent = `Thread: ${t.threadId}`;
  // render messages
  const messagesEl = document.getElementById('adminChatMessages');
  messagesEl.innerHTML = '';
  t.messages.forEach(m=>{
    const item = document.createElement('div');
    item.className = 'p-3 rounded-xl bg-white/10';
    item.innerHTML = `<div class="text-xs opacity-80">${m.from} • ${new Date(m.time).toLocaleString()}</div><div class="mt-1">${m.text}</div>`;
    messagesEl.appendChild(item);
  });
  // wire send handler: adminChatForm
  const chatForm = document.getElementById('adminChatForm');
  if (chatForm) {
    chatForm.onsubmit = (e)=>{
      e.preventDefault();
      const inp = document.getElementById('adminChatInput');
      const txt = (inp.value||'').trim();
      if (!txt) return;
      // append message
      t.messages.push({ from: 'Admin', text: txt, time: new Date().toISOString() });
      // save updated thread in storage (replace)
      const all = loadMessages();
      const idx = all.findIndex(x=>x.threadId===t.threadId);
      if (idx !== -1) all[idx] = t;
      else all.push(t);
      saveMessages(all);
      // reflect in UI
      inp.value = '';
      openAdminThread(threadId); // re-render
    };
  }
  // scroll messages to bottom
  setTimeout(()=> { const m = document.getElementById('adminChatMessages'); if (m) m.scrollTop = m.scrollHeight; }, 40);
}

function clearAdminChatView(){
  const header = document.getElementById('adminChatHeader');
  if (header) header.querySelector('.font-semibold').textContent = 'Select a conversation';
  const messagesEl = document.getElementById('adminChatMessages');
  if (messagesEl) messagesEl.innerHTML = '';
  const meta = document.getElementById('adminChatMeta');
  if (meta) meta.textContent = '';
  const chatForm = document.getElementById('adminChatForm');
  if (chatForm) chatForm.onsubmit = null;
  const inp = document.getElementById('adminChatInput');
  if (inp) inp.value = '';
}

// Convenience: if admin clicks "Open Thread" from donations, open that thread. If thread not exist, create it.
function openAdminThread(code){
  let threads = loadMessages();
  let t = threads.find(x=>x.threadId === code);
  if (!t) {
    // try build title from donation
    const d = loadDonations().find(x => x.code === code);
    const title = d ? `Wish: ${d.wishNickname} • ${d.code}` : `Thread • ${code}`;
    t = { threadId: code, title, wishId: d?.wishId || null, donorUsername: d?.donorUsername || 'unknown', createdAt: new Date().toISOString(), messages: [{ from:'Admin', text:'Thread created by admin.', time: new Date().toISOString() }] };
    threads.push(t);
    saveMessages(threads);
  }
  // open inbox tab then open thread
  switchAdminTab('inbox');
  // slight delay to ensure inbox rendered
  setTimeout(()=> openAdminThreadImmediate(code), 80);
}
function openAdminThreadImmediate(code){
  const threads = loadMessages();
  const t = threads.find(x=>x.threadId === code);
  if (!t) return;
  // render and open
  const listEl = document.getElementById('adminThreadList');
  // re-render list then open
  renderAdminInbox();
  setTimeout(()=> openAdminThreadUI(code), 60);
}
function openAdminThreadUI(code){
  // find the list item and click it (so normal open code runs)
  const list = document.getElementById('adminThreadList');
  if (!list) return;
  const btn = Array.from(list.children).find(child => child.textContent.includes(code) || child.textContent.includes(code.split('-').pop()));
  // fallback: directly call openAdminThread by id
  openAdminThread(code);
}

// initial render calls
renderAdmin();
renderAdminInbox();
