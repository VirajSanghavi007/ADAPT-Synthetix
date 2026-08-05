# Mercury — Product Definition & Roadmap

## What Mercury is

**Speech infrastructure that knows what it doesn't know.**

Every speech-to-text system on the market is optimised to look confident. They
publish a single headline accuracy number, return a clean paragraph of text, and
say nothing at all about the parts they guessed. When they fail, they fail
silently — and silent failure is the expensive kind. Whisper invents sentences
into medical records. Live captions run at sixty percent accuracy with nothing
on screen to warn the person reading them. The industry's own standard metric,
word error rate, is structurally incapable of telling a dropped filler word from
a dropped drug name.

Mercury takes the opposite position. Every transcript we return carries its own
confidence with it: which segments were certain, which were guesses, which model
version produced them, and where the recognised sounds diverged from what was
expected. Customers run the whole stack on their own infrastructure, so the audio
never leaves their building and the model never changes underneath them without
their say-so.

We are not trying to win the accuracy benchmark. That race is a commodity, and it
is being run by companies with far more compute than we will ever have. We are
building the layer that sits on top of those models and makes their output
trustworthy — which is the part nobody is building, and the part that every
regulated buyer actually needs.

## Who this is for

Mercury is for the customer where a *silently wrong* answer costs more than a
*slow* one:

- **Clinical documentation** — where a hallucinated line contaminates a patient
  record permanently and influences care for years.
- **Contact-centre quality and compliance** — where the job is finding the small
  number of calls that went wrong, not producing transcripts of the ones that
  went fine.
- **Accessibility and live captioning** — where the reader has no way to know a
  caption is wrong unless the system tells them.
- **Regulated and sovereignty-bound organisations** — legal, government, finance,
  and any EU entity facing the August 2026 AI Act conformity deadline, who cannot
  send audio to a third-party cloud regardless of how accurate it is.

## Objectives

**O1 — Ship the honest transcript.**
Every response carries per-segment confidence, flagged uncertain spans, and the
exact model version that produced it. *Success:* no Mercury response can be
consumed without the caller also receiving its reliability signal.

**O2 — Make our own accuracy claims honest.**
Replace the single WER headline with semantic-aware measurement — Semantic WER
and Missed Entity Rate alongside raw WER — so the numbers we publish reflect
whether a transcript is actually usable, not just lexically close.
*Success:* published benchmarks a customer can reproduce on their own audio.

**O3 — Guarantee we don't fabricate.**
Hallucination guarding (VAD gating, silence trimming, post-filtering) as a
default, measured, advertised property of the product.
*Success:* a stated, tested hallucination rate we are willing to put in a
contract.

**O4 — Be provable, not just private.**
Full request-level audit trail, pinned model versions, and a documented consent
and provenance chain for any data used in training.
*Success:* a customer can answer "where did this transcript and this model come
from?" without contacting us.

**O5 — Become the layer, not the model.**
Support bringing your own model backend, so Mercury's value compounds as the
open-model ecosystem improves rather than competing against it.
*Success:* a customer running their own Whisper deployment still pays us.

**O6 — Improve fastest where everyone else is worst.**
Build the closed loop — detect errors in real usage, synthesise targeted training
data, retrain — aimed at accented and code-switched speech, the documented
failure mode of every general-purpose system.
*Success:* measurable accuracy gains on customer audio that competitors cannot
match by swapping in a bigger model.

## Roadmap

Four phases. Each phase has a **thesis** (why it exists), **workstreams** (the
parallel tracks of work), **exit criteria** (how we know it's done, not "done
enough"), and **risks** (what kills it). Phases are sequenced by dependency, not
by calendar — Phase 2 needs Phase 1's data model, Phase 4 needs Phase 3's
backend abstraction. Within a phase, workstreams marked ∥ can run in parallel.

Grounding note: file paths and endpoint names below refer to the codebase as it
stands. The single most important structural fact is that
`Backend/asr_pipeline.py::transcribe_audio()` currently returns a bare `str`.
Nearly all of Phase 1 hangs off changing that one return type, so it is the first
thing to do and everything else is downstream of it.

---

### How to read this section

Every workstream below is broken into lettered tasks. Each task carries four
fields:

- **Task** — the concrete unit of work, scoped to something one person can pick
  up without asking a clarifying question first.
- **Design** — the non-obvious technical decision, data shape, or algorithm
  choice, where one exists. Tasks without a real design decision skip this.
- **Est** — rough effort size. **XS** = under 2 hours. **S** = under a day.
  **M** = 2-4 days. **L** = a week or more, and should probably be split further
  when it's actually picked up.
- **Accept** — the specific, checkable condition that makes the task
  *provably* done, not just "looks right."

Phase 0 and Phase 1 are specified to this depth because they are near-term and
the codebase facts are known today. Phase 2 through 4 carry the same structure
but with lighter acceptance detail in places, since their exact shape will shift
once Phase 1 ships and the real API contract exists to design against —
pre-specifying acceptance tests against code that doesn't exist yet produces
false precision, not detail.

---

### Phase 0 — Stabilise the floor *(prerequisite, unglamorous, blocking)*

**Thesis.** None of the below matters if the thing falls over. Current known
state: the free tier works, Pro/Max are deliberately stopped, Docker Desktop has
crashed repeatedly, `space-max` has never had a clean uninterrupted test window,
and cold model loads have been observed at 100-600s against a stated 3s target.
Phase 1 adds fields to a response — that is only meaningful if the response
arrives.

#### P0.1 — Cold-start elimination

- **P0.1.a** — Task: audit every Space's container entrypoint and identify
  exactly what triggers a model download versus a cache hit (HF cache volume
  mount path, `HF_HOME`/`TRANSFORMERS_CACHE` env vars, whether the volume is
  actually populated pre-deploy or only after first use).
  Est: S. Accept: a written table, one row per Space, of "cache populated
  ahead of time: yes/no" and the exact path checked.
- **P0.1.b** — Task: add a startup warm-up call — on container start, before
  marking the service healthy, run one real inference against a fixed short
  sample audio/text pair.
  Design: warm-up must use the *actual* inference path (not a stub), so a
  broken model load fails the health check instead of silently serving cold.
  Est: M (one per engine type — Parakeet, Bark, CosyVoice2 each behave
  differently on first call). Accept: `docker compose up` from a cold volume
  reaches `healthy` only after a real transcription/synthesis has completed
  successfully; killing the model mid-load leaves the container `unhealthy`,
  not `starting` forever.
- **P0.1.c** — Task: readiness probe wired into `docker-compose.yml`
  `healthcheck` blocks, replacing whatever currently gates "Up" status.
  Design: use a dedicated `/ready` endpoint distinct from `/api/health` —
  health can mean "process is alive," ready must mean "can serve a real
  request right now."
  Est: S. Accept: `docker compose ps` shows `(healthy)` only after P0.1.b's
  warm-up call has actually succeeded, verified by killing the model weights
  file and confirming the container reports unhealthy instead of healthy.
- **P0.1.d** — Task: latency instrumentation — log time-to-first-token /
  time-to-first-audio-byte for every request, tagged cold vs warm, exported to
  the existing p50/p95 admin latency view.
  Est: S. Accept: admin latency dashboard shows a visible split between the
  first request after a restart and steady-state requests.

#### P0.2 — Environment reliability

- **P0.2.a** — Task: document every Docker Desktop crash this session with
  timestamp, what was running, and what was lost (build cache, in-flight
  rebuild, container state) — a short incident log, not a full postmortem.
  Est: XS. Accept: a dated list existing somewhere durable (this file or
  `docs/`), so the next crash isn't diagnosed from memory.
- **P0.2.b** — Task: stand up the Oracle Cloud free-tier instance (already
  blocked on signup per the backlog below) and get one service (start with
  `space-free`) running there end to end.
  Est: L — outside pure engineering, involves account provisioning and is
  blocked on external signup completing. Accept: a `curl` from outside the
  Oracle instance to its `/api/health` returns 200, sustained over 72 hours
  without a manual restart.
- **P0.2.c** — Task: migration runbook — steps to move the full compose stack
  (all services, volumes, `.env`) from the local machine to the new host,
  written *before* the move so it's a checklist, not an improvisation.
  Est: S. Accept: a second person (or the same person, cold, a week later)
  could follow it without reading the source code.

#### P0.3 — `space-max` clean test pass

- **P0.3.a** — Task: assemble the fixed test set — a small, versioned set of
  audio files (varied length, at least one with silence padding, at least one
  accented sample) that exercises the five previously-fixed dependency-drift
  bugs specifically, so the pass is a regression test, not a vibe check.
  Est: S. Accept: files committed (or referenced, if licensing prevents
  committing raw audio) with a short note on which past bug each one
  exercises.
- **P0.3.b** — Task: run the full ASR + TTS round trip against `space-max` on
  a freshly built container, uninterrupted, and record pass/fail per bug
  scenario.
  Est: M (mostly wall-clock waiting on builds/model loads, not engineering
  time). Accept: written pass/fail table against P0.3.a's test set, dated.
- **P0.3.c** — Task: decision point — based on P0.3.b's result, either mark
  `space-max` supportable and remove the "never had a clean test window"
  caveat from the backlog, or formally retire it and update the tier config
  to stop offering it, rather than leaving it in an ambiguous stopped state.
  Est: XS (a decision, not a build). Accept: TODO.md backlog entry updated to
  reflect the actual decided state, one way or the other.

#### P0.4 — Build-verification discipline

- **P0.4.a** — Task: a one-line convention, documented once: after any
  `docker compose build`, before declaring success, `docker compose exec
  <service> grep -r "<known-new-string>" <built-asset-path>` to confirm the
  new code actually landed inside the running container, not just that the
  build command exited 0.
  Est: XS. Accept: written into this file or a CONTRIBUTING-style note, so
  it's a habit, not a one-off catch.

**Exit criteria.** A cold `docker compose up` reaches a state where a real
transcribe request succeeds in under 3 seconds, twice in a row, on a host that
has not crashed in seven days.

**Risk.** Perpetual deferral. Phase 0 has no visible output, so it loses to
feature work every time. Mitigation: treat the exit criteria as a gate on
starting Phase 1 workstream P1.4 onwards, not as a suggestion.

---

### Phase 1 — The Honest Transcript

**Thesis.** Change the *shape* of Mercury's output so that within thirty seconds
of a trial, a technical evaluator sees something no competitor returns. This is
the phase that converts the positioning statement from a claim into an
observable property. Most of the work is promotion of existing code into a new
position, not new invention.

#### P1.1 — Structured transcription result *(blocks everything downstream)*

- **P1.1.a** — Task: define `TranscriptionResult` and `TranscriptSegment` as
  explicit types (Pydantic models, since the backend is FastAPI).
  Design:
  ```
  TranscriptSegment:
    text: str
    start_ms: int
    end_ms: int
    confidence: float | None       # None = "unavailable", never fabricated
    uncertain: bool                # derived: confidence below threshold, or None

  TranscriptionResult:
    text: str                      # convenience: full text, back-compat
    segments: list[TranscriptSegment]
    model_id: str
    model_version: str
    engine: str
    duration_ms: int
    api_version: Literal["2"]      # response-shape version, not model version
  ```
  Est: S. Accept: types defined, unit-testable independent of any engine.
- **P1.1.b** — Task: change `transcribe_audio()` in `Backend/asr_pipeline.py:92`
  to return `TranscriptionResult` instead of `str`; each engine adapter
  populates what it can and leaves `confidence=None` where it can't (real
  values land in P1.2, this task is the plumbing only).
  Est: M. Accept: function signature changed, all existing call sites updated
  to at least compile/type-check; a call against each of the three free-tier
  engines returns a valid `TranscriptionResult` with correct `text`.
