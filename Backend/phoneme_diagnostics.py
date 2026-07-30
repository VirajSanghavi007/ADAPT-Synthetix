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

    return {
        "basis": "reference_aligned_phoneme_errors",
        "top_errors": rows[:25],
        "systematic_confusions": systematic,
    }
