from __future__ import annotations


def compute_wpr(hypothesis_text: str, expected_lang: str = "en") -> float | None:
    if not hypothesis_text or not hypothesis_text.strip():
        return None
    try:
        from langdetect import detect_langs
        for lang in detect_langs(hypothesis_text):
            if lang.lang == expected_lang:
                return round(1 - lang.prob, 4)
        return 1.0
    except Exception:
        return None


def compute_her(alignment: dict) -> float | None:
    hypothesis_len = len(alignment.get("hypothesis_phonemes") or [])
    if hypothesis_len == 0:
        return None
    insertions = sum(1 for e in alignment["errors"] if e["operation"] == "insertion")
    return round(insertions / hypothesis_len, 4)