- **P1.1.c** — Task: update `/api/transcribe` in `Backend/main.py:109` to
  return the new shape under `api_version: "2"`, while a request with an
  `Accept-Version: 1` header (or absent) gets the old flat-string shape
  computed from `result.text` — so existing integrations don't break the
  instant this ships.
  Design: version via a request header, not a URL path segment, to avoid
  duplicating the whole route.
  Est: S. Accept: a request with no version header gets today's exact
  response shape (regression-tested against the previous behaviour); a
  request with `Accept-Version: 2` gets the new structured shape.
- **P1.1.d** — Task: update the three frontend consumers —
  `frontend-next/components/Recorder.tsx`,
  `frontend-next/components/LiveTranscribe.tsx`, and the history read path —
  to request and store the v2 shape, even before anything renders the new
  fields (that's P1.2/P1.3's job).
  Est: S. Accept: no frontend regression; network tab shows `Accept-Version:
  2` on transcribe calls; existing UI renders identically using `result.text`.
- **P1.1.e** — Task: update `Backend/mcp_server.py` to expose the structured
  result to MCP clients, since it's a second consumer that would otherwise
  silently keep using the old shape.
  Est: S. Accept: an MCP tool call returns segments and confidence when
  available.
- **P1.1.f** — Task: history write path — persist `model_version`, per-segment
  confidence (as JSON), and `api_version` alongside the existing transcript
  row, migration `015_transcript_structure.sql` adding the columns.
  Est: S. Accept: a row written through the new path round-trips correctly
  through `Backend/history.py`'s read endpoint.

*Dependency:* none upstream. *Blocks:* P1.2, P1.3, P1.5, P1.6, P1.7, all of
Phase 2 onward.

#### P1.2 — Confidence extraction per engine

- **P1.2.a** — Task: for each ASR engine behind Echo/Apollo/Thoth
  (Parakeet-family and whatever backs the other tiers), determine what raw
  uncertainty signal it actually exposes — token logprobs, CTC frame
  posteriors, beam-search scores, or nothing.
  Est: S per engine (3 engines → treat as M total). Accept: one short note per
  engine: "signal available: yes (logprobs) / no," committed alongside the
  adapter code as a comment or short doc.
- **P1.2.b** — Task: write the normalisation adapter — raw signal → 0-1
  confidence per segment — for engines that expose something.
  Design: normalise per-engine, not globally, since raw scales aren't
  comparable across architectures (e.g., CTC posterior vs. transformer
  logprob-derived score). Store the raw signal type alongside the normalised
  score so a customer can ask "confidence from what."
  Est: M per engine with a signal → treat as L across all engines with
  signals. Accept: for a held-out sample where a word is known to be
  mistranscribed (from the P0.3.a test set or similar), the confidence score
  on that segment is measurably lower than on correctly transcribed segments
  — this is the calibration check, not just "a number comes out."
- **P1.2.c** — Task: explicit "confidence unavailable" path for engines with
  no exposed signal — `confidence: None`, `uncertain: false` (never guess a
  flag from nothing), documented in the API docs as an intentional gap, not a
  bug.
  Est: XS. Accept: an engine known to expose nothing returns `None`, and this
  is asserted in a test so a future change can't silently start fabricating a
  value.

#### P1.3 — Phoneme diagnostics promoted to the live path

- **P1.3.a** — Task: benchmark `Backend/phoneme_diagnostics.py`'s current
  post-hoc runtime on a range of audio lengths, to know the actual latency
  cost before deciding sync vs. async.
  Est: XS. Accept: a table of audio-length vs. diagnostics-runtime.
- **P1.3.b** — Task: based on P1.3.a, implement either inline (if it fits
  comfortably inside the 3s budget) or async-alongside (returns the
  transcript immediately, diagnostics available via a `GET
  /api/transcribe/{id}/diagnostics` follow-up once ready).
  Design: prefer async-alongside by default unless P1.3.a shows diagnostics
  reliably complete in well under 1s — the 3s target is fragile enough
  already (see Phase 0) that adding a synchronous dependency is a latency
  risk, not a UX win, at typical audio lengths.
  Est: M. Accept: the diagnostics endpoint returns real phoneme-error data
  correlated with the transcript that triggered it, and the primary
  `/api/transcribe` p95 latency does not regress against the Phase 0 baseline.
- **P1.3.c** — Task: wire diagnostics output into `TranscriptSegment.uncertain`
  where phoneme divergence and low ASR confidence disagree (e.g., confidence
  high but phoneme diagnostics flags an unusual substitution) — surface both
  signals rather than collapsing them into one, since they measure different
  things.
  Est: S. Accept: a segment can be marked uncertain by phoneme divergence
  alone even when engine confidence was high, and the response shows which
  signal triggered it.

#### P1.4 — Hallucination guard *(∥ — independent of P1.1-P1.3)*

- **P1.4.a** — Task: integrate SileroVAD (or equivalent) as a pre-filter on
  incoming audio, gating what reaches the ASR engine.
  Est: M. Accept: feeding a pure-silence or pure-noise clip through
  `/api/transcribe` returns an empty/near-empty result instead of invented
  text, verified against a fixed set of non-speech test clips.
