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
const EMOTION_COLORS = { hope:'#60A5FA', determination:'#34D399', sadness:'#A78BFA', embarrassment:'#F472B6', anxiety:'#FCA5A5' };
const CATEGORY_ICON = { shoes:'👟', stationery:'✏️', meals:'🧃', data:'📶', transport:'🚲', other:'🎒' };


// Utilities
let activeChannel = null;

function subscribeToMessages(conversationId, userId, donorDisplayName) {
  // Remove old channel if any
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
        const from = m.sender_name || (isMine ? donorDisplayName || 'You' : m.sender_id ? 'Staff' : 'System');

        const messagesEl = document.getElementById('chatMessages');
        const item = document.createElement('div');
        item.className = `p-3 rounded-xl my-1 max-w-[70%] ${
          isMine
            ? 'bg-blue-500/80 text-white text-right ml-auto'
            : 'bg-white/10 text-white/90 mr-auto'
        }`;
        item.innerHTML = `
          <div class="text-xs opacity-80 ${isMine ? 'text-right' : ''}">
            ${from} • ${new Date(m.created_at).toLocaleString()}
          </div>
          <div class="mt-1">${m.body}</div>
        `;
        messagesEl.appendChild(item);
        messagesEl.scrollTop = messagesEl.scrollHeight;
      }
    )
    .subscribe((status) => {
      console.log("Realtime channel status:", status);
    });
}

function startPaymentFlow(donationCode) {
  // TODO: hook this to your real payment integration.
  // Default behavior: open a new page /pay?code=... (you can change)
  console.log("Starting payment flow for", donationCode);
  // Example: redirect to a payment page (replace with real route)
  // window.location.href = `/pay?code=${encodeURIComponent(donationCode)}`;
  // For demo / placeholder:
  alert('Payment flow placeholder for donation ' + donationCode);
}

function showPaymentPrompt(donationCode) {
  // avoid duplicating prompt
  if (document.getElementById('paymentPrompt')) return;

  const container = document.createElement('div');
  container.id = 'paymentPrompt';
  container.className = 'fixed bottom-6 right-6 z-[9999]';
  container.style.width = '320px';
  container.style.transition = 'transform .5s ease, opacity .5s ease';
  container.innerHTML = `
    <div class="rounded-2xl bg-white/10 border border-white/10 p-4 shadow-xl backdrop-blur">
      <div class="font-semibold mb-1">Thanks — your pledge is recorded</div>
      <div class="text-sm opacity-85 mb-3">Would you like to pay for your donation now?</div>
      <div class="flex gap-2">
        <button id="payNowBtn" class="flex-1 px-3 py-2 rounded-xl bg-indigo-600 text-white font-semibold">Pay</button>
        <button id="payLaterBtn" class="px-3 py-2 rounded-xl bg-white/10 border border-white/10">Later</button>
      </div>
    </div>
  `;

  document.body.appendChild(container);

  // animate in
  requestAnimationFrame(() => {
    container.style.transform = 'translateY(0)';
    container.style.opacity = '1';
  });

  document.getElementById('payNowBtn').addEventListener('click', () => {
    container.remove();
    startPaymentFlow(donationCode);
  });
  document.getElementById('payLaterBtn').addEventListener('click', () => {
    container.remove();
  });

  // auto-dismiss after 25s
  setTimeout(() => { container.remove(); }, 25000);
}


async function getActiveUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  console.log(data.user.id)
  return {
    id: data.user.id, // UUID
    username: data.user.user_metadata?.username || data.user.email || "Anonymous"
  };
}

(async () => {
  const user = await getActiveUser();
  if (!user) {
    alert('Please sign in first. Redirecting to login.');
    window.location.href = 'index.html';
  }
})();

