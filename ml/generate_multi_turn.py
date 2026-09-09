#!/usr/bin/env python3
"""
Generate multi-turn deep-mode training data using the production prompt.

For each (single-file lesson × profile), build the production prompt (DEEP mode
this time, so the LLM proceeds through several concepts) and simulate 2-3
exchanges by appending a brief "Correct." student reply after each tutor turn.
Capture all line refs from all turns — the LLM's line-counting accuracy
degrades on deeper turns, and that's the distribution we want in training.

Output JSONL schema: same `exchanges` format as v1 `training_raw.jsonl`,
so verify_with_llm.py consumes it without modification.

Usage:
    python generate_multi_turn.py             # all lessons × profiles, 3 turns
    python generate_multi_turn.py --limit 5   # smoke-test
    python generate_multi_turn.py --turns 2   # shorter conversations
"""

import argparse
import json
import os
import random
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
PROTOTYPE_DIR = SCRIPT_DIR.parent
DATA_DIR = SCRIPT_DIR / "data"

sys.path.insert(0, str(PROTOTYPE_DIR))
from validator import extract_refs  # noqa: E402

MODEL = "gpt-oss-120b"
LLM_URL = "https://api.cerebras.ai/v1/chat/completions"

PROFILES = [
    {"name": "beginner", "known": [], "concepts": [],
     "desc": "a student who is likely a beginner"},
    {"name": "python_dev", "known": ["Python"], "concepts": ["OOP"],
     "desc": "a programmer who has worked with Python and has experience with OOP"},
    {"name": "java_dev", "known": ["Java", "Python"], "concepts": ["OOP", "Concurrency"],
     "desc": "a programmer who has worked with Java, Python and has experience with OOP, Concurrency"},
    {"name": "js_dev", "known": ["JavaScript"], "concepts": [],
     "desc": "a programmer who has worked with JavaScript"},
    {"name": "experienced", "known": ["Python", "JavaScript", "Java"],
     "concepts": ["OOP", "Memory management", "Concurrency"],
     "desc": "a programmer who has worked with Python, JavaScript, Java and has experience with OOP, Memory management, Concurrency"},
]

STUDENT_REPLIES = [
    "Correct.",
    "Yes, that's right.",
    "I see — that makes sense.",
]


def load_api_key():
    env = PROTOTYPE_DIR / ".env"
    if env.exists():
        for line in open(env):
            line = line.strip()
            if "=" in line and not line.startswith("#"):
                k, v = line.split("=", 1)
                if k.strip() in ("GROQ_API_KEY", "LLM_API_KEY"):
                    return v.strip()
    return os.environ.get("GROQ_API_KEY") or os.environ.get("LLM_API_KEY", "")


def load_lessons():
    extractor = """
const fs = require("fs"), vm = require("vm"), path = require("path");
const dir = process.env.LESSONS_DIR;
const files = fs.readdirSync(dir).filter(f => f.endsWith(".js") && f !== "meta.js");
const out = [];
for (const f of files) {
  let code = fs.readFileSync(path.join(dir, f), "utf8")
    .replace(/^export\\s+const\\s+(\\w+)\\s*=/gm, "this.$1 =");
  const ctx = {};
  try { vm.runInNewContext(code, ctx); } catch (e) { continue; }
  for (const k of Object.keys(ctx)) {
    const obj = ctx[k];
    if (obj && Array.isArray(obj.lessons)) {
      for (const l of obj.lessons) {
        if (l.code && !l.files) {
          out.push({id: l.id, title: l.title, series: obj.name,
            concepts: l.concepts || [], bridges: l.bridges || {}, code: l.code});
        }
      }
    }
  }
}
process.stdout.write(JSON.stringify(out));
"""
    r = subprocess.run(["node", "-e", extractor], capture_output=True, text=True,
                       env={**os.environ, "LESSONS_DIR": str(PROTOTYPE_DIR / "lessons")})
    if r.returncode != 0:
        sys.exit(f"lesson extraction failed: {r.stderr}")
    return json.loads(r.stdout)