- **P1.4.b** — Task: leading/trailing silence trim before the audio reaches
  the model, decibel-threshold based.
  Est: S. Accept: a clip with 5+ seconds of silence padding on either end
  produces the same transcript as the same clip with padding removed.
- **P1.4.c** — Task: post-filter — a small, maintained list of known Whisper-
  class hallucination phrases (the literature documents recurring patterns,
  e.g. repeated stock phrases on silence) checked against low-confidence
  segments and flagged/stripped.
  Est: S. Accept: a documented hallucination phrase injected into a test
  fixture gets flagged rather than passed through silently.
- **P1.4.d** — Task: measurement harness — a fixed corpus of non-speech audio
  (silence, music, background noise, breathing) run through the pipeline with
  hallucination rate recorded before and after P1.4.a-c.
  Est: S. Accept: a before/after number exists and is written down — this is
  the artefact O3 promises ("a stated, tested hallucination rate"), so it must
  be a real measured percentage, not a claim.

#### P1.5 — Honest metrics *(∥)*

- **P1.5.a** — Task: implement Semantic WER — embedding-based distance between
  reference and hypothesis transcripts (e.g., sentence-embedding cosine
  distance as a first pass; can be refined later) instead of raw token
  substitution counting.
  Est: M. Accept: a substitution that preserves meaning (e.g., "OK" → "okay")
  scores near-zero penalty under Semantic WER while still counting as an error
  under raw WER — the two numbers visibly diverge on a constructed test case,
  proving the metric is doing something different from WER, not just
  relabelling it.
- **P1.5.b** — Task: implement Missed Entity Rate — WER computed restricted to
  a tagged entity subset (proper nouns, numbers, medical terms if a domain
  lexicon is available) of the reference transcript.
  Est: M (needs an entity tagger — spaCy or similar, plus the phoneme/lexicon
  work already in the codebase for names). Accept: on a constructed test
  transcript where only a non-entity word is wrong, Missed Entity Rate reads
  0%; where an entity word is wrong, it reads a nonzero rate distinct from
  overall WER.
- **P1.5.c** — Task: migration `016_semantic_metrics.sql` widening
  `eval_metrics` with `semantic_wer` and `missed_entity_rate` columns.
  Est: XS. Accept: migration applies cleanly against a copy of the current
  schema.
- **P1.5.d** — Task: surface all four metrics (WER, CER, Semantic WER, Missed
  Entity Rate) in the admin trend charts, replacing or augmenting the current
  WER/CER-only view.
  Est: S. Accept: admin dashboard renders four series with correct labels and
  units, spot-checked against manually computed values on a small fixture.

#### P1.6 — Model version in every response + public changelog

- **P1.6.a** — Task: confirm the existing model-versioning data (from prior
  session work) is queryable at request time, not just stored; wire
  `model_version` into `TranscriptionResult` (already in P1.1.a's shape) and
  the equivalent TTS response type.
  Est: S. Accept: `/api/transcribe` and `/api/tts` responses both carry a
  non-null `model_version` for every built-in tier.
- **P1.6.b** — Task: `GET /api/models/changelog` endpoint returning a
  chronological list of model version changes per tier.
  Est: S. Accept: endpoint returns real historical entries if any exist in the
  DB, or a documented empty state if versioning only just started being
  tracked.
- **P1.6.c** — Task: public docs page rendering the changelog
  (`frontend-next/app/docs/`), linked from the API reference.
  Est: S. Accept: page renders the changelog endpoint's data, matches the
  existing docs site's styling.

#### P1.7 — "Test it on your own audio" onboarding

- **P1.7.a** — Task: signup-flow UI step — upload or record a short sample,
  see it transcribed with real confidence/uncertain-span highlighting inline.
  Est: M. Accept: a new user can complete this step and see visibly
  color-coded confidence on their own words before reaching the main app.
- **P1.7.b** — Task: persist the result of this test (opt-in) as the user's
  baseline accuracy figure, viewable later in settings, so "your real number"
  isn't a one-time toast that disappears.
  Est: S. Accept: the number is visible again on a return visit to settings.

**Exit criteria.** A `/api/transcribe` response contains per-segment confidence,
uncertain-span flags, model version, and diagnostics. Measured hallucination rate
on non-speech audio is published. Semantic WER and Missed Entity Rate appear in
the admin dashboard. A prospective user can measure us on their own file without
talking to us.

**Risks.** *Latency* — diagnostics and VAD both add cost against a 3s budget;
mitigate with the async-diagnostics fallback in P1.3.b. *Confidence quality* — a
poorly calibrated confidence score is worse than none, because the entire pitch
rests on it; mitigate by validating calibration (P1.2.b's check: do low-confidence
segments actually fail more often?) before advertising it. *Versioning debt* — an
`api_version` header scheme (P1.1.c) is a commitment to maintain two response
shapes; revisit whether v1 can be deprecated with notice once real client usage
data exists.

---

### Phase 2 — Trust at Scale

**Thesis.** Phase 1 makes Mercury interesting to an engineer. Phase 2 makes it
purchasable by an organisation — which is a different problem, solved with audit
trails, documentation, and provable claims rather than with model quality. The
August 2026 EU AI Act conformity deadline is an externally imposed forcing
function we did not have to create and should organise around.

#### P2.1 — Request-level audit log

- **P2.1.a** — Task: migration `017_audit_log.sql` — append-only table:
  request id, user/org id, endpoint, model id + version, timestamp, duration,
  outcome (success/error/rate-limited), content hash (SHA-256 of the audio
  bytes, never the audio itself).
  Design: append-only at the application layer (no UPDATE/DELETE code path
  exposed), and a Postgres trigger or row-level policy denying UPDATE/DELETE
  outright as a second line of defence — an audit log that can be edited isn't
  one.
  Est: M. Accept: attempting an UPDATE against the table from the app's own DB
  role fails at the database level, not just by convention.
- **P2.1.b** — Task: middleware writing an audit row on every request to
  `/api/transcribe`, `/api/tts`, and admin-sensitive endpoints, without adding
  a synchronous DB round-trip to the critical path (write async/queued).
  Est: M. Accept: audit rows appear for 100% of a test batch of requests,
  verified by comparing request-log count to audit-table row count under load.
- **P2.1.c** — Task: admin-only query surface — filter by user/org, date
  range, model, outcome — plus CSV/JSON export.
  Est: S. Accept: an admin can pull "every request against model X in the last
  30 days" and export it.

#### P2.2 — Consent and provenance ledger *(∥ — must precede any retraining, hard gate on P4.1)*

- **P2.2.a** — Task: migration `018_consent_ledger.sql` — per-recording:
  consent status (granted/withdrawn/unknown), permitted uses (enum:
  service-delivery-only, retraining-permitted, research-permitted), retention
  window, erasure timestamp if applicable.
  Est: S. Accept: schema reviewed against GDPR Article 9 requirements checklist
  (documented consent, specific purpose, revocable) before being considered
  final — this one is worth a second pair of eyes given the legal exposure.
- **P2.2.b** — Task: consent capture UI at signup / recording time —
  explicit, unticked-by-default checkbox for "permit use of my recordings to
  improve Mercury's models," separate from basic service consent.
  Est: S. Accept: default state is opt-out, verified by inspecting the actual
  rendered form state, not just the intent.
- **P2.2.c** — Task: erasure flow — a user withdrawing consent flags their
  existing recordings as excluded from any future training run, and (if
  already used in a completed training run) records that fact rather than
  pretending retroactive removal from a trained model is possible.
  Est: M. Accept: withdrawing consent is reflected in the ledger within the
  same request; a query "give me all recordings eligible for the next
  training run" correctly excludes withdrawn ones.

#### P2.3 — Self-hosted deployment guide + conformity pack

- **P2.3.a** — Task: architecture diagram + written data-flow trace showing
  audio path from ingestion to deletion, confirming no egress point exists in
  the self-hosted configuration.
  Est: S. Accept: diagram reviewed against the actual `docker-compose.yml` —
  every network call an external auditor would ask about is either shown or
  explicitly noted as absent.
- **P2.3.b** — Task: written mapping from Mercury's actual controls (P2.1
  audit log, P1.6 version pinning, P2.2 consent ledger) to EU AI Act
  technical-documentation article requirements.
  Est: M — this is research-and-writing effort, not engineering; likely needs
  a pass by someone (or something) with actual regulatory familiarity before
  being shown to a customer.
  Accept: a document that names the specific AI Act article each control
  answers, not a generic "we take compliance seriously" page.
