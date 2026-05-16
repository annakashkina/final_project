import { recommendLesson } from "./assessment_recommend.js";

// Load both question sets
const formA = await import("./assessment_pre.js");
const formB = await import("./assessment_post.js");

// --- Privacy / auth (mirrored from app.js for standalone use) ---
function getPrivacyMode() {
  const v = localStorage.getItem("codeprobe_privacy");
  if (v === "saving" || v === "paused") return v;
  return "ephemeral";
}

let _sessionUID = null;
function getUID() {
  const stored = localStorage.getItem("codeprobe_uid");
  if (stored) return stored;
  if (!_sessionUID) _sessionUID = crypto.randomUUID();
  return _sessionUID;
}

let _memToken = null;
function getToken() { return localStorage.getItem("codeprobe_token") || _memToken; }
function storeToken(tok) {
  if (localStorage.getItem("codeprobe_uid")) localStorage.setItem("codeprobe_token", tok);
  else _memToken = tok;
}

async function ensureToken() {
  let tok = getToken();
  if (tok) return tok;
  const resp = await fetch("/api/register", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-UID": getUID() },
  });
  if (!resp.ok) throw new Error("register failed");
  const data = await resp.json();
  storeToken(data.token);
  return data.token;
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

async function gradeAnswer(code, question, answer) {
  const h = await apiHeaders();
  const messages = [
    {
      role: "system",
      content: `You are grading a student's answer to a C programming comprehension question.

CODE:
\`\`\`c
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
    body: JSON.stringify({ messages }),
  });
  if (!resp.ok) return { score: null, feedback: "Grading unavailable — your answer was recorded.", raw: null };
  const data = await resp.json();
  const raw = data.reply || "";
  const scoreMatch = raw.match(/SCORE:\s*(\d)/);
  const feedbackMatch = raw.match(/FEEDBACK:\s*(.+)/);
  return {
    score: scoreMatch ? parseInt(scoreMatch[1]) : null,
    feedback: feedbackMatch ? feedbackMatch[1].trim() : raw.trim(),
    raw,
  };
}

// --- Helpers ---
const $ = (s) => document.querySelector(s);
function escHTML(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
                  .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function toast(msg) {
  const el = $("#toast");
  el.textContent = msg;
  el.classList.remove("hidden");
  setTimeout(() => el.classList.add("hidden"), 2200);
}

// --- Theme ---
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem("codeprobe_theme", theme);
  document.getElementById("hljs-light").disabled = theme === "dark";
  document.getElementById("hljs-dark").disabled = theme === "light";
  document.getElementById("theme-toggle").textContent = theme === "dark" ? "\u2600" : "\u263E";
}
$("#theme-toggle").addEventListener("click", () => {
  const cur = document.documentElement.dataset.theme || "light";
  applyTheme(cur === "dark" ? "light" : "dark");
});
applyTheme(localStorage.getItem("codeprobe_theme") || "light");

// --- Shuffle (seeded from UID for stable per-user order) ---
function seedFromUID(uid) {
  let h = 0;
  for (let i = 0; i < uid.length; i++) h = ((h << 5) - h + uid.charCodeAt(i)) | 0;
  return Math.abs(h);
}
function shuffle(arr, seed) {
  const a = [...arr];
  let s = seed;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// --- Counterbalancing ---
// Half of users get Form A first (pre), half get Form B first (pre).
// UID hash determines assignment. Stable per user.
function hashUID(uid, salt) {
  let h = salt;
  for (let i = 0; i < uid.length; i++) {
    h = ((h << 5) - h + uid.charCodeAt(i)) | 0;
    h = Math.imul(h, 2654435761);
  }
  return Math.abs(h);
}

function getAssignment() {
  const uid = getUID();
  const aFirst = hashUID(uid, 1) % 2 === 0;
  const treatment = hashUID(uid, 2) % 2 === 0;
  return {
    preForm: aFirst ? formA : formB,
    postForm: aFirst ? formB : formA,
    preLabel: aFirst ? "A" : "B",
    postLabel: aFirst ? "B" : "A",
    group: treatment ? "treatment" : "control",
  };
}

function getPhase() {
  if (localStorage.getItem("codeprobe_assessment_pre_complete")) return "post";
  return "pre";
}

const assignment = getAssignment();
const phase = getPhase();
const currentForm = phase === "pre" ? assignment.preForm : assignment.postForm;
const questions = currentForm.questions;
const formLabel = phase === "pre" ? assignment.preLabel : assignment.postLabel;

const SCORE_LABELS = ["No understanding", "Partial understanding", "Mostly correct", "Fully correct"];
const SCORE_COLORS = ["var(--red)", "var(--orange)", "var(--yellow)", "var(--green)"];

// --- State ---
const state = {
  index: 0,
  answers: [],
  startTime: 0,
  order: [],
  grading: false,
  answered: false,
};

function enableSavingForAssessment() {
  const uid = getUID();
  localStorage.setItem("codeprobe_uid", uid);
  localStorage.setItem("codeprobe_privacy", "saving");
}

// --- Consent / routing ---
const consentCheck = $("#consent-check");
const consentStart = $("#consent-start");
consentCheck.addEventListener("change", () => { consentStart.disabled = !consentCheck.checked; });
consentStart.addEventListener("click", () => {
  enableSavingForAssessment();
  initQuiz();
});

// Auto-resume if there's a saved session
if (loadSession()) {
  enableSavingForAssessment();
  initQuiz();
}

const completionKey = `codeprobe_assessment_${phase}_complete`;
const alreadyDone = localStorage.getItem(completionKey);
const MIN_GAP_MS = 46 * 60 * 60 * 1000; // 46 hours

// Check time lock for post-test
let timeLocked = false;
let hoursLeft = 0;
if (phase === "post" && !alreadyDone) {
  let preData = {};
  try { preData = JSON.parse(localStorage.getItem("codeprobe_assessment_pre_complete") || "{}"); } catch {}
  if (preData.ts && preData.score !== undefined) {
    const elapsed = Date.now() - preData.ts;
    if (elapsed < MIN_GAP_MS) {
      timeLocked = true;
      hoursLeft = Math.ceil((MIN_GAP_MS - elapsed) / (60 * 60 * 1000));
    }
  } else {
    // Corrupt or legacy data — reset to pre-test
    localStorage.removeItem("codeprobe_assessment_pre_complete");
    location.reload();
  }
}

if (alreadyDone) {
  let msg, heading;
  if (phase === "post") {
    heading = "Study complete";
    msg = "You have completed both the pre-test and post-test. Thank you for participating!";
  } else if (assignment.group === "treatment") {
    let preAnswers = [];
    try { preAnswers = JSON.parse(alreadyDone).answers || []; } catch {}
    const rec = recommendLesson(preAnswers);
    heading = "Pre-test complete \u2014 nice work!";
    msg = `You just showed what you know. Now let\u2019s build on it.<br><br>
      Based on your answers, a good starting point would be: <a href="/c-fundamentals#${rec.id}" style="color:var(--accent);font-weight:600">${rec.title}</a> \u2014 it takes about 8 minutes.<br><br>
      <span style="color:var(--dim)">You\u2019ll read real C code, answer questions about it, and get instant AI feedback. Research shows testing yourself produces 50% better recall than re-reading.</span><br><br>
      Pick a time in the next day or two to try it \u2014 right after lunch, between classes, before bed. If you enjoy it, try a few more lessons.<br><br>
      Then come back to <a href="/assessment" style="color:var(--accent)">/assessment</a> in a couple of days for part 2.`;
  } else {
    heading = "Pre-test complete";
    msg = "Spend the next <strong>2\u20133 days</strong> studying C programming concepts using whatever resources you prefer (Qwasar exercises, tutorials, documentation, etc.). Then come back here for the post-test!";
  }
  $("#consent-screen").innerHTML = `
    <div class="consent-box">
      <h2>${heading}</h2>
      <p>${msg}</p>
      <a href="/" class="btn-secondary">Back to codeprobe</a>
    </div>`;
} else if (timeLocked) {
  let timeLockedCTA = "";
  if (assignment.group === "treatment") {
    let preAnswers = [];
    try { preAnswers = JSON.parse(localStorage.getItem("codeprobe_assessment_pre_complete") || "{}").answers || []; } catch {}
    const rec = recommendLesson(preAnswers);
    const progress = JSON.parse(localStorage.getItem("codeprobe") || "{}");
    const didFinishRec = progress[rec.id] && progress[rec.id].completed > 0;
    if (didFinishRec) {
      timeLockedCTA = `<a href="/c-fundamentals" class="btn-primary" style="text-decoration:none;display:inline-block;margin-top:14px;padding:12px 24px">Continue learning C</a>`;
    } else {
      timeLockedCTA = `<a href="/c-fundamentals#${rec.id}" class="btn-primary" style="text-decoration:none;display:inline-block;margin-top:14px;padding:12px 24px">${rec.title} \u2192</a>`;
    }
  }
  $("#consent-screen").innerHTML = `
    <div class="consent-box">
      <h2>Post-test not yet available</h2>
      <p>The post-test opens <strong>46 hours</strong> after the pre-test to give you time to study.<br><br>
      Come back in about <strong>${hoursLeft} hour${hoursLeft === 1 ? "" : "s"}</strong>!</p>
      ${timeLockedCTA}
      <a href="/" class="btn-secondary" style="margin-top:10px">Back to codeprobe</a>
    </div>`;
} else {
  const phaseTitle = phase === "pre" ? "Pre-test" : "Post-test";
  const phaseDesc = phase === "pre"
    ? "This is the <strong>pre-test</strong> — 8 short questions about C programming before you start learning. An AI will give you instant feedback on each answer.<br><br>Your responses are recorded anonymously for a study on learning effectiveness. No personal data is collected beyond your anonymous session ID."
    : "Welcome back! This is the <strong>post-test</strong> — 8 questions to see how your understanding has grown. Same format as before.<br><br>Your responses are recorded anonymously, same as the pre-test.";
  $("#consent-heading").textContent = `Comprehension Test — ${phaseTitle}`;
  $("#consent-desc").innerHTML = phaseDesc;
}

// --- Session persistence ---
const sessionKey = `codeprobe_assessment_${phase}_session`;

function saveSession() {
  localStorage.setItem(sessionKey, JSON.stringify({
    index: state.index,
    answers: state.answers,
    startTime: state.startTime,
    order: state.order,
  }));
}

function loadSession() {
  try {
    const s = JSON.parse(localStorage.getItem(sessionKey));
    if (s && s.order && s.order.length === questions.length) return s;
  } catch {}
  return null;
}

function clearSession() {
  localStorage.removeItem(sessionKey);
}

// --- Quiz logic ---
function initQuiz() {
  $("#consent-screen").classList.add("hidden");
  $("#quiz-screen").classList.remove("hidden");
  const phaseTitle = phase === "pre" ? "Pre-test" : "Post-test";
  $("#assess-title").textContent = `C Comprehension — ${phaseTitle}`;

  const saved = loadSession();
  if (saved) {
    state.order = saved.order;
    state.answers = saved.answers;
    state.index = saved.index;
    state.startTime = saved.startTime;
  } else {
    const seed = seedFromUID(getUID());
    state.order = shuffle(questions.map((_, i) => i), seed + (phase === "post" ? 9999 : 0));
    state.startTime = Date.now();
    track("assessment_start", { assessment: phase, form: formLabel, group: assignment.group, counterbalance: assignment.preLabel + "/" + assignment.postLabel });
  }
  renderQuestion();
}

function renderQuestion() {
  const qi = state.order[state.index];
  const q = questions[qi];

  state.answered = false;
  $("#q-submit").disabled = false;
  $("#q-submit").textContent = "Submit answer";
  $("#q-next").classList.add("hidden");
  $("#q-feedback").classList.add("hidden");
  $("#q-answer").value = "";
  $("#q-answer").disabled = false;
  $("#q-answer").focus();

  $("#progress-text").textContent = `Question ${state.index + 1} of ${questions.length}`;
  $("#progress-fill").style.width = `${(state.index / questions.length) * 100}%`;

  const codeEl = $("#q-code-display");
  $("#q-filename").textContent = `question_${state.index + 1}.c`;
  codeEl.className = "language-c";
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

  const qi = state.order[state.index];
  const q = questions[qi];

  let result;
  try {
    result = await gradeAnswer(q.code, q.question, answer);
  } catch {
    result = { score: null, feedback: "Grading unavailable — your answer was recorded.", raw: null };
  }

  state.answers.push({
    questionId: q.id,
    concept: q.concept,
    answer,
    score: result.score,
    feedback: result.feedback,
    raw: result.raw,
  });

  track("assessment_answer", {
    assessment: phase,
    form: formLabel,
    group: assignment.group,
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
        <span class="fb-num">${result.score}/3</span>
        <span class="fb-label">${SCORE_LABELS[result.score]}</span>
      </div>
      <div class="fb-text">${escHTML(result.feedback)}</div>`;
  } else {
    fb.innerHTML = `<div class="fb-text">${escHTML(result.feedback)}</div>`;
  }

  $("#q-submit").textContent = "Submitted";
  saveSession();
  $("#q-next").classList.remove("hidden");
  $("#q-next").textContent = state.index < questions.length - 1 ? "Next question" : "See results";
  state.grading = false;
});

