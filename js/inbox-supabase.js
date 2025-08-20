// js/inbox-supabase.js
// Supabase Inbox System (secure chat between donor and admin)
//
// Requires:
// - conversations table
// - messages table
// - RLS policies from instructions

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

// ---------- CONFIG ----------
const SUPABASE_URL = "https://eaivuhgvzdvvxscqqqji.supabase.co"; // replace
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVhaXZ1aGd2emR2dnhzY3FxcWppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU1OTMxNDIsImV4cCI6MjA3MTE2OTE0Mn0.ru1S0ZiYQluFFzYkrbFxqzk2v315xAA29iXlviy3Y1E";                          // replace
// ----------------------------

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let activeConversation = null;
let user = null;

// Helpers
const $ = id => document.getElementById(id);
function showBanner(msg, color = "yellow") {
  const banner = $("inboxBanner");
  if (!banner) return;
  banner.textContent = msg;
  banner.classList.remove("hidden");
  banner.className = `mt-4 text-sm px-4 py-2 rounded-lg text-${color}-200 bg-${color}-500/20`;
}
function clearBanner() {
  const banner = $("inboxBanner");
  if (banner) banner.classList.add("hidden");
}

// Load user info
async function initUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    showBanner("Not signed in. Please log in.", "red");
    return null;
  }
  user = data.user;
  $("inboxUserBadge").textContent = user.email || "User";
  return user;
}

// Load conversations for this user
async function loadConversations() {
  clearBanner();
  const { data, error } = await supabase
    .from("conversations")
    .select("id, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    showBanner("Failed to load conversations", "red");
    return;
  }

  const threadList = $("threadList");
  threadList.innerHTML = "";

  if (!data.length) {
    threadList.innerHTML = `<div class="p-4 text-sm opacity-70">No conversations yet</div>`;
    return;
  }

  data.forEach(conv => {
    const btn = document.createElement("button");
    btn.className = "w-full text-left px-4 py-3 hover:bg-white/10";
    btn.textContent = `Conversation ${conv.id.slice(0, 6)}…`;
    btn.onclick = () => openConversation(conv.id);
    threadList.appendChild(btn);
  });
}

// Open a conversation and subscribe
async function openConversation(convId) {
  activeConversation = convId;
  $("chatHeader").querySelector("div").textContent = `Conversation ${convId.slice(0, 6)}`;
  $("chatMessages").innerHTML = "";

  const { data, error } = await supabase
    .from("messages")
    .select("id, sender_id, body, created_at")
    .eq("conversation_id", convId)
    .order("created_at");

  if (error) {
    console.error(error);
    showBanner("Failed to load messages", "red");
    return;
  }
  renderMessages(data);

  // Subscribe for realtime updates
  supabase
    .channel("chat-" + convId)
    .on("postgres_changes", {
      event: "INSERT",
      schema: "public",
      table: "messages",
      filter: `conversation_id=eq.${convId}`
    }, payload => {
      renderMessages([...(data || []), payload.new]);
    })
    .subscribe();
}

// Render messages
function renderMessages(msgs) {
  const container = $("chatMessages");
  container.innerHTML = "";
  msgs.forEach(m => {
    const div = document.createElement("div");
    const isSelf = m.sender_id === user.id;
    div.className = `p-3 rounded-lg max-w-[75%] ${isSelf ? "bg-indigo-600 text-white ml-auto" : "bg-white text-slate-900"}`;
    div.textContent = m.body;
    container.appendChild(div);
  });
  container.scrollTop = container.scrollHeight;
}

// Handle sending
$("chatForm").addEventListener("submit", async e => {
  e.preventDefault();
  if (!activeConversation) {
    showBanner("Select a conversation first.", "yellow");
    return;
  }
  const input = $("chatInput");
  const text = input.value.trim();
  if (!text) return;

  const { error } = await supabase.from("messages").insert([
    {
      conversation_id: activeConversation,
      sender_id: user.id,
      body: text
    }
  ]);
  if (error) {
    console.error(error);
    showBanner("Message failed to send", "red");
  }
  input.value = "";
});

// Init
(async function(){
  const u = await initUser();
  if (u) loadConversations();
})();
