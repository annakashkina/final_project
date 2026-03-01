import { lessons } from "./lessons.js?v=5";

// User ID for tracking
function getUID() {
  let uid = localStorage.getItem("codeprobe_uid");
  if (!uid) {
    uid = crypto.randomUUID();
    localStorage.setItem("codeprobe_uid", uid);
  }
  return uid;
}

// JS proof token — sha256(uid + salt), first 8 hex chars
async function makeToken(uid) {
  const data = new TextEncoder().encode(uid + "codeprobe_2026");
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 8);
}

let _tokenPromise = makeToken(getUID());

function apiHeaders() {
  return _tokenPromise.then(token => ({
    "Content-Type": "application/json",
    "X-UID": getUID(),
    "X-Token": token,
  }));
}

// Analytics — fire-and-forget
function track(type, data = {}) {
  const body = JSON.stringify({ type, ...data, ts: Date.now() });
  apiHeaders().then(h => fetch("/api/event", { method: "POST", headers: h, body })).catch(() => {});
}

// Identify: send page_load, adopt server-matched UID + restore progress
async function identify() {
  const uid = getUID();
  try {
    const h = await apiHeaders();
    const r = await fetch("/api/event", {
      method: "POST",
      headers: h,
      body: JSON.stringify({ type: "page_load", ts: Date.now() }),
    });
    const data = await r.json();
    if (data.uid && data.uid !== uid) {
      localStorage.setItem("codeprobe_uid", data.uid);
      _tokenPromise = makeToken(data.uid);
      if (data.progress) {
        localStorage.setItem("codeprobe", JSON.stringify(data.progress));
        renderHome();
      }
    }
  } catch {}
}

// Language names for prompt instruction
const LANG_NAMES = {
  en: "English", es: "Spanish", fr: "French", de: "German", it: "Italian",
  pt: "Portuguese", ru: "Russian", zh: "Chinese", ja: "Japanese", ko: "Korean",
  ar: "Arabic", hi: "Hindi", tr: "Turkish", nl: "Dutch", pl: "Polish",
  uk: "Ukrainian", vi: "Vietnamese", th: "Thai", et: "Estonian", lv: "Latvian",
  lt: "Lithuanian",
};

// State
const state = {
  lesson: null,
  fileIdx: 0,
  phase: "explore",
  messages: [],
  exchangeCount: 0,
  loading: false,
  mode: localStorage.getItem("codeprobe_mode") || "quick",
  lang: localStorage.getItem("codeprobe_lang") || "en",
};

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

// Progress (localStorage)
function getProgress() {
  try { return JSON.parse(localStorage.getItem("codeprobe") || "{}"); }
  catch { return {}; }
}

function saveCompletion(id) {
  const p = getProgress();
  if (!p[id]) p[id] = { completed: 0, first: Date.now() };
  p[id].completed++;
  p[id].last = Date.now();
  localStorage.setItem("codeprobe", JSON.stringify(p));
}

function shouldRevisit(id) {
  const p = getProgress()[id];
  if (!p) return false;
  return (Date.now() - p.last) / 86400000 >= 1 && p.completed < 3;
}

// "I already know" chips
const LANG_CHIPS = ["Python", "JavaScript", "Java", "C", "C++", "TypeScript", "Ruby", "Rust", "Go", "C#"];
const CONCEPT_CHIPS = ["OOP", "Data structures", "Memory management", "Concurrency", "Functional programming", "Databases / SQL", "Algorithms"];

function getKnownItems() {
  try { return JSON.parse(localStorage.getItem("codeprobe_knows") || "[]"); }
  catch { return []; }
}

function saveKnownItems(items) {
  localStorage.setItem("codeprobe_knows", JSON.stringify(items));
}

function getKnownLangs() {
  return getKnownItems().filter(i => LANG_CHIPS.includes(i));
}

function getKnownConcepts() {
  return getKnownItems().filter(i => CONCEPT_CHIPS.includes(i));
}

