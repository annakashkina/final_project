"""
Line Reference Validator — post-processing for LLM tutor responses.

Detects incorrect line number references and corrects them before
the student sees the response.

Usage from serve.py:
    from validator import fix_line_refs
    reply = fix_line_refs(reply, code)

This module is also the single source of truth for feature extraction
used at training time — ml/extract_features.py imports `extract_features`
and `FEATURE_NAMES` from here.
"""

import hashlib
import hmac
import math
import os
import pickle
import re
import sys
from collections import Counter

import numpy as np


# ── Detection thresholds ────────────────────────────────────────────────
# p_wrong(claim) >= DETECT_T              → claimed ref is flagged as wrong
# p_wrong(cand)  < 0.5                    → candidate is on the "correct" side
# p_wrong(claim) - p_wrong(cand) >= MARGIN → candidate is meaningfully better
# No correction-window constant: `distance_from_claim` is now a feature, so
# the model learns when distant candidates are plausible.
DETECT_T = 0.5
ACCEPT_MARGIN = 0.3


# ── Regexes and lexicons ────────────────────────────────────────────────

LINE_REF_RE = re.compile(r"[Ll]ines?\s+(\d+)(?:\s*[-–]\s*(\d+))?")
COMMENT_RE = re.compile(r"^\s*(//|#|/\*|\*|--|;)")
BLANK_RE = re.compile(r"^\s*$")

# Words that aren't code identifiers even though they look like them.
STOPWORDS = frozenset(
    "the and but for not you all can had her was one our out are has his how its "
    "let may new now old see way who did get got him hit put run say she too use "
    "also back been call come each find from give have here into just know like "
    "look make many more most much must name only over such take than them then "
    "this very when will with what that your does done some they used were which "
    "would could should about after again being below between both same other "
    "these those above where while think line lines code because prints print "
    "output says means called first second third next last still right wrong "
    "correct check quiz answer question explain predict yes exactly great good "
    "concept happens note start starting type value why before since every using "
    "here there what shows inside runs keep keeps main function variable result "
    "example says happens means tries tells acts works reads goes adds returns "
    "takes gives true false will ends begins after".split()
)

# Language keywords — present on many lines, low discriminative value.
CODE_KEYWORDS = frozenset(
    "int char void float double long short unsigned signed const static "
    "if else for while do switch case default break continue return goto "
    "struct union enum typedef sizeof "
    "class public private protected virtual override new delete this "
    "template typename namespace using auto constexpr concept requires "
    "def self end nil puts require include module attr_accessor "
    "fn let mut pub impl mod use crate super where trait enum match "
    "import from as pass lambda with yield assert del raise except try finally "
    "function var const export async await throw catch "
    "printf println std cout cin cerr".split()
)


# ── Pure helpers (importable by training pipeline) ──────────────────────

def backtick_spans(text):
    """Return stripped backtick-quoted spans of length > 1 from `text`."""
    return [s.strip() for s in re.findall(r"`([^`]+)`", text) if len(s.strip()) > 1]


def extract_identifiers(text):
    """Pull likely code identifiers from text. Backticked tokens count even if
    short; bare tokens require length > 2 and pass stopword/keyword filters."""
    ids = set()
    for span in re.findall(r"`([^`]+)`", text):
        for tok in re.findall(r"[a-zA-Z_]\w*", span):
            if tok.lower() not in STOPWORDS and tok.lower() not in CODE_KEYWORDS:
                ids.add(tok)
    for tok in re.findall(r"\b[a-z_]\w*\b", text):
        if (
            len(tok) > 2
            and tok.lower() not in STOPWORDS
            and tok.lower() not in CODE_KEYWORDS
        ):
            ids.add(tok)
    return ids


def extract_refs(text):
    """Find line references in `text`. Returns dicts with `raw`, `start`, `end`,
    `context` (sentence around the ref), `match_start`, `match_end`."""
    refs = []
    for match in LINE_REF_RE.finditer(text):
        start = int(match.group(1))
        end = int(match.group(2)) if match.group(2) else None

        pos = match.start()
        ctx_start = pos
        for boundary in (". ", ".\n", "\n\n", "\n"):
            idx = text.rfind(boundary, max(0, pos - 200), pos)
            if idx != -1:
                ctx_start = idx + len(boundary)
                break
        else:
            ctx_start = max(0, pos - 150)

        ctx_end = pos + len(match.group(0))
        for boundary in (". ", ".\n", "\n\n", "\n"):
            idx = text.find(boundary, ctx_end)
            if idx != -1 and idx < ctx_end + 200:
                ctx_end = idx + 1
                break
        else:
            ctx_end = min(len(text), ctx_end + 150)

        refs.append({
            "raw": match.group(0),
            "start": start,
            "end": end,
            "context": text[ctx_start:ctx_end].strip(),
            "match_start": match.start(),
            "match_end": match.end(),
        })
    return refs