- **P2.3.c** — Task: publish as a docs page + downloadable PDF.
  Est: S. Accept: linked from the enterprise docs section, exportable.

#### P2.4 — Batch quality-assurance endpoint *(∥)*

- **P2.4.a** — Task: `POST /api/qa/batch` — accepts N audio files (or
  references to already-transcribed history rows), returns them ranked by
  aggregate error signal (low confidence density + phoneme diagnostics
  severity).
  Est: M. Accept: given a batch where one file is a known-bad sample (from the
  P0.3.a fixture set) and the rest are clean, the bad one ranks first.
- **P2.4.b** — Task: compliance-event flagging — configurable keyword/phrase
  rules (missing consent statement, restricted topic mentioned, an
  unauthorised-sounding promise pattern) run against the transcript, flagged
  per-call.
  Est: M. Accept: a test transcript containing a configured trigger phrase is
  flagged; one without is not.
- **P2.4.c** — Task: results UI — a ranked list view in the dashboard, not
  just an API response, since the QA buyer persona is not necessarily a
  developer.
  Est: M. Accept: a non-technical reviewer can open the batch result and
  identify the worst call without reading JSON.

#### P2.5 — Published break-even economics *(∥)*

- **P2.5.a** — Task: build the actual cost model — hardware cost, amortised
  power draw, and a reasonable ops-time estimate, compared against published
  cloud ASR per-hour rates, producing a real break-even point in hours of
  audio.
  Est: S. Accept: numbers are sourced (cited), not asserted, and include the
  case where self-hosting is *not* yet cheaper (low-volume users), stated
  honestly rather than omitted.
- **P2.5.b** — Task: publish as a docs/marketing page with an interactive
  "how many hours of audio do you process" calculator.
  Est: S. Accept: page live, calculator's output matches P2.5.a's model at
  the boundary values.

#### P2.6 — Contractual accuracy and latency targets

- **P2.6.a** — Task: define the actual numbers Mercury is willing to commit
  to (e.g., specific WER/Semantic-WER ceiling under stated conditions, p95
  latency ceiling), derived from real measured data from P1.5/P0.1.d, not
  aspirational figures.
  Est: S. Accept: every number in the published commitment traces back to a
  measured dashboard value, with the measurement conditions stated alongside
  it (audio type, tier, load level).
- **P2.6.b** — Task: publish as a documented SLA/target page, distinct from
  marketing copy — plain numbers, conditions, and what happens if they're
  missed.
  Est: S. Accept: page exists, legal/founder review done before publishing
  (this is a commitment, not a blog post).

**Exit criteria.** A security reviewer can approve a Mercury deployment from
written documentation alone. Every request is auditable and exportable. No audio
enters a training set without a recorded consent basis. Published, defensible
accuracy and latency figures exist.

**Risks.** *Compliance theatre* — producing documents that describe controls
which do not technically exist; mitigate by deriving P2.3 from P2.1's actual
schema rather than writing it aspirationally. *Scope creep into certification* —
full formal conformity assessment is a specialist, expensive exercise; the goal
here is to be *ready* for one, not to perform it.

---

### Phase 3 — Platform

**Thesis.** The strategic inversion. As long as Mercury ships its own models, it
is in a quality race against organisations with vastly more compute. The moment
Mercury runs *other people's* models and adds the trust layer, every improvement
in the open-model ecosystem becomes a tailwind instead of a threat. This phase is
what makes the answer to "you're just wrapping pretrained models" be "yes,
deliberately, that's the product."

#### P3.1 — Bring-your-own-model backend registration

- **P3.1.a** — Task: define a backend protocol contract — the minimal request/
  response shape any external inference endpoint must implement to plug into
  Mercury (audio in, `TranscriptionResult`-compatible out, or an adapter layer
  translating a raw-text response into that shape when the backend can't
  supply confidence).
  Est: M. Accept: contract documented, and the existing built-in tiers pass it
  by construction (since P1.1 already defines the shape they return).
- **P3.1.b** — Task: generalise `_space_url_for()` in
  `Backend/asr_pipeline.py:61` into a registry lookup keyed by org-configured
  backend id, falling back to the existing built-in mapping unchanged.
  Est: M. Accept: existing built-in tiers continue working with zero behaviour
  change; a manually-registered test endpoint (even a stub) is reachable
  through the same `/api/transcribe` path.
- **P3.1.c** — Task: registration UI/API for an org admin to add an endpoint
  URL, auth credentials, and declared capabilities (does it expose
  confidence? what audio formats?).
  Est: M. Accept: a registered backend shows up in `/api/models` alongside
  built-in tiers, correctly labelled as external.
- **P3.1.d** — Task: audit log (P2.1) and confidence handling (P1.2) both
  verified to degrade correctly against an external backend that supplies
  none of the optional signals.
  Est: S. Accept: a minimal stub backend (returns only text) still produces a
  valid, audit-logged response with `confidence: None` throughout, not an
  error.

#### P3.2 — Speaker diarization *(∥)*

- **P3.2.a** — Task: evaluate and select an existing diarization model/library
  (not build from scratch) against Mercury's actual audio profile (call
  center, lecture, clinical).
  Est: M. Accept: a written comparison of 2-3 candidates against a small
  labeled internal test set, with a decision recorded.
- **P3.2.b** — Task: integrate the chosen model, output speaker-labelled
  segments merged into `TranscriptionResult`.
  Est: L. Accept: on a known 2-speaker test recording, output correctly
  labels the majority of turns (exact threshold set after P3.2.a's baseline
  is known — don't pre-commit to a DER number the research says is
  unreachable).
- **P3.2.c** — Task: overlap-confidence reporting — when the model detects (or
  is likely encountering, based on acoustic features) overlapping speech,
  flag the segment as `overlap_uncertain: true` rather than silently
  assigning it to one speaker.
  Est: M. Accept: a constructed test clip with deliberate overlapping speech
  is flagged, not silently mis-attributed.

#### P3.3 — True streaming ASR

- **P3.3.a** — Task: audit which engines behind Echo/Apollo/Thoth actually
  support incremental/streaming inference versus only batch — this determines
  which tiers can offer the feature at all.
  Est: S. Accept: a written per-engine yes/no, before any streaming
  infrastructure work starts.
- **P3.3.b** — Task: WebSocket endpoint accepting a live audio stream, running
  incremental inference on supporting engines, emitting partial results with
  confidence as they firm up.
  Est: L. Accept: a live microphone stream produces visibly updating partial
  transcripts client-side with sub-second latency per update, on at least one
  supporting engine.
- **P3.3.c** — Task: `LiveTranscribe.tsx` updated to consume the streaming
  endpoint instead of the current 6-second-segment polling approximation.
  Est: M. Accept: perceived latency to first partial text is visibly lower
  than the current implementation, measured, not just felt.

#### P3.4 — Turn-taking and barge-in primitives *(∥)*

- **P3.4.a** — Task: implement semantic VAD combining acoustic silence
  detection with transcript syntactic-completeness (does the partial
  transcript look like a finished sentence).
  Est: L. Accept: on a test set of recorded conversational turns including
  mid-sentence pauses, false-turn-end rate is measured and recorded (target:
  matching or beating the naive VAD-only baseline, with the actual number
  published rather than assumed).
- **P3.4.b** — Task: expose as a standalone API primitive
  (`POST /api/turn-detect` or a streaming event on the P3.3 WebSocket) usable
  independent of full transcription, so voice-agent builders can consume just
  this signal.
  Est: M. Accept: an external caller can get a turn-end event without
  requesting a full transcript.

#### P3.5 — Long-form handling

- **P3.5.a** — Task: measure current behaviour on real hour-plus audio —
  deletion error rate and timestamp drift over the file's duration, using
  existing engines as-is.
  Est: S. Accept: a table showing error rate vs. position-in-file, proving or
  disproving that degradation is actually present in Mercury's pipeline
  specifically (not just in the literature).
- **P3.5.b** — Task: fix chunk-boundary stitching — overlap-and-merge windows
  instead of hard cuts, resolving duplicate/dropped words at boundaries.
  Est: M. Accept: P3.5.a's measurement re-run shows reduced boundary-error
  rate.

#### P3.6 — Custom pronunciation lexicon (TTS) *(∥)*

- **P3.6.a** — Task: per-org/per-user pronunciation dictionary table (term →
  ARPAbet/IPA override), migration `019_pronunciation_lexicon.sql`.
  Est: S. Accept: schema supports both ARPAbet (reusing the existing g2p_en
  representation) and free-text IPA.