function renderChips() {
  const known = getKnownItems();
  const makeChips = (items) => items.map(item =>
    `<span class="i-know-chip ${known.includes(item) ? "active" : ""}" data-item="${item}">${item}</span>`
  ).join("");

  $("#i-know-chips").innerHTML =
    `<div class="chip-row">${makeChips(LANG_CHIPS)}</div>` +
    `<div class="chip-row">${makeChips(CONCEPT_CHIPS)}</div>`;

  $$("#i-know-chips .i-know-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      const item = chip.dataset.item;
      let items = getKnownItems();
      if (items.includes(item)) items = items.filter(i => i !== item);
      else items.push(item);
      saveKnownItems(items);
      chip.classList.toggle("active");
      track("i_know_toggle", { item, on: items.includes(item) });
    });
  });
}

// System prompt
function buildPrompt(lesson, questions) {
  const known = getKnownLangs();

  // Filter bridges to only languages the user knows; none selected → no bridges
  let bridges = "";
  if (known.length > 0) {
    let bridgeEntries = Object.entries(lesson.bridges).filter(([l]) => known.includes(l));
    if (bridgeEntries.length === 0) bridgeEntries = Object.entries(lesson.bridges);
    bridges = bridgeEntries.map(([l, n]) => `- ${l}: ${n}`).join("\n");
  }

  const code = lesson.files
    ? lesson.files.map(f => `--- ${f.name} ---\n${f.code}`).join("\n\n")
    : lesson.code;

  const concepts = getKnownConcepts();

  let studentDesc;
  const parts = [];
  if (known.length > 0) parts.push(`has worked with ${known.join(", ")}`);
  if (concepts.length > 0) parts.push(`has experience with ${concepts.join(", ")}`);
  if (parts.length === 0) {
    studentDesc = "a student who is likely a beginner";
  } else {
    studentDesc = `a programmer who ${parts.join(" and ")}`;
  }

  let levelNote = "";
  if (known.length === 0 && concepts.length === 0) {
    levelNote = "\nNote: The student hasn't specified their background. Don't assume what languages or CS concepts they know — ask if you need to reference another language or concept.";
  } else {
    const missing = [];
    if (!concepts.includes("Memory management")) missing.push("memory management (pointers, heap/stack)");
    if (!concepts.includes("Concurrency")) missing.push("concurrency (threads, async)");
    if (!concepts.includes("OOP")) missing.push("OOP (classes, inheritance)");
    if (missing.length > 0) {
      levelNote = `\nThe student has NOT indicated knowledge of: ${missing.join(", ")}. Do NOT assume they understand these — explain from scratch if the code involves them.`;
    }
  }

  const bridgeNote = bridges ? ", bridging from languages they know" : "";
  const isQuick = state.mode === "quick";

  const approach = isQuick
    ? `APPROACH:
1. Briefly address their questions if any
2. Teach ONE key concept from the code${bridgeNote}
3. After each concept, quiz them immediately — predict output, explain why, spot an issue
4. Give feedback on answers. Correct kindly, deepen if right.
5. After their answer, you decide:
   a) if their answer is correct AND shows understanding, give brief feedback, summarize what they learned in 1 sentence, and VERY IMPORTANT to end with [LESSON_COMPLETE].
   b) if the answer is wrong, incomplete, or "I don't know": explain kindly, then say "Final challenge:" and ask a NEW question so they can demonstrate understanding. Do NOT end with [LESSON_COMPLETE] until they answer a question correctly.
CRITICAL: Never use [LESSON_COMPLETE] in the same response where you had to significantly correct the person. The student must answer at least one question right before the lesson ends. But if you chose to correct and NOT finish yet, always ask some quiz.

RULES: Be conversational. ONE question only. Use backtick code snippets. Reference specific lines. ~1-2 total exchanges. Only reference languages the student knows — do NOT assume knowledge of languages not listed.${levelNote}`
    : `APPROACH:
1. Address their questions about the code
2. Teach ONE concept at a time${bridgeNote}
3. After each concept, quiz them immediately — predict output, explain why, spot an issue
4. Give feedback on answers. Correct kindly, deepen if right.
5. After 4-5 exchanges, say "Final challenge:" and give a synthesis question
6. After they answer the final challenge correctly, summarize what they learned in 2-3 sentences, and VERY IMPORTANT to end with [LESSON_COMPLETE]
CRITICAL: Never use [LESSON_COMPLETE] in the same response where you had to significantly correct the person. The student must answer at least one question right before the lesson ends. If you chose to correct and NOT finish yet, always ask some quiz.

RULES: Be conversational. ONE question at a time. Use backtick code snippets. Reference specific lines. ~5-7 total exchanges. Only reference languages the student knows — do NOT assume knowledge of languages not listed.${levelNote}`;

  const langInstruction = state.lang !== "en"
    ? `\nLANGUAGE: Respond entirely in ${LANG_NAMES[state.lang] || state.lang}. All explanations, questions, feedback, and quizzes must be in ${LANG_NAMES[state.lang] || state.lang}. Use English only for code snippets and technical terms that have no standard translation.\n`
    : "";

  return `You are a tutor teaching ${studentDesc}. They are learning ${lesson.lang || "this language"} through real code.
${langInstruction}
${approach}

${bridges ? `BRIDGES:\n${bridges}\n` : ""}CODE:
\`\`\`
${code}
\`\`\`

CONCEPTS: ${lesson.concepts.join(", ")}

STUDENT QUESTIONS: ${questions || "(none — start with the most important concept)"}`;
}

