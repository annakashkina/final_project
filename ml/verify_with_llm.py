#!/usr/bin/env python3
"""
Gold-standard verification of line references using a large LLM.

For each entry in training_raw.jsonl / validation_real.jsonl, sends the
numbered code + tutor response + extracted references to gpt-oss-120b
and asks it to judge each reference as correct/incorrect with the right line.

This is a READING COMPREHENSION task for the LLM (much easier than
generating correct line refs), so accuracy should be near-perfect.

Usage:
    python verify_with_llm.py                         # verify training data
    python verify_with_llm.py --input validation_real.jsonl
    python verify_with_llm.py --dry-run               # preview prompts
"""

import argparse
import json
import os
import re
import sys
import time
import urllib.request
import urllib.error
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
DATA_DIR = SCRIPT_DIR / "data"
PROTOTYPE_DIR = SCRIPT_DIR.parent

VERIFY_MODEL = os.environ.get("VERIFY_MODEL", "gpt-oss-120b")
GROQ_URL = os.environ.get(
    "VERIFY_URL", "https://api.cerebras.ai/v1/chat/completions"
)


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


def call_llm(messages, api_key, max_retries=5):
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}",
        "User-Agent": "CodeProbe-Verify/1.0",
    }
    for attempt in range(max_retries + 1):
        payload = json.dumps(
            {"model": VERIFY_MODEL, "messages": messages, "temperature": 0.0, "max_tokens": 4000}
        ).encode()
        req = urllib.request.Request(GROQ_URL, data=payload, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                result = json.loads(resp.read())
                return result["choices"][0]["message"]["content"]
        except urllib.error.HTTPError as e:
            body = e.read().decode(errors="replace")
            print(f"    HTTP {e.code}: {body[:150]}", file=sys.stderr)
            if e.code == 429:
                wait = min(90, 2 ** (attempt + 2))
                print(f"    rate-limited, waiting {wait}s", file=sys.stderr)
                time.sleep(wait)
                continue
        except Exception as e:
            print(f"    error: {e}", file=sys.stderr)
        if attempt < max_retries:
            time.sleep(2)
    return None


def number_code(code):
    """Add line numbers to code for the verification prompt."""
    lines = code.split("\n")
    width = len(str(len(lines)))
    return "\n".join(f"{i+1:>{width}}: {line}" for i, line in enumerate(lines))


def build_verify_prompt(entry):
    """Build a verification prompt for all line refs in one entry."""
    code = entry.get("code", "")
    numbered = number_code(code)

    # Collect all refs across exchanges
    all_refs = []
    if "exchanges" in entry:
        for ex in entry["exchanges"]:
            for ref in ex.get("refs", []):
                all_refs.append(ref)
    elif "line_refs" in entry:
        all_refs = entry["line_refs"]

    if not all_refs:
        return None, []

    # Build the ref list for the prompt
    ref_descriptions = []
    for i, ref in enumerate(all_refs, 1):
        ctx = ref.get("context", "").replace("\n", " ")[:300]
        ref_descriptions.append(
            f'{i}. "{ref["raw"]}" in context: "{ctx}"'
        )

    refs_text = "\n".join(ref_descriptions)

    prompt = f"""You are verifying line number references in an AI tutor's response about code.

Here is the code with line numbers:
```
{numbered}
```

The tutor made these line references. For each one, determine if the referenced line number(s) correctly match what the tutor is describing in the surrounding context.

{refs_text}

For EACH reference, respond with exactly this JSON format (as a JSON array):
[
  {{"ref_index": 1, "ref": "line 5", "correct": true, "correct_start": 5, "correct_end": null, "reason": "brief explanation"}},
  {{"ref_index": 2, "ref": "lines 18-20", "correct": false, "correct_start": 17, "correct_end": 18, "reason": "fall-through is on lines 17-18, not 18-20"}}
]

Rules:
- "correct": true if the line number(s) point to what the tutor is describing
- "correct": false if the tutor meant a different line — provide correct_start/correct_end
- correct_end is null for single-line references
- Be precise: check that the CONTENT at the referenced line matches the tutor's description
- If the context is too vague to determine, set "correct": null and explain in reason

Respond ONLY with the JSON array, no other text."""

    return prompt, all_refs


def parse_llm_response(text, ref_count):
    """Parse the JSON array from the LLM's response."""
    # Try to extract JSON array from the response
    text = text.strip()

    # Handle markdown code blocks
    if "```" in text:
        match = re.search(r"```(?:json)?\s*\n?(.*?)\n?```", text, re.DOTALL)
        if match:
            text = match.group(1).strip()

    try:
        results = json.loads(text)
        if isinstance(results, list):
            return results
    except json.JSONDecodeError:
        pass

    # Try to find array in the text
    match = re.search(r"\[.*\]", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            pass

    print(f"    Failed to parse LLM response: {text[:200]}", file=sys.stderr)
    return None


def verify(args):
    api_key = load_api_key()
    if not api_key and not args.dry_run:
        sys.exit("No API key. Set GROQ_API_KEY or add to prototype/.env")

    input_path = DATA_DIR / args.input
    if not input_path.exists():
        sys.exit(f"Input not found: {input_path}")

    output_path = DATA_DIR / args.input.replace(".jsonl", "_verified.jsonl")

    # Load entries
    entries = []
    for line in open(input_path):
        try:
            entries.append(json.loads(line))
        except Exception:
            pass

    # Count total refs
    total_refs = 0
    entries_with_refs = []
    for entry in entries:
        refs = []
        if "exchanges" in entry:
            for ex in entry["exchanges"]:
                refs.extend(ex.get("refs", []))
        elif "line_refs" in entry:
            refs = entry["line_refs"]
        if refs:
            total_refs += len(refs)
            entries_with_refs.append(entry)

    print(f"Input: {input_path.name}")
    print(f"Entries: {len(entries)} total, {len(entries_with_refs)} with refs")
    print(f"Total references to verify: {total_refs}")

    # Resumability
    existing_ids = set()
    if output_path.exists():
        for line in open(output_path):
            try:
                existing_ids.add(json.loads(line).get("id", ""))
            except Exception:
                pass
        if existing_ids:
            print(f"Resuming — {len(existing_ids)} already verified")

    est_minutes = (len(entries_with_refs) - len(existing_ids)) * 3 / 60
    print(f"Estimated time: ~{est_minutes:.0f} min\n")

    stats = {"calls": 0, "refs_verified": 0, "correct": 0, "wrong": 0, "uncertain": 0}

    outfile = open(output_path, "a") if not args.dry_run else None
    try:
        for entry in entries_with_refs:
            entry_id = entry.get("id", "unknown")
            if entry_id in existing_ids:
                continue

            prompt, refs = build_verify_prompt(entry)
            if not prompt:
                continue

            if args.dry_run:
                print(f"  {entry_id}: {len(refs)} refs")
                if args.verbose:
                    print(f"    Prompt length: {len(prompt)} chars")
                    for r in refs:
                        print(f"    - {r['raw']}")
                continue

            print(f"  {entry_id} ({len(refs)} refs) ...", end=" ", flush=True)

            messages = [{"role": "user", "content": prompt}]
            response = call_llm(messages, api_key)
            stats["calls"] += 1

            if not response:
                print("FAILED")
                continue

            results = parse_llm_response(response, len(refs))
            if not results:
                print("PARSE ERROR")
                continue

            # Merge LLM verdicts back into the refs
            verified_refs = []
            for i, ref in enumerate(refs):
                verdict = None
                for r in results:
                    if r.get("ref_index") == i + 1:
                        verdict = r
                        break

                if verdict:
                    ref["llm_verdict"] = {
                        "correct": verdict.get("correct"),
                        "correct_start": verdict.get("correct_start"),
                        "correct_end": verdict.get("correct_end"),
                        "reason": verdict.get("reason", ""),
                    }
                    v = verdict.get("correct")
                    if v is True:
                        stats["correct"] += 1
                    elif v is False:
                        stats["wrong"] += 1
                    else:
                        stats["uncertain"] += 1
                    stats["refs_verified"] += 1
                else:
                    ref["llm_verdict"] = {"correct": None, "reason": "no verdict from LLM"}
                    stats["uncertain"] += 1
                    stats["refs_verified"] += 1

                verified_refs.append(ref)

            # Reconstruct entry with verdicts
            output_entry = dict(entry)
            if "exchanges" in output_entry:
                ref_idx = 0
                for ex in output_entry["exchanges"]:
                    for j in range(len(ex.get("refs", []))):
                        if ref_idx < len(verified_refs):
                            ex["refs"][j] = verified_refs[ref_idx]
                            ref_idx += 1
            elif "line_refs" in output_entry:
                output_entry["line_refs"] = verified_refs

            c = stats["correct"]
            w = stats["wrong"]
            print(f"{len(refs)} verified ({c}c {w}w)")

            outfile.write(json.dumps(output_entry) + "\n")
            outfile.flush()

            time.sleep(5)  # rate limit — gpt-oss-120b is ~15 req/min on Groq

    except KeyboardInterrupt:
        print("\n\nInterrupted — progress saved, re-run to resume.")
    finally:
        if outfile:
            outfile.close()

    total = stats["refs_verified"]
    print(f"\nDone: {stats['calls']} API calls, {total} refs verified")
    print(f"  Correct:   {stats['correct']} ({stats['correct']*100//max(total,1)}%)")
    print(f"  Wrong:     {stats['wrong']} ({stats['wrong']*100//max(total,1)}%)")
    print(f"  Uncertain: {stats['uncertain']}")
    print(f"Output: {output_path}")


def main():
    p = argparse.ArgumentParser(description="Verify line references with LLM")
    p.add_argument("--input", default="training_raw.jsonl", help="Input JSONL file in data/")
    p.add_argument("--dry-run", action="store_true", help="Preview without API calls")
    p.add_argument("--verbose", action="store_true", help="Extra detail in dry-run")
    verify(p.parse_args())


if __name__ == "__main__":
    main()
