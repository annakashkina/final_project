// Daily quiz. One question per difficulty level, in order beginner -> expert.
// Same picks for everyone on a given UTC date (seeded by date+track).
//
// Tracks: choose via URL hash, e.g. /daily#rust. Default: rust.
// To add a track later: drop a new daily_questions_<id>.js file and register
// it in TRACK_MODULES below.

const TRACK_MODULES = {
  rust: () => import("./daily_questions_rust.js"),
};
const DEFAULT_TRACK = "rust";

const trackId = (location.hash.slice(1) || DEFAULT_TRACK).toLowerCase();
if (!TRACK_MODULES[trackId]) {
  document.body.innerHTML = `<div style="padding:40px;text-align:center;color:var(--dim)">Unknown track: <code>${trackId}</code></div>`;
  throw new Error(`unknown track ${trackId}`);
}
const trackMod = await TRACK_MODULES[trackId]();
const TRACK_META = trackMod.meta;
const LEVELS = trackMod.levels;
const POOL = trackMod.questions;

const HISTORY_KEY = `codeprobe_daily_${trackId}_history`;
const TODAY_KEY = `codeprobe_daily_${trackId}_today`;
const HISTORY_WINDOW = 60;

// --- UTC date helpers ---
function todayUTC() {
  return new Date().toISOString().slice(0, 10);
}
function msUntilNextUTCMidnight() {
  const now = new Date();
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return next - now;
}
function formatCountdown(ms) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${m}m`;
}

// --- Seeded picker (FNV-1a hash -> index per level) ---
function hashStr(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}
function pickForDate(date) {
  return LEVELS.map(level => {
    const pool = POOL[level] || [];
    if (pool.length === 0) throw new Error(`level ${level} has no questions`);
    const idx = hashStr(`${trackId}|${date}|${level}`) % pool.length;
    return { ...pool[idx], level };
  });
}

// --- Privacy / auth (mirrored from app.js for standalone use) ---
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
  let tok = getToken();
  if (tok) return tok;
  if (!_tokenPromise) {
    _tokenPromise = (async () => {
      const resp = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-UID": getUID() },
      });
      if (!resp.ok) throw new Error("register failed");
      const data = await resp.json();
      storeToken(data.token);
      return data.token;
    })().finally(() => { _tokenPromise = null; });
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
function track(type, data = {}) {
  const body = JSON.stringify({ type, ...data, ts: Date.now() });
  apiHeaders().then(h => fetch("/api/event", { method: "POST", headers: h, body })).catch(() => {});
}
function enableSaving() {
  const uid = getUID();
  localStorage.setItem("codeprobe_uid", uid);
  localStorage.setItem("codeprobe_privacy", "saving");
}
function hasConsented() {
  return localStorage.getItem("codeprobe_privacy") === "saving";
}

// --- LLM grading ---
async function gradeAnswer(language, code, question, answer) {
  const h = await apiHeaders();
  const messages = [
    {
      role: "system",
      content: `You are grading a student's answer to a ${language} programming comprehension question.

CODE:
\`\`\`${language}
${code}
\`\`\`

QUESTION: ${question}

Grade their answer on this scale:
0 = No understanding or completely wrong
1 = Partial understanding with significant errors
2 = Mostly correct with minor gaps
3 = Fully correct with clear reasoning

Respond in EXACTLY this format (two lines, nothing else):
SCORE: [number]
FEEDBACK: [one brief encouraging sentence]`,
    },
    { role: "user", content: answer },
  ];
  const resp = await fetch("/api/chat", {
    method: "POST",
    headers: h,
    body: JSON.stringify({ messages, expect_short: true }),
  });
  if (!resp.ok) return { score: null, feedback: "Grading unavailable; your answer was recorded.", raw: null };
  const data = await resp.json();
  const raw = data.reply || "";
  const scoreMatch = raw.match(/SCORE:\s*(\d)/);
  const feedbackMatch = raw.match(/FEEDBACK:\s*(.+)/);
  const parsed = scoreMatch ? parseInt(scoreMatch[1]) : null;
  return {
    score: parsed !== null ? Math.min(parsed, 3) : null,
    feedback: feedbackMatch ? feedbackMatch[1].trim() : raw.trim(),
    raw,
  };
}