// API
async function chat(messages) {
  const h = await apiHeaders();
  const body = JSON.stringify({ messages });
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch("/api/chat", { method: "POST", headers: h, body });
      if (r.ok) return (await r.json()).reply;
      lastErr = (await r.json().catch(() => ({}))).error || `Error ${r.status}`;
      if (r.status < 500) break;
    } catch (e) {
      lastErr = e.message;
    }
    await new Promise(ok => setTimeout(ok, 1000 * (attempt + 1)));
  }
  throw new Error(lastErr);
}

// Render: Home
function renderHome() {
  const progress = getProgress();

  const langOrder = ["c", "python", "rust", "typescript", "ruby", "cpp", "meta"];
  const langNames = { c: "C", rust: "Rust", python: "Python", typescript: "TypeScript", ruby: "Ruby", cpp: "C++", meta: "How codeprobe works" };
  const grouped = {};
  for (const l of lessons) {
    const lang = l.lang || "rust";
    if (!grouped[lang]) grouped[lang] = [];
    grouped[lang].push(l);
  }

  $("#lesson-grid").innerHTML = langOrder
    .filter(lang => grouped[lang])
    .map(lang => {
      const cards = grouped[lang].map(l => {
        const p = progress[l.id];
        let badge = "";
        if (p && shouldRevisit(l.id)) badge = `<span class="card-badge revisit">revisit</span>`;
        else if (p) badge = `<span class="card-badge done">${p.completed}x</span>`;
        return `<div class="card" data-id="${l.id}">
          ${badge}
          <span class="card-diff">${l.difficulty}</span>
          <h3>${l.title}</h3>
          <p>${l.description}</p>
        </div>`;
      }).join("");
      return `<div class="lang-section">
        <h2 class="lang-header">${langNames[lang]}</h2>
        <div class="lang-row">${cards}</div>
      </div>`;
    }).join("");

  $$("#lesson-grid .card").forEach(c =>
    c.addEventListener("click", () => openLesson(c.dataset.id))
  );
}

function showView(v) {
  $("#home").classList.add("hidden");
  $("#lesson-view").classList.add("hidden");
  if (v === "home") {
    $("#home").classList.remove("hidden");
    $("#back-btn").classList.add("hidden");
  } else {
    $("#lesson-view").classList.remove("hidden");
    $("#back-btn").classList.remove("hidden");
  }
}