async function getActiveProfile() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Fetch the full profile from your profiles table
  const { data: profile, error } = await supabase
    .from('profiles')
    // Select all the columns from your new table structure
    .select('username, full_name, hide_full_name, phone, affiliation, total_pledges, wishes_granted, total_donated, latest_code')
    .eq('id', user.id)
    .maybeSingle(); // Use maybeSingle() to prevent errors if a profile is missing

  if (error) {
    console.error("Error fetching profile:", error);
    // Return a default object based on auth user if the query fails
    return { 
      id: user.id, 
      username: user.email || 'Anonymous',
      fullName: null,
      hideFullName: false,
      phone: null,
      affiliation: null,
      totalPledges: 0,
      wishesGranted: 0,
      totalDonated: 0,
      latestCode: null
    };
  }

  // If a profile exists, return its data.
  if (profile) {
    return {
      id: user.id,
      username: profile.username || user.email || 'Anonymous',
      fullName: profile.full_name,
      hideFullName: profile.hide_full_name,
      phone: profile.phone,
      affiliation: profile.affiliation,
      totalPledges: profile.total_pledges,
      wishesGranted: profile.wishes_granted,
      totalDonated: profile.total_donated,
      latestCode: profile.latest_code
    };
  }

  // Fallback for new users who might not have a profile row yet
  return {
    id: user.id,
    username: user.email || 'Anonymous',
    fullName: null,
    hideFullName: false,
    phone: null,
    affiliation: null,
    totalPledges: 0,
    wishesGranted: 0,
    totalDonated: 0,
    latestCode: null
  };
}


