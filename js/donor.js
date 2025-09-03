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
const EMOTION_COLORS = { envy:'#2E8B57', shy:'#FF6EC7', worry:'#6A5ACD', serenity:'#FEFEFA', chirpy:'#FFFF00', gratitude:'#FFAD00' };
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
// Updated renderJar() — adds slow, brighter hover glow via an animating SVG circle
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

  ballsGroup.querySelectorAll("g.ballWrap").forEach(wrap => wrap.remove());

  // --- RANDOM POSITIONING ADDED ---
  const jarPath = document.querySelector("clipPath#jarClip path");
  const jarShape = new Path2D(jarPath.getAttribute("d"));
  const svg = document.querySelector("#jarButton svg");
  const vb = svg.viewBox.baseVal;
  const ctx = document.createElement("canvas").getContext("2d");
  ctx.canvas.width = vb.width;
  ctx.canvas.height = vb.height;

  function isInsideJar(x, y) {
    return ctx.isPointInPath(jarShape, x, y);
  }

function isCircleInsideJar(x, y, r) {
  // Check multiple points around the circle’s edge
  const steps = 12; // more steps = more accurate
  for (let i = 0; i < steps; i++) {
    const angle = (i / steps) * 2 * Math.PI;
    const px = x + r * Math.cos(angle);
    const py = y + r * Math.sin(angle);
    if (!ctx.isPointInPath(jarShape, px, py)) {
      return false;
    }
  }
  return true;
}


    const placed = [];
  const radius = 26;
  const maxOrbs = 30;
  const numWishesToPlace = Math.min(maxOrbs, wishes.length);
  let totalAttempts = 0;
  const maxTotalAttempts = 200000; // Safety break to prevent infinite loops

  // Start from the bottom of the viewBox and move upwards in small layers
  for (let y = vb.height - radius; y > radius && placed.length < numWishesToPlace; y -= 4) {
    let attemptsInLayer = 0;
    const maxAttemptsPerLayer = 300; // Tries to place an orb in the current horizontal slice

    // Attempt to place several orbs in the current layer before moving up
    while (attemptsInLayer < maxAttemptsPerLayer && placed.length < numWishesToPlace) {
      totalAttempts++;
      attemptsInLayer++;
      if (totalAttempts > maxTotalAttempts) break;

      // Pick a random horizontal position
      const cx = Math.random() * (vb.width - 2 * radius) + radius;
      // Use the current 'y' level, but add a small vertical jitter for a less grid-like look
      const cy = y + (Math.random() - 0.5) * 4;

      // Check 1: Is the proposed circle fully inside the jar's boundaries?
      if (!isCircleInsideJar(cx, cy, radius)) {
        continue;
      }

      // Check 2: Does it collide with any orb that has already been placed?
      let isOverlapping = false;
      for (const orb of placed) {
        const dx = cx - orb.cx;
        const dy = cy - orb.cy;
        // The minimum distance between centers must be twice the radius (plus a small gap)
        if (Math.sqrt(dx * dx + dy * dy) < radius * 2 + 2) {
          isOverlapping = true;
          break;
        }
      }

      if (isOverlapping) {
        continue;
      }

      // If all checks pass, this is a valid position. Add the orb.
      placed.push({ cx, cy });
    }
    
    if (totalAttempts > maxTotalAttempts) {
        console.warn("Max placement attempts reached. Not all orbs may be placed.");
        break;
    }
  }
  // --- END OF PLACEMENT LOGIC ---

 placed.forEach((pos, i) => {
  const w = wishes[i];
  if (!w) return;
  const wrap = document.createElementNS("http://www.w3.org/2000/svg", "g");
  wrap.classList.add("ballWrap");
  wrap.style.animation = "bob 3s ease-in-out infinite, sway 5s ease-in-out infinite";

  const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  c.setAttribute("cx", pos.cx);
  c.setAttribute("cy", pos.cy);
  c.setAttribute("r", radius);
  c.dataset.id = w.id; // crucial for the render pipeline
  wrap.appendChild(c);
  ballsGroup.appendChild(wrap);
 });

  // Ensure defs exist for clipPaths and filters
  let defs = ballsGroup.querySelector('defs');
  if (!defs) {
    defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    ballsGroup.prepend(defs);
  }

  // Inject small hover/glow CSS once (slow fade & subtle scale)
  if (!document.getElementById('dd-orb-hover-style')) {
    const style = document.createElement('style');
    style.id = 'dd-orb-hover-style';
    style.textContent = `
      /* orb outline (stroke) is used for glow; animate opacity + transform */
      .orb-outline {
        transition: opacity 420ms cubic-bezier(.2,.9,.25,1), transform 420ms cubic-bezier(.2,.9,.25,1);
        will-change: opacity, transform;
        opacity: 0;
        transform-origin: center center;
      }
      g.ballWrap, circle { transform-box: fill-box; }
      g.ballWrap.is-hover .orb-outline { opacity: 0.95; transform: scale(1.08); }
      g.ballWrap.is-dragging.is-hover .orb-outline { opacity: 0.85; transform: scale(1.04); }
    `;
    document.head.appendChild(style);
  }

  // --- filters + helpers (enhanced) ---
  if (!document.getElementById('dd-orb-filters')) {
    const container = document.createElement('div');
    container.id = 'dd-orb-filters';
    container.style.display = 'none';
    document.body.appendChild(container);
  }

  // Base and hover filters (kept)
  if (!document.getElementById('insideOutGlow')) {
    // 1) base glow (soft)
    const filter = document.createElementNS("http://www.w3.org/2000/svg", "filter");
    filter.setAttribute("id", "insideOutGlow");
    filter.setAttribute("x", "-50%");
    filter.setAttribute("y", "-50%");
    filter.setAttribute("width", "200%");
    filter.setAttribute("height", "200%");
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

    // 2) stronger hover glow (generic white-ish) - kept for added halo if needed
    const filterHover = document.createElementNS("http://www.w3.org/2000/svg", "filter");
    filterHover.setAttribute("id", "insideOutGlowHover");
    filterHover.setAttribute("x", "-80%");
    filterHover.setAttribute("y", "-80%");
    filterHover.setAttribute("width", "260%");
    filterHover.setAttribute("height", "260%");
    const blurHover = document.createElementNS("http://www.w3.org/2000/svg", "feGaussianBlur");
    blurHover.setAttribute("in", "SourceGraphic");
    blurHover.setAttribute("stdDeviation", "8");
    blurHover.setAttribute("result", "blurHover");
    filterHover.appendChild(blurHover);
    const mergeHover = document.createElementNS("http://www.w3.org/2000/svg", "feMerge");
    const mHn1 = document.createElementNS("http://www.w3.org/2000/svg", "feMergeNode");
    mHn1.setAttribute("in", "blurHover");
    const mHn2 = document.createElementNS("http://www.w3.org/2000/svg", "feMergeNode");
    mHn2.setAttribute("in", "SourceGraphic");
    mergeHover.appendChild(mHn1);
    mergeHover.appendChild(mHn2);
    filterHover.appendChild(mergeHover);
    defs.appendChild(filterHover);

    // 3) colored hover factory (keeps ability to colorize)
    window.__ensureEmotionHoverFilters = function (emotionColorMap = {}) {
      Object.entries(emotionColorMap).forEach(([emotion, color]) => {
        const id = `hoverGlow-${emotion}`;
        if (document.getElementById(id)) return;
        const f = document.createElementNS("http://www.w3.org/2000/svg", "filter");
        f.setAttribute("id", id);
        f.setAttribute("x", "-80%");
        f.setAttribute("y", "-80%");
        f.setAttribute("width", "260%");
        f.setAttribute("height", "260%");
        const ga = document.createElementNS("http://www.w3.org/2000/svg", "feGaussianBlur");
        ga.setAttribute("in", "SourceAlpha");
        ga.setAttribute("stdDeviation", "8");
        ga.setAttribute("result", "alphaBlur");
        f.appendChild(ga);
        const flood = document.createElementNS("http://www.w3.org/2000/svg", "feFlood");
        flood.setAttribute("flood-color", color);
        flood.setAttribute("flood-opacity", "0.85");
        flood.setAttribute("result", "floodColor");
        f.appendChild(flood);
        const comp = document.createElementNS("http://www.w3.org/2000/svg", "feComposite");
        comp.setAttribute("in", "floodColor");
        comp.setAttribute("in2", "alphaBlur");
        comp.setAttribute("operator", "in");
        comp.setAttribute("result", "coloredHalo");
        f.appendChild(comp);
        const mergeF = document.createElementNS("http://www.w3.org/2000/svg", "feMerge");
        const mn1 = document.createElementNS("http://www.w3.org/2000/svg", "feMergeNode");
        mn1.setAttribute("in", "coloredHalo");
        const mn2 = document.createElementNS("http://www.w3.org/2000/svg", "feMergeNode");
        mn2.setAttribute("in", "SourceGraphic");
        mergeF.appendChild(mn1);
        mergeF.appendChild(mn2);
        f.appendChild(mergeF);
        defs.appendChild(f);
      });
    };
    if (window.EMOTION_COLORS) {
      try { window.__ensureEmotionHoverFilters(window.EMOTION_COLORS); } catch (e) { /* ignore */ }
    }
  }

  // add a small outline-blur filter used for the stroke halo (not a filled disc)
  if (!document.getElementById('orbOutlineBlur')) {
    const ob = document.createElementNS("http://www.w3.org/2000/svg", "filter");
    ob.setAttribute("id", "orbOutlineBlur");
    ob.setAttribute("x", "-80%");
    ob.setAttribute("y", "-80%");
    ob.setAttribute("width", "260%");
    ob.setAttribute("height", "260%");
    const gblur = document.createElementNS("http://www.w3.org/2000/svg", "feGaussianBlur");
    gblur.setAttribute("in", "SourceGraphic");
    gblur.setAttribute("stdDeviation", "6"); // blur radius for outline
    gblur.setAttribute("result", "outlineBlur");
    ob.appendChild(gblur);
    // optionally merge (keeps some crispness if desired)
    const mergeOb = document.createElementNS("http://www.w3.org/2000/svg", "feMerge");
    const m1 = document.createElementNS("http://www.w3.org/2000/svg", "feMergeNode");
    m1.setAttribute("in", "outlineBlur");
    const m2 = document.createElementNS("http://www.w3.org/2000/svg", "feMergeNode");
    m2.setAttribute("in", "SourceGraphic");
    mergeOb.appendChild(m1);
    mergeOb.appendChild(m2);
    ob.appendChild(mergeOb);
    defs.appendChild(ob);
  }

  // Add blur filter for orb images (soft memory effect)
  if (!document.getElementById('orbImageBlur')) {
    const filter = document.createElementNS("http://www.w3.org/2000/svg", "filter");
    filter.setAttribute("id", "orbImageBlur");
    const blur = document.createElementNS("http://www.w3.org/2000/svg", "feGaussianBlur");
    blur.setAttribute("stdDeviation", "0.2"); // tweak for more/less blur
    filter.appendChild(blur);
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

    // create a stroke-outline (not a filled disc) and place it under the circle
    const glowId = `glow-${id}`;
    let glow = wrap.querySelector(`circle#${glowId}`);
    if (!glow) {
      glow = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      glow.setAttribute('id', glowId);
      glow.classList.add('orb-outline');
      // no fill — outline only
      glow.setAttribute('fill', 'none');
      // stroke is white
      glow.setAttribute('stroke', '#ffffff');
      glow.setAttribute('stroke-opacity', '0.95');
      // stroke width relative to orb radius
      const strokeW = Math.max(2, Math.round(r * 0.2));
      glow.setAttribute('stroke-width', strokeW);
      // position
      glow.setAttribute('cx', cx);
      glow.setAttribute('cy', cy);
      glow.setAttribute('r', r + strokeW * 0.5); // slightly larger so stroke sits outside edge
      // apply outline blur so it's a halo rather than a crisp ring
      glow.setAttribute('filter', 'url(#orbOutlineBlur)');
      // initial visual state
      glow.style.opacity = '0';
      glow.style.transformOrigin = `${cx}px ${cy}px`;
      glow.style.transformBox = 'fill-box';
      wrap.insertBefore(glow, baseCircle);
    } else {
      // update if it already exists
      const strokeW = Math.max(2, Math.round(r * 0.2));
      glow.setAttribute('stroke-width', strokeW);
      glow.setAttribute('cx', cx);
      glow.setAttribute('cy', cy);
      glow.setAttribute('r', r + strokeW * 0.5);
      glow.style.opacity = '0';
    }

    if (w.situation_image_url) {
      // --- IMAGE ORB ---
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

      // Place blurred image first
      const img = document.createElementNS("http://www.w3.org/2000/svg", "image");
      img.setAttribute("href", w.situation_image_url);
      img.setAttribute("x", cx - r + 1);
      img.setAttribute("y", cy - r + 1);
      img.setAttribute("width", r * 2 - 2);
      img.setAttribute("height", r * 2 - 2);
      img.setAttribute("preserveAspectRatio", "xMidYMid slice");
      img.setAttribute("clip-path", `url(#${clipId})`);
      img.setAttribute("filter", "url(#orbImageBlur)");

      const gradId = `grad-${id}`;
      let grad = document.getElementById(gradId);
      if (!grad) {
        grad = document.createElementNS("http://www.w3.org/2000/svg", "radialGradient");
        grad.setAttribute("id", gradId);
        grad.setAttribute("cx", "50%");
        grad.setAttribute("cy", "50%");
        grad.setAttribute("r", "50%");
        grad.setAttribute("fx", "50%");
        grad.setAttribute("fy", "50%");

        const stop1 = document.createElementNS("http://www.w3.org/2000/svg", "stop");
        stop1.setAttribute("offset", "0%");
        stop1.setAttribute("stop-color", "#fff");
        stop1.setAttribute("stop-opacity", "0.2");

        const stop2 = document.createElementNS("http://www.w3.org/2000/svg", "stop");
        stop2.setAttribute("offset", "100%");
        stop2.setAttribute("stop-color", EMOTION_COLORS[w.emotion] || "#FDE047");
        stop2.setAttribute("stop-opacity", "0.95");

        grad.appendChild(stop1);
        grad.appendChild(stop2);
        defs.appendChild(grad);
      }

      baseCircle.setAttribute("fill", `url(#${gradId})`);
      baseCircle.style.mixBlendMode = "normal";
      baseCircle.style.opacity = w.granted ? "1" : "0.85";
      wrap.appendChild(baseCircle);

      wrap.appendChild(img);

    } else {
      // --- NO IMAGE → gradient orb ---
      const gradId = `grad-${id}`;
      let grad = document.getElementById(gradId);
      if (!grad) {
        grad = document.createElementNS("http://www.w3.org/2000/svg", "radialGradient");
        grad.setAttribute("id", gradId);
        grad.setAttribute("cx", "50%");
        grad.setAttribute("cy", "50%");
        grad.setAttribute("r", "50%");
        grad.setAttribute("fx", "50%");
        grad.setAttribute("fy", "50%");

        const stop1 = document.createElementNS("http://www.w3.org/2000/svg", "stop");
        stop1.setAttribute("offset", "0%");
        stop1.setAttribute("stop-color", "#fff");
        stop1.setAttribute("stop-opacity", "0.2");

        const stop2 = document.createElementNS("http://www.w3.org/2000/svg", "stop");
        stop2.setAttribute("offset", "100%");
        stop2.setAttribute("stop-color", EMOTION_COLORS[w.emotion] || "#FDE047");
        stop2.setAttribute("stop-opacity", "0.95");

        grad.appendChild(stop1);
        grad.appendChild(stop2);
        defs.appendChild(grad);
      }

      baseCircle.setAttribute("fill", `url(#${gradId})`);
      baseCircle.style.mixBlendMode = "normal";
      baseCircle.style.opacity = w.granted ? "1" : "0.85";
      wrap.appendChild(baseCircle);

      // Emoji fallback on top
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

    // Always apply base glow filter initially
    baseCircle.setAttribute("filter", "url(#insideOutGlow)");

    // Click hit target
    const hit = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    hit.classList.add('ball-hit');
    hit.setAttribute('cx', cx);
    hit.setAttribute('cy', cy);
    hit.setAttribute('r', r);
    hit.setAttribute('fill', 'transparent');
    hit.style.cursor = 'pointer';
    hit.style.pointerEvents = 'all';

    // hover handlers: animate outline & swap stronger filter (white outline + filter)
    const onEnter = (ev) => {
      if (wrap.classList.contains('is-dragging')) return;
      // stronger filter on main circle (prefer colored emotion filter if present)
      const colorFilterId = `hoverGlow-${w.emotion}`;
      if (document.getElementById(colorFilterId)) {
        baseCircle.setAttribute('filter', `url(#${colorFilterId})`);
      } else {
        baseCircle.setAttribute('filter', 'url(#insideOutGlowHover)');
      }
      // animate outline stroke (no filled disc)
      glow.style.opacity = '1';
      glow.style.transform = 'scale(1)';
      // make stroke a bit thicker/bright
      glow.setAttribute('stroke-opacity', '0.98');
      // brighten base stroke too
      baseCircle.style.stroke = 'rgba(255,255,255,0.98)';
      baseCircle.style.strokeWidth = '1';
      wrap.classList.add('is-hover');
    };

    const onLeave = (ev) => {
      glow.style.opacity = '0';
      glow.style.transform = 'scale(1)';
      baseCircle.setAttribute('filter','url(#insideOutGlow)');
      baseCircle.style.stroke = w.granted ? "rgba(255,255,255,0.95)" : "none";
      baseCircle.style.strokeWidth = w.granted ? "3" : "0";
      wrap.classList.remove('is-hover');
    };

    // restore click to open modal (user requested)
    hit.addEventListener('click', (ev) => {
      ev.stopPropagation();
      try { openModal(id); } catch (e) { console.log('openModal missing', e); }
    });

    // pointer events (enter/leave + touch-friendly)
    hit.addEventListener('pointerenter', onEnter);
    hit.addEventListener('pointerleave', onLeave);
    hit.addEventListener('pointerdown', () => {
      // touch feedback: briefly show glow; keep until pointerup
      onEnter();
    });
    hit.addEventListener('pointerup', () => {
      if (!wrap.classList.contains('is-dragging')) {
        setTimeout(onLeave, 150);
      }
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
  } else if (latestDonation && latestDonation.granted_at !== null){
    alert("Thank you, but you've already granted a wish for this month. Please grant another in a few weeks!");
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
        <div class="font-semibold">${d.wish_nickname}</div>
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
  console.log(conversationId);
  console.log(title);
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
    console.log(txt);
    if (!txt) return;

    const senderId = user?.id || null;
    const senderName = donorDisplayName || user?.username || 'Anonymous';
    await saveMessage(conversationId, senderId, txt, senderName);
    document.getElementById('chatInput').value = '';
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
