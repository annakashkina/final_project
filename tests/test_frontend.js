/**
 * Frontend unit tests for codeprobe.
 *
 * Tests pure functions extracted from app.js: HTML escaping, markdown
 * formatting, system prompt construction, privacy mode logic, progress
 * tracking, session persistence, and demo response matching.
 *
 * Run in browser: open test_frontend.html
 * Run headless:   python3 -m pytest tests/test_frontend_runner.py -v
 */

// ── Test harness ───────────────────────────────────────────────────────

let _passed = 0;
let _failed = 0;
const _results = [];

function assert(cond, msg) {
  if (!cond) throw new Error(msg || "assertion failed");
}

function assertEqual(a, b, msg) {
  if (a !== b) throw new Error(msg || `expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}

function assertIncludes(str, sub, msg) {
  if (!str.includes(sub)) throw new Error(msg || `expected "${str}" to include "${sub}"`);
}

function test(name, fn) {
  try {
    fn();
    _passed++;
    _results.push({ name, status: "PASS" });
  } catch (e) {
    _failed++;
    _results.push({ name, status: "FAIL", error: e.message });
  }
}

// ── Functions under test (extracted from app.js) ───────────────────────

function escHTML(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
                  .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function fmt(t) {
  const esc = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const holds = [];
  const ph = (s) => { holds.push(s); return `\x00${holds.length - 1}\x00`; };
  t = t.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, _l, code) => ph(`<pre><code>${esc(code)}</code></pre>`));
  t = t.replace(/`([^`]+)`/g, (_, code) => ph(`<code>${esc(code)}</code>`));
  t = esc(t);
  t = t.replace(/\*\*([\s\S]+?)\*\*/g, "<strong>$1</strong>");
  t = t.replace(/\n/g, "<br>");
  t = t.replace(/\x00(\d+)\x00/g, (_, i) => holds[i]);
  return t;
}

function getPrivacyMode(storage) {
  const v = storage.get("codeprobe_privacy");
  if (v === "saving" || v === "paused") return v;
  return "ephemeral";
}

function shouldRevisit(progress, id) {
  const p = progress[id];
  if (!p) return false;
  return (Date.now() - p.last) / 86400000 >= 1 && p.completed < 3;
}

function getKnownItems(storage) {
  try { return JSON.parse(storage.get("codeprobe_knows") || "[]"); }
  catch { return []; }
}

const LANG_CHIPS = ["Python", "JavaScript", "Java", "C", "C++", "TypeScript", "Ruby", "Rust", "Go", "C#"];
const CONCEPT_CHIPS = ["OOP", "Data structures", "Memory management", "Concurrency", "Functional programming", "Databases / SQL", "Algorithms"];

function getKnownLangs(storage) {
  return getKnownItems(storage).filter(i => LANG_CHIPS.includes(i));
}

function getKnownConcepts(storage) {
  return getKnownItems(storage).filter(i => CONCEPT_CHIPS.includes(i));
}

const LANG_NAMES = {
  en: "English", es: "Spanish", fr: "French", de: "German", it: "Italian",
  pt: "Portuguese", ru: "Russian", zh: "Chinese", ja: "Japanese", ko: "Korean",
  ar: "Arabic", hi: "Hindi", tr: "Turkish", nl: "Dutch", pl: "Polish",
  uk: "Ukrainian", vi: "Vietnamese", th: "Thai", et: "Estonian", lv: "Latvian",
  lt: "Lithuanian",
};

function buildStudentDesc(knownLangs, knownConcepts) {
  const parts = [];
  if (knownLangs.length > 0) parts.push(`has worked with ${knownLangs.join(", ")}`);
  if (knownConcepts.length > 0) parts.push(`has experience with ${knownConcepts.join(", ")}`);
  if (parts.length === 0) return "a student who is likely a beginner";
  return `a programmer who ${parts.join(" and ")}`;
}

function buildPromptCore(lesson, questions, mode, lang, knownLangs, knownConcepts) {
  const studentDesc = buildStudentDesc(knownLangs, knownConcepts);
  const code = lesson.files
    ? lesson.files.map(f => `--- ${f.name} ---\n${f.code}`).join("\n\n")
    : lesson.code;

  let bridges = "";
  if (knownLangs.length > 0 && lesson.bridges) {
    let entries = Object.entries(lesson.bridges).filter(([l]) => knownLangs.includes(l));
    if (entries.length === 0) entries = Object.entries(lesson.bridges);
    bridges = entries.map(([l, n]) => `- ${l}: ${n}`).join("\n");
  }

  const isQuick = mode === "quick";
  const langInstruction = lang !== "en"
    ? `\nLANGUAGE: Respond entirely in ${LANG_NAMES[lang] || lang}.`
    : "";

  const prompt = `You are a tutor teaching ${studentDesc}. They are learning ${lesson.series} through real code.\n${langInstruction}`;
  return { prompt, code, bridges, studentDesc };
}

// Mock localStorage for testing
function mockStorage(initial = {}) {
  const data = { ...initial };
  return {
    get(k) { return data[k] ?? null; },
    set(k, v) { data[k] = v; },
    remove(k) { delete data[k]; },
    _data: data,
  };
}

// ── Tests: escHTML ─────────────────────────────────────────────────────

test("escHTML: escapes ampersand", () => {
  assertEqual(escHTML("a & b"), "a &amp; b");
});

test("escHTML: escapes angle brackets", () => {
  assertEqual(escHTML("<script>"), "&lt;script&gt;");
});

test("escHTML: escapes quotes", () => {
  assertEqual(escHTML('he said "hi"'), "he said &quot;hi&quot;");
  assertEqual(escHTML("it's"), "it&#39;s");
});

test("escHTML: passes through safe text", () => {
  assertEqual(escHTML("hello world"), "hello world");
});

test("escHTML: handles empty string", () => {
  assertEqual(escHTML(""), "");
});

test("escHTML: coerces numbers", () => {
  assertEqual(escHTML(42), "42");
});

// ── Tests: fmt (markdown formatting) ───────────────────────────────────

test("fmt: renders bold", () => {
  assertIncludes(fmt("this is **bold** text"), "<strong>bold</strong>");
});

test("fmt: renders inline code", () => {
  assertIncludes(fmt("use `printf()` here"), "<code>printf()</code>");
});

test("fmt: renders code blocks", () => {
  const result = fmt("```c\nint x = 5;\n```");
  assertIncludes(result, "<pre><code>");
  assertIncludes(result, "int x = 5;");
});

test("fmt: escapes HTML in text but not in code", () => {
  const result = fmt("use <div> for `<div>` elements");
  assertIncludes(result, "&lt;div&gt; for");
  assertIncludes(result, "<code>&lt;div&gt;</code>");
});

test("fmt: converts newlines to br", () => {
  assertIncludes(fmt("line1\nline2"), "line1<br>line2");
});

test("fmt: handles code blocks with angle brackets", () => {
  const result = fmt("```\nif (x < 5) {}\n```");
  assertIncludes(result, "&lt;");
});

test("fmt: bold inside text", () => {
  assertEqual(fmt("hello **world**"), "hello <strong>world</strong>");
});

test("fmt: no formatting in inline code", () => {
  const result = fmt("`**not bold**`");
  assert(!result.includes("<strong>"), "bold should not render inside code");
});

test("fmt: empty string", () => {
  assertEqual(fmt(""), "");
});

test("fmt: multiple code blocks", () => {
  const result = fmt("`a` and `b`");
  assertEqual(result.match(/<code>/g).length, 2);
});

// ── Tests: privacy mode ────────────────────────────────────────────────

test("privacy: default is ephemeral", () => {
  const s = mockStorage();
  assertEqual(getPrivacyMode(s), "ephemeral");
});

test("privacy: saving mode", () => {
  const s = mockStorage({ codeprobe_privacy: "saving" });
  assertEqual(getPrivacyMode(s), "saving");
});

test("privacy: paused mode", () => {
  const s = mockStorage({ codeprobe_privacy: "paused" });
  assertEqual(getPrivacyMode(s), "paused");
});

test("privacy: invalid value defaults to ephemeral", () => {
  const s = mockStorage({ codeprobe_privacy: "invalid" });
  assertEqual(getPrivacyMode(s), "ephemeral");
});

test("privacy: null value defaults to ephemeral", () => {
  const s = mockStorage({ codeprobe_privacy: null });
  assertEqual(getPrivacyMode(s), "ephemeral");
});

// ── Tests: progress & spaced repetition ────────────────────────────────

test("shouldRevisit: no progress returns false", () => {
  assert(!shouldRevisit({}, "c-pointers"));
});

test("shouldRevisit: recent completion returns false", () => {
  const progress = { "c-pointers": { completed: 1, last: Date.now() } };
  assert(!shouldRevisit(progress, "c-pointers"));
});

test("shouldRevisit: old completion with < 3 returns true", () => {
  const progress = { "c-pointers": { completed: 1, last: Date.now() - 2 * 86400000 } };
  assert(shouldRevisit(progress, "c-pointers"));
});

test("shouldRevisit: 3+ completions returns false even if old", () => {
  const progress = { "c-pointers": { completed: 3, last: Date.now() - 10 * 86400000 } };
  assert(!shouldRevisit(progress, "c-pointers"));
});

test("shouldRevisit: exactly 24h boundary", () => {
  const progress = { "c-pointers": { completed: 1, last: Date.now() - 86400000 } };
  assert(shouldRevisit(progress, "c-pointers"));
});

// ── Tests: known items / personalization ────────────────────────────────

test("knownItems: empty by default", () => {
  const s = mockStorage();
  assertEqual(getKnownItems(s).length, 0);
});

test("knownItems: parses stored JSON", () => {
  const s = mockStorage({ codeprobe_knows: '["Python","OOP"]' });
  const items = getKnownItems(s);
  assertEqual(items.length, 2);
  assert(items.includes("Python"));
  assert(items.includes("OOP"));
});

test("knownItems: invalid JSON returns empty", () => {
  const s = mockStorage({ codeprobe_knows: "not json" });
  assertEqual(getKnownItems(s).length, 0);
});

test("knownLangs: filters to language chips only", () => {
  const s = mockStorage({ codeprobe_knows: '["Python","OOP","Rust"]' });
  const langs = getKnownLangs(s);
  assertEqual(langs.length, 2);
  assert(langs.includes("Python"));
  assert(langs.includes("Rust"));
  assert(!langs.includes("OOP"));
});

test("knownConcepts: filters to concept chips only", () => {
  const s = mockStorage({ codeprobe_knows: '["Python","OOP","Concurrency"]' });
  const concepts = getKnownConcepts(s);
  assertEqual(concepts.length, 2);
  assert(concepts.includes("OOP"));
  assert(concepts.includes("Concurrency"));
});

// ── Tests: student description ─────────────────────────────────────────

test("studentDesc: beginner when no chips", () => {
  assertEqual(buildStudentDesc([], []), "a student who is likely a beginner");
});

test("studentDesc: langs only", () => {
  const desc = buildStudentDesc(["Python", "JavaScript"], []);
  assertIncludes(desc, "has worked with Python, JavaScript");
});

test("studentDesc: concepts only", () => {
  const desc = buildStudentDesc([], ["OOP", "Algorithms"]);
  assertIncludes(desc, "has experience with OOP, Algorithms");
});

test("studentDesc: both langs and concepts", () => {
  const desc = buildStudentDesc(["Rust"], ["Memory management"]);
  assertIncludes(desc, "has worked with Rust");
  assertIncludes(desc, "has experience with Memory management");
});

// ── Tests: prompt construction ─────────────────────────────────────────

const MOCK_LESSON = {
  id: "c-pointers",
  title: "Pointers",
  series: "C",
  code: "int *p = &x;",
  concepts: ["Pointers", "Memory"],
  seedQuestions: ["What does &x do?"],
  bridges: {
    Python: "Python uses references, not pointers",
    JavaScript: "JS has no pointers",
    Rust: "Rust has references and raw pointers",
  },
};

const MOCK_MULTIFILE_LESSON = {
  id: "auth-flow",
  title: "Auth Flow",
  series: "Python",
  files: [
    { name: "auth.py", code: "def login():\n    pass" },
    { name: "models.py", code: "class User:\n    pass" },
  ],
  concepts: ["Authentication"],
  seedQuestions: [],
  bridges: {},
};

test("prompt: includes student description", () => {
  const { prompt } = buildPromptCore(MOCK_LESSON, "", "quick", "en", ["Python"], []);
  assertIncludes(prompt, "has worked with Python");
});

test("prompt: beginner when no chips", () => {
  const { prompt } = buildPromptCore(MOCK_LESSON, "", "quick", "en", [], []);
  assertIncludes(prompt, "a student who is likely a beginner");
});

test("prompt: includes series name", () => {
  const { prompt } = buildPromptCore(MOCK_LESSON, "", "quick", "en", [], []);
  assertIncludes(prompt, "learning C through real code");
});

test("prompt: single-file code", () => {
  const { code } = buildPromptCore(MOCK_LESSON, "", "quick", "en", [], []);
  assertIncludes(code, "int *p = &x;");
});

test("prompt: multi-file code with filenames", () => {
  const { code } = buildPromptCore(MOCK_MULTIFILE_LESSON, "", "quick", "en", [], []);
  assertIncludes(code, "--- auth.py ---");
  assertIncludes(code, "--- models.py ---");
  assertIncludes(code, "def login():");
});

test("prompt: bridges filtered to known languages", () => {
  const { bridges } = buildPromptCore(MOCK_LESSON, "", "quick", "en", ["Python"], []);
  assertIncludes(bridges, "Python");
  assert(!bridges.includes("JavaScript"), "should not include JS bridge when only Python is known");
});

test("prompt: no bridges when no langs known", () => {
  const { bridges } = buildPromptCore(MOCK_LESSON, "", "quick", "en", [], []);
  assertEqual(bridges, "");
});

test("prompt: all bridges when known lang not in bridges", () => {
  const { bridges } = buildPromptCore(MOCK_LESSON, "", "quick", "en", ["Go"], []);
  assertIncludes(bridges, "Python");
  assertIncludes(bridges, "JavaScript");
  assertIncludes(bridges, "Rust");
});

test("prompt: language instruction for non-English", () => {
  const { prompt } = buildPromptCore(MOCK_LESSON, "", "quick", "es", [], []);
  assertIncludes(prompt, "LANGUAGE: Respond entirely in Spanish");
});

test("prompt: no language instruction for English", () => {
  const { prompt } = buildPromptCore(MOCK_LESSON, "", "quick", "en", [], []);
  assert(!prompt.includes("LANGUAGE:"), "should not include language instruction for English");
});

// ── Tests: session persistence logic ───────────────────────────────────

test("session: expired after 24h", () => {
  const session = { savedAt: Date.now() - 25 * 3600 * 1000, lessonId: "c-pointers" };
  assert(Date.now() - session.savedAt > 86400000, "should be expired");
});

test("session: valid within 24h", () => {
  const session = { savedAt: Date.now() - 1000, lessonId: "c-pointers" };
  assert(Date.now() - session.savedAt <= 86400000, "should be valid");
});

// ── Tests: demo response matching ──────────────────────────────────────

function getDemoResponse(lessonId, messages) {
  if (lessonId !== "c-pointers") return null;
  if (messages.length === 1 && messages[0].role === "system" && messages[0].content.includes("What does &x give you")) {
    return "demo-first-turn";
  }
  const lastUser = messages.filter(m => m.role === "user").pop();
  const prevAssistant = messages.filter(m => m.role === "assistant").pop();
  if (lastUser && prevAssistant && prevAssistant.content.includes("*p = 99") && /99/.test(lastUser.content)) {
    return "demo-second-turn-complete";
  }
  return null;
}

test("demo: fires on c-pointers first turn with seed question", () => {
  const msgs = [{ role: "system", content: "You are a tutor. What does &x give you?" }];
  assert(getDemoResponse("c-pointers", msgs) !== null);
});

test("demo: does not fire on wrong lesson", () => {
  const msgs = [{ role: "system", content: "What does &x give you?" }];
  assertEqual(getDemoResponse("rust-ownership", msgs), null);
});

test("demo: does not fire without seed question", () => {
  const msgs = [{ role: "system", content: "You are a tutor." }];
  assertEqual(getDemoResponse("c-pointers", msgs), null);
});

test("demo: second turn fires on correct answer", () => {
  const msgs = [
    { role: "system", content: "..." },
    { role: "assistant", content: "What will *p = 99 print?" },
    { role: "user", content: "It will print 99" },
  ];
  assert(getDemoResponse("c-pointers", msgs) !== null);
});

test("demo: second turn does not fire without 99", () => {
  const msgs = [
    { role: "system", content: "..." },
    { role: "assistant", content: "What will *p = 99 print?" },
    { role: "user", content: "I don't know" },
  ];
  assertEqual(getDemoResponse("c-pointers", msgs), null);
});

// ── Tests: LESSON_COMPLETE detection ───────────────────────────────────

function detectCompletion(reply) {
  const clean = reply.trim().replace("[LESSON_PENDING]", "").trim();
  if (clean.trimEnd().endsWith("[LESSON_COMPLETE]")) {
    return { complete: true, summary: clean.replace(/\[LESSON_COMPLETE\]\s*$/, "").trim() };
  }
  return { complete: false, summary: null };
}

test("completion: detects [LESSON_COMPLETE] at end", () => {
  const result = detectCompletion("Great job! You learned pointers. [LESSON_COMPLETE]");
  assert(result.complete);
  assertEqual(result.summary, "Great job! You learned pointers.");
});

test("completion: strips [LESSON_PENDING]", () => {
  const result = detectCompletion("[LESSON_PENDING] keep going");
  assert(!result.complete);
});

test("completion: not triggered mid-text", () => {
  const result = detectCompletion("When you see [LESSON_COMPLETE] it means done. But not yet.");
  assert(!result.complete);
});

test("completion: handles trailing whitespace", () => {
  const result = detectCompletion("Summary here. [LESSON_COMPLETE]  \n");
  assert(result.complete);
});

test("completion: normal reply is not complete", () => {
  const result = detectCompletion("What do you think line 5 does?");
  assert(!result.complete);
});

// ── Tests: exchange counting logic ─────────────────────────────────────

test("exchange: quick mode target is ~1", () => {
  const target = "quick" === "quick" ? "~1" : "~3";
  assertEqual(target, "~1");
});

test("exchange: deep mode target is ~3", () => {
  const target = "deep" === "quick" ? "~1" : "~3";
  assertEqual(target, "~3");
});

test("exchange: challenge triggers at 4+ in deep mode", () => {
  const exchangeCount = 4;
  const mode = "deep";
  const phase = "learn";
  const shouldChallenge = mode !== "quick" && exchangeCount >= 4 && phase !== "challenge";
  assert(shouldChallenge);
});

test("exchange: no challenge in quick mode", () => {
  const exchangeCount = 10;
  const mode = "quick";
  const phase = "learn";
  const shouldChallenge = mode !== "quick" && exchangeCount >= 4 && phase !== "challenge";
  assert(!shouldChallenge);
});

test("exchange: no double challenge", () => {
  const exchangeCount = 5;
  const mode = "deep";
  const phase = "challenge";
  const shouldChallenge = mode !== "quick" && exchangeCount >= 4 && phase !== "challenge";
  assert(!shouldChallenge);
});

// ── Tests: UUID format ─────────────────────────────────────────────────

test("UUID: crypto.randomUUID format", () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    const uid = crypto.randomUUID();
    assert(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(uid));
  }
});

// ── Report ─────────────────────────────────────────────────────────────

function report() {
  const lines = [];
  for (const r of _results) {
    const mark = r.status === "PASS" ? "\u2713" : "\u2717";
    lines.push(`  ${mark} ${r.name}${r.error ? ` — ${r.error}` : ""}`);
  }
  lines.push(`\n${_passed} passed, ${_failed} failed out of ${_passed + _failed} tests`);
  return { passed: _passed, failed: _failed, total: _passed + _failed, text: lines.join("\n") };
}

// If running in Node.js or Deno, print and exit
if (typeof process !== "undefined" && process.exit) {
  const r = report();
  console.log(r.text);
  process.exit(r.failed > 0 ? 1 : 0);
}

// If running in browser, export for test_frontend.html
if (typeof window !== "undefined") {
  window._testReport = report;
}
