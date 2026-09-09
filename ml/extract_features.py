#!/usr/bin/env python3
"""
Extract ML features from verified line reference data into CSVs ready for
training. Feature extraction lives in prototype/validator.py — this script is
just the batch CSV writer.

Each ref in the corpus is materialised as MULTIPLE training rows:
  - the claim line itself (distance_from_claim = 0)
  - the true correct_line, if different from the claim
  - a sampled set of other candidate lines (negatives)

Each row is labelled "is THIS line the correct one for this ref?". The
classifier therefore generalises beyond binary "was the LLM's claim right?".

Usage:
    python extract_features.py
"""

import csv
import json
import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from validator import FEATURE_NAMES, extract_features  # noqa: E402

DATA_DIR = Path(__file__).parent / "data"

LABEL_NAMES = ["is_correct", "correct_line", "distance_from_claim"]

# How many candidate rows to emit per ref. Includes claim + correct + nearby
# neighbours + a random sample of distant lines. Cap keeps the dataset bounded
# on long files.
MAX_CANDIDATES_PER_REF = 10


def _verdict_correct_line(ref):
    """Return the correct line per the LLM verdict, or None if unknown."""
    verdict = ref.get("llm_verdict", {})
    raw = verdict.get("correct")
    correct_start = verdict.get("correct_start")
    claim = ref["start"]
    if raw is True:
        return claim
    if raw is False and isinstance(correct_start, int) and correct_start > 0:
        return correct_start
    return None


def _candidate_lines(claim, correct, total_lines, rng):
    """Pick which lines of the code to materialise as training rows.

    Goal: avoid the model learning a trivial "distance ≫ 3 ⇒ wrong" shortcut.
    We achieve that by mirroring the distance of the correct line with random
    negatives at the SAME distance, so distance alone cannot separate the
    classes — feature evidence has to.
    """
    cands = {claim}
    if correct and 1 <= correct <= total_lines:
        cands.add(correct)
        d = abs(correct - claim)
        # Pair the positive with a few negatives at the same distance.
        same_dist = [i for i in (claim - d, claim + d) if 1 <= i <= total_lines and i != correct]
        for c in same_dist:
            cands.add(c)
    # A small fixed set of nearby negatives — the model learns local
    # "almost right" looks bad too.
    for off in (-2, -1, 1, 2):
        c = claim + off
        if 1 <= c <= total_lines and c != correct:
            cands.add(c)
    # A few random distant negatives, so distance > 3 isn't unrepresented.
    available = [i for i in range(1, total_lines + 1) if i not in cands]
    rng.shuffle(available)
    while len(cands) < MAX_CANDIDATES_PER_REF and available:
        cands.add(available.pop())
    return sorted(cands)


def _refs_for_entry(entry):
    if "exchanges" in entry:
        for ex in entry["exchanges"]:
            reply = ex.get("reply", "")
            for ref in ex.get("refs", []):
                yield ref, reply
    elif "line_refs" in entry:
        response = entry.get("response", "")
        for ref in entry["line_refs"]:
            yield ref, response


def process_file(input_name, output_name):
    input_path = DATA_DIR / input_name
    output_path = DATA_DIR / output_name
    if not input_path.exists():
        print(f"  Skipping {input_name} (not found)")
        return 0, 0, 0

    rows, skipped, refs_seen = [], 0, 0
    for entry in (json.loads(l) for l in open(input_path)):
        code_lines = entry.get("code", "").split("\n")
        total = len(code_lines)
        for ref, reply in _refs_for_entry(entry):
            if "llm_verdict" not in ref:
                skipped += 1
                continue
            correct = _verdict_correct_line(ref)
            verdict = ref.get("llm_verdict", {})
            # Drop unusable: verdict said wrong but supplied no correct_line,
            # OR verdict was uncertain.
            if verdict.get("correct") is None:
                skipped += 1
                continue
            if verdict.get("correct") is False and correct is None:
                skipped += 1
                continue
            # Drop the "wrong but correct_line == claim" inconsistency.
            if verdict.get("correct") is False and correct == ref["start"]:
                skipped += 1
                continue

            refs_seen += 1
            rng = random.Random(f"{entry.get('id', '')}::{ref.get('raw', '')}")
            claim = ref["start"]
            for cand in _candidate_lines(claim, correct, total, rng):
                cand_ref = dict(ref)
                cand_ref["start"] = cand
                if ref.get("end") is not None:
                    cand_ref["end"] = ref["end"] + (cand - claim)
                    if cand_ref["end"] > total or cand_ref["end"] < cand:
                        continue
                features = extract_features(
                    cand_ref, code_lines, reply, claim_line=claim
                )
                if features is None:
                    continue
                is_correct_row = 1 if (correct is not None and cand == correct) else 0
                rows.append({
                    "entry_id": entry.get("id", ""),
                    "ref_raw": ref.get("raw", ""),
                    **dict(zip(FEATURE_NAMES, features)),
                    "is_correct": is_correct_row,
                    "correct_line": correct if correct else -1,
                    "distance_from_claim": abs(cand - claim),
                })

    if rows:
        fieldnames = ["entry_id", "ref_raw"] + FEATURE_NAMES + LABEL_NAMES
        with open(output_path, "w", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows)

    return len(rows), skipped, refs_seen


def main():
    print("Extracting features...\n")
    for in_name, out_name, label in (
        ("training_raw_verified.jsonl", "features_train.csv", "Training"),
        ("validation_real_verified.jsonl", "features_validation.csv", "Validation"),
    ):
        n, skip, refs = process_file(in_name, out_name)
        print(f"{label}:  {refs} refs → {n} rows  ({skip} refs skipped)")
        if n > 0:
            with open(DATA_DIR / out_name) as f:
                correct = sum(1 for r in csv.DictReader(f) if r["is_correct"] == "1")
            print(f"  positive (is_correct=1): {correct} ({correct*100//n}%)")

    print(f"\nOutput dir: {DATA_DIR}")


if __name__ == "__main__":
    main()