def _level_note(known, concepts):
    if not known and not concepts:
        return (
            "\nNote: The student hasn't specified their background. Don't assume "
            "what languages or CS concepts they know — ask if you need to "
            "reference another language or concept."
        )
    missing = []
    if "Memory management" not in concepts:
        missing.append("memory management (pointers, heap/stack)")
    if "Concurrency" not in concepts:
        missing.append("concurrency (threads, async)")
    if "OOP" not in concepts:
        missing.append("OOP (classes, inheritance)")
    if missing:
        return (
            f"\nThe student has NOT indicated knowledge of: {', '.join(missing)}. "
            "Do NOT assume they understand these — explain from scratch if the "
            "code involves them."
        )
    return ""


def _bridges_block(lesson, known):
    bridges = lesson.get("bridges", {})
    if not bridges:
        return "", ""
    entries = [(l, n) for l, n in bridges.items() if l in known]
    if not entries:
        entries = list(bridges.items())
    text = "\n".join(f"- {l}: {n}" for l, n in entries)
    return f"BRIDGES:\n{text}\n", ", bridging from languages they know"


def build_deep_prompt(lesson, profile):
    """Production prompt — DEEP mode variant (longer conversation expected)."""
    known, concepts = profile["known"], profile["concepts"]
    level_note = _level_note(known, concepts)
    bridges_block, bridge_note = _bridges_block(lesson, known)

    # Production DEEP-mode approach text, mirroring app.js:311
    approach = (
        "Your job is to QUIZ and teach the student through the code, not "
        "overwhelm them. Address their question briefly (but if you see clear "
        "curiosity - no limits)" + bridge_note + ", then ask ONE quiz question "
        "about the code. The student learns by attempting the question, not by "
        "reading an explanation. **Your FIRST reply opens the lesson. Follow "
        "this rule strictly:**\n"
        "- Do NOT ask the student about their background, experience, or what "
        "they already know.\n"
        "- Do NOT welcome them, introduce yourself, or use exclamation marks or "
        "emoji.\n"
        "- Point at ONE specific line or expression in the code (e.g. \"Line 12: "
        "`if (score = 0)`\") and state ONE concrete observation about it in a "
        "single short sentence.\n"
        "- Then ask ONE tiny, low-stakes question about that specific thing — "
        "prefer \"what will this print?\", \"is this true or false?\", a "
        "fill-in-the-blank, or a binary choice. Avoid open-ended questions like "
        "\"what stands out?\" or \"what do you think?\".\n"
        "- Keep the whole first reply under ~4 short lines.\n\n"
        "On all later turns, ADAPT to the student's level.\n\n"
        "After they answer:\n"
        "- If correct AND it's been 4-5 exchanges: brief feedback, summarize "
        "what they learned in 2-3 sentences, end with [LESSON_COMPLETE].\n"
        "- If correct but early: brief feedback, teach the next concept in 1-2 "
        "sentences, ask a NEW quiz question.\n"
        "- If wrong: brief hint, encourage retry.\n\n"
        "RULES: Be conversational but NEUTRAL — no \"great question\", no "
        "\"welcome\", no exclamation marks, no emoji. ONE question at a time. "
        "Use backtick code snippets. Reference specific lines. ~5-7 total "
        "exchanges. Only reference languages the student knows — do NOT assume "
        "knowledge of languages not listed." + level_note
    )

    return (
        f"You are a tutor teaching {profile['desc']}. They are learning "
        f"{lesson['series']} through real code.\n\n"
        f"{approach}\n\n"
        f"{bridges_block}CODE:\n```\n{lesson['code']}\n```\n\n"
        f"CONCEPTS: {', '.join(lesson['concepts'])}\n"
    )


