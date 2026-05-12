"""
Line Reference Validator — post-processing for LLM tutor responses.

Detects incorrect line number references and corrects them before
the student sees the response. Runs in ~5ms per response.

Usage from serve.py:
    from validator import fix_line_refs
    reply = fix_line_refs(reply, code)
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

# ── Model loading ────────────────────────────────────────────────────────

_model_data = None


def _load_model():
    """Load the pickled validator model, but only after verifying an HMAC-SHA256
    signature from a sidecar .sig file against VALIDATOR_HMAC_KEY. This prevents
    a tampered .pkl from yielding RCE via unpickling. If the key is unset or the
    signature missing/wrong, the validator is disabled (returns None)."""
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
        print("Validator: VALIDATOR_HMAC_KEY not set — refusing to load pickle model",
              file=sys.stderr)
        return None
    if not os.path.exists(sig_path):
        print(f"Validator: signature missing at {sig_path} — refusing to load",
              file=sys.stderr)
        return None

    try:
        with open(model_path, "rb") as f:
            model_bytes = f.read()
        with open(sig_path) as f:
            expected = f.read().strip()
        actual = hmac.new(key, model_bytes, hashlib.sha256).hexdigest()
        if not hmac.compare_digest(actual, expected):
            print("Validator: HMAC mismatch — refusing to load pickle model",
                  file=sys.stderr)
            return None
        _model_data = pickle.loads(model_bytes)
        print(f"Validator: loaded {_model_data['model_name']} model", file=sys.stderr)
        return _model_data
    except Exception as e:
        print(f"Validator: failed to load model: {type(e).__name__}", file=sys.stderr)
        return None


def _sign_model_cli():
    """Helper: regenerate the .sig file. Run:
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


if __name__ == "__main__" and len(sys.argv) > 1 and sys.argv[1] == "--sign":
    _sign_model_cli()
    sys.exit(0)


# ── Line reference extraction ────────────────────────────────────────────

_LINE_REF_RE = re.compile(r"[Ll]ines?\s+(\d+)(?:\s*[-–]\s*(\d+))?")
_COMMENT_RE = re.compile(r"^\s*(//|#|/\*|\*|--|;)")

