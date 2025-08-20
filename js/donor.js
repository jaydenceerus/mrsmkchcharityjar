// js/donor.js
// Keys
const LS_ROLE = 'wishjar_role';
const LS_ACTIVE_USER = 'wishjar_active_user';
const LS_WISHES = 'wishjar_wishes';
const LS_DONATIONS = 'wishjar_donations';
const LS_MESSAGES = 'wishjar_messages';
const LS_LATEST_CODE = 'wishjar_latest_code';
const LS_THANKS = 'wishjar_thankyou';

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

// ---------- CONFIG ----------
const SUPABASE_URL = "https://eaivuhgvzdvvxscqqqji.supabase.co"; // replace
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVhaXZ1aGd2emR2dnhzY3FxcWppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU1OTMxNDIsImV4cCI6MjA3MTE2OTE0Mn0.ru1S0ZiYQluFFzYkrbFxqzk2v315xAA29iXlviy3Y1E";                          // replace
// ----------------------------

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);


// Demo defaults (copied from original full.html)
const defaultWishes = [
  { id:'w1', nickname:'Star Panda',    situation:'Lives with single parent.', wish:'Black school shoes (size 38)', category:'shoes', emotion:'hope', granted:false, batch:'2025-08' },
  { id:'w2', nickname:'Blue Sparrow',  situation:'Shares study space with siblings.', wish:'Desk lamp + A4 books', category:'stationery', emotion:'determination', granted:false, batch:'2025-08' },
  { id:'w3', nickname:'Kind Tiger',    situation:'Long commute; limited lunch.', wish:'Meal allowance (RM60)', category:'meals', emotion:'sadness', granted:false, batch:'2025-08' },
  { id:'w4', nickname:'Bright Mango',  situation:'Exam prep; needs calculator.', wish:'Scientific calculator', category:'stationery', emotion:'determination', granted:false, batch:'2025-08' },
  { id:'w5', nickname:'Quiet Horizon', situation:'Shoes torn; uniform fading.', wish:'School uniform (size M)', category:'other', emotion:'embarrassment', granted:false, batch:'2025-08' },
  { id:'w6', nickname:'Silver Fern',   situation:'Limited data at home.', wish:'Data top-up (RM30)', category:'data', emotion:'anxiety', granted:false, batch:'2025-09' },
  { id:'w7', nickname:'Sunny Lychee',  situation:'Old bicycle to school.', wish:'Bicycle repair', category:'transport', emotion:'determination', granted:false, batch:'2025-09' },
  { id:'w8', nickname:'Jade River',    situation:'Spotty internet access.', wish:'Data top-up (RM30)', category:'data', emotion:'anxiety', granted:false, batch:'2025-09' },
  { id:'w9', nickname:'Coral Leaf',    situation:'Late-night studying.', wish:'Clip-on reading lamp', category:'stationery', emotion:'hope', granted:false, batch:'2025-09' },
  { id:'w10', nickname:'Ruby Dawn',    situation:'Flat tire risk.', wish:'Bike tube + mini pump', category:'transport', emotion:'anxiety', granted:false, batch:'2025-09' }
];
const EMOTION_COLORS = { hope:'#60A5FA', determination:'#34D399', sadness:'#A78BFA', embarrassment:'#F472B6', anxiety:'#FCA5A5' };
const CATEGORY_ICON = { shoes:'👟', stationery:'✏️', meals:'🧃', data:'📶', transport:'🚲', other:'🎒' };

// Ensure role present: redirect if not logged in
if (!localStorage.getItem(LS_ROLE)) {
  alert('Please sign in (demo). Redirecting to login.');
  window.location.href = 'index.html';
}

// Utilities
async function loadWishes() {
  let { data, error } = await supabase.from('wishes').select('*');
  if (error) {
    console.error("Error loading wishes:", error);
    return [];
  }
   console.log("Wishes loaded:", data);
  return data || []; // ensures it's always an array
}

async function saveWishes(wishes) {
  for (const w of wishes) {
    await supabase.from('wishes').upsert(w);
  }
}

