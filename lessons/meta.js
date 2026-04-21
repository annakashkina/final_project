export const overviewLessons = { name: "Overview", lessons: [
  {
    id: "meta-what",
    title: "What codeprobe Does",
    difficulty: "Overview",
    icon: "🏠",
    description:
      "A tool for understanding code you didn't write. Whether you're a senior picking up an unfamiliar service, switching teams, or revisiting code you wrote six months ago — read the real code, get quizzed by an AI tutor, and build genuine comprehension. Lessons are plain JS objects, easy to generate with AI code tools.",
    concepts: [
      "For anyone touching unfamiliar code — seniors, new hires, team switchers",
      "58% of a developer's day is reading code they didn't write (Xia et al. 2018)",
      "Scaffolded AI quizzes you instead of just explaining — builds real retention",
      "Lessons are plain JS objects — generate them from your codebase with AI code tools",
      "Self-hostable: one Python file, zero dependencies, any LLM, works air-gapped",
      "Secure by default: no accounts, zero npm, stdlib only, GDPR-compliant",
    ],
    bridges: {
      Python: "The entire backend is Python stdlib — you can audit every line without learning a framework.",
      JavaScript: "The frontend is vanilla JS with no build step — no supply-chain risk, no node_modules.",
      Java: "If you've used Spring Boot, this is the opposite — zero frameworks, zero dependencies, ~1700 lines total.",
    },
    files: [
      {
        name: "why_codeprobe.txt",
        code: `WHO IS THIS FOR
================
- Senior picking up a service they've never touched
- Engineer switching teams mid-quarter
- Anyone revisiting code they wrote 6 months ago
- New hire ramping on the codebase (without pulling seniors away)
- You, right now, learning how codeprobe itself works

58% of a developer's day is reading code they didn't write.
This tool turns that reading into active learning.

HOW IT WORKS
============
1. Point it at YOUR code (lessons are plain JS objects)
2. Read the real code in the left panel
3. AI tutor quizzes you — you learn by answering, not reading
4. Wrong? It corrects and asks a new question. Right? Next concept.
5. Dashboard shows who learned what (opt-in, private by default)

Generate lessons from your codebase with Claude Code, Cursor, etc.
This entire onboarding track was generated that way.

See the full pitch: /presentation.html (arrow keys to navigate)

THE RESEARCH BEHIND IT
======================
Plain AI chatbots → -17% on comprehension (Anthropic 2026)
Scaffolded AI     → +127% practice gains (Bastani, PNAS 2025)
Retrieval practice → g=0.50 effect size (Rowland 2014)

WHY TEAMS CAN TRUST IT
=======================
- Zero npm, zero supply chain. Python stdlib only.
- Self-hostable. Swap the LLM with 3 env vars. Can run on gemma4 on a laptop.
- GDPR-compliant: no accounts, opt-in tracking, 90-day auto-delete.`,
      },
      {
        name: "lessons/example.js",
        code: `// A lesson is just a JS object. You can write one by hand,
// or ask Claude Code / Cursor / Copilot to generate it from
// your source files. That's how this onboarding track was made.

export const myLessons = { name: "My Service", lessons: [
  {
    id: "auth-flow",
    title: "How Authentication Works",
    difficulty: "Core",
    concepts: [
      "OAuth2 PKCE flow with Google",
      "JWT validation in middleware",
      "Role-based access: admin vs member",
    ],
    bridges: {
      Python: "Like Flask-Login sessions, but stateless JWTs.",
      Go: "Like chi middleware — each handler checks claims.",
    },
    // Paste your actual code here:
    files: [
      { name: "auth/middleware.ts", code: "..." },
      { name: "auth/callback.ts",  code: "..." },
    ],
    seedQuestions: [
      "Where is the JWT verified?",
      "What happens if the token expires mid-request?",
    ],
  },
] };

// That's it. No build step. Drop the file in lessons/,
// import it in lessons.js, and it appears on the home screen.`,
      },
      {
        name: "file_map.txt",
        code: `prototype/                          ~1700 lines of code total
├── serve.py          # Python backend (stdlib only, no pip install)
├── app.js            # Frontend (vanilla JS, no build step)
├── lessons/          # One .js per series — the content layer
├── validator.py      # ML line-ref validator (sklearn, HMAC-signed)
├── deploy/           # One-command VPS setup (Caddy + systemd)
├── privacy.html      # GDPR privacy policy
├── dashboard.html    # Analytics (who learned what, where they struggled)
└── presentation.html # The pitch deck (open it! arrow keys to navigate)`,
      },
    ],
    seedQuestions: [
      "How would a senior use this when picking up an unfamiliar service?",
      "How would you generate lessons for your own codebase?",
      "Why does quizzing work better than just reading an explanation?",
      "What makes this safe to self-host on a corporate network?",
    ],
  },

  {
    id: "meta-stack",
    title: "Architecture & Tech Stack",
    difficulty: "Overview",
    icon: "🧱",
    description:
      "Zero frameworks, zero build steps, zero npm. The backend is Python stdlib (http.server), the frontend is vanilla JS loaded as an ES module, the LLM is any OpenAI-compatible API, and storage is append-only JSONL files. Hosted on a single VPS behind Caddy.",
    concepts: [
      "Backend: Python 3 http.server + ThreadingHTTPServer (~750 lines)",
      "Frontend: vanilla JS, ES modules, no bundler — just <script type=module>",
      "LLM: Groq API (any OpenAI-compatible provider), configured via env vars",
      "Storage: JSONL files in data/ — one per user, append-only",
      "Hosting: Cloudzy VPS (Amsterdam), Caddy reverse proxy, auto-HTTPS",
      "ML: sklearn classifier (2.5KB pickle), HMAC-signed for safe unpickling",
    ],
    bridges: {
      Python: "If you know Flask or Django, unlearn the abstractions — this uses raw http.server.SimpleHTTPRequestHandler.",
      JavaScript: "No React, no Vue, no build. $ = document.querySelector. State is one object. DOM updates are innerHTML.",
      Java: "Like writing a servlet from scratch with HttpServlet — but Python and ~10x fewer lines.",
    },
    files: [
      {
        name: "serve.py",
        code: `#!/usr/bin/env python3
import http.server, json, urllib.request, os, threading, time, hmac, secrets, re

# The entire backend in one file. No frameworks, no dependencies.
# stdlib http.server does routing, static files, and JSON APIs.

LLM_API_KEY = os.environ.get("LLM_API_KEY", "")
LLM_MODEL   = os.environ.get("LLM_MODEL", "openai/gpt-oss-120b")
LLM_API_URL = os.environ.get("LLM_API_URL",
    "https://api.groq.com/openai/v1/chat/completions")

class Handler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):   ...  # dashboard, GDPR export, static files
    def do_POST(self):  ...  # chat, events, register, delete, feedback

# Multi-threaded server (handles parallel browser connections)
server = http.server.ThreadingHTTPServer(("", 3000), Handler)
server.serve_forever()`,
      },
      {
        name: "app.js",
        code: `// The entire frontend in one file. No React, no Vue, no build step.
// Loaded as: <script type="module" src="app.js">

// Dynamic lesson loading — different HTML shells pick different series
const _src = document.querySelector('meta[name="codeprobe-lessons"]')?.content
           || "./lessons.js";
const { lessons, series } = await import(_src);

const $ = (s) => document.querySelector(s);

const state = {
  lesson: null,          // current lesson object
  phase: "explore",      // "explore" | "learn" | "challenge" | "done"
  messages: [],          // conversation history (sent to LLM each turn)
  mode: "quick",         // "quick" (~1 exchange) or "full" (~5-7)
  lang: "en",            // UI language (AI responds in this)
};

// Hash-based routing: #lesson-id in the URL
function navigate(lessonId) { ... }

// The core loop: build prompt → call LLM → quiz → repeat
async function startLearning() {
  state.messages = [{ role: "system", content: buildPrompt(lesson, questions) }];
  const reply = await chat(state.messages);  // POST /api/chat
}`,
      },
      {
        name: "data/example.jsonl",
        code: `// Storage: one JSONL file per user. Append-only. No database.
// Events (analytics):
{"type":"page_load","ts":1775074441949}
{"type":"lesson_open","lesson":"c-pointers","ts":1775074445123}
{"type":"start_learning","lesson":"c-pointers","mode":"quick","ts":1775074460000}

// Chats (separate file: {uid}_chat.jsonl):
{"ts":1775074465000,"model":"openai/gpt-oss-120b","messages":[...],"reply":"..."}

// No database. No schema. No migrations.
// Just append a JSON line. Read by scanning the file.
// Trade-off: no queries, no joins — but zero setup,
// zero dependencies, and trivially GDPR-deletable (rm the file).`,
      },
    ],
    seedQuestions: [
      "Why use Python stdlib instead of Flask or FastAPI?",
      "What's the trade-off of JSONL files vs a real database?",
      "How does the app work without a build step or bundler?",
      "Why self-host highlight.js instead of using a CDN?",
    ],
  },
]};

