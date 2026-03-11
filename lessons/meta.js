export const metaLessons = { name: "How codeprobe works", lessons: [
  {
    id: "meta-lessons",
    title: "How Lessons Are Defined",
    difficulty: "Project",
    icon: "📦",
    description:
      "Every lesson is a JavaScript object — with code, concepts, and personalized hints. This is how the content you're reading right now is defined.",
    concepts: [
      "Lessons as data: id, code, concepts, bridges, seed questions",
      "Series group lessons by language (C, Rust, Python, etc.)",
      "Bridges: personalized explanations matched to your background",
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
// The lessons array contains the lesson objects.

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
  // ...more lessons in this series
] };`,
      },
      {
        name: "app.js",
        code: `import { lessons, series } from "./lessons.js";

// lessons.js imports every series file and re-exports two things:
//   series  — array of { name, lessons } (for the home grid)
//   lessons — flat array of all lesson objects (for lookup by id)

// When you click a lesson card on the home screen:
function openLesson(id) {
  const lesson = lessons.find(l => l.id === id);
  if (!lesson) { navigate(null); return; }
  state.lesson = lesson;
  renderCode();           // syntax-highlight the left panel
  renderSeeds();          // show clickable seed questions
  setPhase("explore");    // phase 1: read the code
}`,
      },
    ],
    seedQuestions: [
      "Why are bridges filtered to only languages the student selected?",
      "What's the point of seed questions — why not just let people type?",
      "How does the app know which syntax highlighting to use?",
      "What makes this different from showing code in a textbook?",
    ],
  },

  {
    id: "meta-flow",
    title: "The Lesson Flow",
    difficulty: "Project",
    icon: "🔄",
    description:
      "Every lesson moves through four phases: read the code, learn from the AI tutor, face a challenge, then see what you've learned. This state machine drives the whole experience.",
    concepts: [
      "Four phases: explore → learn → challenge → done",
      "State object tracks the current lesson, messages, and phase",
      "[LESSON_COMPLETE] — the AI decides when you're ready",
      "Quick mode (~1 exchange) vs full mode (~5-7 exchanges)",
      "setPhase({ silent }) — silent mode for session restore without side effects",
    ],
    bridges: {
      Python: "Like a state machine — a variable tracks the current phase, functions transition between them.",
      Java: "Like an enum-driven state pattern — each phase shows/hides its own UI panel.",
      Ruby: "Like a finite state machine — the phase string controls which view is active.",
    },
    files: [
      {
        name: "app.js",
        code: `// All lesson state lives in one object

const state = {
  lesson: null,        // current lesson object (loaded on demand)
  fileIdx: 0,          // which file tab is selected (multi-file lessons)
  phase: "explore",    // "explore" | "learn" | "challenge" | "done"
  messages: [],        // [{role: "system"|"user"|"assistant", content}]
  exchangeCount: 0,    // how many answers the student has sent
  loading: false,      // true while waiting for AI response
  mode: "quick",       // "quick" (~1 exchange) or "full" (~5-7)
  lang: "en",          // UI language — AI responds in this language
};

// EXPLORE:   student reads code, writes questions
// LEARN:     AI teaches one concept, quizzes, student answers
// CHALLENGE: final synthesis question (full mode only)
// DONE:      summary, concepts learned, confetti

// { silent } prevents side effects during session restore:
// no tracking events, no "final challenge" label, no saveSession()
function setPhase(phase, { silent = false } = {}) {
  state.phase = phase;
  if (state.lesson && !silent) track("phase_change", {...});

  // Each phase has its own UI panel — show the right one
  if (phase === "explore") show("#phase-explore");
  else if (phase === "learn" || phase === "challenge") {
    show("#phase-chat");
    if (phase === "challenge" && !silent) addMsg("challenge", "final challenge");
  }
  else if (phase === "done") show("#phase-complete");

  if (!silent) saveSession();  // persist to localStorage
}

// After each AI reply, check if the lesson should end.
// The AI ends its message with [LESSON_COMPLETE] only when
// the student answered correctly — never right after a correction.

if (reply.endsWith("[LESSON_COMPLETE]")) {
  saveCompletion(lesson.id);
  setPhase("done");
  renderDone(summary);
}

// In full mode, after 4+ exchanges, switch to the final challenge
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
      "Hash-based routing gives every lesson a shareable URL, and makes the browser's back/forward buttons work. No server changes needed — the hash never hits the server.",
    concepts: [
      "Hash-based routing: #lesson-id in the URL",
      "hashchange and popstate events for browser navigation",
      "navigate() as the single entry point for all navigation",
      "Re-entry guard (_routing) prevents double-handling",
      "history.pushState for clean home URL (no trailing #)",
    ],
    bridges: {
      Python: "Like Flask's @app.route — mapping URL patterns to handler functions, but entirely client-side.",
      Java: "Like a servlet's URL mapping — the hash fragment acts as the route, handled in JavaScript.",
      Ruby: "Like Sinatra's get '/path' — but running in the browser, not a server.",
    },
    files: [
      {
        name: "app.js",
        code: `// Hash-based routing: / = home, #lesson-id = lesson view.
// The hash fragment (#...) is never sent to the server,
// so this works with any static file server — no rewrites needed.

function navigate(lessonId) {
  if (lessonId) {
    window.location.hash = lessonId;  // triggers hashchange
  } else {
    // Clean URL when going home (remove trailing #)
    if (window.location.hash) {
      history.pushState(null, "", window.location.pathname);
    }
    handleRoute();
  }
}

// Guard against re-entry: hashchange can fire during openLesson
let _routing = false;

async function handleRoute() {
  if (_routing) return;       // prevent double-handling
  _routing = true;
  try {
    const id = window.location.hash.slice(1);  // "#c-pointers" → "c-pointers"
    if (id) {
      await openLesson(id);   // async — loads lesson data on demand
    } else {
      state.lesson = null;
      renderHome();
      showView("home");
    }
  } finally {
    _routing = false;
  }
}

// Browser back/forward buttons trigger these events
window.addEventListener("hashchange", handleRoute);
window.addEventListener("popstate", handleRoute);

// Card clicks go through navigate(), not direct function calls
card.addEventListener("click", () => navigate(card.dataset.id));

// Back button and "another lesson" go through navigate(null)
$("#back-btn").addEventListener("click", () => navigate(null));
$("#go-home").addEventListener("click", () => navigate(null));

// Init: route based on current URL (supports direct links)
handleRoute();  // if URL is /#c-pointers, opens that lesson directly`,
      },
    ],
    seedQuestions: [
      "Why use hash-based routing instead of regular URL paths?",
      "What would break if you removed the _routing guard?",
      "How does someone share a link to a specific lesson?",
      "Why use history.pushState when going home instead of just setting hash to ''?",
    ],
  },

  {
    id: "meta-session",
    title: "Session Persistence",
    difficulty: "Project",
    icon: "💾",
    description:
      "Accidentally close the tab mid-lesson? Your conversation survives. The app saves chat state to localStorage after every message and restores it when you return — with a 24-hour expiry.",
    concepts: [
      "localStorage for session state (survives tab close)",
      "Saving after every meaningful state change",
      "24-hour expiry to prevent stale sessions",
      "Silent restore: setPhase({ silent: true }) avoids duplicate side effects",
      "clearSession() on lesson completion or manual back",
    ],
    bridges: {
      Python: "Like pickling state to a file — JSON.stringify serializes, JSON.parse deserializes.",
      Java: "Like SharedPreferences or Serializable — structured data persisted to browser storage.",
      Ruby: "Like Marshal.dump/load — save and restore a hash of state to survive restarts.",
    },
    files: [
      {
        name: "app.js",
        code: `// Saves in-progress lesson state to localStorage.
// Cleared when the lesson completes or user clicks back.

function saveSession() {
  // Only save during active learning (not explore or done)
  if (!state.lesson || state.phase === "explore" || state.phase === "done") return;

  localStorage.setItem("codeprobe_session", JSON.stringify({
    lessonId: state.lesson.id,
    phase: state.phase,
    messages: state.messages,         // full conversation array
    exchangeCount: state.exchangeCount,
    fileIdx: state.fileIdx,
    chatHTML: $("#chat-messages")?.innerHTML || "",  // rendered messages
    savedAt: Date.now(),              // for 24h expiry check
  }));
}

function loadSession() {
  try {
    const s = JSON.parse(localStorage.getItem("codeprobe_session"));
    // Expired after 24 hours — stale sessions are confusing
    if (!s || Date.now() - s.savedAt > 86400000) {
      localStorage.removeItem("codeprobe_session");
      return null;
    }
    return s;
  } catch { return null; }
}

function clearSession() {
  localStorage.removeItem("codeprobe_session");
}

// --- Where saveSession() is called ---
// setPhase()       — after every phase transition
// startLearning()  — when the first system message is built
// sendMsg()        — after every user message
// getLLMResponse()  — after every AI reply (except lesson complete)

// --- Where clearSession() is called ---
// renderDone()     — lesson finished, no need to restore
// back button      — user deliberately left the lesson

// --- Restore logic in openLesson ---
function openLesson(id) {
  const lesson = lessons.find(l => l.id === id);
  state.lesson = lesson;

  const session = loadSession();
  if (session && session.lessonId === id
      && session.phase !== "explore" && session.phase !== "done") {
    // Restore: put state back, re-render from saved HTML
    state.messages = session.messages;
    state.exchangeCount = session.exchangeCount;
    state.fileIdx = session.fileIdx;
    renderCode();
    setPhase(session.phase, { silent: true });  // no side effects
    $("#chat-messages").innerHTML = session.chatHTML;
    updateExchange();
  } else {
    // Fresh start
    state.messages = [];
    state.exchangeCount = 0;
    setPhase("explore");
  }
}`,
      },
    ],
    seedQuestions: [
      "Why save to localStorage instead of sessionStorage?",
      "Why expire sessions after 24 hours?",
      "What would go wrong if setPhase didn't have a silent option during restore?",
      "Why save the rendered chatHTML instead of just re-rendering from messages?",
    ],
  },

  {
    id: "meta-prompt",
    title: "Building the Tutor Prompt",
    difficulty: "Project",
    icon: "🧩",
    description:
      "This is what makes the AI a tutor instead of a chatbot. buildPrompt() takes the lesson, the student's background, and their questions, and writes an instruction that controls how the AI teaches.",
    concepts: [
      "System prompts as scaffolding for AI behavior",
      "Bridges: filtered to only languages the student knows",
      "Quick vs full mode changes the number of exchanges",
      "The AI is told what NOT to assume about the student",
      "Language selector: the AI responds in the student's chosen language",
    ],
    bridges: {
      Python: "Template literals (backtick strings with ${}) work like Python f-strings.",
      Java: "Like String.format() but inline — JS template literals embed expressions with ${}.",
      Ruby: "Like Ruby string interpolation #{} — same idea, JS uses ${}.",
    },
    files: [
      {
        name: "app.js",
        code: `// This turns a chatbot into a tutor.
// Without it, you're just talking to an LLM. With it,
// the AI teaches from YOUR background and quizzes you.

function buildPrompt(lesson, questions) {
  const known = getKnownLangs();  // e.g. ["Python", "JavaScript"]

  // Only include bridges for languages the student selected.
  // If they know Python, explain Rust using Python analogies.
  const bridges = Object.entries(lesson.bridges)
    .filter(([lang]) => known.includes(lang))
    .map(([lang, note]) => \`- \${lang}: \${note}\`)
    .join("\\n");

  // Multi-file lessons: concatenate all files into the prompt
  const code = lesson.files
    ? lesson.files.map(f => \`--- \${f.name} ---\\n\${f.code}\`).join("\\n\\n")
    : lesson.code;

  // Also factors in concept knowledge (OOP, concurrency, etc.)
  // to tell the AI what NOT to assume the student knows
  const concepts = getKnownConcepts();
  const studentDesc = known.length > 0
    ? \`a programmer who \${known.join(", ")} and knows \${concepts.join(", ")}\`
    : "a student who is likely a beginner";

  const exchanges = state.mode === "quick" ? "1-2" : "5-7";

  // If student picked a language (e.g. Spanish), instruct AI to respond in it
  const langNote = state.lang !== "en"
    ? \`\\nLANGUAGE: Respond in \${LANG_NAMES[state.lang]}. English only for code.\`
    : "";

  return \`You are a tutor teaching \${studentDesc}.\${langNote}
Teach ONE concept. Quiz immediately. ~\${exchanges} exchanges.

CRITICAL: Never end with [LESSON_COMPLETE] if you just
corrected them. They must answer a question right first.

BRIDGES:
\${bridges}

CODE:
\${code}

CONCEPTS: \${lesson.concepts.join(", ")}

STUDENT QUESTIONS: \${questions || "(none)"}\`;
}`,
      },
    ],
    seedQuestions: [
      "What would happen if you sent just the question to the AI without this prompt?",
      "Why filter bridges instead of sending all of them?",
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
      "When you click 'start learning', the browser sends the full conversation to a Python server, which forwards it to the AI and returns the reply. Here's how that round trip works.",
    concepts: [
      "Conversations as arrays of {role, content} messages",
      "The full array is sent every time — the server is stateless",
      "fetch() is the browser's built-in HTTP client",
      "The server keeps the API key safe from the browser",
      "Retry with backoff: up to 3 attempts on server errors",
    ],
    bridges: {
      Python: "fetch() is like requests.post() — the browser's built-in HTTP client.",
      Java: "Like HttpClient.send() — fetch returns a Promise (similar to CompletableFuture).",
      Ruby: "Like Net::HTTP.post — sends JSON to the server, gets JSON back.",
    },
    files: [
      {
        name: "app.js",
        code: `// A conversation is an array of messages.
// Each call sends the WHOLE array — the server has no memory.

// Step 1: start with the system prompt
state.messages = [
  { role: "system", content: buildPrompt(lesson, questions) }
];

// Step 2: send to server → AI teaches and quizzes
const reply = await chat(state.messages);
state.messages.push({ role: "assistant", content: reply });
saveSession();  // persist after every AI reply

// Step 3: student answers → add to array, send again
state.messages.push({ role: "user", content: answer });
saveSession();  // persist after every user message
const reply2 = await chat(state.messages);  // full history
state.messages.push({ role: "assistant", content: reply2 });

// The HTTP call with retry logic
async function chat(messages) {
  const h = await apiHeaders();  // includes X-UID, X-Token
  const body = JSON.stringify({ messages });
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch("/api/chat", { method: "POST", headers: h, body });
      if (r.ok) return (await r.json()).reply;
      lastErr = (await r.json().catch(() => ({}))).error || \`Error \${r.status}\`;
      if (r.status < 500) break;  // don't retry client errors
    } catch (e) { lastErr = e.message; }
    await new Promise(ok => setTimeout(ok, 1000 * (attempt + 1)));  // backoff
  }
  throw new Error(lastErr);
}`,
      },
      {
        name: "serve.py",
        code: `# POST /api/chat — receives the conversation, forwards to the LLM

# The server reads these from environment variables:
#   LLM_API_URL  → e.g. Groq, xAI, or a local Ollama instance
#   LLM_API_KEY  → omitted for keyless self-hosted providers
#   LLM_MODEL    → which model to use

payload = json.dumps({
    "model": LLM_MODEL,
    "messages": body["messages"],   # full conversation
    "temperature": 0.7,
    "max_tokens": 1500,
}).encode()

req = urllib.request.Request(LLM_API_URL, data=payload, headers=LLM_HEADERS)

with urllib.request.urlopen(req, timeout=10) as resp:
    result = json.loads(resp.read())
    reply = result["choices"][0]["message"]["content"]

# Log the exchange for quality review
with open(f"data/{uid}_chat.jsonl", "a") as f:
    json.dump({"messages": body["messages"], "reply": reply}, f)
    f.write("\\n")

self._json_response(200, {"reply": reply})

# The server is stateless — no session cache.
# The browser sends the full history every time.
# The API key lives here, never exposed to the browser.`,
      },
    ],
    seedQuestions: [
      "Why send the WHOLE message array each time, not just the latest message?",
      "Why does the browser talk to our server instead of calling the LLM directly?",
      "What does the 'system' role do that 'user' doesn't?",
      "Why retry on 5xx errors but not on 4xx?",
    ],
  },

  {
    id: "meta-server",
    title: "How the Server Works",
    difficulty: "Project",
    icon: "🖥️",
    description:
      "The Python server routes requests, validates input, and serves files — all with Python's built-in http.server. No frameworks, no dependencies. Every POST goes through a security pipeline before reaching the route.",
    concepts: [
      "Extending SimpleHTTPRequestHandler for custom routes",
      "do_GET for reading data, do_POST for writing data",
      "Security pipeline: bot check → size limit → UUID check → token verify → parse → validate → route",
      "ThreadingHTTPServer handles multiple users at once",
    ],
    bridges: {
      JavaScript: "Like Express routes (app.get, app.post) but built into Python's standard library.",
      Java: "Like a HttpServlet with doGet/doPost — same pattern, Python syntax.",
      Ruby: "Like a Sinatra app — route matching in methods, lightweight, no big framework.",
    },
    files: [
      {
        name: "serve.py",
        code: `import http.server, json

class Handler(http.server.SimpleHTTPRequestHandler):

    # GET: serve static files + dashboard + API reads
    def do_GET(self):
        if self.path == f"/dashboard/{DASHBOARD_SECRET}":
            # serve dashboard (secret URL = auth)
        elif self.path.startswith("/api/users"):
            # list users (requires dashboard key)
        elif self.path.startswith("/api/timeline"):
            uid = params.get("uid", "")
            if not valid_uid(uid):            # ← UUID validation
                return error(400)
            # return user's event timeline
        else:
            super().do_GET()  # built-in: serves index.html, app.js, etc.

    # POST: security pipeline → route
    def do_POST(self):
        # 1. Block bots by User-Agent
        if is_bot(ua):
            return error(403)

        # 2. Reject oversized bodies (256KB max)
        if length > MAX_BODY:
            return error(413)

        # 3. Validate UID is a real UUID (prevents path traversal)
        if not valid_uid(uid):
            return error(400)

        # 4. Verify JS proof token
        if token != make_token(uid):
            return error(403)

        # 5. Route to handler
        if self.path == "/api/chat":
            body = json.loads(...)            # ← can fail → 400
            validate_messages(body["messages"])  # ← roles, count, size
            if not check_rate(ip):            # ← rate limit
                return error(429)
            # forward to LLM, log, respond
        elif self.path == "/api/event":
            evt = json.loads(body)            # ← validate JSON first
            # log to user's JSONL file

# Multi-threaded: handles many users at once
server = http.server.ThreadingHTTPServer(("", 3000), Handler)
server.request_queue_size = 64  # default is 5 — too low when browsers
server.socket.listen(64)        # open many connections at once (JS lessons, CSS, etc.)
server.serve_forever()`,
      },
    ],
    seedQuestions: [
      "Why check the body size BEFORE parsing JSON?",
      "Why validate the UID as a UUID — what attack does that prevent?",
      "What does ThreadingHTTPServer give you that HTTPServer doesn't?",
      "Why does each check return early instead of using if/else chains?",
    ],
  },

  {
    id: "meta-llm",
    title: "Calling the AI (Any LLM Provider)",
    difficulty: "Project",
    icon: "🤖",
    description:
      "The server forwards your conversation to an LLM API and returns the reply. It works with any OpenAI-compatible provider — Groq, xAI, Ollama, or any self-hosted model. Just change the URL and key.",
    concepts: [
      "OpenAI-compatible API: most LLM providers use the same format",
      "Environment variables for provider-agnostic configuration",
      "Conditional auth: skip the API key for self-hosted models",
      "Retry logic catches API flakiness (short replies, errors)",
      "The response format: choices[0].message.content",
    ],
    bridges: {
      Python: "urllib is Python's built-in HTTP client — like requests but no install needed.",
      JavaScript: "Same idea as fetch() on the client — build a request, send JSON, parse JSON back.",
      Java: "Like HttpClient with Jackson — build request, send, deserialize the JSON response.",
    },
    files: [
      {
        name: "serve.py",
        code: `import urllib.request, json, os, time

# Provider-agnostic: just change these env vars to switch providers.
# Works with Groq, xAI (Grok), Ollama, vLLM, or any OpenAI-compatible API.
LLM_API_KEY = os.environ.get("LLM_API_KEY", "")
LLM_MODEL   = os.environ.get("LLM_MODEL", "kimi-k2-instruct")
LLM_API_URL = os.environ.get("LLM_API_URL",
    "https://api.groq.com/openai/v1/chat/completions")

# Headers are built once. Authorization is only added if a key exists —
# so self-hosted providers (Ollama, vLLM) that need no key just work.
LLM_HEADERS = {"Content-Type": "application/json"}
if LLM_API_KEY:
    LLM_HEADERS["Authorization"] = f"Bearer {LLM_API_KEY}"

# The actual LLM call — same format works everywhere
payload = json.dumps({
    "model": LLM_MODEL,
    "messages": messages,       # full conversation so far
    "temperature": 0.7,         # some creative variation
    "max_tokens": 1500,         # cap response length
}).encode()

req = urllib.request.Request(LLM_API_URL, data=payload, headers=LLM_HEADERS)

with urllib.request.urlopen(req, timeout=10) as resp:
    result = json.loads(resp.read())

reply = result["choices"][0]["message"]["content"]

# If reply is suspiciously short, the API probably glitched.
# Wait 1s, add a trailing space to avoid cache, try again.
if len(reply.split()) < 40:
    time.sleep(1)
    messages[-1]["content"] += " "
    # ... same request again with modified message`,
      },
    ],
    seedQuestions: [
      "Why do so many LLM providers use the same API format as OpenAI?",
      "What does temperature 0.7 actually change in the response?",
      "Why retry when the reply is too short instead of just returning it?",
      "What would you change to run this against a local Ollama model?",
    ],
  },

  {
    id: "meta-progress",
    title: "Progress & Personalization",
    difficulty: "Project",
    icon: "📊",
    description:
      "The app remembers what you've completed and what you know — all in localStorage. Your 'I've worked with' selections directly control how the AI teaches you.",
    concepts: [
      "localStorage as client-side persistence (no account needed)",
      "Completion tracking: count, first time, last time",
      "Spaced repetition: revisit after 1+ day, up to 3 times",
      "\"I've worked with\" chips feed directly into buildPrompt()",
      "Language selector: the AI responds in 20+ languages",
    ],
    bridges: {
      Python: "localStorage is like a persistent dict — JSON.parse/stringify is like json.loads/dumps.",
      Java: "Like SharedPreferences on Android — key-value storage that survives page refresh.",
      Ruby: "Like a persistent hash saved to disk — except the browser manages the file.",
    },
    files: [
      {
        name: "app.js",
        code: `// Progress stored in localStorage — no account needed.
// Key "codeprobe" holds a JSON object:
// { "c-pointers": {completed: 2, first: 170800000, last: 170820000} }

function getProgress() {
  return JSON.parse(localStorage.getItem("codeprobe") || "{}");
}

function saveCompletion(id) {
  const p = getProgress();
  if (!p[id]) p[id] = { completed: 0, first: Date.now() };
  p[id].completed++;
  p[id].last = Date.now();
  localStorage.setItem("codeprobe", JSON.stringify(p));
}

// Spaced repetition: suggest revisiting after 1+ day
function shouldRevisit(id) {
  const p = getProgress()[id];
  if (!p) return false;
  // Not done in 24 hours AND completed fewer than 3 times
  return (Date.now() - p.last) / 86400000 >= 1 && p.completed < 3;
}

// "I've worked with" chips are also in localStorage.
// When you select Python, buildPrompt() includes Python bridges.
// When you select "Memory management", the AI won't over-explain it.

const LANG_CHIPS = [
  "Python", "JavaScript", "Java", "C", "C++",
  "TypeScript", "Ruby", "Rust", "Go", "C#",
];
const CONCEPT_CHIPS = [
  "OOP", "Data structures", "Memory management",
  "Concurrency", "Functional programming", "Databases / SQL", "Algorithms",
];

function getKnownLangs() {
  return getKnownItems().filter(i => LANG_CHIPS.includes(i));
}
// getKnownLangs() → buildPrompt() → bridges filtered → AI teaches your way

// Language selector — stored in localStorage, sent to buildPrompt().
// The AI is instructed to respond entirely in the chosen language.
// state.lang = localStorage.getItem("codeprobe_lang") || "en";`,
      },
    ],
    seedQuestions: [
      "Why use localStorage instead of a server database?",
      "How does selecting 'Python' change what the AI says?",
      "Why is the spaced repetition threshold 3 completions?",
      "What would happen to progress if the user clears their browser data?",
    ],
  },

  {
    id: "meta-security",
    title: "Input Validation & Security",
    difficulty: "Project",
    icon: "🛡️",
    description:
      "Every API endpoint is a door. If you don't check who's knocking and what they're carrying, bad things happen. Here's how codeprobe validates every request — and why each check exists.",
    concepts: [
      "Path traversal: why UIDs must be validated as UUIDs",
      "Body size limits prevent memory exhaustion (DoS)",
      "Message validation: role whitelist, count caps, size caps",
      "Rate limiting per IP to prevent abuse",
      "Parse-then-write: never trust raw input",
    ],
    bridges: {
      Python: "re.compile for regex, dict for rate limit tracking — all stdlib, no dependencies.",
      JavaScript: "Same defense principles as Express middleware — validate early, reject fast.",
      Java: "Like a servlet filter chain — each check is a gate that can reject the request.",
    },
    files: [
      {
        name: "serve.py",
        code: `import re, time, threading

# UUID regex — if the UID doesn't match, reject it.
# Without this, an attacker sends X-UID: "../../etc/passwd"
# and the server writes files outside the data/ directory.
_UUID_RE = re.compile(
    r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
)
MAX_BODY = 256 * 1024   # 256KB — generous, but prevents gigabyte payloads

def valid_uid(uid):
    return bool(_UUID_RE.match(uid))

# Rate limiting: track timestamps per IP, reject if over 30/hour
_lock = threading.Lock()
_chat_hits = {}   # {ip: [timestamp, ...]}

def check_rate(ip):
    with _lock:
        now = time.time()
        hits = [t for t in _chat_hits.get(ip, []) if now - t < 3600]
        if len(hits) >= 30:
            return False      # over limit
        hits.append(now)
        _chat_hits[ip] = hits
        return True`,
      },
      {
        name: "validate.py",
        code: `# Message validation — runs before forwarding to the LLM.
# Without this, an attacker could:
#   - send 100 messages → blow through your token budget
#   - inject extra "system" messages → override your prompt
#   - send 1MB of text → cost a fortune in API tokens

def validate_messages(messages):
    if not isinstance(messages, list) or len(messages) == 0:
        return "messages must be a non-empty array"
    if len(messages) > 20:
        return "too many messages"

    allowed_roles = {"system", "user", "assistant"}
    system_count = 0
    total_chars = 0

    for i, m in enumerate(messages):
        if m["role"] not in allowed_roles:
            return f"invalid role: {m['role']}"
        if m["role"] == "system":
            system_count += 1
            if i != 0:
                return "system message must be first"
        total_chars += len(m.get("content", ""))

    if system_count > 1:
        return "only one system message allowed"
    if total_chars > 60000:
        return "messages too large"
    return None   # all good`,
      },
    ],
    seedQuestions: [
      "What exactly is path traversal — how would ../../ escape the data directory?",
      "Why validate the UID with a regex instead of just checking if the file exists?",
      "What happens if you skip the body size check — how would an attacker exploit it?",
      "Why limit to one system message at position 0 — what's the prompt injection risk?",
    ],
  },
] };