// DONATIONS
async function loadDonations() {
  const { data, error } = await supabase.from('donations').select('*');
  if (error) { console.error(error); return []; }
  return data;
}
async function saveDonation(donation) {
  const { error } = await supabase.from('donations').insert([donation]);
  if (error) console.error(error);
}

// MESSAGES
async function loadMessages() {
  const { data, error } = await supabase.from('messages').select('*');
  if (error) { console.error(error); return []; }
  return data;
}
async function saveMessage(thread) {
  const { error } = await supabase.from('messages').upsert(thread);
  if (error) console.error(error);
}

// LATEST CODE
async function setLatestCode(code) {
  const { error } = await supabase.from('latest_code').upsert({ id:1, code });
  if (error) console.error(error);
}
async function getLatestCode() {
  const { data, error } = await supabase
  .from('latest_code')
  .select('code')
  .eq('id', 1)
  .maybeSingle();  // ✅ won't throw 406 if no row
  if (error) return null;
  return data?.code;
}

// THANKS
async function loadThanks() {
  const { data, error } = await supabase.from('thanks').select('*');
  if (error) { console.error(error); return {}; }
  const map = {};
  data.forEach(row => { map[row.code] = row; });
  return map;
}
async function saveThanks(obj) {
  const { error } = await supabase.from('thanks').upsert(obj);
  if (error) console.error(error);
}