// Render: Code
function renderCode(idx) {
  const lesson = state.lesson;
  const codeEl = $("#code-display");
  let code, langClass;

  // Detect highlight language — for meta lessons, infer from filename or code
  const hljsLang = (lang, filename) => {
    if (lang && lang !== "meta") return lang;
    if (filename) {
      if (filename.includes(".py")) return "python";
      if (filename.includes(".js")) return "javascript";
      if (filename.includes(".ts")) return "typescript";
      if (filename.includes(".rb")) return "ruby";
      if (filename.includes(".c") && !filename.includes(".cpp")) return "c";
      if (filename.includes(".cpp")) return "cpp";
      if (filename.includes(".rs")) return "rust";
    }
    return null;  // let hljs auto-detect for meta single-file lessons
  };

  const extMap = { rust: "rs", python: "py", typescript: "ts", javascript: "js", c: "c", cpp: "cpp", ruby: "rb" };

  if (lesson.files) {
    idx = idx ?? state.fileIdx;
    code = lesson.files[idx].code;
    langClass = `language-${hljsLang(lesson.lang, lesson.files[idx].name)}`;
    $("#file-tabs").innerHTML = lesson.files.map((f, i) =>
      `<span class="file-tab ${i === idx ? "active" : ""}" data-idx="${i}">${f.name}</span>`
    ).join("");
    $$("#file-tabs .file-tab").forEach(t =>
      t.addEventListener("click", () => { state.fileIdx = +t.dataset.idx; renderCode(state.fileIdx); })
    );
  } else {
    code = lesson.code;
    const effectiveLang = hljsLang(lesson.lang);
    langClass = effectiveLang ? `language-${effectiveLang}` : null;
    const name = lesson.title.toLowerCase().replace(/[^a-z0-9]+/g, "_");
    const ext = extMap[effectiveLang] || extMap[lesson.lang] || "js";
    $("#file-tabs").innerHTML = `<span class="file-tab active">${name}.${ext}</span>`;
  }

  codeEl.className = langClass || "";
  codeEl.removeAttribute("data-highlighted");
  codeEl.textContent = code;
  hljs.highlightElement(codeEl);

  // Line numbers — inline, no block elements
  codeEl.innerHTML = codeEl.innerHTML
    .split("\n")
    .map((line, i) => `<span class="ln">${String(i + 1).padStart(3)}</span>${line}`)
    .join("\n");
}

function renderSeeds() {
  const el = $("#seed-questions");
  el.innerHTML = state.lesson.seedQuestions
    .map(q => `<span class="seed">${q}</span>`).join("");
  el.querySelectorAll(".seed").forEach(s =>
    s.addEventListener("click", () => {
      const ta = $("#user-questions");
      ta.value = ta.value ? ta.value + "\n" + s.textContent : s.textContent;
      ta.focus();
      track("seed_click", { text: s.textContent });
    })
  );
}

// Phases
function setPhase(phase) {
  state.phase = phase;
  if (state.lesson) track("phase_change", { lesson: state.lesson.id, phase });
  const order = ["explore", "learn", "challenge", "done"];
  const idx = order.indexOf(phase);
  $$(".phase").forEach((el, i) => {
    el.classList.toggle("active", i === idx);
    el.classList.toggle("done", i < idx);
  });
  $$("#phase-explore, #phase-chat, #phase-complete").forEach(el => el.classList.add("hidden"));
  if (phase === "explore") $("#phase-explore").classList.remove("hidden");
  else if (phase === "learn" || phase === "challenge") {
    $("#phase-chat").classList.remove("hidden");
    if (phase === "challenge") addMsg("challenge", "final challenge");
  }
  else if (phase === "done") $("#phase-complete").classList.remove("hidden");
}

