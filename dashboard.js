let currentUID = null;
const dashKey = location.pathname.split("/").pop();

function relTime(ms) {
  const diff = Date.now() - ms;
  if (diff < 60000) return "just now";
  if (diff < 3600000) return Math.floor(diff / 60000) + "m ago";
  if (diff < 86400000) return Math.floor(diff / 3600000) + "h ago";
  return Math.floor(diff / 86400000) + "d ago";
}

function absTime(ms) {
  const d = new Date(ms);
  return d.toLocaleString();
}

function esc(s) {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

async function loadUsers() {
  const minEv = document.getElementById("hide-bots").checked ? 2 : 0;
  const resp = await fetch(`/api/users?key=${dashKey}&min_events=${minEv}`);
  const users = await resp.json();
  const el = document.getElementById("users");

  if (users.length === 0) {
    el.innerHTML = '<div class="no-users">no users yet — open the app to generate events</div>';
    return;
  }

  el.innerHTML = users.map(u => `
    <div class="user-item ${u.uid === currentUID ? 'active' : ''}" data-uid="${u.uid}">
      <div class="user-id">${u.uid.slice(0, 8)}</div>
      <div class="user-meta">consented ${u.consent_ts ? relTime(u.consent_ts) : "—"}</div>
      <div class="user-stats">
        <span>${u.events} events</span>
        <span>${u.last_ts ? relTime(u.last_ts) : "—"}</span>
      </div>
    </div>
  `).join("");

  el.querySelectorAll(".user-item").forEach(item => {
    item.addEventListener("click", () => {
      currentUID = item.dataset.uid;
      loadUsers();
      loadTimeline(currentUID);
    });
  });
}

async function loadTimeline(uid) {
  const resp = await fetch(`/api/timeline?key=${dashKey}&uid=${uid}`);
  const events = await resp.json();
  const el = document.getElementById("timeline");

  if (events.length === 0) {
    el.innerHTML = '<div class="timeline-empty">no events for this user</div>';
    return;
  }

  el.innerHTML = `<div class="timeline-header">${uid} — ${events.length} events</div>` +
    events.map((evt, i) => {
      const type = evt.type || "unknown";
      let detail = "";
      let text = "";

      if (evt.lesson) detail += evt.lesson;
      if (evt.phase) detail += (detail ? " → " : "") + evt.phase;
      if (evt.from_lesson) detail += evt.from_lesson;

      if (type === "user_msg" && evt.text) text = evt.text;
      if (type === "tutor_reply" && evt.text) text = evt.text;
      if (type === "seed_click" && evt.text) detail = evt.text;
      if (type === "start_learning" && evt.questions) text = evt.questions;
      if (type === "feedback" && evt.text) text = evt.text;
      if (type === "invite" && evt.code) detail = `invite ${evt.code}`;

      if (type === "assessment_start") detail = `${evt.assessment} | ${evt.group || "?"} | form ${evt.form || "?"}`;
      if (type === "assessment_answer") {
        const s = evt.score !== null && evt.score !== undefined ? `${evt.score}/3` : "?";
        detail = `${s} — ${evt.concept}`;
        if (evt.answer) text = evt.answer;
      }
      if (type === "assessment_complete") {
        detail = `${evt.assessment} | ${evt.group || "?"}: ${evt.score}/${evt.maxScore} (${evt.pct}%)`;
        if (evt.durationMs) detail += ` in ${Math.round(evt.durationMs / 1000)}s`;
        if (evt.answers) {
          text = evt.answers.map(a => `${a.score ?? "?"}/3 ${a.concept}`).join("\n");
        }
      }

      if (type === "daily_start") detail = `${evt.track || "?"} | ${evt.date || "?"}`;
      if (type === "daily_answer") {
        const s = evt.score !== null && evt.score !== undefined ? `${evt.score}/3` : "?";
        detail = `${evt.level || "?"} — ${s} — ${evt.concept || ""}`;
        if (evt.answer) text = evt.answer;
      }
      if (type === "daily_complete") {
        detail = `${evt.track || "?"} | ${evt.date || "?"}: ${evt.score}/${evt.maxScore} (${evt.pct}%)`;
        if (evt.durationMs) detail += ` in ${Math.round(evt.durationMs / 1000)}s`;
        if (evt.answers) {
          text = evt.answers.map(a => `${a.score ?? "?"}/3 [${a.level}] ${a.concept}`).join("\n");
        }
      }

      return `
        <div class="event ev-${type}">
          <div class="event-time" title="${absTime(evt.ts)}">${relTime(evt.ts)}</div>
          <div class="event-dot"></div>
          <div class="event-body">
            <div class="event-type">${type.replace(/_/g, " ")}</div>
            ${detail ? `<div class="event-detail">${esc(detail)}</div>` : ""}
            ${text ? `<div class="event-text">${esc(text)}</div>` : ""}
          </div>
        </div>`;
    }).join("");
}

document.getElementById("refresh-btn").addEventListener("click", () => {
  loadUsers();
  if (currentUID) loadTimeline(currentUID);
});

document.getElementById("hide-bots").addEventListener("change", () => loadUsers());

loadUsers();
