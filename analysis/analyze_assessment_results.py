#!/usr/bin/env python3
"""Analyze CodeProbe assessment exports.

This script intentionally uses only the Python standard library so the report can
be regenerated on a fresh checkout.
"""

from __future__ import annotations

import csv
import datetime as dt
import hashlib
import json
import math
import pathlib
import re
import statistics
import sys
from collections import Counter, defaultdict
from typing import Any


DEFAULT_DATA_DIR = pathlib.Path("/Users/ann/backup/data/data")
DEFAULT_OUT_DIR = pathlib.Path(__file__).resolve().parent
MIN_POST_GAP_MS = 46 * 60 * 60 * 1000
CURRENT_MAX_SCORE = 24
EXPECTED_QUESTIONS = 8

CONCEPT_TO_LESSON = {
    "write() and file descriptors": ("s01-write", 0, "write() & File Descriptors"),
    "Strings and the \\0 loop": ("s01-strings", 1, "Strings & Null Termination"),
    "Character checks and ASCII math": ("s01-ascii", 0, "ASCII & Character Math"),
    "argc/argv and argument handling": ("s01-argc-argv", 2, "argc & argv: Command-Line Args"),
    "Logic: swap and in-place modification": ("s01-in-place", 2, "Swap & In-Place Modification"),
    "Logic: modular arithmetic and state": ("s01-control-flow", 0, "Control Flow & Loops"),
    "Linked list traversal": ("s01a2-linked-list", 1, "Linked Lists"),
    "Recursion": ("s01a2-recursion", 2, "Recursion & Trees"),
    "Static variables and persistent state": ("s01a2-static-var", 2, "Static Variables & State"),
}

LESSON_EVENT_TYPES = {
    "lesson_open",
    "start_learning",
    "lesson_complete",
    "user_msg",
    "tutor_reply",
    "phase_change",
    "seed_click",
    "back_home",
    "mode_toggle",
    "lang_toggle",
    "i_know_toggle",
}


def iso(ms: int | float | None) -> str:
    if not ms:
        return ""
    return dt.datetime.fromtimestamp(ms / 1000, dt.UTC).replace(microsecond=0).isoformat()


def pct(n: int | float, d: int | float, digits: int = 1) -> float:
    return round((n / d * 100) if d else 0, digits)


def mean(values: list[int | float]) -> float | None:
    return round(statistics.mean(values), 2) if values else None


def median(values: list[int | float]) -> float | None:
    return round(statistics.median(values), 2) if values else None


def uid_short(uid: str) -> str:
    return uid[:8]


def word_count(text: str) -> int:
    return len(re.findall(r"\b\w+\b", text or ""))


def pearson(pairs: list[tuple[int | float, int | float]]) -> float | None:
    if len(pairs) < 2:
        return None
    xs = [p[0] for p in pairs]
    ys = [p[1] for p in pairs]
    mx = statistics.mean(xs)
    my = statistics.mean(ys)
    sx = math.sqrt(sum((x - mx) ** 2 for x in xs))
    sy = math.sqrt(sum((y - my) ** 2 for y in ys))
    if sx == 0 or sy == 0:
        return None
    cov = sum((x - mx) * (y - my) for x, y in pairs)
    return round(cov / (sx * sy), 3)


def read_jsonl(path: pathlib.Path) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for line_no, line in enumerate(path.read_text().splitlines(), start=1):
        if not line.strip():
            continue
        try:
            rows.append(json.loads(line))
        except json.JSONDecodeError as exc:
            rows.append({"_invalid_json": True, "line_no": line_no, "error": str(exc)})
    return rows


def load_data(data_dir: pathlib.Path) -> tuple[dict[str, list[dict[str, Any]]], dict[str, Any], list[dict[str, Any]]]:
    user_events: dict[str, list[dict[str, Any]]] = {}
    for path in sorted(data_dir.glob("*.jsonl")):
        if path.name.startswith("_") or path.name.endswith("_chat.jsonl"):
            continue
        rows = read_jsonl(path)
        rows.sort(key=lambda e: e.get("ts", 0) or 0)
        user_events[path.stem] = rows

    users_path = data_dir / "_users.json"
    users = json.loads(users_path.read_text()) if users_path.exists() else {}
    feedback = read_jsonl(data_dir / "_feedback.jsonl") if (data_dir / "_feedback.jsonl").exists() else []
    return user_events, users, feedback


def is_current_valid_completion(event: dict[str, Any]) -> bool:
    answers = event.get("answers") or []
    unique_questions = {a.get("questionId") for a in answers if a.get("questionId")}
    return (
        event.get("type") == "assessment_complete"
        and event.get("assessment") == "pre"
        and event.get("maxScore") == CURRENT_MAX_SCORE
        and len(unique_questions) == EXPECTED_QUESTIONS
    )


