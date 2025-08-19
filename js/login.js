// js/login.js
// keys are same as the extracted demo code
const LS_ROLE = 'wishjar_role';
const LS_ACTIVE_USER = 'wishjar_active_user';

document.getElementById("loginForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const form = e.target;
  const username = (form.username.value || '').trim();
  const password = (form.password.value || '').trim();

  const isAdmin = username === "admin" && password === "admin123";
  const isUser = username === "member" && password === "member123";

  if (!isAdmin && !isUser) {
    alert("Invalid username or password. Use admin/admin123 or member/member123 for demo.");
    return;
  }

  localStorage.setItem(LS_ROLE, isAdmin ? 'admin' : 'user');
  localStorage.setItem(LS_ACTIVE_USER, isAdmin ? 'admin' : 'member');

  if (isAdmin) window.location.href = "admin.html";
  else window.location.href = "donor.html";
});

document.getElementById("registerBtn").addEventListener("click", () => {
  alert("Registration not implemented in this demo. Use demo accounts: admin/admin123 or member/member123.");
});