def call_llm(api_key, messages, retries=6):
    body = json.dumps({
        "model": MODEL,
        "messages": messages,
        "temperature": 0.7,
    }).encode()
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "User-Agent": "codeprobe-validator/1.0",
    }
    last_err = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(LLM_URL, data=body, headers=headers)
            with urllib.request.urlopen(req, timeout=60) as r:
                payload = json.loads(r.read())
                return payload["choices"][0]["message"]["content"]
        except urllib.error.HTTPError as e:
            last_err = f"HTTP {e.code}"
            if e.code in (429, 500, 502, 503):
                time.sleep(min(60, 2 ** attempt))
                continue
            raise
        except (urllib.error.URLError, ConnectionResetError, OSError) as e:
            last_err = str(e)
            time.sleep(min(60, 2 ** attempt))
            continue
    raise RuntimeError(f"call_llm gave up after {retries} retries: {last_err}")


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--limit", type=int, default=0)
    p.add_argument("--turns", type=int, default=3,
                   help="number of tutor turns per conversation (default 3)")
    p.add_argument("--output", default=str(DATA_DIR / "training_raw_v3_multi_turn.jsonl"))
    p.add_argument("--seed", type=int, default=42)
    p.add_argument("--dry-run", action="store_true")
    args = p.parse_args()

    api_key = load_api_key() if not args.dry_run else "DRY"
    if not api_key:
        sys.exit("No GROQ_API_KEY / LLM_API_KEY")

    lessons = load_lessons()
    rng = random.Random(args.seed)
    rng.shuffle(lessons)
    pairs = [(l, p) for l in lessons for p in PROFILES]
    rng.shuffle(pairs)
    if args.limit:
        pairs = pairs[: args.limit]

    print(f"Lessons: {len(lessons)} single-file")
    print(f"Turns per conversation: {args.turns}")
    print(f"Conversations: {len(pairs)}  → up to {len(pairs) * args.turns} API calls")

    out_path = Path(args.output)
    n_written = n_failed = 0
    with open(out_path, "w") as f:
        for i, (lesson, profile) in enumerate(pairs, 1):
            system_prompt = build_deep_prompt(lesson, profile)
            messages = [{"role": "system", "content": system_prompt}]
            exchanges = []
            ok = True
            for turn in range(args.turns):
                try:
                    reply = call_llm(api_key, messages)
                except Exception as e:
                    print(f"[{i:3d}/{len(pairs)}] {lesson['id']:25s} {profile['name']:12s} "
                          f"turn {turn+1} ERROR: {e}", file=sys.stderr)
                    ok = False
                    break
                refs = extract_refs(reply)
                exchanges.append({
                    "turn": turn + 1,
                    "reply": reply,
                    "refs": refs,
                })
                # Append to message history + simulated student reply (except after last)
                messages.append({"role": "assistant", "content": reply})
                if turn < args.turns - 1:
                    student = STUDENT_REPLIES[turn % len(STUDENT_REPLIES)]
                    messages.append({"role": "user", "content": student})
                time.sleep(0.3)

            if not ok or not exchanges:
                n_failed += 1
                continue

            total_refs = sum(len(e["refs"]) for e in exchanges)
            record = {
                "id": f"v3_{lesson['id']}_{profile['name']}",
                "lesson_id": lesson["id"],
                "profile": profile["name"],
                "model": MODEL,
                "code": lesson["code"],
                "exchanges": exchanges,
                "total_refs": total_refs,
                "ts": int(time.time() * 1000),
            }
            f.write(json.dumps(record) + "\n")
            f.flush()
            n_written += 1
            print(f"[{i:3d}/{len(pairs)}] {lesson['id']:25s} {profile['name']:12s} "
                  f"{len(exchanges)} turns, {total_refs} refs")

    print(f"\nWrote {n_written} conversations, {n_failed} failed → {out_path}")


if __name__ == "__main__":
    main()