- **P3.6.b** — Task: wire lexicon lookup into the TTS synthesis path —
  matched terms in input text get the override pronunciation instead of the
  model's default guess.
  Est: M. Accept: a registered override for a known-mispronounced name is
  audibly correct in synthesized output where the unmodified model gets it
  wrong.
- **P3.6.c** — Task: management UI in settings for adding/editing lexicon
  entries.
  Est: S. Accept: a user can add an entry and immediately hear it applied in
  a test synthesis.

**Exit criteria.** A customer runs their own model behind Mercury and gets the
full trust layer. Diarization ships with honest overlap reporting. Streaming
supports live uncertainty flagging. Turn-detection is callable standalone.

**Risks.** *Backend abstraction leakage* — confidence extraction is engine-
specific (P1.2), so a customer's arbitrary backend may supply none; handle by
degrading explicitly to "confidence unavailable" rather than silently, which the
Phase 1 design already anticipates. *Diarization scope* — easy to sink a quarter
chasing DER improvements that the field says are not available; hold the line
that the differentiator is honest reporting, not a better number.

---

### Phase 4 — Compounding Advantage

**Thesis.** Everything up to here is defensible engineering that a
well-resourced competitor could replicate in a year. This phase builds the part
that gets *harder* to copy over time, because it is made of accumulated
real-world error data rather than code. The loop: observe where Mercury fails on
real customer audio, synthesise targeted training data through our own TTS,
retrain, measure. Published work validates the technique — TTS-augmented training
cut mixed error rate from 12.1% to 10.1% and 17.8% to 16.0% on code-switching
benchmarks — and it is aimed squarely at the failure mode every general-purpose
system shares.

#### P4.1 — The closed improvement loop *(hard-gated on P2.2 consent ledger)*

- **P4.1.a** — Task: error-mining query — pull low-confidence and
  phoneme-flagged segments from real usage where the recording's consent
  status (P2.2) permits retraining use.
  Est: M. Accept: query correctly excludes every recording without explicit
  retraining consent, verified against P2.2's ledger with a deliberately
  mixed test set.
- **P4.1.b** — Task: targeted synthesis — for the most common error patterns
  found (e.g., a specific phoneme confusion or code-switch boundary), generate
  synthetic training pairs via Mercury's own TTS engines.
  Est: L. Accept: generated synthetic samples reviewed for basic quality
  (not garbled — reuse the existing TTS garbled-speech check from the
  coaching module work) before entering the training set.
- **P4.1.c** — Task: retraining pipeline wired to the existing n8n
  `retrain_trigger.json` scaffolding, with before/after evaluation against a
  held-out real-audio set (never included in training) using P1.5's honest
  metrics.
  Est: L. Accept: a full retrain cycle runs end to end and produces a
  before/after Semantic WER / Missed Entity Rate comparison on the held-out
  set.
- **P4.1.d** — Task: rollback gate — a retrained model only promotes to
  production if the held-out evaluation shows improvement; regression blocks
  promotion automatically, not by manual review alone.
  Est: M. Accept: a deliberately-degraded test model fails to promote through
  the pipeline.

#### P4.2 — Real drift detection *(feeds the safety gate on P4.1)*

- **P4.2.a** — Task: replace the volume-based proxy in `Backend/mlops.py`'s
  `get_drift_signal()` with genuine WER/CER (and Semantic WER, once P1.5
  ships) trend computation per model against a rolling baseline window.
  Est: M. Accept: the endpoint's own docstring no longer needs to say "not
  real drift detection"; a synthetic test where recent accuracy is
  deliberately worse than baseline correctly triggers the signal.
- **P4.2.b** — Task: alerting — when drift crosses a threshold, flag in the
  admin dashboard and (if wired to notifications) alert, distinct from and in
  addition to the existing crude proxy.
  Est: S. Accept: threshold breach produces a visible admin alert within one
  evaluation cycle.

#### P4.3 — Accent and code-switch depth

- **P4.3.a** — Task: assemble or source a code-switching evaluation set
  (starting point: public datasets like SwitchLingua, referenced in the
  research sweep) to measure Mercury's current baseline performance.
  Est: M. Accept: a baseline Semantic WER / mixed-error-rate number exists on
  a real code-switching test set, before any augmentation work starts.
- **P4.3.b** — Task: apply the P4.1 closed loop specifically targeted at
  code-switch boundaries and accented phoneme confusions, using the published
  technique (TTS-augmented training data) as the method.
  Est: L. Accept: measured improvement against P4.3.a's baseline, on the same
  held-out set, attributable to the targeted synthetic data specifically
  (ablation: compare against a control retrain without the targeted
  augmentation).

#### P4.4 — Vertical packaging *(∥)*

- **P4.4.a** — Task: clinical package — bundle P1.4 hallucination guard
  messaging, P4.3 accent/code-switch improvements, and a specialty-terminology
  lexicon (extends P3.6) into a positioned offering for medical scribing.
  Est: M (mostly packaging/positioning + a terminology lexicon seed data set).
  Accept: a demo environment configured specifically for a code-switched
  clinical consult scenario, working end to end.
- **P4.4.b** — Task: contact-centre package — bundle P2.4 batch QA with a
  compliance-rule template library (common consent-statement patterns,
  common restricted-topic categories) so a buyer isn't starting from a blank
  rule set.
  Est: M. Accept: a new org can enable the package and get useful flags on
  day one without hand-writing rules first.
- **P4.4.c** — Task: captioning package — bundle P3.3 streaming with P2.6's
  contractual latency/accuracy targets into a positioned live-captioning
  offering.
  Est: S (mostly packaging on top of already-built pieces). Accept: a demo
  showing live captions with the published latency target actually met on
  real audio.

#### P4.5 — Underserved languages *(∥)*

- **P4.5.a** — Task: pick one target low-resource language (e.g., one of the
  named Indic languages with active research infrastructure) and assess
  available public data (IndicVoices, similar) against what Mercury's
  pipeline needs.
  Est: S. Accept: a written data-availability assessment and go/no-go
  recommendation for a first language.
- **P4.5.b** — Task: fine-tune/adapt an existing multilingual base model for
  the chosen language, evaluated against a held-out set in that language.
  Est: L. Accept: a working ASR (and ideally TTS) path for the chosen
  language with a measured baseline accuracy, however modest.

#### P4.6 — Coaching and clinician module *(needs P3.3 for real-time correction)*

- **P4.6.a** — Task: real-time inline pronunciation correction, built on
  P3.3's streaming infrastructure — flag a mispronunciation as it happens
  during recording.
  Est: M (mostly wiring, given P3.3 exists). Accept: a deliberately
  mispronounced test word is flagged inline during a live session, not only
  in a post-session report.
- **P4.6.b** — Task: clinician/coach dashboard — longitudinal phoneme-error
  view per student/patient across sessions, exportable for billing/reporting
  use.
  Est: L. Accept: a clinician account can view a trend across multiple past
  sessions for one client, not just a single-session report.
- **P4.6.c** — Task: own-voice corrected playback — TTS voice-clone the
  user's own voice reading back the corrected pronunciation, reusing existing
  voice-cloning infrastructure from the TTS tiers.
  Est: M. Accept: a generated corrected sample is audibly in the same voice
  as the original recording, verified by listening comparison.

**Exit criteria.** A measurable, published accuracy improvement on accented and
code-switched audio that is attributable to the loop rather than to a model
upgrade — that is, an improvement a competitor cannot obtain by swapping in a
bigger model.

**Risks.** *Feedback contamination* — training on our own errors can entrench
them; mitigate with a held-out real-audio evaluation set that never enters
training. *Consent drag* — doing P2.2 properly will make some data unusable, and
that is the correct outcome even though it slows the loop. *Diffusion* — P4.4 and
P4.5 are three-plus products; sequence them by which buyer signs first rather
than building all of them speculatively.

---

### Dependency map

```
P0 (floor)
 └─> P1.1 structured result ──┬─> P1.2 confidence ─┬─> P1.7 self-serve test
                              ├─> P1.3 diagnostics │
                              ├─> P1.5 metrics ────┼─> P2.6 contractual targets
                              └─> P1.6 versioning ─┘
     P1.4 hallucination guard (∥, independent)

P1 ──> P2.1 audit ──> P2.3 conformity pack
       P2.2 consent ledger ────────────────────> P4.1 retrain loop (hard gate)
       P2.4 batch QA ──────────────────────────> P4.4 vertical packaging

P1.1 + P2.1 ──> P3.1 BYO backend
P3.3 streaming ──> P4.6 coaching (real-time correction)
P1.5 metrics ──> P4.2 real drift detection ──> P4.1 (safety gate on retraining)
```