// Router (pages are sections with IDs)
const navlinks = document.querySelectorAll('.navlink');
const pages = {
  home: document.getElementById('page-home'),
  about: document.getElementById('page-about'),
  achievements: document.getElementById('page-achievements'),
  status: document.getElementById('page-status'),
  donate: document.getElementById('page-donate'),
  inbox: document.getElementById('page-inbox')
};
function routeTo(name){
  Object.values(pages).forEach(p => p.classList.remove('active'));
  if (pages[name]) pages[name].classList.add('active');
  navlinks.forEach(n=>{
    if (n.dataset.route === name) n.classList.add('bg-white/20','font-semibold');
    else n.classList.remove('bg-white/20','font-semibold');
  });
  if (name === 'home') renderJar();
  if (name === 'inbox') renderInbox();
  if (name === 'achievements') renderAchievements();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
navlinks.forEach(btn => btn.addEventListener('click', ()=> routeTo(btn.dataset.route)));

// Logout
document.getElementById('logoutBtn').addEventListener('click', ()=>{
  try { localStorage.removeItem(LS_ROLE); localStorage.removeItem(LS_ACTIVE_USER); } catch(e){}
  window.location.href = 'index.html';
});

// Jar rendering
const ballsGroup = document.getElementById('ballsGroup');
const iconsLayer = document.getElementById('iconsLayer');

async function renderJar() {
  const circles = ballsGroup.querySelectorAll('circle[data-id]');
  const wishes = await loadWishes();   // ⬅️ FIXED
  const map = Object.fromEntries(wishes.map(w => [w.id, w]));
  const icons = [];
  console.log(wishes)
  circles.forEach(c => {
    const id = c.dataset.id;
    const w = map[id];
    if (w) {
      c.style.display = '';
      c.setAttribute('fill', EMOTION_COLORS[w.emotion] || '#FDE047');
      c.style.opacity = w.granted ? '1' : '.85';
      c.style.filter = w.granted ? 'drop-shadow(0 0 12px rgba(255,255,255,0.95))' : 'none';
      c.style.stroke = w.granted ? 'rgba(255,255,255,0.95)' : 'none';
      c.style.strokeWidth = w.granted ? '3' : '0';
      const cx = +c.getAttribute('cx'), cy = +c.getAttribute('cy');
      icons.push(
        `<text x="${cx}" y="${cy}" fill="#fff" text-anchor="middle" dominant-baseline="central" font-weight="700" font-size="12">${CATEGORY_ICON[w.category] || '🎒'}</text>`
      );
    } else {
      c.style.display = 'none';
    }
  });

  iconsLayer.innerHTML = icons.join('');
  await refreshBallHighlights();
}


// Modal open/close
const modal = document.getElementById('wishModal');
const modalBackdrop = document.getElementById('modalBackdrop');
const closeModalBtn = document.getElementById('closeModal');
const closeModalTop = document.getElementById('closeModalTop');
const grantBtn = document.getElementById('grantBtn');
const wishNickname = document.getElementById('wishNickname');
const wishEmotion = document.getElementById('wishEmotion');
const wishSituation = document.getElementById('wishSituation');
const wishText = document.getElementById('wishText');

let currentWishId = null;
function openModal(wishId){
  const w = loadWishes().find(x=>x.id===wishId);
  if(!w) return;
  currentWishId = wishId;
  wishNickname.textContent = w.nickname || 'Student';
  wishEmotion.textContent = w.emotion ? (w.emotion[0].toUpperCase()+w.emotion.slice(1)) : '-';
  wishSituation.textContent = w.situation || '';
  wishText.textContent = w.wish || '';
  modal.classList.remove('modal-hidden'); modal.classList.add('modal-visible');
  modalBackdrop.classList.remove('opacity-0','pointer-events-none'); modalBackdrop.classList.add('opacity-100');
}
function closeModal(){
  modal.classList.remove('modal-visible'); modal.classList.add('modal-hidden');
  modalBackdrop.classList.add('opacity-0','pointer-events-none'); modalBackdrop.classList.remove('opacity-100');
  currentWishId = null;
}
closeModalBtn.addEventListener('click', closeModal);
closeModalTop.addEventListener('click', closeModal);
modalBackdrop.addEventListener('click', closeModal);
document.addEventListener('keydown', (e)=>{ if (e.key === 'Escape') closeModal(); });

// Click on jar circle
ballsGroup.addEventListener('click', (e)=>{
  const t = e.target;
  if (t && t.tagName === 'circle' && t.dataset.id) openModal(t.dataset.id);
});

// Grant -> go to pledge form
const donateWishBadge = document.getElementById('donateWishBadge');
grantBtn.addEventListener('click', ()=>{
  if (!currentWishId) return;
  const w = loadWishes().find(x=>x.id===currentWishId);
  donateWishBadge.textContent = `Granting: ${w.nickname}`;
  closeModal();
  routeTo('donate');
});

// Pledge form submission
const donorForm = document.getElementById('donorForm');
donorForm.addEventListener('submit', async (e) =>{
  e.preventDefault();
  const fd = new FormData(donorForm);
  const fullName = (fd.get('name')||'').trim();
  const nick = (fd.get('nickname')||'').trim();
  if (!fullName && !nick) { alert('Please enter either your Full Name or a Nickname.'); return; }
  const wishes = loadWishes();
  const target = wishes.find(x => `Granting: ${x.nickname}` === donateWishBadge.textContent) || wishes[0];

  const code = 'WISH-' + Math.floor(1000 + Math.random()*9000);
  const now = new Date().toISOString();
  const activeUser = localStorage.getItem(LS_ACTIVE_USER) || 'member';

  const donation = {
    code,
    wishId: target.id,
    wishNickname: target.nickname,
    donorUsername: activeUser,
    timestamp: now,
    donor: {
      displayName: fullName || nick || 'Anonymous',
      fullName, nickname: nick,
      email: fd.get('email'),
      phone: fd.get('phone') || '',
      type: fd.get('type'),
      amount: fd.get('amount') || '',
      timeline: fd.get('timeline') || '',
      message: fd.get('message') || ''
    },
    statusPhase: 0,
    pledgedAt: now,
    receivedAt: null,
    grantedAt: null
  };
  await saveDonation(donation);
  await setLatestCode(code);

  // Create a new thread for this pledge
  const msgs = loadMessages();
  await saveMessage(thread);

  donorForm.reset();
  alert('Pledge submitted! You can chat in Inbox. Admin will mark it as Granted when fulfilled.');
  routeTo('inbox');
  renderInbox();
  openThread(code);
});

// Cancel donate
document.getElementById('cancelDonate').addEventListener('click', ()=> routeTo('home'));

// Status lookup
document.getElementById('lookupBtn').addEventListener('click', ()=>{
  const code = (document.getElementById('lookupCode').value || '').trim();
  const d = loadDonations().find(x => x.code === code);
  const statusResult = document.getElementById('statusResult');
  statusResult.classList.remove('hidden');
  if (!code || !d) {
    statusResult.innerHTML = `<div class="text-white/90">No donation found for that code.</div>`;
    return;
  }
  const w = loadWishes().find(x => x.id === d.wishId);
  const phase = d.statusPhase ?? 0;
  const steps = [
    { label: 'Pledge given', date: d.pledgedAt, done: phase >= 0, icon: '📝' },
    { label: 'Donation received', date: d.receivedAt, done: phase >= 1, icon: '📦' },
    { label: 'Wish granted', date: d.grantedAt, done: phase >= 2, icon: '✨' },
  ];
  const items = steps.map((s,i) => `
    <div class="flex items-start gap-3">
      <div class="h-8 w-8 rounded-full ${s.done ? 'bg-green-400 text-green-900' : 'bg-white/20 text-white'} flex items-center justify-center font-semibold">${s.icon}</div>
      <div>
        <div class="font-semibold ${s.done ? '' : 'opacity-80'}">${s.label}${s.done ? ' • Completed' : ''}</div>
        <div class="text-xs opacity-80">${s.date ? new Date(s.date).toLocaleString() : (i===phase+1 ? 'In progress' : '')}</div>
      </div>
    </div>
  `).join('<div class="ml-3 h-6 border-l border-white/20"></div>');

  const ty = loadThanks()[d.code];
  const tyBlock = ty ? `
    <div class="rounded-2xl bg-white/10 border border-white/10 p-5">
      <div class="text-sm opacity-80 mb-1">A note from the student</div>
      <div>${ty.note ? ty.note.replace(/</g,'&lt;').replace(/>/g,'&gt;') : ''}</div>
      ${ty.image ? `<img src="${ty.image}" alt="Thank-you image" class="mt-3 rounded-xl max-h-64 object-cover" />` : ''}
      <div class="text-xs opacity-70 mt-2">Sent ${new Date(ty.time).toLocaleString()}</div>
    </div>
  ` : '';

  statusResult.innerHTML = `
    <div class="flex flex-col gap-5">
      <div class="flex items-center justify-between">
        <div>
          <div class="text-sm opacity-80">Donation Code</div>
          <div class="text-xl font-semibold">${d.code}</div>
        </div>
        <div class="text-sm">
          <span class="px-3 py-1 rounded-full ${phase === 2 ? 'bg-green-400 text-green-900' : phase === 1 ? 'bg-blue-300 text-blue-900' : 'bg-yellow-300 text-yellow-900'} font-semibold">
            ${phase === 2 ? 'Granted' : phase === 1 ? 'Received' : 'Pledged'}
          </span>
        </div>
      </div>
      <div class="rounded-xl bg-white/10 border border-white/10 p-5">
        <div class="grid gap-4">${items}</div>
      </div>
      ${tyBlock}
      <div class="rounded-xl bg-white/10 border border-white/10 p-5">
        <div class="text-sm opacity-80 mb-1">Student</div>
        <div class="font-semibold">${d.wishNickname}</div>
        <div class="text-sm opacity-80 mt-3">Wish</div>
        <div>${w?.wish || '-'}</div>
      </div>
    </div>
  `;
  refreshBallHighlights();
});

// Inbox rendering + thread open
async function renderInbox(){
  const msgs = await loadMessages();   // ✅ wait for Supabase
  const sorted = msgs.slice().reverse(); // ✅ now it's an array

  const list = document.getElementById('threadList');
  list.innerHTML = sorted.length ? '' : `<div class="p-4 text-white/80">No conversations yet.</div>`;
  sorted.forEach(m => {
    const el = document.createElement('div');
    el.className = 'px-4 py-3 hover:bg-white/5 cursor-pointer';
    el.innerHTML = `
      <div class="font-semibold">${m.title}</div>
      <div class="text-xs opacity-80">${new Date(m.createdAt).toLocaleString()}</div>`;
    el.addEventListener('click', ()=> openThread(m.threadId));
    list.appendChild(el);
  });
}

function openThread(threadId){
  const msgs = loadMessages();
  const t = msgs.find(x=>x.threadId===threadId);
  if(!t) return;
  document.getElementById('chatHeader').querySelector('.font-semibold').textContent = t.title;
  const messagesEl = document.getElementById('chatMessages');
  messagesEl.innerHTML = '';
  t.messages.forEach(m=>{
    const item = document.createElement('div');
    item.className = 'p-3 rounded-xl bg-white/10';
    item.innerHTML = `<div class="text-xs opacity-80">${m.from} • ${new Date(m.time).toLocaleString()}</div><div class="mt-1">${m.text}</div>`;
    messagesEl.appendChild(item);
  });
  // show input
  document.getElementById('chatForm').onsubmit = (e)=>{
    e.preventDefault();
    const txt = (document.getElementById('chatInput').value||'').trim();
    if(!txt) return;
    t.messages.push({ from: 'You', text: txt, time: new Date().toISOString() });
    saveMessages(loadMessages().map(x => x.threadId === t.threadId ? t : x));
    document.getElementById('chatInput').value = '';
    openThread(threadId);
  };
}

// Achievements (simple)

async function renderAchievements() {
  const topPledges = document.getElementById('topPledges');
  const topValue = document.getElementById('topValue');
  if (!topPledges || !topValue) return;

  topPledges.innerHTML = '';
  topValue.innerHTML = '';

  const ds = await loadDonations();   // ✅ wait for data
  const byPerson = {};

  ds.forEach(d => {
    const name = d.donor?.displayName || 'Anonymous';
    const value = parseFloat((d.donor?.amount || d.amount || '').toString().replace(/[^0-9.]/g,'')) || 0;

    if (!byPerson[name]) byPerson[name] = { name, count: 0, value: 0 };
    byPerson[name].count += 1;
    byPerson[name].value += value;
  });

  const rows = Object.values(byPerson);
  const pledgesSorted = rows.slice().sort((a,b) => b.count - a.count).slice(0,5);
  const valueSorted   = rows.slice().sort((a,b) => b.value - a.value).slice(0,5);

  pledgesSorted.forEach((r) => {
    const line = document.createElement('div');
    line.className = 'flex items-center justify-between rounded-xl bg-white/10 border border-white/10 p-3';
    line.innerHTML = `<div class="font-semibold">${r.name}</div><div class="text-sm opacity-90">${r.count} pledge(s)</div>`;
    topPledges.appendChild(line);
  });

  valueSorted.forEach((r) => {
    const line = document.createElement('div');
    line.className = 'flex items-center justify-between rounded-xl bg-white/10 border border-white/10 p-3';
    line.innerHTML = `<div class="font-semibold">${r.name}</div><div class="text-sm opacity-90">~RM${r.value.toFixed(2)}</div>`;
    topValue.appendChild(line);
  });
}


// Misc
async function refreshBallHighlights(){
  // highlight balls which have open pledges
  const latest = getLatestCode();
  const donations = await loadDonations();   // ✅ wait for array
  const donatedWishIds = donations.map(d => d.wishId);

  document.querySelectorAll('#ballsGroup circle[data-id]').forEach(c => {
    const id = c.dataset.id;
    if (donatedWishIds.includes(id)) {
      c.style.filter = 'drop-shadow(0 0 12px rgba(255,255,255,0.15))'; // ✅ SVG-friendly glow
    } else {
      c.style.filter = '';
    }
  });
}


// Profile modal
document.getElementById('profileBtn').addEventListener('click', ()=>{
  document.getElementById('profileModal').classList.remove('hidden');
  const user = localStorage.getItem(LS_ACTIVE_USER) || '-';
  document.getElementById('profUsername').textContent = user;
  document.getElementById('profRole').textContent = localStorage.getItem(LS_ROLE) || '-';
});
document.getElementById('closeProfile').addEventListener('click', ()=> document.getElementById('profileModal').classList.add('hidden'));

// Admin guard note: prevent admin.html access from donor (admin.html itself handles guard). This file just ensures donor pages behave.

// Initial render
renderJar();
renderInbox();
renderAchievements();
