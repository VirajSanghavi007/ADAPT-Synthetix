"""Reference-aligned phoneme error diagnostics, ported from v2's diagnostics.py."""
from __future__ import annotations

from collections import defaultdict

_g2p = None


def _get_g2p():
    global _g2p
    if _g2p is None:
        import nltk
        try:
            nltk.data.find("corpora/cmudict")
        except LookupError:
            nltk.download("cmudict", quiet=True)
        # g2p_en's own lazy-download uses NLTK's old resource name
        # ("averaged_perceptron_tagger"), which newer NLTK versions renamed to
        # "averaged_perceptron_tagger_eng" — g2p_en's download silently succeeds
        # against the wrong name, then nltk.pos_tag() fails to find it at call time.
        # Pre-download the current name ourselves so it's already there.
        try:
            nltk.data.find("taggers/averaged_perceptron_tagger_eng")
        except LookupError:
            nltk.download("averaged_perceptron_tagger_eng", quiet=True)
        from g2p_en import G2p
        _g2p = G2p()
    return _g2p


def extract_phonemes(text: str) -> list[str]:
    tokens = _get_g2p()(text or "")
    return [str(t) for t in tokens if str(t).strip()]


def align_phoneme_errors(reference_text: str, hypothesis_text: str) -> dict:
    """Levenshtein-align reference vs hypothesis at phoneme level."""
    reference = extract_phonemes(reference_text)
    hypothesis = extract_phonemes(hypothesis_text)
    rows, cols = len(reference) + 1, len(hypothesis) + 1
    dp = [[0] * cols for _ in range(rows)]
    for i in range(rows):
        dp[i][0] = i
    for j in range(cols):
        dp[0][j] = j

    for i in range(1, rows):
        for j in range(1, cols):
            cost = 0 if reference[i - 1] == hypothesis[j - 1] else 1
            dp[i][j] = min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost)

    errors, i, j = [], len(reference), len(hypothesis)
    while i > 0 or j > 0:
        if i > 0 and j > 0 and reference[i - 1] == hypothesis[j - 1]:
            i -= 1
            j -= 1
        elif i > 0 and j > 0 and dp[i][j] == dp[i - 1][j - 1] + 1:
            errors.append({"operation": "substitution", "reference": reference[i - 1], "hypothesis": hypothesis[j - 1]})
            i -= 1
            j -= 1
        elif i > 0 and dp[i][j] == dp[i - 1][j] + 1:
            errors.append({"operation": "deletion", "reference": reference[i - 1], "hypothesis": ""})
            i -= 1
        else:
            errors.append({"operation": "insertion", "reference": "", "hypothesis": hypothesis[j - 1]})
            j -= 1

    errors.reverse()
    return {
        "reference_phonemes": reference,
        "hypothesis_phonemes": hypothesis,
        "distance": dp[-1][-1],
        "errors": errors,
    }


CONFUSION_RATE_THRESHOLD = 0.30  # DyPCL / POWER systematic-confusion rule

# ARPAbet (CMUdict/g2p_en's phoneme alphabet) -> a plain-English name and example
# word, for the majority of users who have no reason to know what "AH0" means.
# Stress digits (0/1/2) on vowels are stripped before lookup.
_PHONEME_NAMES: dict[str, tuple[str, str]] = {
    "AA": ("ah", "father"), "AE": ("a", "cat"), "AH": ("uh", "but"),
    "AO": ("aw", "dog"), "AW": ("ow", "how"), "AY": ("eye", "my"),
    "B": ("b", "boy"), "CH": ("ch", "chip"), "D": ("d", "dog"),
    "DH": ("th (soft)", "this"), "EH": ("e", "bed"), "ER": ("er", "bird"),
    "EY": ("ay", "day"), "F": ("f", "fish"), "G": ("g", "go"),
    "HH": ("h", "hat"), "IH": ("i", "bit"), "IY": ("ee", "see"),
    "JH": ("j", "joy"), "K": ("k", "cat"), "L": ("l", "lip"),
    "M": ("m", "man"), "N": ("n", "no"), "NG": ("ng", "sing"),
    "OW": ("oh", "go"), "OY": ("oy", "boy"), "P": ("p", "pig"),
    "R": ("r", "run"), "S": ("s", "sun"), "SH": ("sh", "shoe"),
    "T": ("t", "top"), "TH": ("th (hard)", "think"), "UH": ("oo (short)", "book"),
    "UW": ("oo (long)", "food"), "V": ("v", "van"), "W": ("w", "we"),
    "Y": ("y", "yes"), "Z": ("z", "zoo"), "ZH": ("zh", "vision"),
}