### Sequencing principle

Ship in the order that makes the *next* conversation possible. Phase 1 makes an
engineer curious. Phase 2 makes their security team say yes. Phase 3 makes the
platform bet real. Phase 4 makes it permanent. Attempting Phase 4 first is the
most tempting mistake available — it is the most intellectually interesting work
and the least useful without anyone using the product to generate the errors the
loop feeds on.

### Explicitly not doing

Focus is a decision about what to decline. The following are removed from active
scope, with reasons, so they don't quietly return:

- **General-purpose reasoning layer ("the brain")** — a different company.
- **Browser extension and chatbot** — surface area without a buyer.
- **Client-side obfuscation** — cost without customer value.
- **Deepfake detection** — genuinely a large and growing market, but a separate
  product with an inherent conflict against our own voice synthesis. Parked
  deliberately, not forgotten.

---

## Backlog

Below this line: the running list of "later" items as they've come up, kept so
they don't get lost. Not scheduled, not prioritised against each other.

## Performance

- **3-second maximum response time** — every user-facing request (transcribe, TTS,
  page loads) should respond within 3 seconds. Currently nowhere close for a cold
  model load (observed 100-600s this session) — first real request after a restart
  needs to hit a warm/pre-loaded model, not trigger a live download. Once models
  persist properly (HF cache volumes, already in place) and stay warm, revisit
  whether 3s is realistic for the heavier models (Apollo/Bark, Thoth/CosyVoice2) or
  whether the target should vary by tier/model size.

## Integrations

- **n8n node for Mercury** — a real installable n8n *node* (published npm package,
  shows up in n8n's node picker with Mercury's own icon/params) so anyone building
  an n8n workflow can add a "Mercury" step directly, instead of wiring an HTTP
  Request node by hand against the REST API. Different from the n8n *workflows*
  already in the repo (`n8n/retrain_trigger.json`, `n8n/account_deletion_cron.json`)
  — those are workflow definitions that happen to call Mercury's API; this would be
  the reusable building block other people's workflows could use.

## Coaching module (not a standalone product — a module on top of Mercury's
## existing ASR/TTS/error-diagnostics core)

Researched ELSA Speak, Speak, Speechling before scoping this (2026-08-05) — all
three already own real-time phoneme feedback, color-coded scoring, tongue/lip
placement guidance, and L1-accent-specific drills. Competing head-on there is
not viable; this module only makes sense bolted onto Mercury's existing
transcription/TTS use cases, not as a reason to build a separate consumer app.

- **Real-time inline pronunciation correction** — flag a mispronunciation while
  recording, not just in a post-session report. Table stakes to not look dated
  next to ELSA/Speak, not a differentiator by itself. Blocked on real streaming
  ASR (see "True streaming ASR" below) — the current 6-second-segment
  approximation is too laggy for inline flagging to feel real-time.
- **Clinician/coach dashboard (B2B2C wedge)** — the actual gap found in
  research: ELSA/Speak/Speechling are pure consumer self-serve; the separate
  "speech therapy software" category is billing/practice-management, not
  phoneme diagnostics. Nobody bridges phoneme-level error tracking into a
  therapist/ESL-teacher-facing longitudinal view a clinician can act on and
  bill against. Sell to clinics/schools (recurring, real budget) as an add-on
  seat, not a replacement for Mercury's core product.
- **Own-voice corrected playback** — TTS voice-clone the user's own voice
  reading back the corrected pronunciation of what they just said ("hear
  yourself saying it right"), instead of a generic TTS voice modeling the
  target sound. Unclaimed by any competitor reviewed. Cheap relative to the
  others given TTS infra already exists — reuses Apollo/Thoth voice cloning,
  not new model work.
- **Multi-modal (lip/mouth video) feedback** — pair audio error with webcam
  video for mouth-shape guidance on a sound. Folds into the clinician
  dashboard as a premium/clinical-grade tier rather than a standalone core
  feature — meaningful extra build cost (video capture + processing) that
  only pays off once the B2B wedge above has real users to justify it.

## Core product thesis (2026-08-05 — supersedes earlier vague "ASR/TTS platform" framing)

Applied First Principles + Jobs to be Done + TRIZ to answer "what is this product
actually for" after concluding raw model quality isn't defensible (can't out-train
OpenAI/ElevenLabs, model layer is commodity and getting more commodity monthly).

**First Principles**: audio→text, text→audio, and the error/confidence signal
between them are the only three primitives. Nobody pays for the conversion itself
anymore — they pay for what wraps it: trust (compliance/privacy), interpretability
(why did it fail here), workflow fit. Mercury's stack (self-hosted, phoneme
diagnostics, tiered credits) already leans wrap-not-convert — lean harder, don't
compete at the model layer at all.

**Jobs to be Done** — who actually hires ASR/TTS and why:
- Compliance-bound orgs (legal, healthcare, gov) — "audio never leaves our infra."
- Call-center/QA teams — "flag which calls had comprehension failures, not just
  hand me a transcript."
- Dev teams integrating an API — "don't want vendor lock or silent model swaps
  changing behavior under me."
- Accessibility/live-caption tooling — "flag uncertain words live, not after."
- Content/localization teams — batch TTS that doesn't sound synthetic, cheap.

**TRIZ contradiction**: need differentiation, but the model layer is commodity.
Resolved by separating in space — differentiate at the deployment/observability
layer sitting on top of commodity models, not the model layer itself. Mercury
becomes the platform orgs run their model of choice *through*, not another model
vendor.

### Ranked build order (cheapest/highest-leverage first)

1. **Per-segment confidence/uncertainty in every transcribe response** — wire the
   existing phoneme-diagnostics pipeline (`Backend/phoneme_diagnostics.py`) into
   the live `/api/transcribe` path instead of running it only as post-hoc
   analysis. Smallest lift, directly serves the QA/call-center JTBD.
2. **Model version + audit log on every request** — near-free given model
   versioning already exists; return `model_version` in every response, log
   who-ran-what-when for compliance buyers. Trust-as-product.
3. **Batch call-QA endpoint** — upload N recordings, get back a list sorted by
   error rate, so a QA team doesn't have to listen to everything. Reuses
   existing phoneme error scoring.
4. **LLM-based generative error correction pass** — post-process the transcript
   with an LLM given the confidence-flagged spans. Published technique
   (arxiv 2409.09554), meaningful accuracy boost especially on accented/
   low-resource audio, cheap given confidence scoring already exists from #1.
5. **Show-user-their-own-error-rate at signup** — let a new user run a quick
   self-test on their own audio instead of showing a generic marketing WER
   number. Directly answers the most common real-world complaint (Reddit/Adobe
   forums): headline accuracy numbers don't reflect accented/noisy real audio.
6. **Bring-your-own-model backend registration** — let an org register their own
   model endpoint (self-hosted Whisper, whatever) and get Mercury's diagnostics/
   versioning/audit layer wrapped around it, same as the built-in tiers. This is
   the one that actually answers "what makes this not just a fine-tuned
   wrapper" — uniqueness moves off the model entirely onto the platform layer.
7. **Code-switching / accent-focused TTS-augmentation retrain loop** — the
   original detect-error→TTS-synth→retrain idea, retargeted from "medical" (no
   real buyer found) to code-switching/underrepresented-accent speech, where
   it's now a published, validated technique: TTS-synthesized data augmenting
   ASR training cut mixed-error-rate 12.1%→10.1% and 17.8%→16.0% in a 2025-2026
   paper (arxiv 2601.00935). Feeds Mercury's own models with real usage error
   data over time — the actual data moat, vs. static fine-tuning.
8. **Streaming ASR for live uncertain-word flagging** — biggest lift of this
   list, but now justified by a real buyer (accessibility/live captioning), not
   just "cool to have." Same underlying gap as "True streaming ASR" below —
   this is the concrete reason to prioritize it.
9. **Disordered/impaired speech support** — survey-confirmed thin coverage
   across existing ASR vendors (ScienceDirect survey, 2024-2026). Real unmet
   accessibility need, no major player owns it; closer to the original medical
   instinct but accessibility-framed instead of hospital-sales-cycle-framed.
10. **Free-form natural-language TTS emotion control** — industry moving toward
    inline natural-language emotion description ("say this warmly but tense")
    instead of fixed emotion tags; unclaimed by open-source TTS as of 2026.
    Hardest item on this list, least-claimed white space if pursued.

