# Mercury Model Versioning

Mercury presents itself as one product with three model tiers — **Echo** (free),
**Apollo** (pro), and **Thoth** (max/enterprise) — each name covering both the
ASR and TTS engine at that tier. Users see a name and a version number, never a
third-party model id.

## The rule

- **1.x** — stock pre-trained weights, loaded as-is from their upstream source.
  We didn't train these; we selected, wired, and served them. This is the
  starting state for every tier: Echo 1.1, Apollo 1.2, Thoth 1.3.
- **2.0** — the tier's *first* fine-tune. Fine-tuning is the actual work of this
  project — the version jump from 1.x to 2.0 marks the point where the model
  stops being "a pre-trained model we loaded" and becomes "a model we trained."
- **2.x, 3.x, ...** — every fine-tune *after* the first increments the minor
  version: 2.0 → 2.1 → 2.2 ... → 2.9 → 3.0, and so on. Each successive
  fine-tuning pass — new data, a bugfix retrain, a PEFT/LoRA adapter swap,
  whatever — earns the next minor bump. The major version only moves again if
  we decide a change is significant enough to warrant it (e.g. a full
  architecture swap, not just another training pass).

## Why tiers can share a major/minor version independently

Echo, Apollo, and Thoth version independently — fine-tuning Apollo doesn't
touch Echo's or Thoth's version number. It's entirely plausible for Echo to be
at 2.4 while Thoth is still at 1.3, if Echo's been fine-tuned four times and
Thoth hasn't been touched yet.

## Where the version number lives

- `Backend/tiers.py` — `ASR_CATALOG` / `TTS_CATALOG` `label` fields are the
  source of truth users see (`"Echo 1.1"`, etc). Bump both the ASR and TTS
  entry for a tier together if the fine-tune covers both; bump only the
  relevant one if it doesn't.
- When a tier crosses into 2.0 for the first time, add a line to this file's
  changelog section below recording what changed and when.

## Changelog

_(empty — all three tiers are still at their 1.x baseline as of 2026-08-04)_