// --- Local persistence ---
function loadHistory() {
  try {
    const arr = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}
function saveHistory(arr) {
  const trimmed = arr.slice(-HISTORY_WINDOW);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
}
function loadToday() {
  try {
    const t = JSON.parse(localStorage.getItem(TODAY_KEY));
    if (t && t.date === todayUTC()) return t;
  } catch {}
  return null;
}
function saveToday(t) {
  localStorage.setItem(TODAY_KEY, JSON.stringify(t));
}
function clearToday() {
  localStorage.removeItem(TODAY_KEY);
}

// --- DOM helpers ---
const $ = (s) => document.querySelector(s);
function escHTML(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
                  .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function showOnly(id) {
  for (const el of ["intro-screen", "quiz-screen", "results-screen"]) {
    document.getElementById(el).classList.toggle("hidden", el !== id);
  }
}

// --- Theme ---
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem("codeprobe_theme", theme);
  document.getElementById("hljs-light").disabled = theme === "dark";
  document.getElementById("hljs-dark").disabled = theme === "light";
  document.getElementById("theme-toggle").textContent = theme === "dark" ? "L" : "D";
}
$("#theme-toggle").addEventListener("click", () => {
  const cur = document.documentElement.dataset.theme || "light";
  applyTheme(cur === "dark" ? "light" : "dark");
});
applyTheme(localStorage.getItem("codeprobe_theme") || "light");

// --- Score labels ---
const SCORE_LABELS = ["Not yet", "Getting there", "Mostly there", "Solid"];
const SCORE_COLORS = ["var(--dim)", "var(--orange)", "var(--yellow)", "var(--green)"];

// --- Quiz state ---
const state = {
  date: todayUTC(),
  questions: [],
  index: 0,
  answers: [],
  startTime: 0,
  grading: false,
  answered: false,
};

function showIntro() {
  showOnly("intro-screen");
  $("#daily-title").textContent = TRACK_META.title;
  $("#intro-heading").textContent = TRACK_META.title;
  const consented = hasConsented();
  const consentRow = $(".study-label");
  if (consented) {
    consentRow.style.display = "none";
    $("#consent-start").disabled = false;
  } else {
    consentRow.style.display = "";
    const check = $("#consent-check");
    check.checked = false;
    $("#consent-start").disabled = true;
    check.addEventListener("change", () => { $("#consent-start").disabled = !check.checked; });
  }
  $("#consent-start").addEventListener("click", startToday, { once: true });
}

function startToday() {
  enableSaving();
  state.questions = pickForDate(state.date);
  state.index = 0;
  state.answers = [];
  state.startTime = Date.now();
  saveToday(serializeToday());
  track("daily_start", {
    track: trackId,
    date: state.date,
    questionIds: state.questions.map(q => q.id),
    levels: state.questions.map(q => q.level),
  });
  initQuiz();
}

function serializeToday() {
  return {
    date: state.date,
    questionIds: state.questions.map(q => q.id),
    levels: state.questions.map(q => q.level),
    index: state.index,
    answers: state.answers,
    startTime: state.startTime,
  };
}

function resumeToday(saved) {
  state.questions = pickForDate(state.date);
  state.answers = saved.answers || [];
  state.index = Math.min(saved.index ?? state.answers.length, state.questions.length);
  state.startTime = saved.startTime || Date.now();
  if (state.index >= state.questions.length) { finishQuiz(); return; }
  initQuiz();
}

function initQuiz() {
  showOnly("quiz-screen");
  $("#daily-title").textContent = TRACK_META.title;
  renderQuestion();
}

function renderQuestion() {
  const q = state.questions[state.index];
  state.answered = false;
  $("#q-submit").disabled = false;
  $("#q-submit").textContent = "Submit answer";
  $("#q-next").classList.add("hidden");
  $("#q-feedback").classList.add("hidden");
  $("#q-answer").value = "";
  $("#q-answer").disabled = false;
  $("#q-answer").focus();
  $("#q-hint").textContent = "Ctrl+Enter to submit.";

  $("#progress-text").textContent = `Question ${state.index + 1} of ${state.questions.length}`;
  $("#progress-fill").style.width = `${(state.index / state.questions.length) * 100}%`;
  $("#level-badge").textContent = q.level;

  const codeEl = $("#q-code-display");
  const lang = TRACK_META.language || "plaintext";
  const ext = lang === "rust" ? "rs" : lang === "python" ? "py" : "txt";
  $("#q-filename").textContent = `question_${state.index + 1}.${ext}`;
  codeEl.className = `language-${lang}`;
  codeEl.removeAttribute("data-highlighted");
  codeEl.textContent = q.code;
  hljs.highlightElement(codeEl);
  codeEl.innerHTML = codeEl.innerHTML
    .split("\n")
    .map((line, i) => `<span class="ln">${String(i + 1).padStart(3)}</span>${line}`)
    .join("\n");

  $("#q-prompt").textContent = q.question;
}

$("#q-submit").addEventListener("click", async () => {
  const answer = $("#q-answer").value.trim();
  if (!answer || state.grading || state.answered) return;

  state.grading = true;
  state.answered = true;
  $("#q-submit").disabled = true;
  $("#q-submit").textContent = "Grading...";
  $("#q-answer").disabled = true;

  const q = state.questions[state.index];
  let result;
  try {
    result = await gradeAnswer(TRACK_META.language || "plaintext", q.code, q.question, answer);
  } catch {
    result = { score: null, feedback: "Grading unavailable; your answer was recorded.", raw: null };
  }

  const answerRecord = {
    questionId: q.id,
    concept: q.concept,
    level: q.level,
    answer,
    score: result.score,
    feedback: result.feedback,
  };
  state.answers.push(answerRecord);
  saveToday(serializeToday());

  track("daily_answer", {
    track: trackId,
    date: state.date,
    level: q.level,
    questionId: q.id,
    concept: q.concept,
    answer,
    score: result.score,
    feedback: result.feedback,
    questionIndex: state.index,
  });

  const fb = $("#q-feedback");
  fb.classList.remove("hidden");
  if (result.score !== null) {
    fb.innerHTML = `
      <div class="fb-score" style="color:${SCORE_COLORS[result.score]}">
        <span class="fb-label">${SCORE_LABELS[result.score]}</span>
      </div>
      <div class="fb-text">${escHTML(result.feedback)}</div>`;
  } else {
    fb.innerHTML = `<div class="fb-text">${escHTML(result.feedback)}</div>`;
  }
  $("#q-submit").textContent = "Submitted";
  $("#q-next").classList.remove("hidden");
  $("#q-next").textContent = state.index < state.questions.length - 1 ? "Next question" : "See results";
  state.grading = false;
});

$("#q-next").addEventListener("click", () => {
  if (!state.answered) return;
  state.index++;
  saveToday(serializeToday());
  if (state.index < state.questions.length) renderQuestion();
  else finishQuiz();
});

$("#q-answer").addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
    e.preventDefault();
    $("#q-submit").click();
  }
});