## Research-backed opportunity landscape (2026-08-05)

Sixteen searches across arxiv/IEEE/ScienceDirect papers, vendor engineering blogs,
and real user complaint threads. Every item below is a documented gap or a
documented user pain — not a guess. Grouped by how well each fits what Mercury
already has built.

### A. Directly buildable on the existing stack

- **Whisper-class hallucination guard.** Whisper invents text on non-speech audio:
  40.3% of inferences on non-speech produced hallucinations in one study, and ~1%
  of ordinary transcriptions contain hallucinated content — 38% of those carry
  explicit harms (fabricated violence, false authority). Healthcare reporting
  already flagged it inventing things patients never said. Documented fixes are
  cheap: VAD gating (SileroVAD), silence trimming at file head/tail (silence is a
  direct trigger), and a "bag of hallucinations" post-filter. Mercury can ship
  this as a *safety guarantee competitors don't advertise* — nobody markets
  "we don't make things up," and in medical/legal it's the whole purchase
  decision. Refs: arxiv 2501.11378, arxiv 2505.12969 (Calm-Whisper),
  arxiv 2502.12414.
- **Semantic WER / Missed Entity Rate instead of plain WER.** WER is broken and
  the industry now says so openly: it weights a dropped filler word the same as a
  dropped drug name, ignores meaning entirely, doesn't correlate with downstream
  task success, and actively penalizes models *more* accurate than the human
  reference transcript. The 2026 recommendation is WER *alongside* Semantic WER
  (embedding-distance-based) and Missed Entity Rate (accuracy on proper nouns,
  medical terms, account numbers, dates — the words downstream systems actually
  depend on). Mercury already computes WER/CER in `eval_metrics`; adding these two
  makes the admin trend charts and any customer-facing benchmark honest, and is a
  legitimately differentiated eval story. Refs: arxiv 2603.05267,
  arxiv 2511.16544 ("WER is Unaware"), arxiv 2410.07400, AssemblyAI.