async function loadWishes() {
  console.log("Attempting to load wishes from Supabase...");
  
  let { data, error } = await supabase
    .from('wishes')
    .select('*')
    .order('created_at', { ascending: false }); // Optional: order by date

  if (error) {
    console.error("Error loading wishes:", error);
    console.error("Error details:", error.message, error.code);
    return [];
  }
  
  console.log("Wishes loaded successfully:", data);
  console.log("Number of wishes:", data?.length || 0);
  
  return data || [];
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
async function saveMessage(conversationId, senderId, text, senderName) {
  const { error } = await supabase.from('messages').insert([{
    conversation_id: conversationId,
    sender_id: senderId,
    body: text,
    sender_name: senderName
  }]);
  if (error) console.error(error);
}

async function loadMessages(conversationId) {
  const { data, error } = await supabase
    .from('messages')
    .select('id, sender_id, sender_name, body, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });
  if (error) { console.error(error); return []; }
  return data;
}

// LATEST CODE
async function setLatestCode(code) {
  // Get the currently logged-in user
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    console.error("Cannot set latest code: no active user.");
    return;
  }

  // Update the 'latest_code' column in the 'profiles' table for that user
  const { error } = await supabase
    .from('profiles')
    .update({ latest_code: code })
    .eq('id', user.id); // Match the profile row to the user's ID

  if (error) {
    console.error("Error updating latest_code in profile:", error);
  } else {
    console.log(`Successfully updated latest_code for user ${user.id} to ${code}`);
  }
}
async function getLatestCode() {
  // Get the currently logged-in user
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    console.error("Cannot get latest code: no active user.");
    return null;
  }

  // Select the 'latest_code' from the user's specific profile
  const { data, error } = await supabase
    .from('profiles')
    .select('latest_code')
    .eq('id', user.id) // Match the profile row to the user's ID
    .maybeSingle();

  if (error) {
    console.error("Error fetching latest_code from profile:", error);
    return null;
  }

  return data?.latest_code;
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
async function renderJar() {
  const ballsGroup = document.getElementById('ballsGroup');
  const wishes = await loadWishes();
  const map = Object.fromEntries((wishes || []).map(w => [w.id, w]));

  // Remove any leftover injected children except the base circle inside each wrapper
  ballsGroup.querySelectorAll("g.ballWrap").forEach(wrap => {
    [...wrap.children].forEach(child => {
      if (child.tagName.toLowerCase() !== 'circle') child.remove();
    });
  });

  // Ensure defs exist for clipPaths and filters
  let defs = ballsGroup.querySelector('defs');
  if (!defs) {
    defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    ballsGroup.prepend(defs);
  }

  // Add inside-out orb filter if not already present
  if (!document.getElementById('insideOutGlow')) {
    const filter = document.createElementNS("http://www.w3.org/2000/svg", "filter");
    filter.setAttribute("id", "insideOutGlow");

    const blur = document.createElementNS("http://www.w3.org/2000/svg", "feGaussianBlur");
    blur.setAttribute("in", "SourceGraphic");
    blur.setAttribute("stdDeviation", "4");
    blur.setAttribute("result", "blur");
    filter.appendChild(blur);

    const merge = document.createElementNS("http://www.w3.org/2000/svg", "feMerge");
    const mergeNode1 = document.createElementNS("http://www.w3.org/2000/svg", "feMergeNode");
    mergeNode1.setAttribute("in", "blur");
    const mergeNode2 = document.createElementNS("http://www.w3.org/2000/svg", "feMergeNode");
    mergeNode2.setAttribute("in", "SourceGraphic");
    merge.appendChild(mergeNode1);
    merge.appendChild(mergeNode2);

    filter.appendChild(merge);
    defs.appendChild(filter);
  }

  // For each base circle
  ballsGroup.querySelectorAll("g.ballWrap > circle[data-id]").forEach(baseCircle => {
    const id = baseCircle.dataset.id;
    const w = map[id];

    if (!w) {
      baseCircle.style.display = 'none';
      return;
    }
    baseCircle.style.display = 'block';

    const cx = +baseCircle.getAttribute('cx');
    const cy = +baseCircle.getAttribute('cy');
    const r  = +baseCircle.getAttribute('r');

    const wrap = baseCircle.parentNode;

    baseCircle.style.pointerEvents = 'none';
    baseCircle.style.filter = w.granted
      ? "drop-shadow(0 0 12px rgba(255,255,255,0.95))"
      : "none";
    baseCircle.style.stroke = w.granted ? "rgba(255,255,255,0.95)" : "none";
    baseCircle.style.strokeWidth = w.granted ? "3" : "0";

    const cAnim = baseCircle.style.animation || baseCircle.getAttribute('style')?.match(/animation:[^;]+/)?.[0] || '';
    if (cAnim && !wrap.style.animation) wrap.style.animation = baseCircle.style.animation;

    [...wrap.querySelectorAll('image, text, .ball-hit')].forEach(el => el.remove());

    if (w.situation_image_url) {
  const clipId = `clip-${id}`;
  let clip = document.getElementById(clipId);
  if (!clip) {
    clip = document.createElementNS("http://www.w3.org/2000/svg", "clipPath");
    clip.setAttribute("id", clipId);
    const cc = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    cc.setAttribute("cx", cx);
    cc.setAttribute("cy", cy);
    cc.setAttribute("r", r);
    clip.appendChild(cc);
    defs.appendChild(clip);
  } else {
    const cc = clip.querySelector('circle');
    if (cc) { cc.setAttribute('cx', cx); cc.setAttribute('cy', cy); cc.setAttribute('r', r); }
  }

  // Place image first
  const img = document.createElementNS("http://www.w3.org/2000/svg", "image");
  img.setAttribute("href", w.situation_image_url);
  img.setAttribute("x", cx - r);
  img.setAttribute("y", cy - r);
  img.setAttribute("width", r * 2);
  img.setAttribute("height", r * 2);
  img.setAttribute("preserveAspectRatio", "xMidYMid slice");
  img.setAttribute("clip-path", `url(#${clipId})`);
  wrap.appendChild(img);

  // Circle always on top
  baseCircle.setAttribute("fill", EMOTION_COLORS[w.emotion] || "#FDE047");
  baseCircle.style.mixBlendMode = "multiply";
  baseCircle.style.opacity = w.granted ? "0.9" : "0.65";
  wrap.appendChild(baseCircle);

} else {
  baseCircle.setAttribute("fill", EMOTION_COLORS[w.emotion] || "#FDE047");
  baseCircle.style.mixBlendMode = "normal";
  baseCircle.style.opacity = w.granted ? "1" : "0.85";
  wrap.appendChild(baseCircle);

  // Emoji fallback sits on top of circle
  const txt = document.createElementNS("http://www.w3.org/2000/svg", "text");
  txt.setAttribute("x", cx);
  txt.setAttribute("y", cy);
  txt.setAttribute("fill", "#fff");
  txt.setAttribute("text-anchor", "middle");
  txt.setAttribute("dominant-baseline", "central");
  txt.setAttribute("font-weight", "700");
  txt.setAttribute("font-size", Math.max(10, Math.floor(r * 0.6)));
  txt.textContent = CATEGORY_ICON[w.category] || "🎒";
  wrap.appendChild(txt);
}

// Inside-out glow always applied
baseCircle.setAttribute("filter", "url(#insideOutGlow)");

// Hit target always last
const hit = document.createElementNS("http://www.w3.org/2000/svg", "circle");
hit.classList.add('ball-hit');
hit.setAttribute('cx', cx);
hit.setAttribute('cy', cy);
hit.setAttribute('r', r);
hit.setAttribute('fill', 'transparent');
hit.style.cursor = 'pointer';
hit.style.pointerEvents = 'all';
hit.addEventListener('click', (ev) => {
  ev.stopPropagation();
  try { openModal(id); } catch (e) { console.log('openModal missing', e); }
});
wrap.appendChild(hit);

  });

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
async function openModal(wishId) {
  const wishes = await loadWishes();
  const w = wishes.find(x => x.id === wishId);
  if (!w) return;

  currentWishId = wishId;
  wishNickname.textContent = w.nickname || 'Student';
  wishEmotion.textContent = w.emotion ? (w.emotion[0].toUpperCase() + w.emotion.slice(1)) : '-';
  wishSituation.textContent = w.situation || '';
  wishText.textContent = w.wish || '';

  // ✅ Student image vs placeholder
  const imgEl = document.getElementById('wishStudentImage');
  const placeholder = document.getElementById('wishStudentPlaceholder');

  if (w.student_image_url && w.student_image_url.trim() !== "") {
    imgEl.src = w.student_image_url;
    imgEl.classList.remove('hidden');
    placeholder.classList.add('hidden');

    // if the image fails to load → revert to placeholder
    imgEl.onerror = () => {
      imgEl.classList.add('hidden');
      placeholder.classList.remove('hidden');
    };
  } else {
    imgEl.src = "";
    imgEl.classList.add('hidden');
    placeholder.classList.remove('hidden');
  }

  modal.classList.remove('modal-hidden');
  modal.classList.add('modal-visible');
  modalBackdrop.classList.remove('opacity-0', 'pointer-events-none');
  modalBackdrop.classList.add('opacity-100');
}



function closeModal(){
  modal.classList.remove('modal-visible'); modal.classList.add('modal-hidden');
  modalBackdrop.classList.add('opacity-0','pointer-events-none'); modalBackdrop.classList.remove('opacity-100');
}
closeModalBtn.addEventListener('click', closeModal);
closeModalTop.addEventListener('click', closeModal);
modalBackdrop.addEventListener('click', closeModal);
document.addEventListener('keydown', (e)=>{ if (e.key === 'Escape') closeModal(); });

// Click on jar circle
ballsGroup.addEventListener('click', (e)=>{
  const t = e.target;
  if (t && t.tagName === 'circle' && t.dataset.id) 
    console.log(t.dataset.id);
    openModal(t.dataset.id);
});

// Grant -> go to pledge form
const donateWishBadge = document.getElementById('donateWishBadge');
grantBtn.addEventListener('click',async ()=>{
  if (!currentWishId) return;
  const wishes = await loadWishes(); // Await the result of the async function
  const donations = await loadDonations();
  const prof = await getActiveProfile();

  // check if wish is already taken
  const isAlreadyPledged = donations.some(d => d.wish_id === currentWishId);

  if (isAlreadyPledged) {
    alert('Sorry, this wish has already been reserved by another donor. Please select a different one.');
    return; // Stop the function from continuing
  }

  // check if user has ongoing pledge
  const usersLatestPledge = prof?.latestCode;
  const latestDonation = donations.find(d => d.code === usersLatestPledge);

  //const hasPledgeOngoing = latestDonation && latestDonation.granted_at == null;

  if (latestDonation && latestDonation.granted_at == null) {
    alert('You already have an active pledge! Please finish it first.');
    return;
  } 

  const w = wishes.find(x=>x.id===currentWishId);   
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
  
  // --- START MODIFICATION ---

  // 1. First, get all current wishes and donations
  const wishes = await loadWishes();
  const donations = await loadDonations();

  const user = await getActiveUser();
  if (!user) {
    alert("Not logged in.");
    return;
  }
  let code;
  let isUnique = false;
  while (!isUnique) {
    // 1. Generate a potential code
    const potentialCode = 'WISH-' + Math.floor(1000 + Math.random() * 9000);
    
    // 2. Check if this code already exists in the donations list
    const codeExists = donations.some(d => d.code === potentialCode);
    
    // 3. If it does not exist, we've found our unique code.
    if (!codeExists) {
      code = potentialCode;
      isUnique = true;
    }
    // If it *does* exist, the loop will simply run again to generate a new number.
  }
  const now = new Date().toISOString();
  const target = wishes.find(w => w.id === currentWishId);
  console.log(currentWishId);

  const donation = {
    code,
    wish_id: target.id, // This now correctly uses the selected wish
    wish_nickname: target.nickname,
    timestamp: now,
    donor_id: user.id, 
    donor: {
      displayName: fullName || nick || user.username,
      fullName,
      nickname: nick,
      email: fd.get('email'),
      phone: fd.get('phone') || '',
      type: fd.get('type'),
      amount: fd.get('amount') || '',
      timeline: fd.get('timeline') || '',
      message: fd.get('message') || ''
    },
    status_phase: 0,
    pledged_at: now,
    received_at: null,
    granted_at: null
  };
  
  // ... the rest of the function continues as before

  await saveDonation(donation);
  await setLatestCode(code);

  const { error: wishUpdateError } = await supabase
  .from("wishes")
  .update({ donationcode: code })   // 👈 set donationcode
  .eq("id", target.id);             // 👈 match the selected wish

if (wishUpdateError) {
  console.error("Error updating wish with donation code:", wishUpdateError);
}

  // ✅ Create conversation
  // After pledge is submitted

  const { data: convo, error: convoError } = await supabase
  .from("conversations")
  .insert([{
    donor_id: user.id,        // ✅ link conversation to donor
    donation_code: code, 
    title: `Pledge for ${target.nickname} (${code})`,
    created_at: now
  }])
  .select()
  .single();

if (convoError) {
  console.error("Error creating conversation:", convoError);
} else {
  // Insert first system message
  await supabase.from("messages").insert([{
    conversation_id: convo.id,
    sender_id: null,  // system message
    body: `Thank you for your pledge. We will update you on its status.`
  }]);
}


  donorForm.reset();
  alert('Pledge submitted! You can chat in Inbox.');
  routeTo('inbox');
  renderInbox();
  openThread(convo.id, convo.title);
  showPaymentPrompt(code);
});

// Cancel donate
document.getElementById('cancelDonate').addEventListener('click', ()=> routeTo('home'));

// Status lookup
document.getElementById('lookupBtn').addEventListener('click', async ()=>{
  const code = (document.getElementById('lookupCode').value || '').trim();

  const donations = await loadDonations();  // ⬅️ wait for the array
  const d = donations.find(x => (x.code || '').trim().toUpperCase() === code.toUpperCase());
  console.log("Looking for code:", code);
console.log("All donation codes:", donations.map(d => d.code));

  const statusResult = document.getElementById('statusResult');
  statusResult.classList.remove('hidden');

  if (!code || !d) {
    statusResult.innerHTML = `<div class="text-white/90">No donation found for that code.</div>`;
    return;
  }

  const wishes = await loadWishes();  // ⬅️ also async
  const w = wishes.find(x => x.id === d.wish_id);
  console.log(d.code);
  const phase = d.status_phase ?? 0;
  const steps = [
    { label: 'Pledge given', date: d.pledged_at, done: phase >= 0, icon: '📝' },
    { label: 'Donation received', date: d.received_at, done: phase >= 1, icon: '📦' },
    { label: 'Wish granted', date: d.granted_at, done: phase >= 2, icon: '✨' },
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

  const thanksMap = await loadThanks();
  const ty = thanksMap[d.code];

  const tyBlock = ty ? `
    <div class="rounded-2xl bg-white/10 border border-white/10 p-5">
      <div class="text-sm opacity-80 mb-1">A note from the student</div>
      <div>${ty.message ? ty.message.replace(/</g,'&lt;').replace(/>/g,'&gt;') : ''}</div>
      ${ty.image_url ? `<img src="${ty.image_url}" alt="Thank-you image" class="mt-3 rounded-xl max-h-64 object-cover" />` : ''}
      <div class="text-xs opacity-70 mt-2">Sent ${new Date(ty.created_at).toLocaleString()}</div>
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
async function renderInbox() {
  const user = await getActiveUser();
  if (!user) return;

  const { data: convos, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('donor_id', user.id)   // 👈 only their conversations
    .order('created_at', { ascending: false });

  if (error) { console.error(error); return; }

  const list = document.getElementById('threadList');
  list.innerHTML = convos.length ? '' : `<div class="p-4 text-white/80">No conversations yet.</div>`;

  convos.forEach(c => {
    const el = document.createElement('div');
    el.className = 'px-4 py-3 hover:bg-white/5 cursor-pointer';
    el.innerHTML = `
      <div class="font-semibold">${c.title}</div>
      <div class="text-xs opacity-80">${new Date(c.created_at).toLocaleString()}</div>`;
    el.addEventListener('click', ()=> openThread(c.id, c.title));
    list.appendChild(el);
  });
}

async function openThread(conversationId, title) {
  document.getElementById('chatHeader').querySelector('.font-semibold').textContent = title;

  const messagesEl = document.getElementById('chatMessages');
  messagesEl.innerHTML = '';

  const user = await getActiveUser(); // Current logged-in donor

  // --- Fetch donorDisplayName from the donations table's jsonb column ---
  let donorDisplayName = 'Anonymous';
  const { data: convo, error: convoError } = await supabase
    .from('conversations')
    .select('donor_id')
    .eq('id', conversationId)
    .single();

  if (!convoError && convo) {
    // We are selecting the donor JSONB column and then filtering by donor_id
    const { data: donations, error: donationError } = await supabase
      .from('donations')
      .select('donor') // Select the entire jsonb column
      .eq('donor_id', user.id)
      .limit(1); //   Pick the latest if multiple donations exist

    if (!donationError && donations.length) {
      // Access the displayName key from the JSONB object
      donorDisplayName = donations[0].donor?.displayName || 'Anonymous';
    }
  }

  const msgs = await loadMessages(conversationId);

  msgs.forEach(m => {
    const isMine = m.sender_id === user?.id;
    const from = m.sender_name || (isMine ? donorDisplayName || 'You' : m.sender_id ? 'Staff' : 'System');

    const item = document.createElement('div');
    item.className = `p-3 rounded-xl my-1 max-w-[70%] ${isMine ? 'bg-blue-500/80 text-white text-right ml-auto' : 'bg-white/10 text-white/90 mr-auto'}`;
    item.innerHTML = `
      <div class="text-xs opacity-80 ${isMine ? 'text-right' : ''}">${from} • ${new Date(m.created_at).toLocaleString()}</div>
      <div class="mt-1">${m.body}</div>
    `;
    messagesEl.appendChild(item);
  });

  subscribeToMessages(conversationId, user?.id, donorDisplayName);

  // Scroll to bottom
  messagesEl.scrollTop = messagesEl.scrollHeight;

  // Sending new message
  document.getElementById('chatForm').onsubmit = async (e) => {
    e.preventDefault();
    const txt = (document.getElementById('chatInput').value || '').trim();
    if (!txt) return;

    const senderId = user?.id || null;
    const senderName = donorDisplayName || user?.username || 'Anonymous';
    await saveMessage(conversationId, senderId, txt, senderName);
    document.getElementById('chatInput').value = '';
  };
}



  document.getElementById('chatForm').onsubmit = async (e)=>{
    e.preventDefault();
    const txt = (document.getElementById('chatInput').value||'').trim();
    if (!txt) return;
    const { data: { user } } = await supabase.auth.getUser();
    const senderId = user.id || null;
    const senderName = donorDisplayName || user?.email || 'Anonymous';
    await saveMessage(conversationId, senderId, txt, senderName);
    document.getElementById('chatInput').value = '';
  };


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


document.getElementById('profileBtn').addEventListener('click', async ()=>{
  const user = await getActiveProfile();
  document.getElementById('profileModal').classList.remove('hidden');
  document.getElementById('profUsername').textContent = user?.username;
  document.getElementById('profRole').textContent = user?.affiliation || '-';
  document.getElementById('profPledges').textContent = user?.totalPledges || '-';
  document.getElementById('profDonated').textContent = user?.totalDonated || '-';
  document.getElementById('profGranted').textContent = user?.wishesGranted || '-';
  document.getElementById('profRecent').textContent = user?.latestCode || '-';
});
document.getElementById('closeProfile').addEventListener('click', ()=> document.getElementById('profileModal').classList.add('hidden'));

// Admin guard note: prevent admin.html access from donor (admin.html itself handles guard). This file just ensures donor pages behave.

// Initial render
renderJar();
renderInbox();
renderAchievements();
