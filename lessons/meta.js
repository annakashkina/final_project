export const metaLessons = [
  {
    id: "meta-lessons",
    lang: "meta",
    title: "How Lessons Are Defined",
    difficulty: "Project",
    icon: "📦",
    description:
      "Every lesson is a JavaScript object — with code, concepts, and personalized hints. This is how the content you're reading right now is defined.",
    concepts: [
      "Lessons as data: id, code, concepts, bridges, seed questions",
      "How the app loads and renders a lesson",
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
        name: "lessons.js",
        code: `// Every lesson on the site is an object in this array.
// The app reads it to build the home screen and lesson view.

export const lessons = [
  {
    id: "c-pointers",
    lang: "c",
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

    code: "...the C code shown in the left panel...",

    seedQuestions: [              // clickable starter questions
      "What does &x give you?",
      "What happens if you dereference NULL?",
    ],
  },
  // ... 40+ more across C, Rust, Python, TypeScript, Ruby, C++
];`,
      },
      {
        name: "app.js",
        code: `// When you click a lesson card on the home screen:

function openLesson(id) {
  state.lesson = lessons.find(l => l.id === id);
  state.messages = [];    // start a fresh conversation
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
    lang: "meta",
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
  lesson: null,        // current lesson object from lessons.js
  phase: "explore",    // "explore" | "learn" | "challenge" | "done"
  messages: [],        // [{role: "system"|"user"|"assistant", content}]
  exchangeCount: 0,    // how many answers the student has sent
  mode: "quick",       // "quick" (~1 exchange) or "full" (~5-7)
};

// EXPLORE:   student reads code, writes questions
// LEARN:     AI teaches one concept, quizzes, student answers
// CHALLENGE: final synthesis question (full mode only)
// DONE:      summary, concepts learned, confetti

function setPhase(phase) {
  state.phase = phase;
  // Each phase has its own UI panel — show the right one
  if (phase === "explore") show("#phase-explore");
  else if (phase === "learn" || phase === "challenge") show("#phase-chat");
  else if (phase === "done") show("#phase-complete");
}

// After each AI reply, check if the lesson should end.
// The AI includes [LESSON_COMPLETE] only when the student
// answered correctly — never right after a correction.

if (reply.includes("[LESSON_COMPLETE]")) {
  saveCompletion(lesson.id);
  setPhase("done");
}

// In full mode, after 4+ exchanges, switch to the final challenge
if (state.mode !== "quick" && state.exchangeCount >= 4)
  setPhase("challenge");`,
      },
    ],
    seedQuestions: [
      "Why does the AI decide when the lesson ends, not the student?",
      "What's the difference between the 'learn' and 'challenge' phases?",
      "Why is the rule 'never end with [LESSON_COMPLETE] after a correction' important?",
      "How does quick mode skip the challenge phase entirely?",
    ],
  },

  {
    id: "meta-prompt",
    lang: "meta",
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

  const studentDesc = known.length > 0
    ? \`a programmer who knows \${known.join(", ")}\`
    : "a student who is likely a beginner";

  const exchanges = state.mode === "quick" ? "1-2" : "5-7";

  return \`You are a tutor teaching \${studentDesc}.
Teach ONE concept. Quiz immediately. ~\${exchanges} exchanges.

CRITICAL: Never end with [LESSON_COMPLETE] if you just
corrected them. They must answer a question right first.

BRIDGES:
\${bridges}

CODE:
\${lesson.code}

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
    lang: "meta",
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

// Step 3: student answers → add to array, send again
state.messages.push({ role: "user", content: answer });
const reply2 = await chat(state.messages);  // full history
state.messages.push({ role: "assistant", content: reply2 });

// The HTTP call to our Python server
async function chat(messages) {
  const resp = await fetch("/api/chat", {
    method: "POST",
    headers: await apiHeaders(),    // includes X-UID, X-Token
    body: JSON.stringify({ messages }),
  });
  return (await resp.json()).reply;
}`,
      },
      {
        name: "serve.py",
        code: `# POST /api/chat — receives the conversation, forwards to Groq

def handle_chat(self, body, uid):
    # body["messages"] = [
    #   {"role": "system",    "content": "You are a tutor..."},
    #   {"role": "assistant", "content": "What does &x give you?"},
    #   {"role": "user",      "content": "The memory address"},
    # ]

    reply = call_groq(body["messages"])

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
      "Why does the browser talk to our server instead of calling Groq directly?",
      "What does the 'system' role do that 'user' doesn't?",
      "Why log every exchange to a file?",
    ],
  },

  {
    id: "meta-server",
    lang: "meta",
    title: "How the Server Works",
    difficulty: "Project",
    icon: "🖥️",
    description:
      "The Python server routes requests, verifies tokens, blocks bots, and serves files — all with Python's built-in http.server. No frameworks, no dependencies. Here's the full routing structure.",
    concepts: [
      "Extending SimpleHTTPRequestHandler for custom routes",
      "do_GET for reading data, do_POST for writing data",
      "Bot check → token verify → route: the request pipeline",
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

    # GET: serve static files (HTML, CSS, JS)
    def do_GET(self):
        super().do_GET()  # built-in: serves index.html, style.css, app.js

    # POST: every request goes through bot check → token verify → route
    def do_POST(self):
        if is_bot(self.headers.get("User-Agent", "")):
            self._json_response(403, {"error": "forbidden"})
            return

        uid = self.headers.get("X-UID", "")
        token = self.headers.get("X-Token", "")
        if token != make_token(uid):
            self._json_response(403, {"error": "invalid token"})
            return

        body = json.loads(self.rfile.read(
            int(self.headers["Content-Length"])
        ))

        if self.path == "/api/chat":
            reply = call_groq(body["messages"])
            self._json_response(200, {"reply": reply})
        elif self.path == "/api/event":
            log_event(uid, body)
            self._json_response(200, {"uid": uid})

    # Helper: send JSON with CORS headers
    def _json_response(self, code, data):
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

# Multi-threaded: handles many users at once
http.server.ThreadingHTTPServer(("", 3000), Handler).serve_forever()`,
      },
    ],
    seedQuestions: [
      "Why does do_GET fall through to super().do_GET() for unknown paths?",
      "Why check the token BEFORE reading the request body?",
      "What does ThreadingHTTPServer give you that HTTPServer doesn't?",
      "How would you add a new API endpoint to this server?",
    ],
  },

  {
    id: "meta-groq",
    lang: "meta",
    title: "Calling the AI (Groq API)",
    difficulty: "Project",
    icon: "🤖",
    description:
      "The server forwards your conversation to Groq's API, which runs the language model and returns a reply. This is the actual AI call — and the format most LLM providers share.",
    concepts: [
      "LLM APIs accept a messages array and return a completion",
      "Temperature controls randomness in responses",
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

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_API_KEY = os.environ["GROQ_API_KEY"]  # never sent to browser

def call_groq(messages):
    # Groq uses the OpenAI-compatible format
    payload = json.dumps({
        "model": "kimi-k2-instruct",
        "messages": messages,     # full conversation so far
        "temperature": 0.7,       # some creative variation
        "max_tokens": 1500,       # cap response length
    }).encode()

    req = urllib.request.Request(GROQ_URL, data=payload, headers={
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json",
    })

    with urllib.request.urlopen(req, timeout=10) as resp:
        result = json.loads(resp.read())

    reply = result["choices"][0]["message"]["content"]

    # If reply is suspiciously short, the API probably glitched.
    # Wait 1s, add a trailing space to avoid cache, try again.
    if len(reply.split()) < 40:
        time.sleep(1)
        messages[-1]["content"] += " "
        # ... same request again with modified message

    return reply`,
      },
    ],
    seedQuestions: [
      "Why does Groq use the same format as OpenAI?",
      "What does temperature 0.7 actually change in the response?",
      "Why retry when the reply is too short instead of just returning it?",
      "What would you change to switch to a different AI provider?",
    ],
  },

  {
    id: "meta-progress",
    lang: "meta",
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

const LANG_CHIPS = ["Python", "JavaScript", "Java", "C", "C++"];
const CONCEPT_CHIPS = ["OOP", "Memory management", "Concurrency"];

function getKnownLangs() {
  return getKnownItems().filter(i => LANG_CHIPS.includes(i));
}
// getKnownLangs() → buildPrompt() → bridges filtered → AI teaches your way`,
      },
    ],
    seedQuestions: [
      "Why use localStorage instead of a server database?",
      "How does selecting 'Python' change what the AI says?",
      "Why is the spaced repetition threshold 3 completions?",
      "What would happen to progress if the user clears their browser data?",
    ],
  },
];
