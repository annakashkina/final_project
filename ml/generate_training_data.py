#!/usr/bin/env python3
"""
Generate training data for the Line Reference Validator.

Simulates tutor conversations using codeprobe lessons, calling two LLMs
(Kimi K2 and gpt-oss-120b, 50/50) via the Groq API.  Extracts and
verifies line references in each tutor response.

Usage:
    python generate_training_data.py                      # all lessons
    python generate_training_data.py --lessons c-switch    # specific lesson(s)
    python generate_training_data.py --dry-run             # preview without API calls
    python generate_training_data.py --multi-turn          # include follow-up exchanges
"""

import argparse
import json
import os
import re
import subprocess
import sys
import time
import urllib.request
import urllib.error
from pathlib import Path

from line_refs import extract_line_refs, verify_ref

# ── paths ──────────────��─────────────────────────────────────────────────
SCRIPT_DIR = Path(__file__).parent
PROTOTYPE_DIR = SCRIPT_DIR.parent
DATA_DIR = SCRIPT_DIR / "data"

# ── models ──────────────────────────────────────────���────────────────────
TUTOR_MODELS = [
    "moonshotai/kimi-k2-instruct",
    "openai/gpt-oss-120b",
]
STUDENT_MODEL = "llama-3.1-8b-instant"  # cheap, for multi-turn follow-ups
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"

# ── student profiles (rotated for variety) ───────────────────────────────
PROFILES = [
    {
        "name": "beginner",
        "known_langs": [],
        "known_concepts": [],
        "desc": "a student who is likely a beginner",
    },
    {
        "name": "python_dev",
        "known_langs": ["Python"],
        "known_concepts": ["OOP"],
        "desc": "a programmer who has worked with Python and has experience with OOP",
    },
    {
        "name": "java_dev",
        "known_langs": ["Java", "Python"],
        "known_concepts": ["OOP", "Concurrency"],
        "desc": "a programmer who has worked with Java, Python and has experience with OOP, Concurrency",
    },
    {
        "name": "js_dev",
        "known_langs": ["JavaScript"],
        "known_concepts": [],
        "desc": "a programmer who has worked with JavaScript",
    },
    {
        "name": "experienced",
        "known_langs": ["Python", "JavaScript", "Java"],
        "known_concepts": ["OOP", "Memory management", "Concurrency"],
        "desc": "a programmer who has worked with Python, JavaScript, Java and has experience with OOP, Memory management, Concurrency",
    },
]


# ── helpers ────��──────────────────────────────────���──────────────────────

def load_api_key():
    env_path = PROTOTYPE_DIR / ".env"
    if env_path.exists():
        for line in open(env_path):
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                if k.strip() in ("GROQ_API_KEY", "LLM_API_KEY"):
                    return v.strip()
    return os.environ.get("GROQ_API_KEY") or os.environ.get("LLM_API_KEY", "")


def load_lessons(filter_ids=None, corpus_file=None):
    """Load lessons from extract_lessons.js and/or a corpus JSON file."""
    lessons = []

    # Load prototype lessons
    extractor = SCRIPT_DIR / "extract_lessons.js"
    r = subprocess.run(
        ["node", str(extractor)], capture_output=True, text=True, cwd=str(PROTOTYPE_DIR)
    )
    if r.returncode != 0:
        sys.exit(f"extract_lessons.js failed:\n{r.stderr}")
    lessons.extend(json.loads(r.stdout))

    # Load additional corpus if provided
    if corpus_file:
        corpus_path = Path(corpus_file)
        if not corpus_path.is_absolute():
            corpus_path = DATA_DIR / corpus_path
        if corpus_path.exists():
            extra = json.loads(corpus_path.read_text())
            print(f"Loaded {len(extra)} corpus lessons from {corpus_path.name}")
            lessons.extend(extra)

    if filter_ids:
        lessons = [l for l in lessons if l["id"] in filter_ids]
    return lessons