function updateExchange() {
  const el = $("#exchange-text");
  if (state.phase === "challenge") el.textContent = "final challenge";
  else {
    const target = state.mode === "quick" ? "~1" : "~3";
    el.textContent = `exchange ${state.exchangeCount} of ${target}`;
  }
}

// Chat
function addMsg(role, content) {
  const box = $("#chat-messages");

  if (role === "typing") {
    const d = document.createElement("div");
    d.className = "typing"; d.id = "typing";
    d.textContent = "thinking...";
    box.appendChild(d);
    box.scrollTop = box.scrollHeight;
    return;
  }

  if (role === "challenge") {
    const d = document.createElement("div");
    d.className = "challenge-label";
    d.textContent = content;
    box.appendChild(d);
    box.scrollTop = box.scrollHeight;
    return;
  }

  const t = $("#typing"); if (t) t.remove();
  const d = document.createElement("div");

  if (role === "system") { d.className = "msg msg-system"; d.textContent = content; }
  else if (role === "assistant") {
    d.className = "msg msg-tutor";
    d.innerHTML = `<div class="msg-label">tutor</div>${fmt(content)}`;
  }
  else { d.className = "msg msg-user"; d.textContent = content; }

  box.appendChild(d);
  box.scrollTop = box.scrollHeight;
}

function fmt(t) {
  const esc = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const holds = [];
  const ph = (s) => { holds.push(s); return `\x00${holds.length - 1}\x00`; };
  t = t.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, _l, code) => ph(`<pre><code>${esc(code)}</code></pre>`));
  t = t.replace(/`([^`]+)`/g, (_, code) => ph(`<code>${esc(code)}</code>`));
  t = t.replace(/\*\*([\s\S]+?)\*\*/g, "<strong>$1</strong>");
  t = t.replace(/\n/g, "<br>");
  t = t.replace(/\x00(\d+)\x00/g, (_, i) => holds[i]);
  return t;
}

// Completion
function renderDone(summary) {
  const lesson = state.lesson;
  const p = getProgress()[lesson.id];
  const first = p && p.completed === 1;

  $("#completion-card").innerHTML = `
    <h2>you understand this now.</h2>
    <div class="concepts">${lesson.concepts.map(c => `<span class="tag">${c}</span>`).join("")}</div>
    <div class="summary">${fmt(summary)}</div>
    ${first ? `<div class="revisit-note">come back tomorrow to revisit this lesson &mdash; spaced repetition dramatically improves retention.</div>` : ""}
    <div class="comp-actions">
      <button class="btn-primary" id="go-home">another lesson</button>
      <button class="btn-secondary" id="go-retry">try again</button>
    </div>`;

  $("#go-home").addEventListener("click", () => { renderHome(); showView("home"); });
  $("#go-retry").addEventListener("click", () => openLesson(lesson.id));

  // confetti
  const c = $("#confetti"); c.innerHTML = "";
  const colors = ["#4a9eff", "#5cb85c", "#e8883a", "#d9534f", "#c9a227"];
  for (let i = 0; i < 30; i++) {
    const p = document.createElement("div");
    p.className = "confetti-bit";
    p.style.left = Math.random() * 100 + "%";
    p.style.background = colors[i % colors.length];
    p.style.animationDelay = Math.random() * 1.2 + "s";
    p.style.animationDuration = 2 + Math.random() + "s";
    c.appendChild(p);
  }
  setTimeout(() => c.innerHTML = "", 3500);
}

// Actions
function openLesson(id) {
  state.lesson = lessons.find(l => l.id === id);
  state.messages = [];
  state.exchangeCount = 0;
  state.fileIdx = 0;
  renderCode();
  renderSeeds();
  $("#user-questions").value = "";
  $("#chat-messages").innerHTML = "";
  setPhase("explore");
  showView("lesson");
  track("lesson_open", { lesson: id });
}

async function startLearning() {
  const q = $("#user-questions").value.trim();
  state.messages = [{ role: "system", content: buildPrompt(state.lesson, q) }];
  setPhase("learn");
  updateExchange();
  const est = state.mode === "quick" ? "~1 exchange" : "~3 exchanges ahead";
  addMsg("system", q ? `questions sent. ${est}.` : `starting. ${est}.`);
  track("start_learning", { lesson: state.lesson.id, questions: q, mode: state.mode, lang: state.lang });
  await getLLMResponse();
}

async function getLLMResponse() {
  state.loading = true;
  $("#send-btn").disabled = true;
  addMsg("typing");

  try {
    const reply = await chat(state.messages);
    state.messages.push({ role: "assistant", content: reply });
    const t = $("#typing"); if (t) t.remove();
    const clean = reply.trim().replace("[LESSON_PENDING]", "").trim();

    if (clean.includes("[LESSON_COMPLETE]")) {
      const summary = clean.replace("[LESSON_COMPLETE]", "").trim();
      addMsg("assistant", summary);
      saveCompletion(state.lesson.id);
      track("tutor_reply", { lesson: state.lesson.id, text: summary });
      track("lesson_complete", { lesson: state.lesson.id });
      setPhase("done");
      renderDone(summary);
    } else {
      addMsg("assistant", clean);
      track("tutor_reply", { lesson: state.lesson.id, text: clean });
      if (state.mode !== "quick" && state.exchangeCount >= 4 && state.phase !== "challenge") setPhase("challenge");
    }
    updateExchange();
  } catch (e) {
    const t = $("#typing"); if (t) t.remove();
    addMsg("system", `error: ${e.message}. try again.`);
  }

  state.loading = false;
  $("#send-btn").disabled = false;
  $("#chat-input").focus();
}

async function sendMsg() {
  const input = $("#chat-input");
  const text = input.value.trim();
  if (!text || state.loading) return;
  input.value = "";
  state.messages.push({ role: "user", content: text });
  state.exchangeCount++;
  addMsg("user", text);
  updateExchange();
  track("user_msg", { lesson: state.lesson.id, text });
  await getLLMResponse();
}

function copyForClaude() {
  const code = state.lesson.files
    ? state.lesson.files.map(f => `// --- ${f.name} ---\n${f.code}`).join("\n\n")
    : state.lesson.code;
  const q = $("#user-questions").value.trim();
  const prompt = `I'm learning ${state.lesson.lang || "Rust"}. Here's code I'm studying:\n\n\`\`\`\n${code}\n\`\`\`\n\n${q ? `My questions:\n${q}\n\n` : ""}Teach me using active learning: explain concepts, then quiz me. One question at a time. Wait for my answer.`;
  navigator.clipboard.writeText(prompt).then(() => toast("copied — paste into Claude"));
  track("copy_claude", { lesson: state.lesson.id });
}

