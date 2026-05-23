const INVITE_CODE_RE = /^[A-Za-z0-9_-]{1,64}$/;

const $ = (s) => document.querySelector(s);

function escHTML(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
                  .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function inviteCodeFromPath() {
  const parts = window.location.pathname.split("/");
  const code = parts.length === 3 ? decodeURIComponent(parts[2]) : "";
  return INVITE_CODE_RE.test(code) ? code : "";
}

// --- Privacy / auth (mirrored from standalone study/assessment flows) ---
let _sessionUID = null;
function getUID() {
  const stored = localStorage.getItem("codeprobe_uid");
  if (stored) return stored;
  if (!_sessionUID) _sessionUID = crypto.randomUUID();
  return _sessionUID;
}

let _memToken = null;
let _tokenPromise = null;
function getToken() { return localStorage.getItem("codeprobe_token") || _memToken; }
function storeToken(tok) {
  if (localStorage.getItem("codeprobe_uid")) localStorage.setItem("codeprobe_token", tok);
  else _memToken = tok;
}

async function ensureToken() {
  const tok = getToken();
  if (tok) return tok;

  if (!_tokenPromise) {
    _tokenPromise = (async () => {
      const resp = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-UID": getUID() },
      });
      if (!resp.ok) throw new Error("register failed: " + resp.status);
      const data = await resp.json();
      storeToken(data.token);
      return data.token;
    })().finally(() => {
      _tokenPromise = null;
    });
  }

  return _tokenPromise;
}

async function apiHeaders() {
  const token = await ensureToken();
  return {
    "Content-Type": "application/json",
    "X-UID": getUID(),
    "X-Token": token,
    "X-Mode": "saving",
  };
}

function enableSavingForInvite() {
  const uid = getUID();
  localStorage.setItem("codeprobe_uid", uid);
  localStorage.setItem("codeprobe_privacy", "saving");
}

async function trackInvite(code) {
  const h = await apiHeaders();
  const body = JSON.stringify({
    type: "invite",
    code,
    text: `invite ${code}`,
    label: `invite ${code}`,
    ts: Date.now(),
  });
  const resp = await fetch("/api/event", { method: "POST", headers: h, body });
  if (!resp.ok) throw new Error("event failed: " + resp.status);
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem("codeprobe_theme", theme);
  $("#theme-toggle").textContent = theme === "dark" ? "L" : "D";
}

const code = inviteCodeFromPath();
const check = $("#consent-check");
const start = $("#consent-start");
const status = $("#invite-status");

$("#invite-code").innerHTML = escHTML(code || "invalid");

if (!code) {
  check.disabled = true;
  start.disabled = true;
  status.textContent = "This invite link is invalid.";
} else {
  check.addEventListener("change", () => { start.disabled = !check.checked; });
  start.addEventListener("click", async () => {
    start.disabled = true;
    check.disabled = true;
    status.textContent = "Recording invite...";
    try {
      enableSavingForInvite();
      await trackInvite(code);
      status.innerHTML = `Recorded <span class="invite-code">invite ${escHTML(code)}</span>. Redirecting...`;
      window.location.assign("/c-fundamentals");
    } catch {
      check.disabled = false;
      start.disabled = !check.checked;
      status.textContent = "Could not record the invite. Please try again.";
    }
  });
}

$("#theme-toggle").addEventListener("click", () => {
  const cur = document.documentElement.dataset.theme || "light";
  applyTheme(cur === "dark" ? "light" : "dark");
});
applyTheme(localStorage.getItem("codeprobe_theme") || "light");
