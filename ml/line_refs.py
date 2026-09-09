"""
Line reference extraction and verification.

Shared by generate_training_data.py and process_real_data.py.
"""

import re

# Matches: "line 5", "Line 18", "lines 5-11", "lines 13–19"
LINE_REF_RE = re.compile(r"[Ll]ines?\s+(\d+)(?:\s*[-–]\s*(\d+))?")

# Words that aren't code identifiers even though they look like them
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

# Language keywords that appear on many lines — low discriminative value
_CODE_KEYWORDS = frozenset(
    "int char void float double long short unsigned signed const static "
    "if else for while do switch case default break continue return goto "
    "struct union enum typedef sizeof "  # C
    "class public private protected virtual override new delete this "
    "template typename namespace using auto constexpr concept requires "  # C++
    "def self end nil puts require include module attr_accessor "  # Ruby
    "fn let mut pub impl mod use crate super where trait enum match "  # Rust
    "import from as pass lambda with yield assert del raise except try finally "  # Python
    "function var const export async await throw catch "  # JS/TS
    "printf println std cout cin cerr".split()
)


def extract_line_refs(text):
    """Extract line number references from tutor response text.

    Returns a list of dicts with keys: raw, start, end, context.
    """
    refs = []
    for match in LINE_REF_RE.finditer(text):
        start = int(match.group(1))
        end = int(match.group(2)) if match.group(2) else None

        # Grab the surrounding sentence / clause as context
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

        refs.append(
            {
                "raw": match.group(0),
                "start": start,
                "end": end,
                "context": text[ctx_start:ctx_end].strip(),
            }
        )
    return refs


def extract_identifiers(text):
    """Pull likely code identifiers from text near a line reference.

    Looks at backtick-quoted spans first, then bare tokens.
    Returns a set of strings (excluding stopwords and common language keywords).
    """
    ids = set()

    # Backtick-quoted code spans — strongest signal, keep single-char identifiers
    for span in re.findall(r"`([^`]+)`", text):
        for tok in re.findall(r"[a-zA-Z_]\w*", span):
            if tok.lower() not in _STOPWORDS and tok.lower() not in _CODE_KEYWORDS:
                ids.add(tok)

    # Bare tokens that look code-like (require length > 2)
    for tok in re.findall(r"\b[a-z_]\w*\b", text):
        if len(tok) > 2 and tok.lower() not in _STOPWORDS and tok.lower() not in _CODE_KEYWORDS:
            ids.add(tok)

    return ids


def _backtick_spans(text):
    """Extract backtick-quoted code spans from text."""
    return [s.strip() for s in re.findall(r"`([^`]+)`", text) if len(s.strip()) > 1]


def verify_ref(ref, code_lines):
    """Verify a single line reference against actual code lines (1-indexed).

    Returns a dict with verification results:
      - in_bounds: bool
      - valid: True / False / None (None = can't determine)
      - best_match_line: int or None
      - ref_score / best_score: identifier overlap counts
      - ref_content / best_match_content: code at those lines
      - context_identifiers: list of identifiers used for matching
    """
    start = ref["start"]
    end = ref["end"] or start
    total = len(code_lines)

    result = {"in_bounds": 1 <= start <= total and 1 <= end <= total, "total_lines": total}

    if not result["in_bounds"]:
        result["valid"] = False
        result["reason"] = "out_of_bounds"
        return result

    ref_content = "\n".join(code_lines[start - 1 : end])
    result["ref_content"] = ref_content

    # ── Substring check: backtick-quoted code appearing literally on the line ──
    spans = _backtick_spans(ref["context"])
    ref_block = " ".join(code_lines[start - 1 : end])  # joined for range refs
    substr_hit = any(span in ref_block for span in spans if len(span) > 2)
    if substr_hit:
        result["valid"] = True
        result["reason"] = "backtick_substring_match"
        result["ref_score"] = 1
        result["best_match_line"] = start
        result["best_score"] = 1
        result["best_match_content"] = ref_content
        return result

    # ── Identifier overlap scoring ──
    ids = extract_identifiers(ref["context"])
    result["context_identifiers"] = sorted(ids)

    if not ids:
        # No discriminative identifiers — can't verify
        result["valid"] = None
        result["reason"] = "no_identifiers_to_check"
        return result

    # Score every code line by identifier overlap
    scores = []
    for i, line in enumerate(code_lines, 1):
        line_tokens = set(re.findall(r"[a-zA-Z_]\w*", line))
        overlap = ids & line_tokens
        scores.append((i, len(overlap), sorted(overlap)))

    scores.sort(key=lambda x: x[1], reverse=True)
    best_line, best_score, best_overlap = scores[0]

    # Score for the referenced line range
    ref_score = 0
    for i in range(start, min(end, total) + 1):
        line_tokens = set(re.findall(r"[a-zA-Z_]\w*", code_lines[i - 1]))
        ref_score = max(ref_score, len(ids & line_tokens))

    result["ref_score"] = ref_score
    result["best_match_line"] = best_line
    result["best_score"] = best_score
    result["best_match_content"] = code_lines[best_line - 1] if best_line <= total else ""
    result["best_overlap"] = best_overlap

    # Decision logic:
    #  - ref line scores as well as best → correct
    #  - ref line within ±1 of best and close score → correct (common off-by-one)
    #  - otherwise → wrong, best_match_line is the likely correct line
    result["valid"] = ref_score >= best_score or (
        ref_score > 0 and abs(start - best_line) <= 1 and ref_score >= best_score - 1
    )

    if not result["valid"]:
        result["reason"] = f"better_match_at_line_{best_line}"

    return result