function finishQuiz() {
  const total = state.answers.reduce((sum, a) => sum + (typeof a.score === "number" ? a.score : 0), 0);
  const maxScore = state.questions.length * 3;
  const pct = Math.round((total / maxScore) * 100);
  const duration = Date.now() - state.startTime;
  const gradingUnavailable = state.answers.filter(a => a.score === null).length;

  // Persist to history (replace if same date already there — shouldn't happen, but safe)
  const history = loadHistory().filter(h => h.date !== state.date);
  const dayRecord = {
    date: state.date,
    track: trackId,
    scores: state.answers.map(a => a.score),
    total,
    maxScore,
    pct,
    levels: state.answers.map(a => a.level),
    answers: state.answers,
    durationMs: duration,
    ts: Date.now(),
  };
  history.push(dayRecord);
  history.sort((a, b) => a.date.localeCompare(b.date));
  saveHistory(history);
  clearToday();

  track("daily_complete", {
    track: trackId,
    date: state.date,
    score: total,
    maxScore,
    pct,
    durationMs: duration,
    gradingUnavailable,
    answers: state.answers.map(a => ({
      questionId: a.questionId,
      concept: a.concept,
      level: a.level,
      score: a.score,
    })),
  });

  renderResults(dayRecord, history);
}

function renderResults(today, history) {
  showOnly("results-screen");
  $("#progress-fill") && ($("#progress-fill").style.width = "100%");

  const max = today.maxScore;
  $("#results-score").textContent = `${today.total}/${max}`;
  $("#results-label").textContent = `${TRACK_META.title} — ${today.pct}% today`;

  $("#results-list").innerHTML = today.answers.map(a => {
    const scoreColor = a.score !== null ? SCORE_COLORS[a.score] : "var(--dim)";
    const scoreText = a.score !== null ? SCORE_LABELS[a.score] : "Pending";
    return `
      <div class="result-item">
        <div class="result-score-badge" style="background:${scoreColor}">${a.score ?? "?"}</div>
        <div class="result-body">
          <div class="result-concept"><span class="result-level">${escHTML(a.level)}</span>${escHTML(a.concept)}</div>
          <div class="result-answer">${escHTML(a.answer || "")}</div>
          <div class="result-feedback">${scoreText}${a.feedback ? " — " + escHTML(a.feedback) : ""}</div>
        </div>
      </div>`;
  }).join("");

  renderProgression(history, max);

  const countdown = formatCountdown(msUntilNextUTCMidnight());
  $("#come-back").innerHTML = `Today's quiz is complete. <strong>Next quiz in ${escHTML(countdown)}</strong> (resets at UTC midnight).`;
}