export const metaLessons = { name: "How codeprobe works", lessons: [
  {
    id: "meta-lessons",
    title: "How Lessons Are Defined",
    difficulty: "Project",
    icon: "📦",
    description:
      "Every lesson is a JavaScript object — code, concepts, and personalized hints. Series files in lessons/ are imported by lessons.js, which exposes a flat array (for lookup) and a nested array (for the home grid).",
    concepts: [
      "Lessons as data: id, code, concepts, bridges, seed questions",
      "Series group lessons by language or topic (C, Rust, Python, How codeprobe works, …)",
      "lessons.js imports every series and re-exports `series` + flat `lessons`",
      "Bridges: per-language explanations, filtered to languages the student knows",
      "Seed questions as conversation starters",
    ],
    bridges: {
      Python: "JS objects work like Python dicts — same {key: value} idea, different syntax.",
      Java: "Like a Java record or POJO — a structured container with named fields.",
      Ruby: "Like a Ruby hash — {key: value} pairs describing each lesson.",
    },
    files: [
      {
        name: "lessons/c.js",
        code: `// Each file in lessons/ exports a series: { name, lessons }.
// The name is shown as the section header on the home screen.

export const cLessons = { name: "C", lessons: [
  {
    id: "c-pointers",
    title: "Pointers & Addresses",
    difficulty: "Essential",

    concepts: [                  // what the AI focuses on
      "&x gives the memory address",
      "*p reads or writes through a pointer",
    ],

    bridges: {                   // matched to YOUR background
      Python: "Python hides pointers — everything is a reference.",
      JavaScript: "JS objects are references, but no raw addresses.",
    },

    // Single-file lesson uses "code":
    code: "...the C code shown in the left panel...",

    // Multi-file lessons use "files" instead:
    // files: [
    //   { name: "main.rs", code: "..." },
    //   { name: "lib.rs",  code: "..." },
    // ],

    seedQuestions: [              // clickable starter questions
      "What does &x give you?",
      "What happens if you dereference NULL?",
    ],
  },
] };`,
      },
      {
        name: "lessons.js",
        code: `// lessons.js stitches every series together.

import { cLessons }       from "./lessons/c.js";
import { rustLessons }    from "./lessons/rust.js";
import { metaLessons }    from "./lessons/meta.js";
import { mlLessons }      from "./lessons/ml.js";
// ...one import per series file

export const series = [cLessons, rustLessons, metaLessons, mlLessons /*, ... */];

// Flatten and stamp each lesson with its series name (used in the prompt).
export const lessons = series.flatMap(s => {
  for (const l of s.lessons) l.series = s.name;
  return s.lessons;
});`,
      },
      {
        name: "app.js",
        code: `// app.js loads the series module dynamically.
// The HTML page can override the source via a meta tag:
//   <meta name="codeprobe-lessons" content="./lessons_s01_arc01.js">
// That's how index.html, /default, /s01_arc01 share one app shell.

const _src = document.querySelector('meta[name="codeprobe-lessons"]')?.content
           || "./lessons.js";
const { lessons, series } = await import(_src);

// On card click: look up the lesson by id and route to it.
function openLesson(id) {
  const lesson = lessons.find(l => l.id === id);
  if (!lesson) { navigate(null); return; }
  state.lesson = lesson;
  renderCode();
  renderSeeds();
  setPhase("explore");
}`,
      },
    ],
    seedQuestions: [
      "Why are bridges filtered to only languages the student selected?",
      "What's the point of seed questions — why not just let people type?",
      "Why load the series module dynamically with import()?",
      "How would you add a new lesson series?",
    ],
  },

  {
    id: "meta-flow",
    title: "The Lesson Flow",
    difficulty: "Project",
    icon: "🔄",
    description:
      "Every lesson moves through four phases: read the code, learn from the AI tutor, face a challenge, then see what you've learned. One state object drives the whole experience.",
    concepts: [
      "Four phases: explore → learn → challenge → done",
      "One state object holds lesson, messages, phase, mode, lang",
      "[LESSON_COMPLETE] — the AI signals when the student is ready",
      "Quick mode (~1 exchange) skips the challenge phase; full mode (~5–7) runs it",
      "setPhase({ silent }) — silent mode for restoring a saved session without side effects",
    ],
    bridges: {
      Python: "Like a state machine — one variable tracks the phase, functions transition between them.",
      Java: "Like an enum-driven state pattern — each phase shows/hides its own UI panel.",
      Ruby: "Like a finite state machine — the phase string controls which view is active.",
    },
    files: [
      {
        name: "app.js",
        code: `// All lesson state lives in one object.

const state = {
  lesson: null,
  fileIdx: 0,
  phase: "explore",        // "explore" | "learn" | "challenge" | "done"
  messages: [],            // [{role: "system"|"user"|"assistant", content}]
  exchangeCount: 0,
  loading: false,
  mode: localStorage.getItem("codeprobe_mode") || "quick",
  lang: localStorage.getItem("codeprobe_lang") || "en",
};

// EXPLORE   — student reads code, writes questions
// LEARN     — AI teaches one concept, quizzes, student answers
// CHALLENGE — final synthesis question (full mode only)
// DONE      — summary, concepts learned, confetti

// { silent } prevents side effects during session restore:
// no tracking events, no "final challenge" label, no saveSession().
function setPhase(phase, { silent = false } = {}) {
  state.phase = phase;
  if (state.lesson && !silent) track("phase_change", { ... });

  if (phase === "explore")        show("#phase-explore");
  else if (phase === "learn"
        || phase === "challenge") {
    show("#phase-chat");
    if (phase === "challenge" && !silent) addMsg("challenge", "final challenge");
  }
  else if (phase === "done")      show("#phase-complete");

  if (!silent) saveSession();
}

// After each AI reply: if it ends with [LESSON_COMPLETE], the student passed.
// The prompt forbids the AI from emitting it right after a correction.
if (reply.trimEnd().endsWith("[LESSON_COMPLETE]")) {
  saveCompletion(state.lesson.id);
  setPhase("done");
  renderDone(summary);
}

// In full mode, after 4 exchanges, switch to the final challenge.
if (state.mode !== "quick" && state.exchangeCount >= 4)
  setPhase("challenge");`,
      },
    ],
    seedQuestions: [
      "Why does the AI decide when the lesson ends, not the student?",
      "What's the difference between the 'learn' and 'challenge' phases?",
      "Why does setPhase need a 'silent' option?",
      "How does quick mode skip the challenge phase entirely?",
    ],
  },

  {
    id: "meta-routing",
    title: "URL Routing & Navigation",
    difficulty: "Project",
    icon: "🔗",
    description:
      "Hash-based routing gives every lesson a shareable URL, and makes the browser's back/forward buttons work. The hash never hits the server, so any static file server can host the SPA.",
    concepts: [
      "Hash-based SPA routing: #lesson-id in the URL",
      "hashchange and popstate events for browser navigation",
      "navigate() as the single entry point for all in-app navigation",
      "Re-entry guard (_routing) prevents double-handling",
      "history.pushState for clean home URL (no trailing #)",
      "Server-side page routes (/default, /s01_arc01) pick a different lessons.js",
    ],
    bridges: {
      Python: "Like Flask's @app.route — but entirely client-side; the server only serves the shell HTML.",
      Java: "Like a servlet's URL mapping — the hash fragment is the route, handled in JavaScript.",
      Ruby: "Like Sinatra's get '/path' — but running in the browser.",
    },
    files: [
      {
        name: "app.js",
        code: `// Hash-based routing: / = home, #lesson-id = lesson view.
// The hash fragment is never sent to the server, so any static
// file server works — no rewrites, no API gateway.

function navigate(lessonId) {
  if (lessonId) {
    window.location.hash = lessonId;       // triggers hashchange
  } else {
    if (window.location.hash) {            // clean URL when going home
      history.pushState(null, "", window.location.pathname);
    }
    handleRoute();
  }
}

let _routing = false;                      // guard against re-entry
async function handleRoute() {
  if (_routing) return;
  _routing = true;
  try {
    const id = window.location.hash.slice(1);
    if (id) await openLesson(id);          // async — may load session, render
    else { state.lesson = null; renderHome(); showView("home"); }
  } finally { _routing = false; }
}

window.addEventListener("hashchange", handleRoute);
window.addEventListener("popstate",  handleRoute);

handleRoute();   // route on first load (supports /#c-pointers direct links)`,
      },
      {
        name: "serve.py",
        code: `# Server side: clean URL routes for the landing pages.
# Each route maps to a different shell HTML, which loads a
# different lessons.js via <meta name="codeprobe-lessons">.

PAGE_ROUTES = {
    "/default":   "index_default.html",
    "/s01_arc01": "index_s01_arc01.html",
}

# In do_GET:
elif self.path.split("?")[0] in PAGE_ROUTES:
    self._serve_page_route()    # serves only files in the allowlist`,
      },
    ],
    seedQuestions: [
      "Why use hash-based routing instead of regular URL paths?",
      "What would break if you removed the _routing guard?",
      "How do /default and /s01_arc01 share one app.js but show different lessons?",
      "How does someone share a link to a specific lesson?",
    ],
  },

  {
    id: "meta-session",
    title: "Session Persistence",
    difficulty: "Project",
    icon: "💾",
    description:
      "Accidentally close the tab mid-lesson? If 'save my progress' is on, your conversation survives. The app saves chat state to localStorage after every message and restores it when you return — with a 24-hour expiry. In ephemeral mode, nothing is saved.",
    concepts: [
      "Privacy-aware: only persists when getPrivacyMode() !== 'ephemeral'",
      "localStorage for session state (survives tab close)",
      "Save after every meaningful state change",
      "24-hour expiry to drop stale sessions",
      "Silent restore: setPhase({ silent: true }) avoids duplicate side effects",
      "clearSession() on lesson completion or back-button",
    ],
    bridges: {
      Python: "Like pickling state to a file — JSON.stringify serializes, JSON.parse deserializes.",
      Java: "Like SharedPreferences or Serializable — structured data persisted to browser storage.",
      Ruby: "Like Marshal.dump/load — save and restore a hash so state survives restarts.",
    },
    files: [
      {
        name: "app.js — save & load",
        code: `function saveSession() {
  if (getPrivacyMode() === "ephemeral") return;
  if (!state.lesson) return;
  if (state.phase === "explore" || state.phase === "done") return;

  localStorage.setItem("codeprobe_session", JSON.stringify({
    lessonId:      state.lesson.id,
    phase:         state.phase,
    messages:      state.messages,
    exchangeCount: state.exchangeCount,
    fileIdx:       state.fileIdx,
    chatHTML:      $("#chat-messages")?.innerHTML || "",
    savedAt:       Date.now(),
  }));
}

function loadSession() {
  if (getPrivacyMode() === "ephemeral") return null;
  try {
    const s = JSON.parse(localStorage.getItem("codeprobe_session"));
    if (!s || Date.now() - s.savedAt > 86400000) {
      localStorage.removeItem("codeprobe_session");
      return null;
    }
    return s;
  } catch { return null; }
}

function clearSession() {
  localStorage.removeItem("codeprobe_session");
}`,
      },
      {
        name: "app.js — restore in openLesson()",
        code: `// Check for a saved session before setting up a fresh explore phase.

const session = loadSession();

if (session && session.lessonId === id
    && session.phase !== "explore"
    && session.phase !== "done") {
  state.messages      = session.messages;
  state.exchangeCount = session.exchangeCount;
  state.fileIdx       = session.fileIdx;
  renderCode();
  setPhase(session.phase, { silent: true });
  $("#chat-messages").innerHTML = session.chatHTML;
} else {
  state.messages      = [];
  state.exchangeCount = 0;
  state.fileIdx       = 0;
  renderCode();
  renderSeeds();
  setPhase("explore");
}`,
      },
    ],
    seedQuestions: [
      "Why save to localStorage instead of sessionStorage?",
      "Why expire sessions after 24 hours?",
      "What would go wrong if setPhase didn't have a silent option during restore?",
      "Why save the rendered chatHTML alongside the messages array?",
    ],
  },

  {
    id: "meta-prompt",
    title: "Building the Tutor Prompt",
    difficulty: "Project",
    icon: "🧩",
    description:
      "This is what makes the AI a tutor instead of a chatbot. buildPrompt() takes the lesson, what the student already knows, their mode (quick/full), and their UI language, and writes the system instruction that controls how the AI teaches.",
    concepts: [
      "System prompt as scaffolding for AI behavior",
      "Bridges filtered to languages the student picked (fallback: send all if none match)",
      "Quick mode (~1–2 exchanges) vs full mode (~5–7) changes the after-answer rules",
      "Tell the AI what the student does NOT know, so it doesn't assume",
      "Language selector: AI replies in the student's chosen language",
    ],
    bridges: {
      Python: "Template literals (backtick strings with ${}) work like Python f-strings.",
      Java: "Like String.format() but inline — JS template literals embed expressions with ${}.",
      Ruby: "Like Ruby string interpolation #{} — same idea, JS uses ${}.",
    },
    files: [
      {
        name: "app.js",
        code: `// Without this, you're talking to an LLM. With it,
// the AI teaches from YOUR background and quizzes YOU.

function buildPrompt(lesson, questions) {
  const known    = getKnownLangs();      // e.g. ["Python", "JavaScript"]
  const concepts = getKnownConcepts();   // e.g. ["OOP", "Concurrency"]

  // Bridges: prefer the languages the student knows.
  // If none of the lesson's bridges match, fall back to all of them.
  let bridges = "";
  if (known.length > 0) {
    let entries = Object.entries(lesson.bridges).filter(([l]) => known.includes(l));
    if (entries.length === 0) entries = Object.entries(lesson.bridges);
    bridges = entries.map(([l, n]) => \`- \${l}: \${n}\`).join("\\n");
  }

  // Multi-file lessons: concatenate every file with a marker.
  const code = lesson.files
    ? lesson.files.map(f => \`--- \${f.name} ---\\n\${f.code}\`).join("\\n\\n")
    : lesson.code;

  // Tell the AI what to assume — and what NOT to.
  const parts = [];
  if (known.length    > 0) parts.push(\`has worked with \${known.join(", ")}\`);
  if (concepts.length > 0) parts.push(\`has experience with \${concepts.join(", ")}\`);
  const studentDesc = parts.length === 0
    ? "a student who is likely a beginner"
    : \`a programmer who \${parts.join(" and ")}\`;

  // Spell out what they HAVEN'T checked, so the AI explains from scratch.
  let levelNote = "";
  if (known.length === 0 && concepts.length === 0) {
    levelNote = "\\nNote: ask before referencing other languages or concepts.";
  } else {
    const missing = [];
    if (!concepts.includes("Memory management")) missing.push("memory management");
    if (!concepts.includes("Concurrency"))       missing.push("concurrency");
    if (!concepts.includes("OOP"))               missing.push("OOP");
    if (missing.length) levelNote =
      \`\\nThe student has NOT indicated knowledge of: \${missing.join(", ")}. \` +
      "Do NOT assume they understand these — explain from scratch.";
  }

  // Quick vs full: same teaching style, different stop rules.
  // Both forbid emitting [LESSON_COMPLETE] right after a correction.

  // Language: if not English, instruct the AI to respond in it
  // (code snippets and untranslatable terms stay in English).

  return \`You are a tutor teaching \${studentDesc}. ...\`;
}`,
      },
    ],
    seedQuestions: [
      "What would happen if you sent just the question to the AI without this prompt?",
      "Why fall back to ALL bridges if none match the student's languages?",
      "How does quick vs full mode change the AI's behavior?",
      "Why tell the AI what the student does NOT know?",
    ],
  },

  {
    id: "meta-chat",
    title: "Browser Sends, Server Replies",
    difficulty: "Project",
    icon: "💬",
    description:
      "When you click 'start learning', the browser sends the full conversation to a Python server, which forwards it to the LLM and returns the reply. Headers carry your UID, your TOFU token, and your privacy mode.",
    concepts: [
      "Conversations as arrays of {role, content} messages — server is stateless",
      "fetch() with X-UID, X-Token, X-Mode headers on every API call",
      "X-Mode: server only logs when the student opted in",
      "Client retries up to 3 times on 5xx; aborts on 4xx",
      "Server post-processes the reply with the line-ref validator before returning",
      "API key never leaves the server",
    ],
    bridges: {
      Python: "fetch() is like requests.post() — the browser's built-in HTTP client.",
      Java: "Like HttpClient.send() — fetch returns a Promise (similar to CompletableFuture).",
      Ruby: "Like Net::HTTP.post — sends JSON, gets JSON back.",
    },
    files: [
      {
        name: "app.js",
        code: `// A conversation is an array of messages.
// Each call sends the WHOLE array — the server has no memory.

state.messages = [{ role: "system", content: buildPrompt(lesson, questions) }];

const reply = await chat(state.messages);
state.messages.push({ role: "assistant", content: reply });
saveSession();

// Student replies → push, send full history again
state.messages.push({ role: "user", content: answer });
saveSession();
const reply2 = await chat(state.messages);

// Headers attached to every API call.
async function apiHeaders() {
  const token = await ensureToken();          // TOFU — see "User IDs & Tokens"
  return {
    "Content-Type": "application/json",
    "X-UID":   getUID(),
    "X-Token": token,
    "X-Mode":  isSaving() ? "saving" : "private",
  };
}

// Up to 3 attempts, exponential-ish backoff. 4xx → don't retry.
async function chat(messages) {
  const h = await apiHeaders();
  const body = JSON.stringify({ messages });
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch("/api/chat", { method: "POST", headers: h, body });
      if (r.ok) return (await r.json()).reply;
      lastErr = (await r.json().catch(() => ({}))).error || \`Error \${r.status}\`;
      if (r.status < 500) break;              // client error — don't retry
    } catch (e) { lastErr = e.message; }
    await new Promise(ok => setTimeout(ok, 1000 * (attempt + 1)));
  }
  throw new Error(lastErr);
}`,
      },
      {
        name: "serve.py",
        code: `# POST /api/chat — receives the conversation, forwards to the LLM.
# Pre-conditions: request passed bot/size/token gates (see "Server").

saving = self.headers.get("X-Mode", "") == "saving"

# Validate before paying for tokens (see "Input Validation").
msg_err = validate_messages(body["messages"])
if msg_err:
    return self._json_response(400, {"error": msg_err})

payload = json.dumps({
    "model":       LLM_MODEL,
    "messages":    body["messages"],     # full conversation
    "temperature": 0.7,
    "max_tokens":  1500,
}).encode()

req = urllib.request.Request(LLM_API_URL, data=payload, headers=LLM_HEADERS)

with urllib.request.urlopen(req, timeout=10) as resp:
    reply = json.loads(resp.read())["choices"][0]["message"]["content"]

# Post-process: ML line-ref validator fixes wrong line numbers in-place.
# See the "How the line validator works" series for the full story.
if VALIDATOR_ENABLED:
    code = extract_code_from_messages(body["messages"])
    if code: reply = fix_line_refs(reply, code)

# Only log when X-Mode is "saving" — privacy enforced server-side.
if saving:
    with open(f"data/{uid}_chat.jsonl", "a") as f:
        f.write(json.dumps({
            "ts":       int(time.time() * 1000),
            "model":    LLM_MODEL,
            "messages": used_messages,
            "reply":    reply,
        }) + "\\n")

self._json_response(200, {"reply": reply})`,
      },
    ],
    seedQuestions: [
      "Why send the WHOLE message array each time, not just the latest?",
      "Why does the browser talk to our server instead of calling the LLM directly?",
      "What does the X-Mode header let the server enforce that the client can't?",
      "Why retry on 5xx but not on 4xx?",
    ],
  },

  {
    id: "meta-server",
    title: "How the Server Works",
    difficulty: "Project",
    icon: "🖥️",
    description:
      "One Python file (serve.py, ~750 lines) routes requests, gates writes through a security pipeline, serves static files through an allow-list, and talks to the LLM. No frameworks, no dependencies — just stdlib http.server.",
    concepts: [
      "Extending SimpleHTTPRequestHandler with do_GET / do_POST",
      "POST pipeline: bot UA → size limit → /api/register branch → token gate → route",
      "Static file fallthrough is allow-listed by extension and denied by prefix",
      "X-Forwarded-For is trusted only when the peer is in TRUSTED_PROXIES (Caddy on localhost)",
      "Dashboard auth = secret in URL, compared with hmac.compare_digest",
      "ThreadingHTTPServer + listen(64) handle many parallel browser sockets",
      "Background timer reaps inactive accounts every 24h (90-day retention)",
    ],
    bridges: {
      JavaScript: "Like Express routes (app.get / app.post) but built into Python's standard library.",
      Java: "Like a HttpServlet with doGet/doPost — same pattern, Python syntax.",
      Ruby: "Like a Sinatra app — route matching in methods, lightweight, no big framework.",
    },
    files: [
      {
        name: "serve.py",
        code: `import http.server, json

class Handler(http.server.SimpleHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    # ---- GET: pages + dashboard + read APIs + static fallthrough ----
    def do_GET(self):
        if self.path.startswith("/dashboard/"):
            if not self._dashboard_ok(): return self._json_response(403, {...})
            # serve dashboard.html

        elif self.path.startswith("/api/users"):     # dashboard-only
            if not self._dashboard_ok(): return self._json_response(403, {...})
            # list users with event counts

        elif self.path.startswith("/api/timeline"): # dashboard-only
            if not valid_uid(params["uid"]):  return self._json_response(400, {...})
            # return per-user event timeline

        elif self.path.startswith("/api/export"):    # GDPR — token required
            if not verify_token(uid, token):  return self._json_response(403, {...})
            # bundle events + chats into one JSON

        elif self.path == "/privacy":                # static privacy policy
            ...
        elif self.path.split("?")[0] in PAGE_ROUTES: # /default, /s01_arc01
            self._serve_page_route()
        else:
            rel = self.path.split("?", 1)[0].lstrip("/")
            if not _is_static_safe(rel):             # allow-list gate
                return self.send_error(404)
            super().do_GET()                         # serves index.html, app.js…

    # ---- POST: security pipeline → route ----
    def do_POST(self):
        if is_bot(self.headers.get("User-Agent", "")):
            return self._json_response(403, {"error": "forbidden"})

        length = int(self.headers.get("Content-Length", 0))
        if length > MAX_BODY:                        # 256 KB cap
            return self._json_response(413, {"error": "request too large"})

        uid   = self.headers.get("X-UID", "")
        token = self.headers.get("X-Token", "")

        # /api/register is unauth'd: trust-on-first-use mints a token.
        if self.path == "/api/register":
            return self._handle_register(uid, length)

        # Every other /api/* requires a valid (UID, token) pair.
        if self.path.startswith("/api/"):
            if not verify_token(uid, token):
                return self._json_response(403, {"error": "invalid token"})

        if   self.path == "/api/chat":     self._handle_chat(uid, length)
        elif self.path == "/api/event":    self._handle_event(uid, length)
        elif self.path == "/api/delete":   self._handle_delete(uid, length)
        elif self.path == "/api/feedback": self._handle_feedback(length)
        else: self.send_error(404)

# Multi-threaded: handles many users at once.
server = http.server.ThreadingHTTPServer(("", port), Handler)
server.request_queue_size = 64        # default 5 — too low for browsers
server.socket.listen(64)              # parallel sockets for lessons.js, css…
schedule_cleanup()                    # 90-day retention reaper, runs every 24h
server.serve_forever()`,
      },
      {
        name: "static-allow-list.py",
        code: `# Defense-in-depth: the static fallthrough rejects anything
# that isn't an obvious public asset. Caddy adds a second layer
# of denies in production (see "Hosting & Hardening").

STATIC_ALLOWED_EXT = {".html", ".css", ".js", ".mjs", ".map",
                      ".png", ".jpg", ".svg", ".ico", ".webp",
                      ".woff", ".woff2", ".ttf", ".otf", ".json"}
STATIC_DENIED_PREFIXES = ("data/", "deploy/", "__pycache__/", ".")
STATIC_DENIED_SUFFIXES = (".env", ".pkl", ".py", ".jsonl", ".sh", ".sig")
STATIC_DENIED_FILES    = {"_users.json", ".env", ".env.example"}

def _is_static_safe(rel):
    if not rel: return True                      # index
    if "\\x00" in rel or "\\\\" in rel: return False
    if rel.startswith("/") or ".." in rel.split("/"): return False
    lower = rel.lower()
    if any(lower.startswith(p) for p in STATIC_DENIED_PREFIXES): return False
    base = lower.rsplit("/", 1)[-1]
    if base in STATIC_DENIED_FILES or base.startswith("."): return False
    if any(lower.endswith(s) for s in STATIC_DENIED_SUFFIXES): return False
    ext = os.path.splitext(base)[1]
    return not ext or ext in STATIC_ALLOWED_EXT`,
      },
    ],
    seedQuestions: [
      "Why check the body size BEFORE parsing JSON?",
      "Why is /api/register the only POST that bypasses token verification?",
      "What attack does the static allow-list block that the path-traversal check doesn't?",
      "Why does the dashboard secret check use hmac.compare_digest?",
    ],
  },

  {
    id: "meta-auth",
    title: "User IDs & Tokens (Trust-On-First-Use)",
    difficulty: "Project",
    icon: "🔑",
    description:
      "There are no accounts, no passwords, no email. Each browser invents a UUID, calls /api/register, and the server mints a random token bound to that UUID. After that, every write request must present the matching token. It's GDPR-friendly anonymity with replay protection.",
    concepts: [
      "Client-generated UUID via crypto.randomUUID()",
      "Trust-on-first-use: server only mints once per UID (returns 409 after that)",
      "Token = secrets.token_urlsafe(32), stored in _users.json",
      "verify_token uses hmac.compare_digest (constant-time, no timing leak)",
      "Ephemeral mode: UID + token live in memory only, lost on page reload",
      "Saving mode: UID + token persisted to localStorage, survive across sessions",
      "Destructive endpoints (/api/delete, /api/export) require the same token gate",
    ],
    bridges: {
      Python: "Like a self-issued bearer token — no OAuth dance, just one round-trip on first use.",
      JavaScript: "Like generating a random cookie client-side, then proving you own it via constant-time compare.",
      Java: "Like a UUID + opaque token pattern — no JWT, no signing, just a key/value lookup.",
    },
    files: [
      {
        name: "app.js",
        code: `// The browser invents its own UUID. Ephemeral by default —
// in memory only, gone on page reload. Promoted to localStorage
// when the user toggles "save my progress".

let _sessionUID = null;
function getUID() {
  const stored = localStorage.getItem("codeprobe_uid");
  if (stored) return stored;
  if (!_sessionUID) _sessionUID = crypto.randomUUID();
  return _sessionUID;
}

// First API call hits ensureToken(): if we don't have one,
// register the UID with the server and stash the minted token.
let _memToken = null;
function getToken() { return localStorage.getItem("codeprobe_token") || _memToken; }

async function ensureToken() {
  let tok = getToken();
  if (tok) return tok;
  const r = await fetch("/api/register", {
    method:  "POST",
    headers: { "Content-Type": "application/json", "X-UID": getUID() },
  });
  if (!r.ok) throw new Error("register failed: " + r.status);
  const { token } = await r.json();
  if (localStorage.getItem("codeprobe_uid"))           // persistent user?
    localStorage.setItem("codeprobe_token", token);
  else _memToken = token;                              // ephemeral
  return token;
}`,
      },
      {
        name: "serve.py",
        code: `import hmac, secrets

_UUID_RE  = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
_TOKEN_RE = re.compile(r'^[A-Za-z0-9_-]{32,64}$')

def valid_uid(uid):    return bool(_UUID_RE.match(uid))
def valid_token(tok):  return bool(tok) and bool(_TOKEN_RE.match(tok))

def register_uid(uid):
    """Trust-on-first-use. Mint a token only if this UID has none yet —
    otherwise an attacker could overwrite an existing user's token."""
    if not valid_uid(uid): return None
    with _lock:
        users = load_users()
        if uid in users and "token" in users[uid]:
            return None                      # already claimed → 409
        meta = users.get(uid, {"first_seen": int(time.time() * 1000)})
        meta["token"] = secrets.token_urlsafe(32)
        users[uid] = meta
        save_users(users)                    # _users.json
        return meta["token"]

def verify_token(uid, presented):
    """Constant-time compare. Returns True only if the UID has a stored
    token AND it matches what the client sent. No token = no access."""
    if not valid_uid(uid) or not valid_token(presented): return False
    with _lock:
        stored = (load_users().get(uid) or {}).get("token")
    if not stored: return False
    return hmac.compare_digest(stored, presented)

# Pipeline:
#   POST /api/register  → no token required (TOFU mints one, rate-limited)
#   POST /api/*         → verify_token(uid, token) or 403`,
      },
    ],
    seedQuestions: [
      "Why does /api/register return 409 (Conflict) if the UID is already registered?",
      "What does hmac.compare_digest protect against that == doesn't?",
      "Why is it safe to let the client choose its own UUID?",
      "What happens to your token when you toggle 'save my progress' off and back on?",
    ],
  },

  {
    id: "meta-security",
    title: "Input Validation & Rate Limiting",
    difficulty: "Project",
    icon: "🛡️",
    description:
      "Every API endpoint is a door. If you don't check who's knocking and what they're carrying, bad things happen. Rate limits are split into four buckets so an event spammer can't lock you out of chat.",
    concepts: [
      "Path traversal: UIDs are matched against a strict UUID regex before file I/O",
      "Body size cap (256 KB) prevents memory exhaustion before JSON parsing",
      "Message validation: role whitelist, count cap (20), total chars cap (60 KB)",
      "Four rate-limit buckets per IP (chat, event, register, mutate)",
      "Counters live in memory only — never persisted (privacy-safe)",
      "X-Forwarded-For is trusted only when the direct peer is in TRUSTED_PROXIES",
    ],
    bridges: {
      Python: "re.compile for regex, threading.Lock for shared state — all stdlib, no deps.",
      JavaScript: "Same defense principles as Express middleware — validate early, reject fast.",
      Java: "Like a servlet filter chain — each check is a gate that can short-circuit.",
    },
    files: [
      {
        name: "serve.py",
        code: `import re, time, threading

# UUID regex — without this, X-UID: "../../etc/passwd" lets an attacker
# write files outside the data/ directory.
_UUID_RE = re.compile(
    r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
)
MAX_BODY = 256 * 1024                # 256 KB

# Four buckets so chat throttling doesn't lock out analytics events,
# and analytics floods can't lock out chat.
RATE_LIMITS = {
    "chat":     (60,  3600),         # LLM spend — strictest
    "event":    (600, 3600),         # analytics — most lenient
    "register": (20,  3600),         # token mint — bot defence
    "mutate":   (30,  3600),         # delete / export / feedback
}

# Per (bucket, ip): list of timestamps. Lost on restart by design.
_lock = threading.Lock()
_rate_hits = {}

def check_rate(bucket, ip):
    limit, window = RATE_LIMITS[bucket]
    with _lock:
        now = time.time()
        hits = [t for t in _rate_hits.get((bucket, ip), []) if now - t < window]
        if len(hits) >= limit:
            _rate_hits[(bucket, ip)] = hits
            return False
        hits.append(now)
        _rate_hits[(bucket, ip)] = hits
        return True

# X-Forwarded-For spoofing: only trust it if Caddy is the direct peer.
TRUSTED_PROXIES = {"127.0.0.1", "::1"}

def get_real_ip(handler):
    peer = handler.client_address[0]
    if peer in TRUSTED_PROXIES:
        first = handler.headers.get("X-Forwarded-For", "").split(",")[0].strip()
        if re.match(r"^[0-9a-fA-F:.]{2,45}$", first):
            return first
    return peer                       # never trust XFF from a random peer`,
      },
      {
        name: "validate_messages.py",
        code: `# Runs before forwarding to the LLM. Without this, an attacker can:
#   - send 100 messages → blow your token budget
#   - inject extra "system" messages → override your prompt
#   - send 1 MB of text → cost a fortune

def validate_messages(messages):
    if not isinstance(messages, list) or len(messages) == 0:
        return "messages must be a non-empty array"
    if len(messages) > 20:
        return "too many messages"

    allowed   = {"system", "user", "assistant"}
    sys_count = 0
    chars     = 0

    for i, m in enumerate(messages):
        if not isinstance(m, dict) or "role" not in m or "content" not in m:
            return "invalid message format"
        if m["role"] not in allowed:
            return f"invalid role: {m['role']}"
        if m["role"] == "system":
            sys_count += 1
            if i != 0: return "system message must be first"
        chars += len(m.get("content", ""))

    if sys_count > 1:    return "only one system message allowed"
    if chars > 60_000:   return "messages too large"
    return None`,
      },
    ],
    seedQuestions: [
      "Why split rate limiting into four buckets instead of one?",
      "What attack does TRUSTED_PROXIES protect against?",
      "Why is keeping rate-limit counters in memory privacy-safe?",
      "How would an attacker exploit a missing 'system message must be first' check?",
    ],
  },

  {
    id: "meta-llm",
    title: "Calling the AI (Any LLM Provider)",
    difficulty: "Project",
    icon: "🤖",
    description:
      "The server forwards your conversation to an OpenAI-compatible LLM API and returns the reply. Defaults to Groq + an open-weight model, but works with xAI, Ollama, vLLM, or any compatible provider — just change three env vars.",
    concepts: [
      "OpenAI-compatible API: same JSON shape across most providers",
      "Three env vars (LLM_API_URL, LLM_API_KEY, LLM_MODEL) pick the provider",
      "Authorization header is added only if a key is set — self-hosted models skip it",
      "Server retries ONCE on upstream errors or replies shorter than 40 words",
      "Failed/short replies are logged when the user opted in (saving mode)",
      "Reply post-processing: line-ref validator runs before the response leaves the server",
    ],
    bridges: {
      Python: "urllib is Python's built-in HTTP client — like requests but no install needed.",
      JavaScript: "Same idea as fetch() — build a request, send JSON, parse JSON back.",
      Java: "Like HttpClient with Jackson — build, send, deserialize the JSON response.",
    },
    files: [
      {
        name: "serve.py",
        code: `import urllib.request, json, os, time

# Provider-agnostic: switch by changing three env vars.
LLM_API_KEY = os.environ.get("LLM_API_KEY") or os.environ.get("GROQ_API_KEY", "")
LLM_MODEL   = os.environ.get("LLM_MODEL")   or os.environ.get("GROQ_MODEL",
                                              "openai/gpt-oss-120b")
LLM_API_URL = os.environ.get("LLM_API_URL") or os.environ.get("GROQ_URL",
                              "https://api.groq.com/openai/v1/chat/completions")

# Auth header only when a key is present — Ollama/vLLM need none.
LLM_HEADERS = {"Content-Type": "application/json", "User-Agent": "CodeProbe/1.0"}
if LLM_API_KEY:
    LLM_HEADERS["Authorization"] = f"Bearer {LLM_API_KEY}"

def call_llm(messages):
    payload = json.dumps({
        "model":       LLM_MODEL,
        "messages":    messages,
        "temperature": 0.7,
        "max_tokens":  1500,
    }).encode()
    req = urllib.request.Request(LLM_API_URL, data=payload, headers=LLM_HEADERS)
    with urllib.request.urlopen(req, timeout=10) as resp:
        return json.loads(resp.read())["choices"][0]["message"]["content"]

# In /api/chat: try once, then retry once on error or too-short reply.
reply = call_llm(messages)
if reply is None or len(reply.split()) < 40:    # ~50 tokens — likely glitch
    if saving:
        log_failed_record(uid, messages, reply)  # for debugging
    time.sleep(1)
    messages[-1]["content"] += " "               # break upstream cache
    reply = call_llm(messages)`,
      },
    ],
    seedQuestions: [
      "Why do most LLM providers use the OpenAI-compatible API format?",
      "What changes if you swap LLM_API_URL to point at a local Ollama instance?",
      "Why retry when the reply is too short instead of just returning it?",
      "Why add a trailing space to the last message before retrying?",
    ],
  },

  {
    id: "meta-privacy",
    title: "Three-State Privacy Model",
    difficulty: "Project",
    icon: "🔒",
    description:
      "By default, nothing is stored — anywhere. The three-state privacy model (ephemeral / saving / paused) gates every piece of data flow: progress tracking, event logging, session persistence, and server-side storage all check getPrivacyMode() before doing anything.",
    concepts: [
      "Ephemeral (default): in-memory UID, no localStorage, no server logging",
      "Saving: persistent UID, completions + events stored locally and on server",
      "Paused: existing data kept, no new recording (revoke consent without losing history)",
      "Every data function gates on getPrivacyMode() — one source of truth",
    ],
    bridges: {
      Python: "localStorage is like a persistent dict — JSON.parse/stringify works like json.loads/dumps.",
      Java: "Like SharedPreferences on Android — key-value storage that survives page reloads.",
      Ruby: "Like a persistent hash saved to disk — except the browser manages the file.",
    },
    files: [
      {
        name: "app.js",
        code: `// The privacy toggle on the home page drives the entire data flow.
// Every function that stores or sends data checks this first.

function getPrivacyMode() {
  const v = localStorage.getItem("codeprobe_privacy");
  if (v === "saving" || v === "paused") return v;
  return "ephemeral";
}

function enableSaving() {
  localStorage.setItem("codeprobe_uid", getUID());
  localStorage.setItem("codeprobe_privacy", "saving");
}

function pauseSaving() {
  localStorage.setItem("codeprobe_privacy", "paused");
}

function resumeSaving() {
  localStorage.setItem("codeprobe_privacy", "saving");
}

// Every data path gates on this:
function saveCompletion(id) {
  if (getPrivacyMode() === "ephemeral") return;  // ← gate
  // ...store completion
}

function saveSession() {
  if (getPrivacyMode() === "ephemeral") return;  // ← gate
  // ...store session
}

function track(type, data = {}) {
  if (getPrivacyMode() !== "saving") return;      // ← gate
  // ...send event to server
}`,
      },
      {
        name: "serve.py",
        code: `# Server enforces privacy as defense-in-depth.
# Even if the client sends events, the server checks X-Mode.

# POST /api/event — only log when student opted in
if self.headers.get("X-Mode", "") != "saving":
    self._json_response(200, {"ok": True})  # silently discard
    return

# POST /api/chat — process always, but only log when saving
saving = self.headers.get("X-Mode", "") == "saving"
reply = call_llm(messages)
if saving:
    with open(f"data/{uid}_chat.jsonl", "a") as f:
        f.write(json.dumps({"ts": now, "reply": reply}) + "\\n")`,
      },
    ],
    seedQuestions: [
      "Why default to ephemeral instead of saving?",
      "What's the difference between 'paused' and just toggling saving off?",
      "Why does the server also check X-Mode if the client already gates on privacy mode?",
      "What happens to your old data when you switch from saving → paused → saving?",
    ],
  },

  {
    id: "meta-progress",
    title: "Progress, Personalization & GDPR",
    difficulty: "Project",
    icon: "📊",
    description:
      "Completion tracking with spaced repetition, 'I've worked with' chips that steer the AI tutor, and full GDPR controls — export and delete, all without accounts.",
    concepts: [
      "Completion tracking: count, first seen, last seen per lesson",
      "Spaced repetition: 'revisit' badge after 1+ day, up to 3 completions",
      "'I've worked with' chips persist regardless of privacy mode — they're functional",
      "GDPR: /api/export downloads all data, /api/delete removes everything",
    ],
    bridges: {
      Python: "getProgress() returns a dict of dicts — like json.load() on a small file.",
      Java: "Like a Map<String, CompletionRecord> serialized to browser storage.",
      Ruby: "Like a Hash of Hashes — {lesson_id => {completed: 2, last: timestamp}}.",
    },
    files: [
      {
        name: "app.js",
        code: `function saveCompletion(id) {
  if (getPrivacyMode() === "ephemeral") return;
  const p = getProgress();
  if (!p[id]) p[id] = { completed: 0, first: Date.now() };
  p[id].completed++;
  p[id].last = Date.now();
  localStorage.setItem("codeprobe", JSON.stringify(p));
}

function shouldRevisit(id) {
  const p = getProgress()[id];
  if (!p) return false;
  const daysSinceLast = (Date.now() - p.last) / 86400000;
  return daysSinceLast >= 1 && p.completed < 3;
}

// "I've worked with" chips always persist — they're functional, not tracking.
// getKnownLangs() feeds into buildPrompt() to filter bridges.
const LANG_CHIPS = [
  "Python", "JavaScript", "Java", "C", "C++",
  "TypeScript", "Ruby", "Rust", "Go", "C#",
];`,
      },
      {
        name: "app.js",
        code: `// GDPR: export all your data as a JSON download.
async function exportData() {
  const r = await fetch("/api/export", { headers: await apiHeaders() });
  const data = await r.json();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "codeprobe-data.json";
  a.click();
}

// GDPR: delete everything — server files + all localStorage keys.
async function deleteEverything() {
  await fetch("/api/delete", { method: "POST", headers: await apiHeaders() });
  localStorage.removeItem("codeprobe_uid");
  localStorage.removeItem("codeprobe_privacy");
  localStorage.removeItem("codeprobe");
  localStorage.removeItem("codeprobe_session");
}`,
      },
    ],
    seedQuestions: [
      "Why do 'I've worked with' chips persist even in ephemeral mode?",
      "How does spaced repetition improve retention compared to doing a lesson once?",
      "What exactly gets exported when you click 'export'?",
      "Why remove individual localStorage keys instead of calling localStorage.clear()?",
    ],
  },

  {
    id: "meta-deploy",
    title: "Hosting & Hardening",
    difficulty: "Project",
    icon: "🚀",
    description:
      "How a 750-line stdlib server runs in production: Caddy in front for HTTPS and a second layer of file denies, systemd locks the process down, and a 90-day retention reaper deletes inactive accounts automatically.",
    concepts: [
      "Caddy reverse proxy: auto-HTTPS + security headers + path denies",
      "systemd hardening: NoNewPrivileges, ProtectSystem=strict, ProtectHome, MemoryMax",
      "Defense-in-depth: app allow-lists, Caddy denies, systemd ReadWritePaths — all three",
      "Secrets in /opt/codeprobe/.env (chmod 600), loaded at startup",
      "Auto-generated DASHBOARD_SECRET + VALIDATOR_HMAC_KEY on first setup",
      "Retention: cleanup_expired_data() runs at startup and every 24h, deletes inactive UIDs",
      "Server-side security headers (CSP, HSTS, X-Frame-Options) on every response",
    ],
    bridges: {
      Python: "Caddy plays the role of nginx + Let's Encrypt + WAF, all in one binary.",
      JavaScript: "Like deploying a Node app behind a reverse proxy — but Caddy provisions HTTPS for free.",
      Java: "Like Tomcat behind nginx — Caddy is the nginx, Python's http.server is the Tomcat.",
    },
    files: [
      {
        name: "deploy/setup.sh",
        code: `# Runs once on the VPS as root. Generates secrets, writes Caddyfile,
# installs the systemd unit, opens the firewall.

ensure_secret() {
    local key="$1"
    grep -q "^\${key}=" /opt/codeprobe/.env 2>/dev/null && return
    local value=$(python3 -c 'import secrets; print(secrets.token_urlsafe(32))')
    printf '%s=%s\\n' "$key" "$value" >> /opt/codeprobe/.env
}
ensure_secret DASHBOARD_SECRET     # gates /dashboard/* and /api/users
ensure_secret VALIDATOR_HMAC_KEY   # signs validator_model.pkl

chmod 600 /opt/codeprobe/.env      # secrets are not world-readable

# Sign the validator model with the new key (or the next start refuses it).
sudo -u codeprobe bash -c 'set -a; . /opt/codeprobe/.env; set +a;
                           cd /opt/codeprobe && python3 validator.py --sign'`,
      },
      {
        name: "deploy/Caddyfile",
        code: `# Caddy fronts the Python server on localhost:3000.
# Auto-HTTPS via Let's Encrypt the moment DNS resolves.

codeprobe-app.dev {
    encode gzip

    header {
        X-Content-Type-Options nosniff
        X-Frame-Options DENY
        Referrer-Policy strict-origin-when-cross-origin
        Strict-Transport-Security "max-age=31536000; includeSubDomains"
        -Server                                # don't leak Caddy version
    }

    # Defense-in-depth: even if the Python static gate regresses,
    # Caddy still refuses to serve secrets, data, or source.
    @forbidden {
        path /.env /.env.* /.token_secret
        path /data /data/*
        path /deploy /deploy/*
        path /__pycache__/*
        path *.py *.pkl *.pkl.sig *.jsonl *.service *.sh
    }
    respond @forbidden 404

    reverse_proxy localhost:3000
}`,
      },
      {
        name: "deploy/codeprobe.service",
        code: `[Unit]
Description=CodeProbe
After=network.target

[Service]
Type=simple
User=codeprobe                       # unprivileged, no shell
WorkingDirectory=/opt/codeprobe
ExecStart=/usr/bin/python3 serve.py 3000
Restart=always
RestartSec=3
EnvironmentFile=/opt/codeprobe/.env  # secrets loaded here

# Sandbox: even if the app is compromised, blast radius is tiny.
NoNewPrivileges=true
ProtectSystem=strict                 # /usr, /boot, /etc → read-only
ProtectHome=true                     # no /home access
PrivateTmp=true                      # private /tmp namespace
ReadWritePaths=/opt/codeprobe/data   # the ONLY writable path

MemoryMax=300M                       # leave room for Caddy + OS

[Install]
WantedBy=multi-user.target`,
      },
      {
        name: "serve.py",
        code: `# Background retention reaper — auto-deletes inactive accounts.
# Runs once at startup, then every 24h. GDPR Article 5(1)(e):
# "kept in a form which permits identification ... no longer than necessary".

RETENTION_DAYS = 90

def cleanup_expired_data():
    cutoff = time.time() - (RETENTION_DAYS * 86400)
    with _lock:
        users   = load_users()
        expired = []
        for uid in list(users):
            paths = [os.path.join(DATA_DIR, f"{uid}.jsonl"),
                     os.path.join(DATA_DIR, f"{uid}_chat.jsonl")]
            mtime = max((os.path.getmtime(p) for p in paths
                         if os.path.exists(p)), default=0)
            if mtime < cutoff:
                expired.append(uid)
                for p in paths:
                    if os.path.exists(p): os.remove(p)
        for uid in expired: del users[uid]
        if expired: save_users(users)

def schedule_cleanup():
    try: cleanup_expired_data()
    except Exception as e: print(f"cleanup error: {e}", file=sys.stderr)
    t = threading.Timer(86400, schedule_cleanup); t.daemon = True; t.start()

# Security headers added to EVERY response (JSON, HTML, static):
def end_headers(self):
    self.send_header("X-Content-Type-Options",      "nosniff")
    self.send_header("X-Frame-Options",             "DENY")
    self.send_header("Referrer-Policy",             "strict-origin-when-cross-origin")
    self.send_header("Strict-Transport-Security",   "max-age=31536000; includeSubDomains")
    if self.path.endswith(".html") or self.path.startswith("/dashboard"):
        self.send_header("Content-Security-Policy",
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data:; font-src 'self' data:; connect-src 'self'; "
            "frame-ancestors 'none'; base-uri 'self'")
    super().end_headers()`,
      },
    ],
    seedQuestions: [
      "Why deny secret paths in BOTH the Python app and Caddy?",
      "What does ProtectSystem=strict prevent if the app is compromised?",
      "Why generate DASHBOARD_SECRET in setup.sh instead of hard-coding it?",
      "What goes wrong if you change VALIDATOR_HMAC_KEY without re-signing the model?",
    ],
  },
] };