# ── TF-IDF helpers ──────────────────────────────────────────────────────

def _tokenize(text):
    return [t.lower() for t in re.findall(r"[a-zA-Z_]\w*", text) if len(t) > 1]


def _compute_tfidf(documents):
    n = len(documents)
    df = Counter()
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


def _cosine_sim(v1, v2):
    if not v1 or not v2:
        return 0.0
    common = set(v1) & set(v2)
    if not common:
        return 0.0
    dot = sum(v1[k] * v2[k] for k in common)
    norm1 = math.sqrt(sum(v ** 2 for v in v1.values()))
    norm2 = math.sqrt(sum(v ** 2 for v in v2.values()))
    if norm1 == 0 or norm2 == 0:
        return 0.0
    return dot / (norm1 * norm2)


# ── Feature extraction ──────────────────────────────────────────────────

FEATURE_NAMES = [
    # Reference properties
    "ref_line_num", "total_lines", "relative_position",
    "is_range", "range_size", "context_length",
    # Line content
    "ref_line_is_blank", "ref_line_is_comment", "ref_line_code_length",
    "ref_line_indent", "ref_line_has_brace",
    # Backtick matching
    "backtick_match_ref", "backtick_span_count",
    "backtick_full_overlap", "backtick_token_overlap",
    "longest_span_match_ratio",
    # Code block proximity
    "code_block_near_ref",
    # Identifier overlap
    "id_overlap_ref", "id_overlap_best", "id_overlap_ratio",
    "best_match_distance", "identifiers_found", "id_unique_to_ref",
    # Neighbor analysis
    "neighbor_max_score", "neighbor_better", "best_neighbor_distance",
    # TF-IDF
    "tfidf_cosine_best", "tfidf_cosine_ratio",
    # Context structure
    "context_has_colon", "context_has_code_block",
    # Distance from the original LLM claim (0 when scoring the claim itself)
    "distance_from_claim",
]