function toast(msg) {
  const el = $("#toast");
  el.textContent = msg;
  el.classList.remove("hidden");
  setTimeout(() => el.classList.add("hidden"), 2200);
}

// Events
$("#back-btn").addEventListener("click", () => {
  track("back_home", { from_lesson: state.lesson?.id });
  renderHome(); showView("home");
});
$("#start-btn").addEventListener("click", startLearning);
$$("#mode-toggle .mode-opt").forEach(btn => {
  btn.addEventListener("click", () => {
    state.mode = btn.dataset.mode;
    localStorage.setItem("codeprobe_mode", state.mode);
    $$("#mode-toggle .mode-opt").forEach(b => b.classList.toggle("active", b === btn));
    track("mode_toggle", { mode: state.mode });
  });
  // Restore active state from localStorage on load
  btn.classList.toggle("active", btn.dataset.mode === state.mode);
});
$("#lang-select").value = state.lang;
$("#lang-select").addEventListener("change", () => {
  state.lang = $("#lang-select").value;
  localStorage.setItem("codeprobe_lang", state.lang);
  track("lang_toggle", { lang: state.lang });
});
$("#copy-claude-btn").addEventListener("click", copyForClaude);
$("#copy-code-btn").addEventListener("click", () => {
  const code = state.lesson.files ? state.lesson.files[state.fileIdx].code : state.lesson.code;
  navigator.clipboard.writeText(code).then(() => toast("copied"));
});
$("#send-btn").addEventListener("click", sendMsg);
$("#chat-input").addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMsg(); }
});