def code_for_lesson(lesson):
    """Return the full code string (handles both single-file and multi-file)."""
    if lesson.get("files"):
        return "\n\n".join(f"--- {f['name']} ---\n{f['code']}" for f in lesson["files"])
    return lesson.get("code", "")


# ── prompt construction (mirrors app.js buildPrompt) ─────────────────────

def build_prompt(lesson, questions, profile, mode="quick"):
    known = profile["known_langs"]
    concepts = profile["known_concepts"]

    # Bridges
    bridges = ""
    if known and lesson.get("bridges"):
        entries = [(l, n) for l, n in lesson["bridges"].items() if l in known]
        if not entries:
            entries = list(lesson["bridges"].items())
        bridges = "\n".join(f"- {l}: {n}" for l, n in entries)

    code = code_for_lesson(lesson)
    student_desc = profile["desc"]

    # Missing-knowledge warning
    level_note = ""
    if not known and not concepts:
        level_note = (
            "\nNote: The student hasn't specified their background. "
            "Don't assume what languages or CS concepts they know."
        )
    else:
        missing = []
        if "Memory management" not in concepts:
            missing.append("memory management (pointers, heap/stack)")
        if "Concurrency" not in concepts:
            missing.append("concurrency (threads, async)")
        if "OOP" not in concepts:
            missing.append("OOP (classes, inheritance)")
        if missing:
            level_note = (
                f"\nThe student has NOT indicated knowledge of: {', '.join(missing)}. "
                "Do NOT assume they understand these — explain from scratch if the code involves them."
            )

    bridge_note = ", bridging from languages they know" if bridges else ""

    # The key difference from production: we EMPHASISE line references
    line_rule = "ALWAYS reference specific line numbers when discussing the code."

    if mode == "quick":
        approach = f"""APPROACH:
1. Briefly address their questions if any
2. Teach ONE key concept from the code{bridge_note}
3. After each concept, quiz them immediately — predict output, explain why, spot an issue
4. Give feedback on answers. Correct kindly, deepen if right.
5. After their answer, you decide:
   a) if correct AND shows understanding → brief feedback, 1-sentence summary, end with [LESSON_COMPLETE].
   b) if wrong/incomplete → explain kindly, ask a NEW question. Do NOT end with [LESSON_COMPLETE] until they answer correctly.
CRITICAL: Never use [LESSON_COMPLETE] in the same response where you corrected the student.

RULES: Be conversational. ONE question only. Use backtick code snippets. {line_rule} ~1-2 total exchanges. Only reference languages the student knows.{level_note}"""
    else:
        approach = f"""APPROACH:
1. Address their questions about the code
2. Teach ONE concept at a time{bridge_note}
3. After each concept, quiz them immediately
4. Give feedback on answers. Correct kindly, deepen if right.
5. After 4-5 exchanges, say "Final challenge:" and give a synthesis question
6. After they answer correctly → summarize in 2-3 sentences, end with [LESSON_COMPLETE]
CRITICAL: Never use [LESSON_COMPLETE] in the same response where you corrected the student.

RULES: Be conversational. ONE question at a time. Use backtick code snippets. {line_rule} ~5-7 total exchanges. Only reference languages the student knows.{level_note}"""

    bridges_section = f"BRIDGES:\n{bridges}\n" if bridges else ""
    return (
        f"You are a tutor teaching {student_desc}. "
        f"They are learning {lesson['series']} through real code.\n\n"
        f"{approach}\n\n"
        f"{bridges_section}CODE:\n```\n{code}\n```\n\n"
        f"CONCEPTS: {', '.join(lesson['concepts'])}\n\n"
        f"STUDENT QUESTIONS: {questions or '(none — start with the most important concept)'}"
    )


# ── LLM calls ──────��────────────────────────────────────────────────────