- **Custom pronunciation lexicon for TTS.** Documented, unglamorous, universally
  painful: neural TTS systematically mispronounces proper nouns, brand names,
  non-English names, and acronyms (can't tell NATO-style from FBI-style), and
  mangles alphanumerics (A380 read as a number, "2026" read as a quantity not a
  year). Fix is a per-user/per-org pronunciation dictionary with IPA or ARPAbet
  overrides. Mercury already extracts ARPAbet phonemes via g2p_en — the
  representation is already in the codebase, this is mostly plumbing plus UI.
- **Long-form degradation handling.** Whisper's 30-second training window means
  hour-long audio hits "long-form degradation" — high deletion errors, and
  timestamp drift that compounds until alignment is visibly wrong by the middle
  of a recording. Chunk-and-stitch (what Mercury effectively does in Live
  Recording) causes boundary errors. Worth measuring on our own long files before
  claiming meeting/lecture support, since lecture transcription is a stated
  target use case. Refs: arxiv 2606.01483 (MURMUR), arxiv 2309.09950.

### B. New capability, clear demand, medium lift

- **Speaker diarization ("who spoke when").** Confirmed still-unsolved, and
  explicitly *not* expected to break through in 2026 — the 30%+ DER ceiling on
  overlapping speech is structural to current approaches. Overlap, unknown
  speaker count, and online/streaming operation are individually handled but
  "no known method solves all three at once." Mercury has no diarization at all
  today, and every meeting/call-center/clinical use case needs it. Not a research
  win to chase — a table-stakes feature to add, where being honest about overlap
  limits (surface a confidence flag rather than pretending) is itself
  differentiating. Refs: arxiv 2509.26177, arxiv 2101.08473.
- **Voice AI turn-taking / barge-in primitives.** The stated hardest product
  problem in voice agents: too-sensitive turn detection interrupts the user,
  too-conservative creates dead air. 2026 production bar is <400ms barge-in
  detection, <2% false barge-in, <1% missed interruptions; humans take turns at
  200-300ms gaps while most agents lag 800-1500ms because they wait on VAD
  silence. Modern approach combines VAD + prosodic pitch analysis + transcript
  syntactic-completeness. If Mercury exposes semantic-VAD/turn-detection as an
  API primitive, it sells to every voice-agent builder without Mercury having to
  build an agent product itself — sell picks, not gold.
- **Audio deepfake / synthetic voice detection.** Biggest raw market signal found
  in the whole sweep: detection market projected $15.7B by 2026 at ~42% CAGR,
  detection spending running 18.5x the generation market, deepfake fraud attempts
  up 2,137% over three years, $1.1B US losses in 2025. Critically, there's a real
  technical gap — detectors hit ~96% in lab conditions but drop 45-50% in the
  real world, and humans only catch commercial/autoregressive-model voices 61-66%
  of the time. Mercury runs TTS models in-house, which is an unusual advantage:
  you can generate labeled synthetic audio from your own engines to train a
  detector. Note the irony/conflict to think through — selling both voice cloning
  and cloning detection.
- **On-device / edge deployment.** Quantizing ASR to 3-8 bits cuts memory and
  latency up to 10x with negligible accuracy loss; model optimization gets
  cloud-scale models to 5-10% of original size. Vosk and Sensory already occupy
  the low end. The pull is privacy + no-connectivity + no per-minute cost. Fits
  the mobile app surface already on the roadmap, and reinforces the
  privacy/compliance thesis rather than diluting it.

### C. Vertical wedges with documented, specific pain

- **Medical scribe — the accent/code-switch failure.** The exact documented
  complaint: generic scribes lose 15-25% accuracy on specialty terminology, and
  "a scribe trained on US English primary care can collapse on a Hindi-English
  code-switched cardiology consult." That is precisely the code-switching gap in
  the core-thesis list, with a named buyer attached. Also documented: DAX
  Copilot's measured documentation-time reduction was 1.7% and *not statistically
  significant*; the named gaps are language auto-detection, suggested coding, and
  self-serve access. And the long-tail risk nobody markets against — bad
  transcription contaminates the EHR permanently and influences future care.
  Mercury's angle: not "better scribe," but "the scribe that survives accented,
  code-switched, multilingual consults" + hallucination guard (A above) as the
  EHR-contamination answer.
- **Call-center QA / compliance.** Documented unmet needs: siloed point
  solutions, disconnected workflows, insights without action. The concrete value
  prop is scoring 100% of interactions automatically instead of sampling a few —
  flagging skipped consent statements, unauthorized promises, restricted topics.
  Maps exactly onto the batch-QA endpoint already in the ranked build list.
- **Live captioning / accessibility.** Real, filed, unresolved grievance:
  disability organizations have petitioned the FCC over chronic live-captioning
  quality. Reported AI caption accuracy runs as low as 60%, auto-generated
  captions up to 40% error, and latency means captions land seconds after the
  speaker moved on. WCAG mandates captions but sets no numeric accuracy or
  latency floor — meaning procurement contracts do, which is a *sellable*
  opening: publish and guarantee numeric targets nobody else commits to.
- **Low-resource / Indic languages.** Genuinely underserved and actively
  researched: IndicVoices, A2TTS, ELAICHI, OpenBibleTTS, WMT 2026 Indic task,
  with named languages (Assamese, Mizo, Khasi, Manipuri, Nyishi, Kokborok) having
  essentially no commercial coverage. Big players won't chase these — no market
  size on their spreadsheets. Strong fit with the code-switching thesis, and a
  defensible niche precisely because it's unattractive to incumbents.
- **Voice biomarkers / mental health.** Speech as non-invasive biomarker for
  depression and other conditions is a live, reviewed research area (JMIR
  systematic review 2025, Frontiers scoping review), with a documented gap in
  synthesizing SER-based diagnostic results specifically. High regulatory
  burden (clinical claims), so treat as long-horizon research direction, not a
  near-term feature — but it's the credible version of the original "medical"
  instinct.

### D. Structural / trust plays (cheap to start, compounding value)

- **Training-data provenance and consent chain.** Voice is biometric data under
  GDPR Art. 9 — explicit consent is the only reliable lawful basis, and the
  consent chain is harder than for other data (performer rights, moral rights,
  right of publicity). "Can you prove where your training data came from?" is
  becoming a procurement requirement, not a best practice. Since Mercury plans to
  retrain on user error data (see the code-switching loop), the consent/provenance
  ledger has to be designed in from the start, not retrofitted. Turn the
  obligation into a selling point: a documented, auditable provenance trail.
- **EU AI Act deadline as a sales trigger.** By 2 August 2026: conformity
  assessments completed, technical documentation finalized, CE marking, EU
  database registration for high-risk systems. Penalties to EUR 20M or 4% of
  worldwide turnover. Voice/biometric and emotion-recognition systems are
  squarely in scope. This is a dated, externally-imposed forcing function that
  makes the self-hosted + audit-log + version-pinned story urgent for EU buyers
  rather than merely nice.
- **Self-hosting economics as the honest pitch.** Cloud batch ASR runs ~$0.15-
  0.36/hr; a ~$600 Mac mini or $700-900 used RTX 3090 breaks even against
  OpenAI's $0.36/hr at roughly 1,670-2,500 hours of audio, and is effectively
  free thereafter. Best local models now beat the paid cloud baseline on accuracy
  too. Mercury already *is* a self-hosted stack — publishing this break-even math
  openly (with real numbers, including power and ops time) is a marketing asset,
  not a risk.

## Product surfaces

- **Software (Enterprise)** — dedicated enterprise deployment/offering, beyond the
  existing enterprise account tier (free Max-tier access + employee-ID auth). Likely
  means: self-hosted or dedicated-tenant deployment, admin console, SSO, audit export.
- **Mobile App ("Smaller Detachment")** — the existing Expo/React Native scaffold in
  `mobile/` is unbuilt/unverified (login only, record→transcribe, TTS, no enterprise
  mode). "Smaller detachment" — a deliberately reduced feature set vs the web app,
  not a full port.
- **Browser Extension** — convert live audio on the page (a video call, a lecture
  stream, anything playing in the tab) to text, and convert typed/selected text to
  audio, without leaving the page. Needs: tab-audio capture permission, a lightweight
  in-page UI, and reuse of the existing `/api/transcribe` / `/api/tts` endpoints
  (probably via an API key, not a full user session, given the extension context).
  Same tier-naming (Echo/Apollo/Thoth, Freyr/Horus/Odin) applies here too — the
  extension's model picker/UI copy should use those names, not raw model ids.
- **CLI ("Developer Mode")** — a command-line client against the existing REST API /
  MCP server, for scripting and CI use. `mercury transcribe file.wav`,
  `mercury tts "text" -o out.mp3`, config via `~/.mercury/config` or an API key env var.
- **"The brain"** — quantize/prune Kimi K2 (or whatever model ends up right-sized)
  down to something that fits on Oracle Cloud's free tier, and run it as a reasoning
  layer alongside ASR/TTS — the "Claude but for speech" framing. Big undertaking,
  blocked on actually having the Oracle Cloud instance (still pending signup as of
  this writing) and on picking a model that's actually small enough post-quantization
  to run acceptably on free-tier hardware — needs real benchmarking before committing,
  not just picking a parameter count that sounds right.
- **True streaming ASR** — Live Recording (shipped) currently approximates "live" by
  recording ~6-second segments and transcribing each as a discrete request, so text
  lands a few seconds behind and stutters at segment boundaries. Real low-latency
  streaming needs a persistent connection (WebSocket) to a model that supports
  incremental/streaming inference (not all of Echo/Apollo/Thoth's engines do —
  worth checking per-engine before assuming this is just a backend wiring change).

## Infrastructure (explicitly "not now, future")

- **Kubernetes** — once there's more than one physical host to schedule across;
  today everything is a single docker-compose stack on one machine.
- **Oracle Cloud (free tier)** — move off the local machine (which has proven
  unreliable this session — Docker Desktop crashed repeatedly) onto an always-on VM.
- **Cloudflare** — in front of the public deployment, primarily to cut down on bot
  traffic before it reaches the app; WAF/rate-limiting at the edge.
- **Chatbot** — not a popup widget; a persistent panel with a text input, scope TBD.
  Depends on the above infra being in place first.
- **Client-side obfuscation** — minify/obfuscate the shipped JS/CSS so the frontend
  isn't trivially copyable. Next.js's production build already minifies; this would
  go further (name-mangling, control-flow obfuscation) — evaluate whether the
  performance/debuggability cost is worth it before doing it.

## Known gaps / things to revisit

- Google Drive import needs a real Google OAuth client ID configured
  (`NEXT_PUBLIC_GOOGLE_CLIENT_ID` is empty) — nothing will work until that's set up
  in Google Cloud Console and wired into `.env`/`.env.local`.
- No object storage bucket provisioned yet — profile pictures are stored as a
  `data:` URL directly on the row (see `docs/MEMORY.md`) as a stopgap; revisit once
  a real bucket exists.
- `space-max` (Thoth/Parakeet+CosyVoice2) has had five real dependency-drift bugs
  found and fixed this session but never got a clean, uninterrupted test window —
  worth a dedicated retest pass once the environment (Docker Desktop crashing
  repeatedly) is stable.
- Pro/Max tiers are deprioritized for now — focus is on Free tier working end-to-end
  before circling back to them.
- **CAPTCHA on signup is a Supabase dashboard setting** (Authentication → Bot and
  Abuse Protection), not wired into our code at all — nothing to remove here in the
  repo, it has to be turned off (or reconfigured) directly in the Supabase project
  settings. The planned replacement, per the original project history, is Cloudflare
  Turnstile — needs a sitekey from Cloudflare and actual code wiring (Supabase
  supports Turnstile natively as a captcha provider) once that's set up.
- **Real model drift detection.** What exists today (`/api/mlops/drift-signal`) is
  explicitly a crude proxy — new-sample-volume since the last training marker, not
  actual statistical/confidence drift. Its own docstring says so. A real version
  would track WER/CER trend over time per model (data for this already exists in
  `eval_metrics`) and flag when recent accuracy degrades past a threshold vs. a
  baseline window, not just "how much new data piled up."

## Admin Panel (Administrator account only)

- Already has: user list, audit log, WER/CER trend, model registry, drift-signal
  (crude, see above), p50/p95 latency + error rate per model, and per-Space
  online/offline status.
- Still missing, worth adding: a "test this model" button per model that fires a
  real request through it and shows the result inline (would have caught most of
  this session's space-max bugs immediately instead of after a live user hit them);
  uptime/incident history per Space (not just current online/offline); a way to see
  which users are near/over their credit limit; surfacing the same round-trip
  garbled-speech check (added to TTSPanel this session) in aggregate across all TTS
  traffic, not just on-demand per clip.

## Fine-tuning datasets

Real fine-tuning targets and what public data actually covers them — some of these
have solid existing datasets, others don't and would need synthetic/augmented data
instead. Being upfront about which is which rather than listing something that
doesn't really fit:

- **Accents** — well covered. Mozilla Common Voice (huge, many English accents,
  crowdsourced, CC0); L2-ARCTIC (non-native English speakers, phonetically
  annotated, built for accent research); the Speech Accent Archive (same short
  passage read by hundreds of speakers from different native-language backgrounds).
- **Medical** — partially covered. PriMock57 (57 simulated primary-care
  consultations, audio + transcript, built for exactly this); MTS-Dialog (medical
  dialogue transcripts, text only — useful for the language model side, not raw
  audio); the "Medical Speech, Transcription, and Intent" dataset on Kaggle (smaller,
  patient symptom descriptions). None of these are huge — medical audio data is
  scarce for privacy reasons, may need to record/commission some ourselves.
- **High-noise environments** — well covered. CHiME-5/CHiME-6 (real dinner-party
  recordings, genuinely messy multi-speaker noisy audio); MUSAN (a big library of
  music/noise/speech for augmentation — layer it onto clean recordings rather than
  needing noisy recordings directly); VoiceBank+DEMAND (clean/noisy speech pairs,
  built specifically for denoising and noise-robust ASR).
- **Street names / addresses / navigation-style speech** — no solid dedicated public
  dataset found. This is the weak spot. Realistic path: synthesize it — take a real
  street-address/POI-name list (e.g. OpenStreetMap data for a target region) and
  generate utterances via TTS, or record volunteers reading addresses. Common Voice
  has some address-like sentences mixed into its generic sentence pool but nothing
  purpose-built.
- **High-motion / exercise audio (running, gym, skipping rope)** — no dedicated
  public dataset found either. Same synthetic path as above: take MUSAN or
  Freesound-sourced breathing/footstep/gym-ambience noise and layer it onto clean
  speech at varying SNR, rather than waiting for a purpose-built corpus that likely
  doesn't exist. Worth checking wearable-mic / fitness-tracker research papers
  directly (not just dataset registries) in case someone's already published one.