function renderProgression(history, maxScore) {
  const svg = $("#progression-chart");
  const W = 600, H = 180;
  const pad = { top: 14, right: 12, bottom: 22, left: 28 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;

  // Build a 30-day window ending today.
  const days = 30;
  const today = todayUTC();
  const todayDate = new Date(today + "T00:00:00Z");
  const window = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(todayDate);
    d.setUTCDate(d.getUTCDate() - i);
    const iso = d.toISOString().slice(0, 10);
    const rec = history.find(h => h.date === iso);
    window.push({ date: iso, total: rec ? rec.total : null });
  }

  const xAt = i => pad.left + (i / (days - 1)) * innerW;
  const yAt = score => pad.top + innerH - (score / maxScore) * innerH;

  let parts = [];
  // Gridlines + y-axis labels at 0, max/2, max
  for (const v of [0, Math.round(maxScore / 2), maxScore]) {
    const y = yAt(v);
    parts.push(`<line class="gridline" x1="${pad.left}" x2="${W - pad.right}" y1="${y}" y2="${y}"/>`);
    parts.push(`<text class="axis-label" x="4" y="${y + 3}">${v}</text>`);
  }
  // X-axis (baseline)
  parts.push(`<line class="axis" x1="${pad.left}" x2="${W - pad.right}" y1="${yAt(0)}" y2="${yAt(0)}"/>`);
  // X labels: first, middle, last
  const labelIdx = [0, Math.floor((days - 1) / 2), days - 1];
  for (const i of labelIdx) {
    const d = window[i].date.slice(5); // MM-DD
    parts.push(`<text class="axis-label" x="${xAt(i)}" y="${H - 6}" text-anchor="middle">${d}</text>`);
  }

  // Polyline through non-null points, broken on nulls.
  let segments = [];
  let cur = [];
  window.forEach((pt, i) => {
    if (pt.total === null) {
      if (cur.length) { segments.push(cur); cur = []; }
    } else {
      cur.push([xAt(i), yAt(pt.total)]);
    }
  });
  if (cur.length) segments.push(cur);

  for (const seg of segments) {
    if (seg.length === 1) {
      parts.push(`<circle class="dot" cx="${seg[0][0]}" cy="${seg[0][1]}" r="3"/>`);
    } else {
      const pts = seg.map(([x, y]) => `${x},${y}`).join(" ");
      parts.push(`<polyline class="line" points="${pts}"/>`);
      for (const [x, y] of seg) {
        parts.push(`<circle class="dot" cx="${x}" cy="${y}" r="2.5"/>`);
      }
    }
  }

  svg.innerHTML = parts.join("");
  $("#chart-title").textContent = `Last 30 days — daily score (0–${maxScore})`;
}

// --- Bootstrap ---
function bootstrap() {
  const history = loadHistory();
  const today = todayUTC();
  const todaysRecord = history.find(h => h.date === today);

  if (todaysRecord) {
    // Already done today: results-only.
    state.date = today;
    renderResults(todaysRecord, history);
    return;
  }
  const inProgress = loadToday();
  if (inProgress) {
    state.date = today;
    resumeToday(inProgress);
    return;
  }
  showIntro();
}

bootstrap();

window._dailyDebug = {
  trackId, TRACK_META, LEVELS,
  state,
  pickForDate,
  loadHistory, loadToday,
  reset() { localStorage.removeItem(HISTORY_KEY); localStorage.removeItem(TODAY_KEY); location.reload(); },
};