def extract_features(ref, code_lines, full_response="", claim_line=None):
    """Compute the feature vector for one ref against `code_lines`.

    When `claim_line` is None, `ref['start']` is treated as the original claim
    (distance_from_claim = 0). At inference time, when scoring candidate lines
    other than the LLM's claim, pass the original claim explicitly so the model
    sees the |L - claim| distance.

    Returns None if the ref is out of bounds.
    """
    start = ref["start"]
    end = ref.get("end") or start
    total = len(code_lines)
    context = ref.get("context", "")

    if start < 1 or start > total:
        return None
    end = min(end, total)
    if claim_line is None:
        claim_line = start
    distance_from_claim = abs(start - claim_line)

    # ── Reference properties ──
    relative_position = start / total if total > 0 else 0
    is_range = 1 if ref.get("end") else 0
    range_size = end - start + 1

    # ── Line content ──
    ref_line = code_lines[start - 1]
    ref_blank = 1 if BLANK_RE.match(ref_line) else 0
    ref_comment = 1 if COMMENT_RE.match(ref_line) and not ref_blank else 0
    ref_code_len = len(ref_line.strip())
    ref_indent = len(ref_line) - len(ref_line.lstrip()) if ref_line.strip() else 0
    ref_has_brace = 1 if re.search(r"[{}]", ref_line) else 0

    # ── Backtick matching ──
    spans = backtick_spans(context)
    backtick_count = len(spans)
    ref_block = " ".join(code_lines[start - 1:end])
    ref_block_lower = ref_block.lower()

    backtick_ref = 1 if any(s in ref_block for s in spans if len(s) > 2) else 0

    backtick_full_overlap = 0.0
    backtick_token_overlap = 0.0
    longest_matched = 0
    longest_in_context = 0
    for span in spans:
        if len(span) <= 2:
            continue
        longest_in_context = max(longest_in_context, len(span))
        span_lower = span.lower().strip()
        if span_lower in ref_block_lower:
            backtick_full_overlap = 1.0
            longest_matched = max(longest_matched, len(span))
        else:
            span_toks = set(re.findall(r"[a-zA-Z_]\w*", span))
            ref_toks = set(re.findall(r"[a-zA-Z_]\w*", ref_block))
            if span_toks:
                backtick_token_overlap = max(
                    backtick_token_overlap, len(span_toks & ref_toks) / len(span_toks)
                )

    longest_span_match_ratio = (
        longest_matched / longest_in_context if longest_in_context else 0.0
    )

    # ── Code block proximity ──
    code_block_near = 0
    ref_pos = ref.get("match_start", 0)
    for m in re.finditer(r"```", full_response):
        if abs(m.start() - ref_pos) < 200:
            code_block_near = 1
            break

    # ── Identifier overlap ──
    ids = extract_identifiers(context)
    id_count = len(ids)

    def line_score(idx):
        if idx < 0 or idx >= total:
            return 0
        return len(ids & set(re.findall(r"[a-zA-Z_]\w*", code_lines[idx])))

    ref_score = max((line_score(i) for i in range(start - 1, end)), default=0)
    all_scores = [(i + 1, line_score(i)) for i in range(total)]
    all_scores.sort(key=lambda x: x[1], reverse=True)
    best_line, best_score = all_scores[0] if all_scores else (start, 0)
    id_ratio = (
        ref_score / best_score if best_score > 0
        else (1.0 if ref_score == 0 else 0.0)
    )
    best_distance = abs(start - best_line)

    # Identifiers that appear ONLY on the ref line — strong correctness signal.
    ref_line_tokens = set(re.findall(r"[a-zA-Z_]\w*", ref_block))
    id_unique = 0
    for ident in ids:
        if ident in ref_line_tokens and not any(
            ident in set(re.findall(r"[a-zA-Z_]\w*", code_lines[j]))
            for j in range(total) if j != start - 1
        ):
            id_unique += 1

    # ── Neighbor analysis (±3) ──
    neighbor_range = list(range(max(0, start - 4), min(total, end + 3)))
    neighbor_scored = [(i + 1, line_score(i)) for i in neighbor_range]
    neighbor_scored.sort(key=lambda x: x[1], reverse=True)
    neighbor_max = neighbor_scored[0][1] if neighbor_scored else 0
    neighbor_better = 1 if neighbor_max > ref_score else 0
    best_neighbor_dist = (
        abs(start - neighbor_scored[0][0]) if neighbor_scored else 0
    )

    # ── TF-IDF ──
    context_tokens = _tokenize(context)
    all_docs = [_tokenize(line) for line in code_lines] + [context_tokens]
    tfidf_vecs = _compute_tfidf(all_docs)
    context_vec = tfidf_vecs[-1]
    best_tfidf_line = max(
        range(total), key=lambda i: _cosine_sim(tfidf_vecs[i], context_vec)
    )
    tfidf_ref = _cosine_sim(context_vec, tfidf_vecs[start - 1])
    tfidf_best = _cosine_sim(context_vec, tfidf_vecs[best_tfidf_line])
    tfidf_ratio = (
        tfidf_ref / tfidf_best if tfidf_best > 0
        else (1.0 if tfidf_ref == 0 else 0.0)
    )

    # ── Context structure ──
    context_has_colon = 1 if re.search(r"[Ll]ines?\s+\d+\s*:", context) else 0
    context_has_code_block = 1 if "```" in context else 0

    return [
        start, total, relative_position, is_range, range_size, len(context),
        ref_blank, ref_comment, ref_code_len, ref_indent, ref_has_brace,
        backtick_ref, backtick_count, backtick_full_overlap, backtick_token_overlap,
        longest_span_match_ratio,
        code_block_near,
        ref_score, best_score, id_ratio, best_distance, id_count, id_unique,
        neighbor_max, neighbor_better, best_neighbor_dist,
        tfidf_best, tfidf_ratio,
        context_has_colon, context_has_code_block,
        distance_from_claim,
    ]


# ── Model loading and HMAC signing ──────────────────────────────────────

_model_data = None


def _load_model():
    """Load the pickled model after verifying its HMAC-SHA256 sidecar signature
    against VALIDATOR_HMAC_KEY. Refuses to load on missing key/sig or mismatch —
    pickle.loads is RCE on tampered input. Returns None if unavailable."""
    global _model_data
    if _model_data is not None:
        return _model_data

    base = os.path.dirname(os.path.abspath(__file__))
    model_path = os.path.join(base, "validator_model.pkl")
    sig_path = model_path + ".sig"
    if not os.path.exists(model_path):
        print(f"Validator: model not found at {model_path}", file=sys.stderr)
        return None

    key = os.environ.get("VALIDATOR_HMAC_KEY", "").encode()
    if not key:
        print(
            "Validator: VALIDATOR_HMAC_KEY not set — refusing to load pickle model",
            file=sys.stderr,
        )
        return None
    if not os.path.exists(sig_path):
        print(
            f"Validator: signature missing at {sig_path} — refusing to load",
            file=sys.stderr,
        )
        return None

    try:
        with open(model_path, "rb") as f:
            model_bytes = f.read()
        with open(sig_path) as f:
            expected = f.read().strip()
        actual = hmac.new(key, model_bytes, hashlib.sha256).hexdigest()
        if not hmac.compare_digest(actual, expected):
            print(
                "Validator: HMAC mismatch — refusing to load pickle model",
                file=sys.stderr,
            )
            return None
        _model_data = pickle.loads(model_bytes)
        print(f"Validator: loaded {_model_data['model_name']} model", file=sys.stderr)
        return _model_data
    except Exception as e:
        print(f"Validator: failed to load model: {type(e).__name__}", file=sys.stderr)
        return None