def call_llm(messages, model, api_key, max_retries=2, timeout=30):
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}",
        "User-Agent": "CodeProbe-DataGen/1.0",
    }
    for attempt in range(max_retries + 1):
        payload = json.dumps(
            {"model": model, "messages": messages, "temperature": 0.7, "max_tokens": 1500}
        ).encode()
        req = urllib.request.Request(GROQ_URL, data=payload, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                result = json.loads(resp.read())
                reply = result["choices"][0]["message"]["content"]
                if len(reply.split()) >= 20:
                    return reply
                print(f"    short reply ({len(reply.split())}w), retrying", file=sys.stderr)
        except urllib.error.HTTPError as e:
            body = e.read().decode(errors="replace")
            print(f"    HTTP {e.code}: {body[:150]}", file=sys.stderr)
            if e.code == 429:
                wait = min(60, 2 ** (attempt + 2))
                print(f"    rate-limited, waiting {wait}s", file=sys.stderr)
                time.sleep(wait)
                continue
        except Exception as e:
            print(f"    error: {e}", file=sys.stderr)
        if attempt < max_retries:
            time.sleep(2)
    return None


# ── core generation loop ─────��───────────────────────────────────────────

def annotate_refs(response, code_lines):
    """Extract line refs from a response and verify each one."""
    refs = extract_line_refs(response)
    for ref in refs:
        ref["verification"] = verify_ref(ref, code_lines)
    return refs


def generate(args):
    api_key = load_api_key()
    if not api_key and not args.dry_run:
        sys.exit("No API key. Set GROQ_API_KEY or add to prototype/.env")

    DATA_DIR.mkdir(exist_ok=True)
    out_path = DATA_DIR / "training_raw.jsonl"

    # Resumability: skip entries we already have
    existing = set()
    if out_path.exists():
        for line in open(out_path):
            try:
                existing.add(json.loads(line).get("id", ""))
            except Exception:
                pass
        if existing:
            print(f"Resuming — {len(existing)} entries already generated")

    lessons = load_lessons(args.lessons, getattr(args, "corpus", None))
    print(f"Loaded {len(lessons)} lessons, {len(TUTOR_MODELS)} models")

    # Calculate total work
    total_combos = sum(len(l.get("seedQuestions", [])) + 1 for l in lessons)  # +1 for no-question
    total_work = total_combos  # each combo → one model (alternating)
    to_skip = len(existing)
    print(f"Total combinations: {total_work} ({'dry run' if args.dry_run else f'~{(total_work - to_skip) * 2.5 / 60:.0f} min'})\n")

    model_idx = 0
    stats = {"calls": 0, "refs": 0, "correct": 0, "wrong": 0, "unknown": 0, "skipped": 0}

    outfile = open(out_path, "a") if not args.dry_run else None
    try:
        for lesson in lessons:
            questions_list = list(lesson.get("seedQuestions", []))
            questions_list.append(None)  # no-questions variant

            for q_idx, question in enumerate(questions_list):
                model = TUTOR_MODELS[model_idx % len(TUTOR_MODELS)]
                model_idx += 1
                profile = PROFILES[(model_idx + q_idx) % len(PROFILES)]
                mode = "quick" if q_idx % 2 == 0 else "full"
                entry_id = f"{lesson['id']}_q{q_idx}_{model.split('/')[-1][:10]}"

                if entry_id in existing:
                    stats["skipped"] += 1
                    continue

                sys_prompt = build_prompt(lesson, question, profile, mode)

                if args.dry_run:
                    print(f"  {entry_id}  model={model.split('/')[-1]}  "
                          f"profile={profile['name']}  mode={mode}")
                    if args.verbose:
                        print(f"    question: {question or '(none)'}")
                        print(f"    prompt: {len(sys_prompt)} chars")
                    continue

                # ── initial tutor exchange ──
                messages = [
                    {"role": "system", "content": sys_prompt},
                    {"role": "user", "content": question or "(none — start with the most important concept)"},
                ]
                print(f"  {entry_id} ...", end=" ", flush=True)
                reply = call_llm(messages, model, api_key)
                stats["calls"] += 1

                if not reply:
                    print("FAILED")
                    continue

                code = code_for_lesson(lesson)
                code_lines = code.split("\n")
                refs = annotate_refs(reply, code_lines)
                _count_refs(refs, stats)

                exchanges = [{"role": "user", "content": question or "(none)", "reply": reply, "refs": refs}]

                # ── optional multi-turn follow-up ──
                if args.multi_turn and not reply.rstrip().endswith("[LESSON_COMPLETE]"):
                    student_reply = _simulate_student(reply, api_key)
                    if student_reply:
                        messages.append({"role": "assistant", "content": reply})
                        messages.append({"role": "user", "content": student_reply})

                        print("→", end=" ", flush=True)
                        reply2 = call_llm(messages, model, api_key)
                        stats["calls"] += 1

                        if reply2:
                            refs2 = annotate_refs(reply2, code_lines)
                            _count_refs(refs2, stats)
                            exchanges.append(
                                {"role": "user", "content": student_reply, "reply": reply2, "refs": refs2}
                            )

                # ── write entry ──
                ref_total = sum(len(ex["refs"]) for ex in exchanges)
                c = stats["correct"]
                w = stats["wrong"]
                print(f"{ref_total} refs" + (f" ({w}w)" if w else ""))

                entry = {
                    "id": entry_id,
                    "lesson_id": lesson["id"],
                    "series": lesson["series"],
                    "model": model,
                    "profile": profile["name"],
                    "mode": mode,
                    "student_msg": question or "(none)",
                    "code": code,
                    "exchanges": exchanges,
                    "total_refs": ref_total,
                    "ts": int(time.time() * 1000),
                }
                outfile.write(json.dumps(entry) + "\n")
                outfile.flush()

                # Pace to stay under Groq rate limits (30 req/min)
                time.sleep(2.5)

    except KeyboardInterrupt:
        print("\n\nInterrupted — progress saved, re-run to resume.")
    finally:
        if outfile:
            outfile.close()

    print(f"\nDone: {stats['calls']} API calls, {stats['refs']} refs "
          f"({stats['correct']} correct, {stats['wrong']} wrong, {stats['unknown']} uncertain)")
    print(f"Output: {out_path}")


def _count_refs(refs, stats):
    for r in refs:
        stats["refs"] += 1
        v = r.get("verification", {}).get("valid")
        if v is True:
            stats["correct"] += 1
        elif v is False:
            stats["wrong"] += 1
        else:
            stats["unknown"] += 1


def _simulate_student(tutor_reply, api_key):
    """Generate a plausible student follow-up using a cheap model."""
    messages = [
        {
            "role": "system",
            "content": (
                "You are a CS student learning to code. A tutor just explained something and "
                "asked you a question. Give a short, natural answer (1-3 sentences). "
                "Sometimes be correct, sometimes be wrong or unsure. Be realistic."
            ),
        },
        {"role": "user", "content": f"The tutor said:\n\n{tutor_reply}\n\nYour answer:"},
    ]
    return call_llm(messages, STUDENT_MODEL, api_key, max_retries=1, timeout=15)


# ── CLI ───���───────────────────────────────────────────────────────��──────

def main():
    p = argparse.ArgumentParser(description="Generate training data for line reference validator")
    p.add_argument("--lessons", nargs="+", help="Only these lesson IDs")
    p.add_argument("--dry-run", action="store_true", help="Preview without API calls")
    p.add_argument("--verbose", action="store_true", help="Extra detail in dry-run")
    p.add_argument("--multi-turn", action="store_true", help="Add one follow-up exchange per conversation")
    p.add_argument("--corpus", help="Additional corpus JSON file (in data/ or absolute path)")
    p.add_argument("--models", nargs="+", help="Override tutor model list")
    args = p.parse_args()
    if args.models:
        global TUTOR_MODELS
        TUTOR_MODELS = args.models
    generate(args)


if __name__ == "__main__":
    main()