def recommend_lesson(answers: list[dict[str, Any]]) -> tuple[str, int, str]:
    partial = [CONCEPT_TO_LESSON[a["concept"]] for a in answers if a.get("score") == 1 and a.get("concept") in CONCEPT_TO_LESSON]
    if partial:
        return sorted(partial, key=lambda x: x[1])[0]

    weak = [
        CONCEPT_TO_LESSON[a["concept"]]
        for a in answers
        if (a.get("score") == 0 or a.get("score") is None) and a.get("concept") in CONCEPT_TO_LESSON
    ]
    if weak:
        return sorted(weak, key=lambda x: x[1])[0]

    partial2 = [CONCEPT_TO_LESSON[a["concept"]] for a in answers if a.get("score") == 2 and a.get("concept") in CONCEPT_TO_LESSON]
    if partial2:
        return sorted(partial2, key=lambda x: -x[1])[0]

    return ("s01a2-recursion", 2, "Recursion & Trees")


def write_csv(path: pathlib.Path, rows: list[dict[str, Any]], fieldnames: list[str]) -> None:
    with path.open("w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def md_table(headers: list[str], rows: list[list[Any]]) -> str:
    lines = ["| " + " | ".join(headers) + " |", "| " + " | ".join(["---"] * len(headers)) + " |"]
    for row in rows:
        lines.append("| " + " | ".join(str(v) for v in row) + " |")
    return "\n".join(lines)


def duplicate_estimate(user_events: dict[str, list[dict[str, Any]]], event_type: str, window_ms: int = 100) -> dict[str, Any]:
    total = 0
    duplicates = 0
    for events in user_events.values():
        prev: list[dict[str, Any]] = []
        for event in [e for e in events if e.get("type") == event_type]:
            total += 1
            key = (event.get("lesson"), event.get("phase"))
            if any(abs((event.get("ts", 0) or 0) - (p.get("ts", 0) or 0)) <= window_ms and (p.get("lesson"), p.get("phase")) == key for p in prev[-5:]):
                duplicates += 1
            prev.append(event)
    return {"event_type": event_type, "total": total, "near_duplicate_within_100ms": duplicates, "pct": pct(duplicates, total)}


def manifest_rows(data_dir: pathlib.Path) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for path in sorted(data_dir.glob("*")):
        if not path.is_file():
            continue
        data = path.read_bytes()
        rows.append(
            {
                "file": path.name,
                "bytes": len(data),
                "lines": data.count(b"\n") + (1 if data and not data.endswith(b"\n") else 0),
                "sha256": hashlib.sha256(data).hexdigest(),
            }
        )
    return rows


def analyze(data_dir: pathlib.Path, out_dir: pathlib.Path) -> dict[str, Any]:
    user_events, users, feedback = load_data(data_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    all_events = [(uid, e) for uid, events in user_events.items() for e in events]
    valid_json_events = [(uid, e) for uid, e in all_events if not e.get("_invalid_json")]
    all_timestamps = [e.get("ts") for _, e in valid_json_events if isinstance(e.get("ts"), (int, float))]
    last_event_ts = max(all_timestamps) if all_timestamps else 0

    event_type_counts = Counter(e.get("type") for _, e in valid_json_events)
    starts = [(uid, e) for uid, e in valid_json_events if e.get("type") == "assessment_start"]
    answers = [(uid, e) for uid, e in valid_json_events if e.get("type") == "assessment_answer"]
    completions = [(uid, e) for uid, e in valid_json_events if e.get("type") == "assessment_complete"]
    current_completions = [(uid, e) for uid, e in completions if is_current_valid_completion(e)]
    current_completion_uids = {uid for uid, _ in current_completions}
    legacy_completions = [(uid, e) for uid, e in completions if not is_current_valid_completion(e)]

    start_uids = {uid for uid, _ in starts}
    starter_rows: list[dict[str, Any]] = []
    for index, uid in enumerate(sorted(start_uids), start=1):
        events = user_events[uid]
        start = next(e for e in events if e.get("type") == "assessment_start")
        uid_answers = [e for e in events if e.get("type") == "assessment_answer"]
        uid_current = [e for e in events if is_current_valid_completion(e)]
        uid_legacy = [e for e in events if e.get("type") == "assessment_complete" and not is_current_valid_completion(e)]
        if uid_current:
            status = "completed_current_pre"
            completion_event = uid_current[0]
        elif uid_legacy:
            status = "legacy_or_partial_completion"
            completion_event = uid_legacy[0]
        elif uid_answers:
            status = "partial_dropout"
            completion_event = None
        else:
            status = "started_no_answer"
            completion_event = None
        starter_rows.append(
            {
                "participant": f"P{index:02d}",
                "uid_prefix": uid_short(uid),
                "status": status,
                "group": start.get("group", ""),
                "form": start.get("form", ""),
                "start_ts": iso(start.get("ts")),
                "answer_events": len(uid_answers),
                "completion_score": completion_event.get("score") if completion_event else "",
                "completion_pct": completion_event.get("pct") if completion_event else "",
                "duration_min": round((completion_event.get("durationMs", 0) or 0) / 60000, 1) if completion_event else "",
            }
        )

    current_answer_events = [
        (uid, e)
        for uid, e in answers
        if uid in current_completion_uids and isinstance(e.get("score"), int)
    ]
    answer_score_dist = Counter(e.get("score") for _, e in current_answer_events)
    completion_scores = [e.get("score") for _, e in current_completions if isinstance(e.get("score"), int)]
    completion_pcts = [e.get("pct") for _, e in current_completions if isinstance(e.get("pct"), int)]

    concept_scores: list[dict[str, Any]] = []
    by_concept: dict[str, list[int]] = defaultdict(list)
    for _, event in current_answer_events:
        by_concept[event.get("concept", "")].append(event["score"])
    for concept, scores in sorted(by_concept.items(), key=lambda item: (statistics.mean(item[1]), item[0])):
        dist = Counter(scores)
        concept_scores.append(
            {
                "concept": concept,
                "n": len(scores),
                "mean_score_0_to_3": round(statistics.mean(scores), 2),
                "pct_of_max": round(statistics.mean(scores) / 3 * 100, 1),
                "score_0": dist.get(0, 0),
                "score_1": dist.get(1, 0),
                "score_2": dist.get(2, 0),
                "score_3": dist.get(3, 0),
            }
        )

    word_score_pairs = [(word_count(e.get("answer", "")), e["score"]) for _, e in current_answer_events]
    word_by_score: dict[int, list[int]] = defaultdict(list)
    for words, score in word_score_pairs:
        word_by_score[score].append(words)
    word_summary = {
        str(score): {
            "n": len(words),
            "mean_words": round(statistics.mean(words), 1),
            "median_words": round(statistics.median(words), 1),
            "min_words": min(words),
            "max_words": max(words),
        }
        for score, words in sorted(word_by_score.items())
    }

    participant_rows: list[dict[str, Any]] = []
    followup_rows: list[dict[str, Any]] = []
    for index, (uid, complete) in enumerate(sorted(current_completions, key=lambda item: item[1].get("ts", 0)), start=1):
        events = user_events[uid]
        start = next((e for e in events if e.get("type") == "assessment_start"), {})
        after = [e for e in events if (e.get("ts", 0) or 0) > (complete.get("ts", 0) or 0)]
        lesson_after = [e for e in after if e.get("type") in LESSON_EVENT_TYPES]
        rec_id, _, rec_title = recommend_lesson(complete.get("answers") or [])
        eligible = bool(last_event_ts and last_event_ts - (complete.get("ts", 0) or 0) >= MIN_POST_GAP_MS)
        participant = f"C{index:02d}"
        participant_rows.append(
            {
                "participant": participant,
                "uid_prefix": uid_short(uid),
                "group": complete.get("group"),
                "form": complete.get("form"),
                "score": complete.get("score"),
                "max_score": complete.get("maxScore"),
                "pct": complete.get("pct"),
                "duration_min": round((complete.get("durationMs", 0) or 0) / 60000, 1),
                "answers_in_completion_payload": len(complete.get("answers") or []),
                "unique_questions": len({a.get("questionId") for a in complete.get("answers", []) if a.get("questionId")}),
                "recommended_lesson": rec_id,
                "recommended_title": rec_title,
                "eligible_for_post_by_last_event": eligible,
                "post_started": any(e.get("type") == "assessment_start" and e.get("assessment") == "post" for e in events),
            }
        )
        followup_rows.append(
            {
                "participant": participant,
                "uid_prefix": uid_short(uid),
                "group": complete.get("group"),
                "form": complete.get("form"),
                "pre_pct": complete.get("pct"),
                "recommended_lesson": rec_id,
                "after_pre_events": len(after),
                "after_pre_lesson_events": len(lesson_after),
                "opened_any_lesson": any(e.get("type") == "lesson_open" for e in lesson_after),
                "started_any_lesson": any(e.get("type") == "start_learning" for e in lesson_after),
                "completed_any_lesson": any(e.get("type") == "lesson_complete" for e in lesson_after),
                "opened_recommended": any(e.get("type") == "lesson_open" and e.get("lesson") == rec_id for e in lesson_after),
                "started_recommended": any(e.get("type") == "start_learning" and e.get("lesson") == rec_id for e in lesson_after),
                "completed_recommended": any(e.get("type") == "lesson_complete" and e.get("lesson") == rec_id for e in lesson_after),
            }
        )

    lesson_by_user: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for uid, event in valid_json_events:
        if event.get("type") in LESSON_EVENT_TYPES:
            lesson_by_user[uid].append(event)
    top_lesson_users = sorted(lesson_by_user.items(), key=lambda item: len(item[1]), reverse=True)[:3]
    top_lesson_user_ids = {uid for uid, _ in top_lesson_users}
    lesson_events_all = [e for events in lesson_by_user.values() for e in events]
    lesson_events_without_top3 = [e for uid, events in lesson_by_user.items() for e in events if uid not in top_lesson_user_ids]
    lesson_counts = Counter(e.get("type") for e in lesson_events_all)
    lesson_counts_without_top3 = Counter(e.get("type") for e in lesson_events_without_top3)

    retry_events = [(uid, e) for uid, e in valid_json_events if e.get("type") == "tutor_retry"]
    assessment_answer_retries = []
    retry_score_pairs = []
    for uid, events in user_events.items():
        for i, event in enumerate(events):
            if event.get("type") != "assessment_answer":
                continue
            prev = next(
                (
                    p
                    for p in reversed(events[:i])
                    if p.get("type") == "tutor_retry" and (event.get("ts", 0) or 0) - (p.get("ts", 0) or 0) < 5000
                ),
                None,
            )
            if prev:
                assessment_answer_retries.append((uid, prev, event))
                match = re.search(r"SCORE:\s*(\d)", prev.get("original") or "")
                if match and isinstance(event.get("score"), int):
                    retry_score_pairs.append((int(match.group(1)), event["score"], uid, event.get("questionId")))

    chat_files = list(data_dir.glob("*_chat.jsonl"))
    chat_records = []
    for path in chat_files:
        for row in read_jsonl(path):
            row["_source_file"] = path.name
            chat_records.append(row)
    chat_models = Counter(row.get("model") for row in chat_records)
    grading_chat_records = sum(1 for row in chat_records if row.get("messages") and "grading a student" in ((row.get("messages") or [{}])[0].get("content") or ""))

    user_first_seen = [meta.get("first_seen") for meta in users.values() if isinstance(meta.get("first_seen"), (int, float))]
    country_counts = Counter((meta.get("cc") or "unknown") for meta in users.values())
    users_with_ua = sum(1 for meta in users.values() if meta.get("ua"))
    assessment_starter_metadata_known = sum(1 for uid, _ in starts if users.get(uid, {}).get("ua") or users.get(uid, {}).get("cc"))

    metrics: dict[str, Any] = {
        "source_data_dir": str(data_dir),
        "generated_at": dt.datetime.now(dt.UTC).replace(microsecond=0).isoformat(),
        "summary": {
            "registered_users": len(users),
            "user_event_files": len(user_events),
            "chat_files": len(chat_files),
            "feedback_records": len(feedback),
            "event_count": len(valid_json_events),
            "event_date_start": iso(min(all_timestamps) if all_timestamps else None),
            "event_date_end": iso(last_event_ts),
            "user_first_seen_start": iso(min(user_first_seen) if user_first_seen else None),
            "user_first_seen_end": iso(max(user_first_seen) if user_first_seen else None),
        },
        "event_type_counts": {str(key): value for key, value in event_type_counts.most_common()},
        "assessment": {
            "starts": len(starts),
            "pre_starts": sum(1 for _, e in starts if e.get("assessment") == "pre"),
            "post_starts": sum(1 for _, e in starts if e.get("assessment") == "post"),
            "answers": len(answers),
            "completions": len(completions),
            "current_valid_pre_completions": len(current_completions),
            "legacy_or_partial_completions": len(legacy_completions),
            "post_completions": sum(1 for _, e in completions if e.get("assessment") == "post"),
            "started_no_answer": sum(1 for row in starter_rows if row["status"] == "started_no_answer"),
            "partial_dropout": sum(1 for row in starter_rows if row["status"] == "partial_dropout"),
            "current_completion_rate_from_all_starts_pct": pct(len(current_completions), len(starts)),
            "any_completion_rate_from_all_starts_pct": pct(len(completions), len(starts)),
            "eligible_for_post_by_last_event": sum(1 for _, e in current_completions if last_event_ts - (e.get("ts", 0) or 0) >= MIN_POST_GAP_MS),
            "group_form_start_counts": {"|".join(map(str, key)): value for key, value in Counter((e.get("group"), e.get("form")) for _, e in starts).items()},
            "group_form_current_completion_counts": {"|".join(map(str, key)): value for key, value in Counter((e.get("group"), e.get("form")) for _, e in current_completions).items()},
        },
        "scores_current_valid_pre": {
            "n": len(current_completions),
            "mean_score": mean(completion_scores),
            "median_score": median(completion_scores),
            "min_score": min(completion_scores) if completion_scores else None,
            "max_score": max(completion_scores) if completion_scores else None,
            "mean_pct": mean(completion_pcts),
            "median_pct": median(completion_pcts),
            "answer_score_distribution": {str(key): value for key, value in sorted(answer_score_dist.items())},
            "answer_score_distribution_pct": {str(k): pct(v, len(current_answer_events)) for k, v in sorted(answer_score_dist.items())},
            "word_count_score_pearson_r": pearson(word_score_pairs),
            "word_count_by_score": word_summary,
        },
        "concept_scores_current_valid_pre": concept_scores,
        "lesson_engagement": {
            "lesson_event_users": len(lesson_by_user),
            "lesson_event_count": len(lesson_events_all),
            "unique_start_learning_users": len({uid for uid, events in lesson_by_user.items() if any(e.get("type") == "start_learning" for e in events)}),
            "unique_lesson_complete_users": len({uid for uid, events in lesson_by_user.items() if any(e.get("type") == "lesson_complete" for e in events)}),
            "start_learning_events": lesson_counts.get("start_learning", 0),
            "lesson_complete_events": lesson_counts.get("lesson_complete", 0),
            "top3_users_event_count": sum(len(events) for _, events in top_lesson_users),
            "top3_users_event_pct": pct(sum(len(events) for _, events in top_lesson_users), len(lesson_events_all)),
            "top3_users_completion_count": sum(Counter(e.get("type") for e in events).get("lesson_complete", 0) for _, events in top_lesson_users),
            "without_top3_users": len(set(lesson_by_user) - top_lesson_user_ids),
            "without_top3_start_learning_events": lesson_counts_without_top3.get("start_learning", 0),
            "without_top3_lesson_complete_events": lesson_counts_without_top3.get("lesson_complete", 0),
            "top_opened_lessons": Counter(e.get("lesson") for e in lesson_events_all if e.get("type") == "lesson_open").most_common(10),
            "top_started_lessons": Counter(e.get("lesson") for e in lesson_events_all if e.get("type") == "start_learning").most_common(10),
            "top_completed_lessons": Counter(e.get("lesson") for e in lesson_events_all if e.get("type") == "lesson_complete").most_common(10),
            "duplicate_estimates": [duplicate_estimate(user_events, "lesson_open"), duplicate_estimate(user_events, "phase_change")],
        },
        "followup_after_valid_pre": {
            "treatment_pre_completers": sum(1 for row in followup_rows if row["group"] == "treatment"),
            "treatment_opened_any_lesson": sum(1 for row in followup_rows if row["group"] == "treatment" and row["opened_any_lesson"]),
            "treatment_started_any_lesson": sum(1 for row in followup_rows if row["group"] == "treatment" and row["started_any_lesson"]),
            "treatment_completed_any_lesson": sum(1 for row in followup_rows if row["group"] == "treatment" and row["completed_any_lesson"]),
            "treatment_opened_recommended": sum(1 for row in followup_rows if row["group"] == "treatment" and row["opened_recommended"]),
            "treatment_started_recommended": sum(1 for row in followup_rows if row["group"] == "treatment" and row["started_recommended"]),
            "treatment_completed_recommended": sum(1 for row in followup_rows if row["group"] == "treatment" and row["completed_recommended"]),
            "post_starts_after_pre": sum(1 for row in participant_rows if row["post_started"]),
        },
        "llm_and_grading": {
            "tutor_retry_events": len(retry_events),
            "tutor_retry_reasons": {str(key): value for key, value in Counter(e.get("reason") for _, e in retry_events).items()},
            "assessment_answers_with_immediate_retry": len(assessment_answer_retries),
            "assessment_answers_with_immediate_retry_pct": pct(len(assessment_answer_retries), len(answers)),
            "parseable_retry_score_pairs": len(retry_score_pairs),
            "retry_score_changed_count": sum(1 for before, after, _, _ in retry_score_pairs if before != after),
            "retry_score_changed_pct": pct(sum(1 for before, after, _, _ in retry_score_pairs if before != after), len(retry_score_pairs)),
            "chat_records": len(chat_records),
            "chat_failed_preretry_records": sum(1 for row in chat_records if row.get("failed")),
            "grading_chat_records": grading_chat_records,
            "chat_models": {str(key): value for key, value in chat_models.most_common()},
        },
        "metadata_quality": {
            "users_with_ua": users_with_ua,
            "users_with_country": sum(1 for meta in users.values() if meta.get("cc")),
            "assessment_starters_with_ua_or_country": assessment_starter_metadata_known,
            "country_counts_top10": country_counts.most_common(10),
            "malformed_or_missing_type_events": event_type_counts.get(None, 0),
        },
    }

    write_csv(
        out_dir / "assessment_starters.csv",
        starter_rows,
        ["participant", "uid_prefix", "status", "group", "form", "start_ts", "answer_events", "completion_score", "completion_pct", "duration_min"],
    )
    write_csv(
        out_dir / "assessment_current_pre_completions.csv",
        participant_rows,
        [
            "participant",
            "uid_prefix",
            "group",
            "form",
            "score",
            "max_score",
            "pct",
            "duration_min",
            "answers_in_completion_payload",
            "unique_questions",
            "recommended_lesson",
            "recommended_title",
            "eligible_for_post_by_last_event",
            "post_started",
        ],
    )
    write_csv(
        out_dir / "assessment_concept_scores.csv",
        concept_scores,
        ["concept", "n", "mean_score_0_to_3", "pct_of_max", "score_0", "score_1", "score_2", "score_3"],
    )
    write_csv(
        out_dir / "assessment_lesson_followup.csv",
        followup_rows,
        [
            "participant",
            "uid_prefix",
            "group",
            "form",
            "pre_pct",
            "recommended_lesson",
            "after_pre_events",
            "after_pre_lesson_events",
            "opened_any_lesson",
            "started_any_lesson",
            "completed_any_lesson",
            "opened_recommended",
            "started_recommended",
            "completed_recommended",
        ],
    )
    write_csv(out_dir / "data_manifest.csv", manifest_rows(data_dir), ["file", "bytes", "lines", "sha256"])

    (out_dir / "assessment_metrics.json").write_text(json.dumps(metrics, indent=2, sort_keys=True))
    (out_dir / "assessment_insights.md").write_text(render_report(metrics, starter_rows, participant_rows, concept_scores, followup_rows))
    return metrics


def render_report(
    metrics: dict[str, Any],
    starter_rows: list[dict[str, Any]],
    participant_rows: list[dict[str, Any]],
    concept_scores: list[dict[str, Any]],
    followup_rows: list[dict[str, Any]],
) -> str:
    summary = metrics["summary"]
    assessment = metrics["assessment"]
    scores = metrics["scores_current_valid_pre"]
    lessons = metrics["lesson_engagement"]
    followup = metrics["followup_after_valid_pre"]
    llm = metrics["llm_and_grading"]
    metadata = metrics["metadata_quality"]

    status_counts = Counter(row["status"] for row in starter_rows)
    group_form_start_rows = [[key.replace("|", " / "), value] for key, value in sorted(assessment["group_form_start_counts"].items())]
    group_form_completion_rows = [[key.replace("|", " / "), value] for key, value in sorted(assessment["group_form_current_completion_counts"].items())]

    participant_table_rows = [
        [
            row["participant"],
            row["group"],
            row["form"],
            f"{row['score']}/{row['max_score']}",
            f"{row['pct']}%",
            row["duration_min"],
            row["recommended_lesson"],
            "yes" if row["eligible_for_post_by_last_event"] else "no",
            "yes" if row["post_started"] else "no",
        ]
        for row in participant_rows
    ]
    concept_table_rows = [
        [
            row["concept"],
            row["n"],
            row["mean_score_0_to_3"],
            f"{row['pct_of_max']}%",
            f"{row['score_0']}/{row['score_1']}/{row['score_2']}/{row['score_3']}",
        ]
        for row in concept_scores
    ]
    followup_table_rows = [
        [
            row["participant"],
            row["group"],
            row["pre_pct"],
            row["recommended_lesson"],
            "yes" if row["opened_any_lesson"] else "no",
            "yes" if row["started_any_lesson"] else "no",
            "yes" if row["opened_recommended"] else "no",
            "yes" if row["completed_recommended"] else "no",
        ]
        for row in followup_rows
    ]
    duplicate_payload_rows = [row for row in participant_rows if row["answers_in_completion_payload"] != row["unique_questions"]]
    word_rows = [
        [score, info["n"], info["mean_words"], info["median_words"], f"{info['min_words']}-{info['max_words']}"]
        for score, info in scores["word_count_by_score"].items()
    ]

    lines = [
        "# CodeProbe Assessment Insights",
        "",
        f"Source data: `{metrics['source_data_dir']}`",
        f"Generated: `{metrics['generated_at']}`",
        "",
        "## Executive Summary",
        "",
        f"The study cannot answer its original causal question yet: there are `{assessment['post_starts']}` post-test starts and `{assessment['post_completions']}` post-test completions. There are no pre/post pairs.",
        f"The useful current-study dataset is `{assessment['current_valid_pre_completions']}` valid 8-question pre-test completions out of `{assessment['starts']}` assessment starts. There is also `{assessment['legacy_or_partial_completions']}` legacy/partial completion using an older 5-question shape.",
        f"The biggest implementation problem in the collected assessment data is assignment confounding: all treatment starts are Form B and all control starts are Form A. Any group comparison is also a form comparison.",
        f"The clearest behavioral finding is retention failure after part 1. By the last event in the backup, `{assessment['eligible_for_post_by_last_event']}` valid pre-test completers had passed the 46-hour post-test lock, but none started a post-test.",
        f"The treatment recommendation did not create much lesson engagement: among `{followup['treatment_pre_completers']}` valid treatment pre-test completers, `{followup['treatment_opened_recommended']}` opened the recommended lesson, `{followup['treatment_started_recommended']}` started it, and `{followup['treatment_completed_recommended']}` completed it.",
        "",
        "## Data Inventory",
        "",
        md_table(
            ["Measure", "Value"],
            [
                ["Registered users", summary["registered_users"]],
                ["User event files", summary["user_event_files"]],
                ["Chat files", summary["chat_files"]],
                ["Feedback records", summary["feedback_records"]],
                ["Parsed events", summary["event_count"]],
                ["Event date range", f"{summary['event_date_start']} to {summary['event_date_end']}"],
            ],
        ),
        "",
        "Evidence files generated by this run:",
        "",
        "- `analysis/assessment_metrics.json`: full machine-readable metrics.",
        "- `analysis/assessment_starters.csv`: every assessment starter with status.",
        "- `analysis/assessment_current_pre_completions.csv`: valid current pre-test completions.",
        "- `analysis/assessment_concept_scores.csv`: item/concept score table.",
        "- `analysis/assessment_lesson_followup.csv`: post-pre lesson engagement.",
        "- `analysis/data_manifest.csv`: source-file line counts and SHA-256 checksums.",
        "",
        "## Assessment Funnel",
        "",
        md_table(
            ["Step", "Count", "Rate"],
            [
                ["Assessment starts", assessment["starts"], "100%"],
                ["Started but no answer", status_counts.get("started_no_answer", 0), f"{pct(status_counts.get('started_no_answer', 0), assessment['starts'])}%"],
                ["Partial dropout", status_counts.get("partial_dropout", 0), f"{pct(status_counts.get('partial_dropout', 0), assessment['starts'])}%"],
                ["Legacy/partial completion", status_counts.get("legacy_or_partial_completion", 0), f"{pct(status_counts.get('legacy_or_partial_completion', 0), assessment['starts'])}%"],
                ["Valid current pre completion", assessment["current_valid_pre_completions"], f"{assessment['current_completion_rate_from_all_starts_pct']}%"],
                ["Post-test starts", assessment["post_starts"], "0%"],
            ],
        ),
        "",
        "Assignment and form counts among starts:",
        "",
        md_table(["Group / Form", "Starts"], group_form_start_rows),
        "",
        "Assignment and form counts among valid current pre-test completions:",
        "",
        md_table(["Group / Form", "Completions"], group_form_completion_rows),
        "",
        "This means the observed treatment/control split is not usable as an experiment. The current backup has no treatment/Form A or control/Form B users.",
        "The pattern is consistent with the earlier assignment logic coupling treatment and form through the same UID hash parity: without the later independent `formCounterbalance`, `hashUID(uid, 1) % 2` and `hashUID(uid, 2) % 2` have opposite parity for the same UID. The collected `assessment_start` events also do not contain `formCounterbalance`, so this dataset should be treated as pre-fix/confounded.",
        "",
        "## Current Pre-Test Scores",
        "",
        md_table(
            ["Measure", "Value"],
            [
                ["Valid current pre-test completions", scores["n"]],
                ["Mean score", f"{scores['mean_score']}/24"],
                ["Median score", f"{scores['median_score']}/24"],
                ["Range", f"{scores['min_score']}-{scores['max_score']}/24"],
                ["Mean percent", f"{scores['mean_pct']}%"],
                ["Median percent", f"{scores['median_pct']}%"],
                ["Answer score distribution", json.dumps(scores["answer_score_distribution"], sort_keys=True)],
            ],
        ),
        "",
        "Participant-level current pre-test completions:",
        "",
        md_table(["ID", "Group", "Form", "Score", "Pct", "Duration min", "Recommended", "Post eligible", "Post started"], participant_table_rows),
        "",
        "The two control/Form A completers scored 96% and 46%; the six treatment/Form B completers averaged 42%. This is descriptive only because group and form are confounded and n is tiny.",
        "",
        "## Concept-Level Findings",
        "",
        md_table(["Concept", "n", "Mean", "% of max", "0/1/2/3 counts"], concept_table_rows),
        "",
        "Interpretation: learners were strongest on strings/null termination in this sample, while modular state-tracing, write/file-descriptor reasoning, ASCII character math, and recursion were weaker. `Logic: swap and in-place modification` has only two observations because it appears only on Form A in this dataset.",
        "",
        "## Grading Signals",
        "",
        f"Answer length is strongly associated with AI score in the current valid pre-test set: Pearson r = `{scores['word_count_score_pearson_r']}` over `{sum(info['n'] for info in scores['word_count_by_score'].values())}` scored answers.",
        "",
        md_table(["Score", "n", "Mean words", "Median words", "Range"], word_rows),
        "",
        f"There were `{llm['assessment_answers_with_immediate_retry']}` assessment answers with an immediate `tutor_retry`, which is `{llm['assessment_answers_with_immediate_retry_pct']}%` of all assessment answers. Among `{llm['parseable_retry_score_pairs']}` parseable retry/final score pairs, `{llm['retry_score_changed_count']}` changed score after retry (`{llm['retry_score_changed_pct']}%`). This is a small but direct signal of grader noise.",
        "",
        "## Lesson Engagement",
        "",
        md_table(
            ["Measure", "Value"],
            [
                ["Users with lesson-related events", lessons["lesson_event_users"]],
                ["Raw lesson-related events", lessons["lesson_event_count"]],
                ["Unique users who started learning", lessons["unique_start_learning_users"]],
                ["Unique users who completed at least one lesson", lessons["unique_lesson_complete_users"]],
                ["start_learning events", lessons["start_learning_events"]],
                ["lesson_complete events", lessons["lesson_complete_events"]],
                ["Top 3 users' share of lesson events", f"{lessons['top3_users_event_pct']}%"],
                ["Lesson completions outside top 3 users", lessons["without_top3_lesson_complete_events"]],
            ],
        ),
        "",
        "Top completed lessons:",
        "",
        md_table(["Lesson", "Completions"], [[lesson, count] for lesson, count in lessons["top_completed_lessons"]]),
        "",
        f"Raw browsing counts are inflated: `{lessons['duplicate_estimates'][0]['pct']}%` of `lesson_open` events and `{lessons['duplicate_estimates'][1]['pct']}%` of `phase_change` events look like near-duplicates within 100 ms.",
        "",
        "## Treatment Follow-Up",
        "",
        md_table(["ID", "Group", "Pre pct", "Recommended", "Opened any", "Started any", "Opened rec", "Completed rec"], followup_table_rows),
        "",
        "The recommendation mechanism did not convert into the intended learning behavior in the observed treatment pre-test completers. One treatment participant opened their recommended lesson, one started a non-recommended lesson, and none completed a recommended lesson before the backup ended.",
        "",
        "## Data Quality Notes",
        "",
        f"User metadata is incomplete for the assessment cohort: only `{metadata['assessment_starters_with_ua_or_country']}` of `{assessment['starts']}` assessment starters have UA or country metadata in `_users.json`. Do not make device/geography claims about assessment participants.",
        f"There is `{len(duplicate_payload_rows)}` current completion with a duplicate/null answer payload row (`answers_in_completion_payload` differs from `unique_questions`); score tables use the logged `assessment_answer` events and 8 unique questions.",
        f"There is `{assessment['legacy_or_partial_completions']}` legacy/partial completion with an older max-score shape; it is excluded from current score and concept summaries.",
        f"The broader app traffic was international, but not controlled recruitment. Top country codes in `_users.json`: `{metadata['country_counts_top10']}`.",
        f"There are `{metadata['malformed_or_missing_type_events']}` user-event records with missing `type`. They do not affect the assessment result counts.",
        "Feedback data is not useful for product conclusions: the standalone feedback file contains only a handful of joke/test messages.",
        "",
        "## Bottom Line",
        "",
        "The data still teaches something useful: the failure mode was not that nobody could finish a pre-test; the failure mode was post-test retention and weak post-pre learning conversion. The assessment also exposed a serious assignment/form confound in the collected data and measurable automated-grading noise. For the next run, fix assignment logging/counterbalancing, capture a contact/reminder mechanism or shorten the return loop, instrument assessment page visits before consent if allowed, and human-audit a sample of AI grades.",
        "",
    ]
    return "\n".join(lines)


def main() -> int:
    data_dir = pathlib.Path(sys.argv[1]).expanduser() if len(sys.argv) > 1 else DEFAULT_DATA_DIR
    out_dir = pathlib.Path(sys.argv[2]).expanduser() if len(sys.argv) > 2 else DEFAULT_OUT_DIR
    if not data_dir.exists():
        print(f"Data directory does not exist: {data_dir}", file=sys.stderr)
        return 1
    metrics = analyze(data_dir, out_dir)
    print(f"Wrote assessment report to {out_dir / 'assessment_insights.md'}")
    print(f"Valid current pre-test completions: {metrics['assessment']['current_valid_pre_completions']}")
    print(f"Post-test completions: {metrics['assessment']['post_completions']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
