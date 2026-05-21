// Standalone C comprehension test. This intentionally does not modify the
// legacy /assessment pre/post mechanism.

const formA = await import("./assessment_pre.js");
const formB = await import("./assessment_post.js");

const TEST_VERSION = "form-b-plus-a5-a6-v1";
const ASSIGNMENT_KEY = "codeprobe_study_assignment";
const SESSION_KEY = "codeprobe_study_session";
const COMPLETE_KEY = "codeprobe_study_complete";
const EXTRA_FORM_A_IDS = new Set(["a-5", "a-6"]);

const questions = [
  ...formB.questions.map(q => ({ ...q, sourceForm: "B" })),
  ...formA.questions.filter(q => EXTRA_FORM_A_IDS.has(q.id)).map(q => ({ ...q, sourceForm: "A" })),
].map((q, index) => ({ ...q, fixedIndex: index }));

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

function track(type, data = {}) {
  const body = JSON.stringify({ type, ...data, ts: Date.now() });
  apiHeaders().then(h => fetch("/api/event", { method: "POST", headers: h, body })).catch(() => {});
}

function enableSavingForStudy() {
  const uid = getUID();
  localStorage.setItem("codeprobe_uid", uid);
  localStorage.setItem("codeprobe_privacy", "saving");
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

// --- Helpers ---
const $ = (s) => document.querySelector(s);
function escHTML(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
                  .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function showOnly(id) {
  for (const el of ["study-screen", "quiz-screen", "results-screen"]) {
    document.getElementById(el).classList.toggle("hidden", el !== id);
  }
}

function loadAssignment() {
  try {
    const a = JSON.parse(localStorage.getItem(ASSIGNMENT_KEY) || "null");
    if (a && a.assignedAt) return createAssignment(a.assignedAt);
  } catch {}
  return null;
}

function saveAssignment(assignment) {
  localStorage.setItem(ASSIGNMENT_KEY, JSON.stringify(assignment));
}

function createAssignment(assignedAt = Date.now()) {
  return {
    version: 2,
    studyId: getUID(),
    group: "test",
    assignedAt,
    availableAt: assignedAt,
    testVersion: TEST_VERSION,
    questionIds: questions.map(q => q.id),
  };
}

function assignmentMeta() {
  return {
    group: assignment.group,
    studyId: assignment.studyId,
    assignedAt: assignment.assignedAt,
    availableAt: assignment.availableAt,
    testVersion: assignment.testVersion || TEST_VERSION,
    questionIds: questions.map(q => q.id),
  };
}

function saveSession() {
  localStorage.setItem(SESSION_KEY, JSON.stringify({
    index: state.index,
    answers: state.answers,
    startTime: state.startTime,
  }));
}

function loadSession() {
  try {
    const s = JSON.parse(localStorage.getItem(SESSION_KEY));
    if (s && Array.isArray(s.answers) && typeof s.index === "number") return s;
  } catch {}
  return null;
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

function renderStudyBox(html) {
  showOnly("study-screen");
  $("#study-screen").innerHTML = `<div class="study-box">${html}</div>`;
}

function showConsent() {
  renderStudyBox(`
    <h2>C Comprehension Test</h2>
    <p>Answer ${questions.length} short C programming questions. There is no waiting period.</p>
    <p>Your responses are recorded anonymously for learning outcome analysis.</p>
    <label class="study-label">
      <input type="checkbox" id="consent-check">
      <span>I agree to have my responses recorded anonymously</span>
    </label>
    <button id="consent-start" class="btn-primary" disabled>Start test</button>`);

  const check = $("#consent-check");
  const start = $("#consent-start");
  check.addEventListener("change", () => { start.disabled = !check.checked; });
  start.addEventListener("click", () => {
    enableSavingForStudy();
    assignment = createAssignment();
    saveAssignment(assignment);
    track("study_assigned", assignmentMeta());
    initQuiz();
  });
}

function showAlreadyComplete() {
  let done = {};
  try { done = JSON.parse(localStorage.getItem(COMPLETE_KEY) || "{}"); } catch {}
  renderStudyBox(`
    <h2>Test complete</h2>
    <p>Thank you for completing the test.</p>
    ${typeof done.score === "number" ? `<p>Your final score was <strong>${done.score}/${done.max}</strong> (${done.pct}%).</p>` : ""}
    <p>You can close this page.</p>`);
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

// --- Quiz state ---
const SCORE_LABELS = ["Not yet", "Getting there", "Mostly there", "Solid"];
const SCORE_COLORS = ["var(--dim)", "var(--orange)", "var(--yellow)", "var(--green)"];

const state = {
  index: 0,
  answers: [],
  startTime: 0,
  grading: false,
  answered: false,
};

function initQuiz() {
  showOnly("quiz-screen");
  $("#study-title").textContent = "C Comprehension Test";

  const saved = loadSession();
  if (saved) {
    state.answers = saved.answers;
    state.index = saved.index;
    state.startTime = saved.startTime;
    if (state.answers.length > state.index) state.index = state.answers.length;
    if (state.index >= questions.length) {
      clearSession();
      finishQuiz();
      return;
    }
  } else {
    state.index = 0;
    state.answers = [];
    state.startTime = Date.now();
    track("study_test_start", assignmentMeta());
  }
  renderQuestion();
}

function renderQuestion() {
  const q = questions[state.index];

  state.answered = false;
  $("#q-submit").disabled = false;
  $("#q-submit").textContent = "Submit answer";
  $("#q-next").classList.add("hidden");
  $("#q-feedback").classList.add("hidden");
  $("#q-answer").value = "";
  $("#q-answer").disabled = false;
  $("#q-answer").focus();
  $("#q-hint").textContent = "Ctrl+Enter to submit. Feedback is shown only after the test is finished.";

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
  $("#q-submit").textContent = "Recording...";
  $("#q-answer").disabled = true;

  const q = questions[state.index];
  let result;
  try {
    result = await gradeAnswer(q.code, q.question, answer);
  } catch {
    result = { score: null, feedback: "Grading unavailable; your answer was recorded.", raw: null };
  }

  const answerRecord = {
    questionId: q.id,
    concept: q.concept,
    sourceForm: q.sourceForm,
    fixedIndex: q.fixedIndex,
    answer,
    score: result.score,
    feedback: result.feedback,
    raw: result.raw,
  };
  state.answers.push(answerRecord);

  track("study_answer", {
    ...assignmentMeta(),
    questionId: q.id,
    concept: q.concept,
    sourceForm: q.sourceForm,
    answer,
    score: result.score,
    feedback: result.feedback,
    questionIndex: state.index,
  });

  $("#q-feedback").textContent = "Answer recorded. Feedback will be shown after the final question.";
  $("#q-feedback").classList.remove("hidden");
  $("#q-submit").textContent = "Recorded";
  saveSession();
  $("#q-next").classList.remove("hidden");
  $("#q-next").textContent = state.index < questions.length - 1 ? "Next question" : "See results";
  state.grading = false;
});

$("#q-next").addEventListener("click", () => {
  if (!state.answered) return;
  state.index++;
  saveSession();
  if (state.index < questions.length) renderQuestion();
  else {
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
  const total = state.answers.reduce((sum, a) => sum + (typeof a.score === "number" ? a.score : 0), 0);
  const max = questions.length * 3;
  const pct = Math.round((total / max) * 100);
  const duration = Date.now() - state.startTime;
  const gradingUnavailable = state.answers.filter(a => a.score === null).length;

  const complete = {
    ...assignmentMeta(),
    score: total,
    max,
    pct,
    durationMs: duration,
    gradingUnavailable,
    answers: state.answers.map(a => ({
      questionId: a.questionId,
      concept: a.concept,
      sourceForm: a.sourceForm,
      score: a.score,
    })),
    ts: Date.now(),
  };

  track("study_complete", complete);
  localStorage.setItem(COMPLETE_KEY, JSON.stringify(complete));

  $("#progress-fill").style.width = "100%";
  showOnly("results-screen");
  $("#results-score").textContent = `${total}/${max}`;
  $("#results-label").textContent = `C comprehension test - ${pct}%${gradingUnavailable ? ` (${gradingUnavailable} answer${gradingUnavailable === 1 ? "" : "s"} pending/ungraded)` : ""}`;
  $("#results-list").innerHTML = state.answers.map(a => {
    const scoreColor = a.score !== null ? SCORE_COLORS[a.score] : "var(--dim)";
    const scoreText = a.score !== null ? SCORE_LABELS[a.score] : "Pending";
    return `
      <div class="result-item">
        <div class="result-score-badge" style="background:${scoreColor}">${a.score ?? "?"}</div>
        <div class="result-body">
          <div class="result-concept">${escHTML(a.concept)}</div>
          <div class="result-answer">${escHTML(a.answer)}</div>
          <div class="result-feedback">${scoreText}${a.feedback ? " - " + escHTML(a.feedback) : ""}</div>
        </div>
      </div>`;
  }).join("");
}

let assignment = loadAssignment();
$("#study-title").textContent = "C Comprehension Test";

if (localStorage.getItem(COMPLETE_KEY)) {
  showAlreadyComplete();
} else if (!assignment) {
  showConsent();
} else {
  enableSavingForStudy();
  saveAssignment(assignment);
  initQuiz();
}

window._studyDebug = {
  questions,
  state,
  get assignment() { return assignment; },
  initQuiz,
  finishQuiz,
};
