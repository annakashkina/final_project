#!/usr/bin/env python3
"""
Process real codeprobe conversation data into a labeled validation set.

Reads _chat.jsonl files from ~/tmp/final-project-data/, extracts line
references from tutor replies, verifies them against the code in the
system prompt, and writes a validation JSONL.

Usage:
    python process_real_data.py
    python process_real_data.py --data-dir /path/to/data
    python process_real_data.py --verbose
"""

import argparse
import json
import re
import sys
from pathlib import Path

from line_refs import extract_line_refs, verify_ref

DEFAULT_DATA_DIR = Path.home() / "tmp" / "final-project-data"
OUTPUT_DIR = Path(__file__).parent / "data"


def extract_code_from_system(messages):
    """Pull the code block out of the system prompt in a message array."""
    for m in messages:
        if m.get("role") == "system":
            match = re.search(r"```\n(.*?)\n```", m["content"], re.DOTALL)
            if match:
                return match.group(1)
    return ""


def extract_lesson_id(messages):
    """Try to guess lesson id from system prompt content."""
    for m in messages:
        if m.get("role") == "system":
            content = m["content"]
            # The prompt says "learning X through real code"
            match = re.search(r"learning\s+(\w[\w+# ]*?)\s+through real code", content)
            if match:
                return match.group(1).strip()
    return "unknown"


def process(args):
    data_dir = Path(args.data_dir)
    if not data_dir.exists():
        sys.exit(f"Data directory not found: {data_dir}")

    OUTPUT_DIR.mkdir(exist_ok=True)
    out_path = OUTPUT_DIR / "validation_real.jsonl"

    chat_files = sorted(data_dir.glob("*_chat.jsonl"))
    print(f"Found {len(chat_files)} chat files in {data_dir}")

    stats = {"entries": 0, "refs": 0, "correct": 0, "wrong": 0, "unknown": 0}

    with open(out_path, "w") as out:
        for chat_file in chat_files:
            uid = chat_file.stem.replace("_chat", "")

            for line_num, raw_line in enumerate(open(chat_file), 1):
                try:
                    entry = json.loads(raw_line)
                except Exception:
                    continue

                reply = entry.get("reply", "")
                if not reply or entry.get("failed"):
                    continue

                code = extract_code_from_system(entry.get("messages", []))
                if not code:
                    continue

                code_lines = code.split("\n")
                refs = extract_line_refs(reply)
                if not refs:
                    continue

                verified = []
                for ref in refs:
                    ref["verification"] = verify_ref(ref, code_lines)
                    verified.append(ref)

                    v = ref["verification"].get("valid")
                    stats["refs"] += 1
                    if v is True:
                        stats["correct"] += 1
                    elif v is False:
                        stats["wrong"] += 1
                    else:
                        stats["unknown"] += 1

                series = extract_lesson_id(entry.get("messages", []))

                result = {
                    "id": f"real_{uid[:8]}_{line_num}",
                    "source": "real_data",
                    "uid": uid[:8],
                    "series": series,
                    "model": entry.get("model", "unknown"),
                    "code": code,
                    "response": reply,
                    "line_refs": verified,
                    "ref_count": len(verified),
                    "ts": entry.get("ts", 0),
                }
                out.write(json.dumps(result) + "\n")
                stats["entries"] += 1

                if args.verbose:
                    for ref in verified:
                        v = ref["verification"]
                        mark = "OK" if v.get("valid") else ("??" if v.get("valid") is None else "WRONG")
                        print(f"  [{mark}] {ref['raw']:15s}  {ref['context'][:80]}")
                        if not v.get("valid") and v.get("valid") is not None:
                            print(f"         best match: line {v.get('best_match_line')}  "
                                  f"{v.get('best_match_content', '')[:60]}")

    print(f"\nProcessed {stats['entries']} entries, {stats['refs']} line references")
    print(f"  Correct:   {stats['correct']}")
    print(f"  Wrong:     {stats['wrong']}")
    print(f"  Uncertain: {stats['unknown']}")
    print(f"Output: {out_path}")


def main():
    p = argparse.ArgumentParser(description="Process real conversation data for validation")
    p.add_argument("--data-dir", default=str(DEFAULT_DATA_DIR), help="Path to JSONL data directory")
    p.add_argument("--verbose", action="store_true", help="Print each reference verification")
    process(p.parse_args())


if __name__ == "__main__":
    main()