def _sign_model_cli():
    """Regenerate the .sig file. Usage:
       VALIDATOR_HMAC_KEY=... python3 validator.py --sign"""
    key = os.environ.get("VALIDATOR_HMAC_KEY", "").encode()
    if not key:
        print("Set VALIDATOR_HMAC_KEY first", file=sys.stderr)
        sys.exit(2)
    base = os.path.dirname(os.path.abspath(__file__))
    model_path = os.path.join(base, "validator_model.pkl")
    with open(model_path, "rb") as f:
        sig = hmac.new(key, f.read(), hashlib.sha256).hexdigest()
    with open(model_path + ".sig", "w") as f:
        f.write(sig + "\n")
    print(f"Wrote {model_path}.sig")


# ── Public API ──────────────────────────────────────────────────────────

def _replace_numbers(text, values):
    """Replace each successive integer in `text` with the next value."""
    out = []
    last = 0
    i = 0
    for m in re.finditer(r"\d+", text):
        out.append(text[last:m.start()])
        out.append(str(values[i]) if i < len(values) else m.group(0))
        last = m.end()
        i += 1
    out.append(text[last:])
    return "".join(out)


def _p_wrong(model, scaler, features):
    X = np.array([features])
    if scaler:
        X = scaler.transform(X)
    if hasattr(model, "predict_proba"):
        return float(model.predict_proba(X)[0][0])
    return 1.0 if model.predict(X)[0] == 0 else 0.0


def fix_line_refs(reply, code):
    """Validate and fix line references in a tutor response.

    Strategy:
      1. Score the LLM's claim with the classifier (distance_from_claim = 0).
      2. If `p_wrong(claim) >= DETECT_T`, score EVERY line of the file as a
         candidate (distance_from_claim = |L - claim|). The model has learned
         how distance from the claim should weigh against feature evidence.
      3. Apply correction only if the best candidate is on the "correct" side
         of the decision boundary AND clearly better than the claim.
    """
    model_data = _load_model()
    if model_data is None:
        return reply

    model = model_data["model"]
    scaler = model_data.get("scaler")
    code_lines = code.split("\n")
    total = len(code_lines)

    refs = extract_refs(reply)
    if not refs:
        return reply

    corrections = []
    for ref in reversed(refs):
        claim = ref["start"]
        if claim < 1 or claim > total:
            continue

        features = extract_features(ref, code_lines, reply, claim_line=claim)
        if features is None:
            continue
        p_claim = _p_wrong(model, scaler, features)
        if p_claim < DETECT_T:
            continue

        best_p = p_claim
        best_line = claim
        for cand in range(1, total + 1):
            if cand == claim:
                continue
            cand_ref = dict(ref)
            cand_ref["start"] = cand
            if ref.get("end") is not None:
                shift = cand - claim
                cand_ref["end"] = ref["end"] + shift
                if cand_ref["end"] > total or cand_ref["end"] < cand:
                    continue
            cand_feats = extract_features(
                cand_ref, code_lines, reply, claim_line=claim
            )
            if cand_feats is None:
                continue
            cand_p = _p_wrong(model, scaler, cand_feats)
            if cand_p < best_p:
                best_p = cand_p
                best_line = cand

        if (
            best_line == claim
            or best_p >= 0.5
            or (p_claim - best_p) < ACCEPT_MARGIN
        ):
            continue
        start = claim  # name used by the rename block below

        # Build the new "Line N" / "lines N–M" string preserving the original shape.
        end = ref.get("end")
        old = ref["raw"]
        if end is not None:
            shift = best_line - start
            new_end = end + shift
            if new_end > total or new_end < 1:
                continue
            new = _replace_numbers(old, [best_line, new_end])
        else:
            new = _replace_numbers(old, [best_line])

        if new != old:
            corrections.append((ref["match_start"], ref["match_end"], new))

    result = reply
    for start_pos, end_pos, replacement in corrections:
        result = result[:start_pos] + replacement + result[end_pos:]

    if corrections:
        print(f"Validator: fixed {len(corrections)} line ref(s)", file=sys.stderr)

    return result


def extract_code_from_messages(messages):
    """Pull the first fenced code block out of a system prompt."""
    for m in messages:
        if m.get("role") == "system":
            match = re.search(r"```\n(.*?)\n```", m.get("content", ""), re.DOTALL)
            if match:
                code = match.group(1)
                lines = code.split("\n")
                while lines and re.match(r"^---\s+.+\s+---$", lines[0]):
                    lines.pop(0)
                return "\n".join(lines)
    return ""


if __name__ == "__main__" and len(sys.argv) > 1 and sys.argv[1] == "--sign":
    _sign_model_cli()
    sys.exit(0)