_STOPWORDS = frozenset(
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

_CODE_KEYWORDS = frozenset(
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


def _extract_refs(text):
    """Extract line references with surrounding context."""
    refs = []
    for match in _LINE_REF_RE.finditer(text):
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


def _backtick_spans(text):
    return [s.strip() for s in re.findall(r"`([^`]+)`", text) if len(s.strip()) > 1]


def _extract_identifiers(text):
    ids = set()
    for span in re.findall(r"`([^`]+)`", text):
        ids.update(re.findall(r"[a-zA-Z_]\w*", span))
    for tok in re.findall(r"\b[a-z_]\w*\b", text):
        if len(tok) > 2:
            ids.add(tok)
    return {t for t in ids if t.lower() not in _STOPWORDS
            and t.lower() not in _CODE_KEYWORDS and len(t) > 1}


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


# ── Feature extraction (must match train_model.py FEATURE_NAMES) ────────

def _extract_features(ref, code_lines, full_response):
    """Extract the same feature vector as extract_features.py."""
    start = ref["start"]
    end = ref.get("end") or start
    total = len(code_lines)
    context = ref.get("context", "")

    if start < 1 or start > total:
        return None, None
    end = min(end, total)

    # Reference properties
    relative_position = start / total if total > 0 else 0
    is_range = 1 if ref.get("end") else 0
    range_size = end - start + 1

    # Line content
    ref_line = code_lines[start - 1]
    ref_blank = 1 if re.match(r"^\s*$", ref_line) else 0
    ref_comment = 1 if _COMMENT_RE.match(ref_line) and not ref_blank else 0
    ref_code_len = len(ref_line.strip())
    ref_indent = len(ref_line) - len(ref_line.lstrip()) if ref_line.strip() else 0
    ref_has_brace = 1 if re.search(r"[{}]", ref_line) else 0

    # Backtick matching
    spans = _backtick_spans(context)
    backtick_count = len(spans)
    ref_block = " ".join(code_lines[start - 1:end])
    backtick_ref = 1 if any(s in ref_block for s in spans if len(s) > 2) else 0

    backtick_char_overlap = 0.0
    for span in spans:
        if len(span) > 2:
            if span.lower().strip() in ref_block.lower():
                backtick_char_overlap = max(backtick_char_overlap, 1.0)
            else:
                span_toks = set(re.findall(r"[a-zA-Z_]\w*", span))
                ref_toks = set(re.findall(r"[a-zA-Z_]\w*", ref_block))
                if span_toks:
                    backtick_char_overlap = max(backtick_char_overlap,
                                                len(span_toks & ref_toks) / len(span_toks))

    # Code block proximity
    code_block_near = 0
    ref_pos = ref.get("match_start", 0)
    for m in re.finditer(r"```", full_response):
        if abs(m.start() - ref_pos) < 200:
            code_block_near = 1
            break

    # Identifier overlap
    ids = _extract_identifiers(context)
    id_count = len(ids)

    def line_score(idx):
        if idx < 0 or idx >= total:
            return 0
        return len(ids & set(re.findall(r"[a-zA-Z_]\w*", code_lines[idx])))

    ref_score = max((line_score(i) for i in range(start - 1, end)), default=0)
    all_scores = [(i + 1, line_score(i)) for i in range(total)]
    all_scores.sort(key=lambda x: x[1], reverse=True)
    best_line, best_score = all_scores[0] if all_scores else (start, 0)

    id_ratio = ref_score / best_score if best_score > 0 else (1.0 if ref_score == 0 else 0.0)
    best_distance = abs(start - best_line)

    # Unique identifiers
    ref_line_tokens = set(re.findall(r"[a-zA-Z_]\w*", ref_block))
    id_unique = 0
    for ident in ids:
        if ident in ref_line_tokens:
            if not any(ident in set(re.findall(r"[a-zA-Z_]\w*", code_lines[j]))
                       for j in range(total) if j != start - 1):
                id_unique += 1

    # Neighbor analysis
    neighbor_range = list(range(max(0, start - 4), min(total, end + 3)))
    neighbor_scored = [(i + 1, line_score(i)) for i in neighbor_range]
    neighbor_scored.sort(key=lambda x: x[1], reverse=True)
    neighbor_max = neighbor_scored[0][1] if neighbor_scored else 0
    neighbor_better = 1 if neighbor_max > ref_score else 0
    best_neighbor_dist = abs(start - neighbor_scored[0][0]) if neighbor_scored else 0

    # TF-IDF
    context_tokens = _tokenize(context)
    all_docs = [_tokenize(line) for line in code_lines] + [context_tokens]
    tfidf_vecs = _compute_tfidf(all_docs)
    context_vec = tfidf_vecs[-1]
    best_tfidf_line = max(range(total), key=lambda i: _cosine_sim(tfidf_vecs[i], context_vec))
    tfidf_ref = _cosine_sim(context_vec, tfidf_vecs[start - 1])
    tfidf_best = _cosine_sim(context_vec, tfidf_vecs[best_tfidf_line])
    tfidf_ratio = tfidf_ref / tfidf_best if tfidf_best > 0 else (1.0 if tfidf_ref == 0 else 0.0)

    # Context structure
    context_has_colon = 1 if re.search(r"[Ll]ines?\s+\d+\s*:", context) else 0
    context_has_code_block = 1 if "```" in context else 0

    features = [
        start, total, relative_position, is_range, range_size, len(context),
        ref_blank, ref_comment, ref_code_len, ref_indent, ref_has_brace,
        backtick_ref, backtick_count, backtick_char_overlap,
        code_block_near,
        ref_score, best_score, id_ratio, best_distance, id_count, id_unique,
        neighbor_max, neighbor_better, best_neighbor_dist,
        tfidf_best, tfidf_ratio,
        context_has_colon, context_has_code_block,
    ]

    # Also return the best matching line for correction
    return features, best_line


# ── Public API ───────────────────────────────────────────────────────────

def fix_line_refs(reply, code):
    """Validate and fix line references in a tutor response.

    Uses a conservative strategy:
    - ML model detects likely-wrong references
    - Only CORRECTS when there's strong heuristic evidence:
      backtick-quoted code appears on a nearby line, or the ref line
      is blank/comment while a nearby code line matches
    - Never makes wild corrections (max ±3 lines)

    Args:
        reply: The LLM's response text
        code: The source code being taught (as shown in the prompt)

    Returns:
        The reply with safely-correctable line numbers fixed.
    """
    model_data = _load_model()
    if model_data is None:
        return reply

    model = model_data["model"]
    scaler = model_data.get("scaler")
    code_lines = code.split("\n")
    total = len(code_lines)

    refs = _extract_refs(reply)
    if not refs:
        return reply

    corrections = []
    for ref in reversed(refs):
        start = ref["start"]
        end = ref.get("end") or start

        # Skip out-of-bounds (can't verify or correct)
        if start < 1 or start > total:
            continue

        features, best_line = _extract_features(ref, code_lines, reply)
        if features is None:
            continue

        X = np.array([features])
        if scaler:
            X = scaler.transform(X)

        # Get model's confidence
        if hasattr(model, "predict_proba"):
            p_wrong = model.predict_proba(X)[0][0]
        else:
            p_wrong = 1.0 if model.predict(X)[0] == 0 else 0.0

        if p_wrong < 0.5:
            continue  # model thinks it's likely correct → leave it

        # Model flagged it as likely wrong. Now find a safe correction
        # using heuristic evidence (not just the model).

        context = ref.get("context", "")
        ref_line = code_lines[start - 1]
        spans = _backtick_spans(context)

        # Strategy 1: backtick-quoted code found on a nearby line but NOT on ref line
        correction = None
        ref_block = " ".join(code_lines[start - 1:min(end, total)])
        ref_has_backtick = any(s in ref_block for s in spans if len(s) > 2)

        if not ref_has_backtick and spans:
            # Check ±3 neighborhood for a line that contains the backtick span
            for offset in [1, -1, 2, -2, 3, -3]:
                check = start + offset
                if 1 <= check <= total:
                    if any(s in code_lines[check - 1] for s in spans if len(s) > 2):
                        correction = check
                        break

        # Strategy 2: ref line is blank/comment, nearby code line has identifiers
        if correction is None and (re.match(r"^\s*$", ref_line) or _COMMENT_RE.match(ref_line)):
            ids = _extract_identifiers(context)
            if ids:
                for offset in [1, -1, 2, -2, 3, -3]:
                    check = start + offset
                    if 1 <= check <= total:
                        line_tokens = set(re.findall(r"[a-zA-Z_]\w*", code_lines[check - 1]))
                        if len(ids & line_tokens) >= 2:
                            correction = check
                            break

        if correction is None or correction == start:
            continue

        # Apply correction
        old = ref["raw"]
        if ref.get("end"):
            offset = correction - start
            new_start = start + offset
            new_end = end + offset
            if new_start < 1 or new_end > total:
                continue
            new = old.replace(str(start), str(new_start), 1)
            new = old.replace(str(end), str(new_end), 1) if end != start else new
        else:
            new = old.replace(str(start), str(correction))

        if new != old:
            corrections.append((ref["match_start"], ref["match_end"], new))

    result = reply
    for start_pos, end_pos, replacement in corrections:
        result = result[:start_pos] + replacement + result[end_pos:]

    if corrections:
        print(f"Validator: fixed {len(corrections)} line ref(s)", file=sys.stderr)

    return result


def extract_code_from_messages(messages):
    """Extract the code block from the system prompt in a message array."""
    for m in messages:
        if m.get("role") == "system":
            match = re.search(r"```\n(.*?)\n```", m.get("content", ""), re.DOTALL)
            if match:
                return match.group(1)
    return ""
