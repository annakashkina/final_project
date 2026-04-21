export const mlLessons = { name: "How the line validator works", lessons: [
  {
    id: "ml-problem",
    title: "The Problem: Wrong Line Numbers",
    difficulty: "Project",
    icon: "🎯",
    description:
      "The AI tutor references specific lines of code — but often gets the numbers wrong. This is how we detect and fix that.",
    concepts: [
      "Why LLMs hallucinate line numbers (off-by-1, off-by-2)",
      "Why a second LLM can't reliably self-correct",
      "Binary classification + correction as an ML task",
      "Post-processing: invisible to the user, runs in milliseconds",
    ],
    bridges: {
      Python: "Think of it like a spell-checker for line numbers — it runs after the LLM responds, before the student sees anything.",
      JavaScript: "Like a middleware function: response comes in, line refs get validated/fixed, clean response goes out.",
      Java: "Like a filter in a servlet chain — intercepts the response, fixes line refs, passes it through.",
    },
    files: [
      {
        name: "the_problem.py",
        code: `# Real example from codeprobe chat data.
# The C code the tutor is teaching:

code = """
Line 1:  #include <stdio.h>
Line 2:  (empty)
Line 3:  int main(void) {
...
Line 14:     switch (grade) {
Line 15:         case 10:
Line 16:         case 9:  printf("A\\n"); break;
Line 17:         case 8:  printf("B\\n");        // <- THIS
Line 18:         case 7:  printf("C\\n"); break; // <- AND THIS
Line 19:         default: printf("F\\n");
Line 20:     }
"""

# What the tutor said:
#   "Look at lines 18-20 where the fall-through happens"
#   "The switch starting on line 16"
#
# What's actually there:
#   Fall-through is on lines 17-18 (off by 1, includes closing brace)
#   Switch starts on line 14 (off by 2)
#
# From our validation data: 50% of line references are WRONG.
# This directly hits research Insight #5:
#   "Confident wrongness destroys trust."

# Why can't the LLM just fix itself?
# - The SAME model that miscounted will miscount again
# - A SECOND LLM is slow, expensive, and also hallucinates
# - A TRAINED model: runs in ms, deterministic, purpose-built`,
      },
      {
        name: "architecture.py",
        code: `# The validator sits between the LLM and the student.
# It's invisible — zero overhead for the user.

# Pipeline:
#   1. Student asks question
#   2. LLM generates tutor response (with line references)
#   3. >>> Validator checks each "line N" reference <<<
#   4. If wrong → correct it (find the right line)
#   5. Student sees clean, accurate response

# For multi-file lessons, the LLM sees global line numbers:
#   --- main.rs ---        (global lines 1-38)
#   --- config.rs ---      (global lines 40-59)
#   --- search.rs ---      (global lines 61-97)
#
# The student sees per-file tabs with local numbering.
# Post-processing translates: global 48 → config.rs line 8

def global_to_local(global_line, file_boundaries):
    """Translate a global line number to (filename, local_line)."""
    for filename, start, end in file_boundaries:
        if start <= global_line <= end:
            return filename, global_line - start + 1
    return None, global_line  # fallback: not in any file`,
      },
    ],
    seedQuestions: [
      "Why can't we just ask the LLM to double-check its own line numbers?",
      "How does the validator know what the 'correct' line is?",
      "What happens with multi-file lessons where each file has its own line numbers?",
    ],
  },

  {
    id: "ml-extraction",
    title: "Extracting Line References",
    difficulty: "Project",
    icon: "🔍",
    description:
      "A regex finds every 'line N' and 'lines N-M' in the tutor's response, then grabs the surrounding sentence as context for verification.",
    concepts: [
      "Regex pattern for single and range references (line 5, lines 5-11)",
      "Context extraction: finding sentence boundaries around each match",
      "Identifier extraction: backtick spans vs bare tokens",
      "Stopword and keyword filtering for discriminative identifiers",
    ],
    bridges: {
      Python: "re.finditer walks through all matches. The for/else pattern tries multiple boundary markers — else runs if none matched.",
      JavaScript: "Like String.matchAll() — iterates regex matches. The context extraction is like finding the nearest period or newline.",
      Java: "Like Pattern/Matcher — compile once, find all matches. The boundary search is indexOf/lastIndexOf with fallbacks.",
    },
    files: [
      {
        name: "line_refs.py",
        code: `import re

# Matches: "line 5", "Line 18", "lines 5-11", "lines 13\\u201319"
LINE_REF_RE = re.compile(r"[Ll]ines?\\s+(\\d+)(?:\\s*[-\\u2013]\\s*(\\d+))?")

def extract_line_refs(text):
    """Extract every line reference from a tutor response.
    Returns list of {raw, start, end, context}."""
    refs = []
    for match in LINE_REF_RE.finditer(text):
        start = int(match.group(1))
        end = int(match.group(2)) if match.group(2) else None

        # Grab the surrounding sentence as context.
        # Search backwards for the nearest boundary:
        pos = match.start()
        ctx_start = pos
        for boundary in (". ", ".\\n", "\\n\\n", "\\n"):
            idx = text.rfind(boundary, max(0, pos - 200), pos)
            if idx != -1:
                ctx_start = idx + len(boundary)
                break
        else:
            ctx_start = max(0, pos - 150)  # fallback

        # Search forward for the end of the sentence:
        ctx_end = pos + len(match.group(0))
        for boundary in (". ", ".\\n", "\\n\\n", "\\n"):
            idx = text.find(boundary, ctx_end)
            if idx != -1 and idx < ctx_end + 200:
                ctx_end = idx + 1
                break
        else:
            ctx_end = min(len(text), ctx_end + 150)

        refs.append({
            "raw": match.group(0),       # "lines 18-20"
            "start": start,               # 18
            "end": end,                    # 20 (or None)
            "context": text[ctx_start:ctx_end].strip(),
        })
    return refs`,
      },
      {
        name: "identifiers.py",
        code: `# After extracting a reference, we need identifiers from
# the surrounding text to match against code lines.
#
# "Look at line 17, when \`grade\` matches case 8" →
#   backtick ids: {"grade"}
#   bare tokens:  {"matches", "case", ...}
#   after filtering: {"grade"}  (case/matches are keywords)

_STOPWORDS = frozenset("the and but for not you all ...".split())
_CODE_KEYWORDS = frozenset(
    "int char void if else for while switch case default "
    "break return def fn let mut printf println".split()
)

def extract_identifiers(text):
    """Pull code identifiers from text near a line reference."""
    ids = set()

    # Strongest signal: backtick-quoted code spans
    for span in re.findall(r"\`([^\`]+)\`", text):
        tokens = re.findall(r"[a-zA-Z_]\\w*", span)
        ids.update(tokens)

    # Weaker signal: bare code-like tokens
    for tok in re.findall(r"\\b[a-z_]\\w*\\b", text):
        if len(tok) > 2:
            ids.add(tok)

    # Filter out noise: English words + language keywords
    return {
        t for t in ids
        if t.lower() not in _STOPWORDS
        and t.lower() not in _CODE_KEYWORDS
        and len(t) > 1
    }

# Why filter keywords? Because \`case\`, \`break\`, \`printf\`
# appear on MANY lines in a switch statement. They match
# everywhere — low discriminative value. We want identifiers
# like \`grade\`, \`score\`, \`Config\` that pinpoint ONE line.`,
      },
    ],
    seedQuestions: [
      "Why does the regex need to handle both 'line 5' and 'lines 5-11'?",
      "What's the for/else pattern doing in the context extraction?",
      "Why are language keywords filtered out of identifiers?",
      "What happens if no identifiers can be extracted?",
    ],
  },

  {
    id: "ml-verification",
    title: "Verifying References",
    difficulty: "Project",
    icon: "✅",
    description:
      "Each extracted reference is scored against every line of code. If a nearby line scores higher than the referenced one, the reference is probably wrong.",
    concepts: [
      "Substring matching: backtick-quoted code appearing literally on the line",
      "Identifier overlap scoring: count shared tokens between context and code line",
      "Best-match search: score all lines, compare referenced vs top scorer",
      "Three outcomes: correct, wrong (with suggested fix), uncertain",
    ],
    bridges: {
      Python: "Like a search engine ranking — each code line gets a relevance score, and we check if the referenced line ranks #1.",
      JavaScript: "Like Array.map to score each line, then Array.sort to find the best. If the referenced line isn't top, it's wrong.",
      Java: "Like a comparator-based ranking — score each line by overlap, pick the max, compare against the referenced line.",
    },
    files: [
      {
        name: "line_refs.py",
        code: `def verify_ref(ref, code_lines):
    """Verify one line reference against actual code (1-indexed).
    Returns {valid: True/False/None, best_match_line, ...}."""
    start = ref["start"]
    end = ref["end"] or start
    total = len(code_lines)

    result = {"in_bounds": 1 <= start <= total and 1 <= end <= total}

    if not result["in_bounds"]:
        result["valid"] = False
        result["reason"] = "out_of_bounds"
        return result

    ref_content = "\\n".join(code_lines[start - 1 : end])

    # ── Fast path: backtick-quoted code on the referenced line ──
    # If the tutor wrote \`printf("B")\` and that string appears
    # on the referenced line, it's almost certainly correct.
    spans = _backtick_spans(ref["context"])
    ref_block = " ".join(code_lines[start - 1 : end])
    if any(span in ref_block for span in spans if len(span) > 2):
        result["valid"] = True
        result["reason"] = "backtick_substring_match"
        return result

    # ── Identifier overlap scoring ──
    ids = extract_identifiers(ref["context"])
    if not ids:
        result["valid"] = None  # can't determine
        result["reason"] = "no_identifiers_to_check"
        return result

    # Score EVERY code line by how many context identifiers it has
    scores = []
    for i, line in enumerate(code_lines, 1):
        line_tokens = set(re.findall(r"[a-zA-Z_]\\w*", line))
        overlap = ids & line_tokens
        scores.append((i, len(overlap)))

    scores.sort(key=lambda x: x[1], reverse=True)
    best_line, best_score = scores[0]

    # Score for the referenced line range
    ref_score = max(
        len(ids & set(re.findall(r"[a-zA-Z_]\\w*", code_lines[i-1])))
        for i in range(start, min(end, total) + 1)
    )

    # Decision: is the referenced line the best match?
    result["valid"] = ref_score >= best_score or (
        ref_score > 0
        and abs(start - best_line) <= 1
        and ref_score >= best_score - 1
    )
    result["best_match_line"] = best_line
    return result`,
      },
      {
        name: "examples.py",
        code: `# Example: tutor says "Look at lines 18-20 where fall-through happens"
#
# Code:
#   line 17: case 8:  printf("B\\n");        // prints B
#   line 18: case 7:  printf("C\\n"); break; // ...AND C!
#   line 19: default: printf("F\\n");
#   line 20: }                                // closing brace
#
# Context identifiers (after filtering): (none meaningful)
# Result: uncertain (no_identifiers_to_check)
#
# But if the tutor says:
#   "line 17 where \`grade\` matches case 8 and prints B"
#
# Identifiers: {"grade"}
#   line 13: int grade = 8;         → score 1 (has "grade")
#   line 14: switch (grade) {       → score 1
#   line 17: case 8: printf("B")   → score 0
# Best match: line 13 (score 1), ref line 17 (score 0)
# Result: WRONG, best_match = 13
#
# This shows the limitation: "grade" appears where it's
# DECLARED, not where case 8 is. The identifier heuristic
# can produce false negatives. That's exactly why we need
# an ML model with richer features — not just token overlap.
#
# Future features for the ML model:
#   - TF-IDF cosine similarity (context ↔ code line)
#   - AST-aware matching (function boundaries, scope)
#   - Embedding cosine similarity (semantic, not lexical)
#   - File boundary awareness (multi-file lessons)
#   - Distance from last referenced line (locality)`,
      },
    ],
    seedQuestions: [
      "Why check backtick substrings before doing identifier overlap?",
      "What does 'ref_score >= best_score - 1 and abs <= 1' handle?",
      "Why can the identifier heuristic produce false negatives?",
      "What would an ML model use instead of just token overlap?",
    ],
  },

  {
    id: "ml-datagen",
    title: "Generating Training Data",
    difficulty: "Project",
    icon: "🏭",
    description:
      "The pipeline loads every lesson, builds prompts matching the real app, calls two LLMs, and extracts verified line references — all resumable and rate-limited.",
    concepts: [
      "Lesson extraction: parsing JS with Node's vm module",
      "Prompt construction: replicating buildPrompt() from app.js",
      "50/50 model split: Kimi K2 + gpt-oss-120b for diversity",
      "Resumability: JSONL append + ID-based skip on restart",
    ],
    bridges: {
      Python: "subprocess.run calls Node.js, json.loads parses the output. The pipeline is a classic ETL: extract lessons, transform via LLM, load into JSONL.",
      JavaScript: "The Node.js extractor uses vm.runInNewContext — like eval() but sandboxed. It converts ES module exports to context assignments.",
      Java: "Like a batch processing pipeline with checkpointing — each entry gets a unique ID, and on restart the pipeline skips already-processed IDs.",
    },
    files: [
      {
        name: "extract_lessons.js",
        code: `// Problem: lesson files are ES modules (export const cLessons = ...)
// but we need to read them from Node.js CommonJS.
// Solution: read as text, rewrite "export const X =" to "this.X =",
// then evaluate in a sandboxed context.

const fs = require("fs");
const vm = require("vm");

const files = ["c.js", "cpp.js", "python.js", "ruby.js",
               "rust.js", "typescript.js"];

const allLessons = [];
for (const f of files) {
  let code = fs.readFileSync("lessons/" + f, "utf8");

  // "export const cLessons =" → "this.cLessons ="
  // Now the variable lands on the sandbox context object
  code = code.replace(
    /^export\\s+const\\s+(\\w+)\\s*=/gm,
    "this.$1 ="
  );

  const ctx = {};
  vm.runInNewContext(code, ctx);  // sandboxed eval

  for (const k of Object.keys(ctx)) {
    const obj = ctx[k];
    if (obj && Array.isArray(obj.lessons)) {
      for (const lesson of obj.lessons) {
        lesson.series = obj.name;  // "C", "Rust", etc.
        allLessons.push(lesson);
      }
    }
  }
}
// Output: 61+ lessons as JSON on stdout
process.stdout.write(JSON.stringify(allLessons));`,
      },
      {
        name: "generate.py",
        code: `# The generation loop. For each lesson x seed question:
#   1. Pick model (alternating 50/50 for balanced data)
#   2. Pick student profile (beginner through experienced)
#   3. Build the system prompt (same format as real app)
#   4. Call the LLM, extract line refs, verify
#   5. Write to JSONL (append mode = resumable)

TUTOR_MODELS = [
    "moonshotai/kimi-k2-instruct",  # current production model
    "openai/gpt-oss-120b",          # likely replacement
]

def generate(args):
    existing = set()  # load IDs from existing output
    if out_path.exists():
        for line in open(out_path):
            existing.add(json.loads(line).get("id", ""))

    model_idx = 0
    for lesson in lessons:
        questions = list(lesson["seedQuestions"]) + [None]
        for q_idx, question in enumerate(questions):
            model = TUTOR_MODELS[model_idx % len(TUTOR_MODELS)]
            model_idx += 1

            entry_id = f"{lesson['id']}_q{q_idx}_{model[-10:]}"
            if entry_id in existing:
                continue  # already done — skip

            prompt = build_prompt(lesson, question, profile, mode)
            reply = call_llm(messages, model, api_key)

            refs = extract_line_refs(reply)
            for ref in refs:
                ref["verification"] = verify_ref(ref, code_lines)

            # Append to JSONL — if we crash, re-run picks up here
            outfile.write(json.dumps(entry) + "\\n")
            outfile.flush()

            time.sleep(2.5)  # Groq rate limit: 30 req/min`,
      },
      {
        name: "results.py",
        code: `# Results from data generation:
#
#   274 API calls (137 Kimi K2 + 137 gpt-oss-120b)
#   274 entries, 233 (85%) contain line references
#   742 total line references extracted
#
#   LLM-verified labels:
#     235 correct  (32%)
#     494 wrong    (67%)
#      13 uncertain (1%)
#
# Plus 36 references from real user conversations
# (validation set — never used for training).
#
# The 85% rate shows the prompt bias works: production
# responses have line refs ~18% of the time, but adding
# "ALWAYS reference specific line numbers" to the system
# prompt pushed it to 85%.
#
# The 67% "wrong" rate reflects LLM-verified ground truth
# (not just heuristic matching). Real tutor error rate is
# ~30-50% — plenty of signal for training a classifier.`,
      },
    ],
    seedQuestions: [
      "Why alternate models instead of running all with one then the other?",
      "How does the resumability work — what if the script crashes mid-run?",
      "Why add 'ALWAYS reference specific line numbers' to the prompt?",
      "What's the vm.runInNewContext trick doing with the lesson files?",
    ],
  },

  {
    id: "ml-realdata",
    title: "Processing Real Conversations",
    difficulty: "Project",
    icon: "📊",
    description:
      "Real user conversations become the validation set — the ground truth the trained model must get right, from data it never saw during training.",
    concepts: [
      "Chat JSONL format: messages array + reply + model + timestamp",
      "Extracting code from system prompts (the code block the tutor teaches)",
      "Train/validation split: synthetic for training, real for evaluation",
      "Why real data matters: synthetic errors may not match real error patterns",
    ],
    bridges: {
      Python: "pathlib.Path.glob finds all chat files. json.loads parses one line at a time — JSONL is just JSON-per-line, no array wrapper.",
      JavaScript: "Like fs.readdirSync + filter — find all *_chat.jsonl files. Each line is independent JSON, parsed with JSON.parse().",
      Java: "Like Files.walk with a glob filter. JSONL is a streaming format — process one line at a time, no need to load everything into memory.",
    },
    files: [
      {
        name: "process_real_data.py",
        code: `def process(args):
    chat_files = sorted(data_dir.glob("*_chat.jsonl"))

    for chat_file in chat_files:
        uid = chat_file.stem.replace("_chat", "")

        for line_num, raw_line in enumerate(open(chat_file), 1):
            entry = json.loads(raw_line)

            reply = entry.get("reply", "")
            if not reply or entry.get("failed"):
                continue  # skip failed retries

            # The code lives inside the system prompt:
            #   "CODE:\\n\\\`\\\`\\\`\\n...actual code...\\n\\\`\\\`\\\`"
            code = extract_code_from_system(entry["messages"])
            code_lines = code.split("\\n")

            refs = extract_line_refs(reply)
            if not refs:
                continue  # no line references in this reply

            for ref in refs:
                ref["verification"] = verify_ref(ref, code_lines)

            # Same JSONL format as training data
            result = {
                "id": f"real_{uid[:8]}_{line_num}",
                "source": "real_data",
                "code": code,
                "response": reply,
                "line_refs": verified_refs,
            }
            out.write(json.dumps(result) + "\\n")`,
      },
      {
        name: "chat_format.jsonl",
        code: `// Each line in a _chat.jsonl file is one LLM exchange:
// (This is the actual format from the codeprobe server)
//
// {
//   "ts": 1775074441949,
//   "model": "moonshotai/kimi-k2-instruct",
//   "messages": [
//     {"role": "system", "content": "You are a tutor...CODE:\\n\\\`\\\`\\\`\\n#include..."},
//     {"role": "user",   "content": "What prints when grade is 8?"},
//     {"role": "assistant", "content": "Look at line 17..."},
//     {"role": "user",   "content": "I think it prints B and C"}
//   ],
//   "reply": "Exactly! Because there's no break after case 8..."
// }
//
// The system message contains the FULL code being taught.
// The reply is the tutor's latest response.
// Failed retries have "failed": true — we skip those.
//
// Result from processing real user data:
//   26 entries with line references
//   36 total references
//   14 correct, 22 wrong (LLM-verified)
//
// This is NEVER used for training — only for evaluating
// how well the model performs on real-world data.`,
      },
    ],
    seedQuestions: [
      "Why keep real data separate from synthetic data?",
      "How does the script find the code inside the system prompt?",
      "What's the difference between an entry with 'failed: true' and a normal one?",
      "Why is 36 references enough for a validation set?",
    ],
  },
  {
    id: "ml-features",
    title: "28 Features Per Reference",
    difficulty: "Project",
    icon: "\u{1F9EC}",
    description:
      "Each line reference becomes a vector of 28 numbers. The features capture code structure, identifier overlap, TF-IDF similarity, and neighbor analysis.",
    concepts: [
      "Feature groups: reference properties, line content, backtick matching, identifiers, neighbors, TF-IDF",
      "TF-IDF cosine similarity: how semantically close is the context to each code line",
      "Neighbor analysis: is there a better-matching line within \u00B13 of the referenced one",
      "Label source: LLM-verified verdicts (correct/wrong) from verify_with_llm.py",
    ],
    bridges: {
      Python: "Each feature is a float in a list. sklearn expects a 2D numpy array — rows are samples, columns are features.",
      JavaScript: "Like building a profile object for each reference, then flattening it to an array of numbers for the model.",
    },
    files: [
      {
        name: "extract_features.py",
        code: `import math, re
from collections import Counter

def extract_features(ref, code_lines, full_response):
    start = ref["start"]
    end = ref.get("end") or start
    total = len(code_lines)
    context = ref.get("context", "")
    ref_line = code_lines[start - 1]

    # ---- Reference properties (6) ----
    relative_position = start / total
    is_range = 1 if ref.get("end") else 0
    range_size = end - start + 1

    # ---- Line content (5) ----
    ref_blank = 1 if re.match(r"^\\s*$", ref_line) else 0
    ref_comment = 1 if re.match(r"^\\s*(//|#)", ref_line) else 0
    ref_code_len = len(ref_line.strip())
    ref_indent = len(ref_line) - len(ref_line.lstrip())
    ref_has_brace = 1 if re.search(r"[{}]", ref_line) else 0

    # ---- Backtick matching (4) ----
    spans = re.findall(r"\`([^\`]+)\`", context)
    ref_block = " ".join(code_lines[start-1:end])
    backtick_match = 1 if any(s in ref_block for s in spans) else 0

    # ---- Identifier overlap (6) ----
    ids = extract_identifiers(context)
    def line_score(i):
        toks = set(re.findall(r"[a-zA-Z_]\\w*", code_lines[i]))
        return len(ids & toks)
    ref_score = max(line_score(i) for i in range(start-1, end))
    all_scores = [(i, line_score(i)) for i in range(total)]
    all_scores.sort(key=lambda x: x[1], reverse=True)
    best_line, best_score = all_scores[0]
    id_ratio = ref_score / best_score if best_score > 0 else 1.0

    # ---- TF-IDF cosine similarity (2) ----
    ctx_tokens = tokenize(context)
    line_tokens = [tokenize(l) for l in code_lines]
    tfidf = compute_tfidf(line_tokens + [ctx_tokens])
    ctx_vec = tfidf[-1]
    tfidf_ref = cosine_sim(ctx_vec, tfidf[start - 1])
    tfidf_best = max(cosine_sim(ctx_vec, tfidf[i]) for i in range(total))

    # ---- Neighbor analysis (3) ----
    neighborhood = range(max(0, start-4), min(total, end+3))
    neighbor_max = max(line_score(i) for i in neighborhood)
    neighbor_better = 1 if neighbor_max > ref_score else 0

    return [start, total, relative_position, is_range, ...]
    # 28 features total → one row in the CSV`,
      },
      {
        name: "tfidf.py",
        code: `# TF-IDF: Term Frequency * Inverse Document Frequency
# Each code line is a "document". The context is another.
# Cosine similarity measures how close they are.

def compute_tfidf(documents):
    n = len(documents)
    df = Counter()  # how many docs contain each token
    for doc in documents:
        df.update(set(doc))

    results = []
    for doc in documents:
        tf = Counter(doc)
        total = len(doc) if doc else 1
        tfidf = {}
        for token, count in tf.items():
            idf = math.log((n + 1) / (df[token] + 1)) + 1
            tfidf[token] = (count / total) * idf
        results.append(tfidf)
    return results

def cosine_sim(v1, v2):
    common = set(v1) & set(v2)
    if not common:
        return 0.0
    dot = sum(v1[k] * v2[k] for k in common)
    n1 = math.sqrt(sum(v**2 for v in v1.values()))
    n2 = math.sqrt(sum(v**2 for v in v2.values()))
    return dot / (n1 * n2)

# Why TF-IDF and not just word overlap?
# "printf" appears on 10 lines → low IDF → low weight
# "grade" appears on 2 lines → high IDF → high weight
# TF-IDF automatically focuses on discriminative tokens`,
      },
    ],
    seedQuestions: [
      "Why is neighbor analysis important \u2014 what pattern does it catch?",
      "What does it mean when id_ratio is low but tfidf_ratio is high?",
      "Why use TF-IDF instead of raw identifier count?",
      "How does the pipeline handle references to blank or comment lines?",
    ],
  },

  {
    id: "ml-training",
    title: "Training & Deployment",
    difficulty: "Project",
    icon: "\u{1F52C}",
    description:
      "Six classifier candidates compete. The winner is selected by validation F1, serialized to a 2.5KB pickle, and deployed as a post-processor that runs in 5ms.",
    concepts: [
      "6 model candidates: GradientBoosting (x3), RandomForest (x2), LogisticRegression",
      "5-fold stratified cross-validation on training set, final selection by validation F1",
      "Conservative correction: model flags it, but heuristics decide the fix (\u00B13 lines max)",
      "Production constraint: ~5ms per response, no GPU, stdlib + sklearn + numpy only",
    ],
    bridges: {
      Python: "sklearn's fit/predict API. pickle serializes the trained model. numpy arrays hold feature vectors.",
      JavaScript: "The model is a black box: features in \u2192 probability out. The correction logic is plain if/else \u2014 no ML needed for the fix itself.",
    },
    files: [
      {
        name: "train_model.py",
        code: `from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import StratifiedKFold, cross_val_score
from sklearn.preprocessing import StandardScaler
import numpy as np, pickle

CANDIDATES = {
    "GBM":           GradientBoostingClassifier(n_estimators=200, max_depth=4),
    "GBM_deep":      GradientBoostingClassifier(n_estimators=300, max_depth=6),
    "RandomForest":  RandomForestClassifier(n_estimators=300, max_depth=10),
    "LogReg":        LogisticRegression(max_iter=1000),
    "RF_small":      RandomForestClassifier(n_estimators=100, max_depth=4),
    "GBM_shallow":   GradientBoostingClassifier(n_estimators=100, max_depth=2),
}

X_train, y_train = load_csv("features_train.csv")
X_val, y_val = load_csv("features_validation.csv")

# Phase 1: 5-fold CV on training set
cv = StratifiedKFold(n_splits=5, shuffle=True)
for name, model in CANDIDATES.items():
    scores = cross_val_score(model, X_train, y_train, cv=cv, scoring="f1")
    print(f"{name}: CV F1 = {scores.mean():.3f}")

# Phase 2: train all on full training set, evaluate on real data
best_f1, best_name = 0, None
for name, model in CANDIDATES.items():
    model.fit(X_train, y_train)
    preds = model.predict(X_val)
    f1 = f1_score(y_val, preds)
    if f1 > best_f1:
        best_f1, best_name = f1, name

# Phase 3: serialize the winner
pickle.dump({
    "model": CANDIDATES[best_name],
    "model_name": best_name,
    "features": FEATURE_NAMES,   # 28 feature names
    "val_metrics": {"f1": best_f1},
}, open("validator_model.pkl", "wb"))
# Output: 2.5 KB file — the entire trained model`,
      },
      {
        name: "validator.py",
        code: `# In production (serve.py), the validator runs AFTER every LLM reply:
#
#   reply = call_llm(messages)
#   if VALIDATOR_ENABLED:
#       code = extract_code_from_messages(messages)
#       reply = fix_line_refs(reply, code)  # <-- this
#   send_to_student(reply)

def fix_line_refs(reply, code):
    """The conservative correction strategy."""
    code_lines = code.split("\\n")
    refs = extract_refs(reply)

    for ref in reversed(refs):
        features, best_line = extract_features(ref, code_lines, reply)
        X = np.array([features])
        p_wrong = model.predict_proba(X)[0][0]

        if p_wrong < 0.5:
            continue  # model says it's probably correct

        # Model flagged it. But we only correct when we're SURE:
        #
        # Strategy 1: backtick code found on nearby line, not on ref line
        #   e.g., tutor says "line 5 where \`grade\` is set"
        #   but \`grade\` appears on line 3, not 5 → fix to 3
        #
        # Strategy 2: ref line is blank/comment, neighbor has identifiers
        #   e.g., "line 20" is "}" but line 19 has the actual code
        #
        # Max correction: \u00B13 lines. No wild jumps.
        correction = find_safe_correction(ref, code_lines)
        if correction:
            reply = apply_correction(reply, ref, correction)

    return reply  # runs in ~5ms`,
      },
    ],
    seedQuestions: [
      "Why select the best model by validation F1, not by cross-validation F1?",
      "Why does the validator only correct within \u00B13 lines?",
      "What's the difference between the ML model's job and the correction heuristic's job?",
      "Why is the model so small (2.5KB) \u2014 could a larger model be better?",
    ],
  },
] };