$("#q-next").addEventListener("click", () => {
  if (!state.answered) return;
  state.index++;
  saveSession();
  if (state.index < questions.length) {
    renderQuestion();
  } else {
    clearSession();
    finishQuiz();
  }
});

$("#q-answer").addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
    e.preventDefault();
    $("#q-submit").click();
  }
});

function finishQuiz() {
  const scored = state.answers.filter(a => a.score !== null);
  const total = scored.reduce((s, a) => s + a.score, 0);
  const max = scored.length * 3;
  const pct = max > 0 ? Math.round((total / max) * 100) : 0;
  const duration = Date.now() - state.startTime;

  track("assessment_complete", {
    assessment: phase,
    form: formLabel,
    group: assignment.group,
    counterbalance: assignment.preLabel + "/" + assignment.postLabel,
    score: total,
    maxScore: max,
    pct,
    durationMs: duration,
    answers: state.answers.map(a => ({ questionId: a.questionId, concept: a.concept, score: a.score })),
  });

  localStorage.setItem(completionKey, JSON.stringify({ score: total, max: max, pct, ts: Date.now(), answers: state.answers.map(a => ({ concept: a.concept, score: a.score })) }));

  $("#progress-fill").style.width = "100%";
  $("#quiz-screen").classList.add("hidden");
  $("#results-screen").classList.remove("hidden");

  const phaseTitle = phase === "pre" ? "Pre-test" : "Post-test";
  $("#results-score").textContent = `${total}/${max}`;
  $("#results-label").textContent = `${phaseTitle} — ${pct}% (preliminary, graded by AI)`;

  const list = $("#results-list");
  list.innerHTML = state.answers.map(a => {
    const scoreColor = a.score !== null ? SCORE_COLORS[a.score] : "var(--dim)";
    const scoreText = a.score !== null ? `${a.score}/3 — ${SCORE_LABELS[a.score]}` : "Pending";
    return `
      <div class="result-item">
        <div class="result-score-badge" style="background:${scoreColor}">${a.score ?? "?"}</div>
        <div class="result-body">
          <div class="result-concept">${escHTML(a.concept)}</div>
          <div class="result-answer">${escHTML(a.answer)}</div>
          <div class="result-feedback">${scoreText}${a.feedback ? " — " + escHTML(a.feedback) : ""}</div>
        </div>
      </div>`;
  }).join("");

  // Show next-step CTA prominently above results
  const nextStep = $("#results-next-step");
  if (phase === "pre" && assignment.group === "treatment") {
    const rec = recommendLesson(state.answers);
    nextStep.innerHTML = `
      <div style="text-align:center;background:var(--surface);border:2px solid var(--accent);border-radius:8px;padding:20px;margin-bottom:20px">
        <p style="font-size:15px;font-weight:600;margin-bottom:12px">Based on your answers, a good starting point:</p>
        <a href="/c-fundamentals#${rec.id}" target="_blank" class="btn-primary" style="text-decoration:none;display:inline-block;padding:14px 28px;font-size:15px;margin-bottom:14px">${rec.title} \u2192</a>
        <p style="font-size:14px;margin-bottom:6px">It takes about <strong>8 minutes</strong>. You\u2019ll read real C code and get instant AI feedback.</p>
        <p style="font-size:13px;color:var(--dim);margin-bottom:10px">Research shows testing yourself produces 50% better recall than re-reading.</p>
        <p style="font-size:14px;margin-bottom:6px">Pick a time to study in the next day or two \u2014 right after lunch, between classes, before bed.</p>
        <p style="font-size:14px;margin-bottom:14px">If you enjoy it, try a few more. Then come back for <a href="/assessment" target="_blank" style="color:var(--accent)">part 2</a> in a couple of days.</p>
        <p style="font-size:12px;color:var(--dim)">Or even explore the full <a href="/c-fundamentals" target="_blank" style="color:var(--accent)">C Programming track</a> (32 lessons)</p>
      </div>`;
  } else if (phase === "pre") {
    nextStep.innerHTML = `
      <div style="text-align:center;background:var(--surface);border:2px solid var(--accent);border-radius:8px;padding:20px;margin-bottom:20px">
        <p style="font-size:15px;font-weight:600;margin-bottom:12px">Next step: study C for 2\u20133 days</p>
        <p style="font-size:14px;margin-bottom:6px">Use whatever resources you prefer \u2014 Qwasar exercises, tutorials, documentation.</p>
        <p style="font-size:14px;color:var(--text);margin-bottom:14px"><strong>Then come back here for part 2</strong> \u2014 we need both tests to measure your progress!</p>
        <p style="font-size:13px;color:var(--dim)">Same link: <a href="/assessment" target="_blank" style="color:var(--accent)">/assessment</a> \u2014 bookmark it now so you don\u2019t forget.</p>
      </div>`;
  } else {
    nextStep.innerHTML = `
      <div style="text-align:center;background:var(--surface);border:2px solid var(--green);border-radius:8px;padding:20px;margin-bottom:20px">
        <p style="font-size:15px;font-weight:600;margin-bottom:8px">Study complete — thank you!</p>
        <p style="color:var(--dim);font-size:13px">Your results help us improve the platform.</p>
      </div>`;
  }

  $("#results-actions").innerHTML = `<a href="/" class="btn-secondary" style="text-decoration:none;display:inline-block">Back to codeprobe</a>`;
}

window._debug = { state, questions, finishQuiz, assignment, phase, $, enableSavingForAssessment };