// Drag handle for resizing panels
(function () {
  const handle = $("#drag-handle");
  const layout = $(".lesson-layout");
  let dragging = false;

  function startDrag(e) {
    e.preventDefault();
    dragging = true;
    handle.classList.add("dragging");
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }

  function onDrag(clientX) {
    if (!dragging) return;
    const rect = layout.getBoundingClientRect();
    const x = clientX - rect.left;
    const pct = (x / rect.width) * 100;
    const clamped = Math.min(Math.max(pct, 20), 80);
    layout.style.gridTemplateColumns = `${clamped}% 6px 1fr`;
  }

  function endDrag() {
    if (!dragging) return;
    dragging = false;
    handle.classList.remove("dragging");
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }

  handle.addEventListener("mousedown", startDrag);
  document.addEventListener("mousemove", (e) => onDrag(e.clientX));
  document.addEventListener("mouseup", endDrag);

  handle.addEventListener("touchstart", startDrag, { passive: false });
  document.addEventListener("touchmove", (e) => {
    if (dragging) { e.preventDefault(); onDrag(e.touches[0].clientX); }
  }, { passive: false });
  document.addEventListener("touchend", endDrag);
})();

// Theme toggle
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem("codeprobe_theme", theme);
  document.getElementById("hljs-light").disabled = theme === "dark";
  document.getElementById("hljs-dark").disabled = theme === "light";
  document.getElementById("theme-toggle").textContent = theme === "dark" ? "\u2600" : "\u263E";
}

$("#theme-toggle").addEventListener("click", () => {
  const current = document.documentElement.dataset.theme || "light";
  applyTheme(current === "dark" ? "light" : "dark");
});

applyTheme(localStorage.getItem("codeprobe_theme") || "light");

// Feedback modal
const feedbackFormHTML = `
  <div style="font-weight:600;margin-bottom:8px">feedback</div>
  <textarea id="feedback-text" rows="4" placeholder="What's hard? What's working? What's missing?" style="width:100%;resize:vertical;padding:8px;border-radius:4px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-family:inherit;font-size:13px"></textarea>
  <div style="display:flex;gap:6px;justify-content:flex-end;margin-top:10px">
    <button id="feedback-cancel" class="btn-secondary">cancel</button>
    <button id="feedback-send" class="btn-primary">send</button>
  </div>`;

function openFeedback() {
  const inner = $("#feedback-modal").firstElementChild;
  inner.innerHTML = feedbackFormHTML;
  $("#feedback-modal").classList.remove("hidden");
  $("#feedback-text").focus();
  $("#feedback-cancel").addEventListener("click", () => {
    $("#feedback-modal").classList.add("hidden");
  });
  $("#feedback-send").addEventListener("click", () => {
    const text = $("#feedback-text").value.trim();
    if (!text) return;
    track("feedback", { text, lesson: state.lesson?.id || null });
    inner.style.transition = "all 0.25s ease";
    inner.innerHTML = `
      <div style="text-align:center;padding:24px 16px">
        <div style="font-size:32px;margin-bottom:8px">&#10003;</div>
        <div style="font-weight:600;font-size:15px">Feedback sent! Thank you!</div>
        <div style="color:var(--dim);font-size:13px;margin-top:6px">I'll read it!</div>
      </div>`;
    setTimeout(() => { $("#feedback-modal").classList.add("hidden"); }, 2400);
  });
}

$("#proto-banner").addEventListener("click", openFeedback);
$("#feedback-modal").addEventListener("click", (e) => {
  if (e.target === $("#feedback-modal")) $("#feedback-modal").classList.add("hidden");
});

// Init
renderChips();
renderHome();
identify();