_VOWELS = {"AA", "AE", "AH", "AO", "AW", "AY", "EH", "ER", "EY", "IH", "IY", "OW", "OY", "UH", "UW"}


def _describe_phoneme(code: str) -> str:
    if not code:
        return "(nothing)"
    base = code.rstrip("012")
    name, example = _PHONEME_NAMES.get(base, (code, None))
    return f'the "{name}" sound (as in "{example}")' if example else f'the "{name}" sound'


def _phoneme_category(code: str) -> str:
    if not code:
        return "none"
    return "vowel" if code.rstrip("012") in _VOWELS else "consonant"


def _plain_english(operation: str, reference_phoneme: str, hypothesis_phoneme: str) -> str:
    if operation == "substitution":
        return f"{_describe_phoneme(reference_phoneme)} gets heard as {_describe_phoneme(hypothesis_phoneme)}"
    if operation == "deletion":
        return f"{_describe_phoneme(reference_phoneme)} gets dropped entirely"
    return f"an extra {_describe_phoneme(hypothesis_phoneme)} gets added in"


def build_error_report(rows: list[dict]) -> dict:
    """rows: [{operation, reference_phoneme, hypothesis_phoneme, count}, ...]"""
    systematic = []
    ref_totals: dict[str, int] = defaultdict(int)
    for r in rows:
        if r["operation"] == "substitution":
            ref_totals[r["reference_phoneme"]] += r["count"]
    for r in rows:
        if r["operation"] == "substitution" and ref_totals.get(r["reference_phoneme"], 0) > 0:
            rate = r["count"] / ref_totals[r["reference_phoneme"]]
            if rate >= CONFUSION_RATE_THRESHOLD:
                systematic.append({**r, "confusion_rate": round(rate, 3), "systematic": True})

    top_errors = [
        {**r, "plain_english": _plain_english(r["operation"], r["reference_phoneme"], r["hypothesis_phoneme"])}
        for r in rows[:25]
    ]
    systematic = [
        {**r, "plain_english": _plain_english(r["operation"], r["reference_phoneme"], r["hypothesis_phoneme"])}
        for r in systematic
    ]

    summary = None
    if top_errors:
        worst = top_errors[0]
        summary = (
            f"Most often, {worst['plain_english']} "
            f"({worst['count']} time{'s' if worst['count'] != 1 else ''} across everything reviewed)."
        )

    # Breakdowns for the dashboard's charts — same rows, grouped differently, so the
    # frontend doesn't have to re-derive them from the (already-aggregated) top_errors.
    operation_breakdown: dict[str, int] = defaultdict(int)
    category_breakdown: dict[str, int] = defaultdict(int)
    for r in rows:
        operation_breakdown[r["operation"]] += r["count"]
        if r["operation"] == "substitution":
            cat = f'{_phoneme_category(r["reference_phoneme"])} -> {_phoneme_category(r["hypothesis_phoneme"])}'
        elif r["operation"] == "deletion":
            cat = f'{_phoneme_category(r["reference_phoneme"])} dropped'
        else:
            cat = f'{_phoneme_category(r["hypothesis_phoneme"])} inserted'
        category_breakdown[cat] += r["count"]

    return {
        "basis": "reference_aligned_phoneme_errors",
        "summary": summary,
        "top_errors": top_errors,
        "systematic_confusions": systematic,
        "operation_breakdown": dict(operation_breakdown),
        "category_breakdown": dict(category_breakdown),
    }
