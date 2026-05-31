# ADAPT-Synthetix: A Closed-Loop ASR Refinement Pipeline with Phoneme-Level Error Diagnosis and LoRA Adaptation

---

## Abstract

Automatic speech recognition systems deployed in real-world conditions — particularly in noisy, accented, or domain-specific environments — degrade without targeted adaptation mechanisms. ADAPT-Synthetix is a closed-loop ASR refinement pipeline that combines confidence scoring, acoustic noise fingerprinting, reference-aligned phoneme error analysis, domain-aware priority queuing, and synthetic remedial audio generation to build a continuous adaptation dataset for LoRA fine-tuning. The system is built on the `facebook/wav2vec2-base-960h` model and exposes a FastAPI backend with 20+ diagnostic endpoints. Preliminary infrastructure is complete; quantitative adaptation results will be reported after sufficient remedial audio is collected.

---

## 1. Introduction

### Problem Statement

Off-the-shelf ASR models trained on large general corpora perform well on clean, standard speech but suffer measurable degradation in four practical failure modes: (1) background noise, (2) non-native or regional accents, (3) domain-specific vocabulary (medical, emergency), and (4) individual speaker characteristics. Retraining from scratch for each deployment is computationally prohibitive; standard fine-tuning without structure risks catastrophic forgetting of previously learned representations.

### Motivation

Parameter-Efficient Fine-Tuning (PEFT) methods — specifically Low-Rank Adaptation (LoRA, Hu et al. 2021) — allow targeted adaptation of a small subset of model weights without modifying the base model. Applied to ASR, LoRA can specialise a model to a specific noise profile or vocabulary domain with minimal compute. However, effective LoRA requires structured training data that captures the specific failure modes of the deployment context. Collecting and labelling such data manually is expensive.

ADAPT-Synthetix automates this data collection loop: every transcription that deviates from the reference (or exceeds a confidence/noise threshold) is converted to a remedial audio sample via TTS synthesis and stored with its transcript for LoRA training. The result is a self-building adaptation dataset that grows with system use.

### Scope

This paper describes the architecture, diagnostic layer, and training infrastructure of ADAPT-Synthetix. Quantitative ASR improvement results are preliminary and will be reported in a subsequent evaluation after remedial audio accumulation and LoRA training runs complete.

---

## 2. System Architecture

The system follows a pipeline architecture illustrated in `Documentation/Flowchart.png`.

```
Microphone / File Upload
        ↓
  Wav2Vec2 ASR (wav2vec2-base-960h)
        ↓
  Diagnostic Layer
  ├── Confidence scoring (logit entropy)
  ├── Noise fingerprinting (8 acoustic features)
  ├── CER computation (reference-aligned, optional)
  └── Phoneme error alignment (g2p_en + Levenshtein)
        ↓
  Error Classification → Priority Queue
        ↓
  TTS Remediation (suno/bark-small)
        ↓
  Remedial Audio → LoRA Training Dataset
        ↓
  LoRA Fine-Tuning (PEFT, per-error-type experts)
        ↓
  Drift Detection (phoneme confidence trends, 20-utterance window)
```

**Backend:** FastAPI, SQLite (default) / PostgreSQL (production), uvicorn.  
**Frontend (legacy):** Vanilla JS terminal UI with Web Audio API waveform.  
**Frontend (React):** Component-based UI with stats dashboard, history panel, and file upload.  
**Dataset:** LibriSpeech test-clean (2,620 labelled samples) for baseline benchmarking; remedial audio for adaptation training.

---

## 3. Technical Contributions

### 3.1 Reference-Aligned Phoneme Error Diagnosis

When a ground-truth reference transcript is provided, ADAPT-Synthetix converts both the reference and hypothesis to phoneme sequences using `g2p_en` and computes a phoneme-level Levenshtein alignment. Each edit operation (substitution, insertion, deletion) is stored in the `phoneme_errors` table with the specific phoneme pair involved. This is more informative than word-level WER because it identifies *which sounds* the model confuses — for example, consistent substitution of /θ/ with /d/ in non-native English speakers — enabling targeted remedial sample selection.

**Distinction from prior work:** Standard ASR evaluation reports WER/CER as aggregates. ADAPT-Synthetix stores per-phoneme error distributions across sessions, enabling longitudinal phoneme drift analysis.

### 3.2 8-Feature Acoustic Noise Fingerprinting

Each audio chunk is classified into five noise categories (clean, traffic, crowd, machinery, indoor) using eight acoustic features extracted by librosa: spectral centroid, spectral bandwidth, spectral rolloff, zero-crossing rate, RMS energy, MFCC variance, tempo, and harmonic ratio. The classifier uses threshold rules with meaningful boundaries: traffic requires `spectral_rolloff > 4000 Hz` AND `rms_energy > 0.02`, preventing misclassification of clean speech. Noise metadata is stored per transcription and used to condition remedial sample selection for LoRA training.

**Limitation:** The current classifier is a heuristic threshold system validated qualitatively. A supervised noise classifier trained on MUSAN or similar labelled noise corpora would improve precision.

### 3.3 Confidence-Weighted Remediation Priority Queue

Not all transcription errors are equally urgent. ADAPT-Synthetix implements a priority queue (`priority_queue` table) where each error entry is scored by: (1) inverse confidence (`1 - confidence_score`), boosted by (2) domain vocabulary presence (medical or emergency word matches add priority weight). This ensures that a low-confidence transcription of a medical dosage instruction is remediated before a high-confidence but slightly erroneous transcription of a filler word.

**Implementation:** Python `heapq`-based priority queue backed by SQLite, with a `mark_completed` method to retire entries after remedial audio is synthesised.

### 3.4 Phoneme-Level Drift Monitoring

A `DriftDetector` class tracks per-phoneme confidence trends across sessions using a sliding window of 20 utterances. A phoneme is classified as *degrading* when its latest window confidence is more than 0.05 below the earliest window value. Phonemes with degrading trend AND average confidence below 0.5 are flagged as *high-risk*. Retraining is triggered when ≥5 phonemes enter high-risk state, providing a proactive signal before overall WER degrades significantly.

The `get_confidence_histogram` method provides a 10-bin distribution of phoneme confidence scores for monitoring population-level shifts.

### 3.5 Domain Vocabulary Injection

ADAPT-Synthetix maintains two domain vocabulary lists: `MEDICAL_VOCABULARY` (~50 clinical terms) and `EMERGENCY_VOCABULARY` (~30 terms). These are used in two ways: (1) the `/vocabulary_check` endpoint flags whether a free-text query contains domain-critical words, and (2) the priority queue boosts remediation priority for transcriptions where recognised words overlap with these vocabularies. This targets system deployment in clinical documentation or emergency dispatch applications where specific vocabulary failures have real-world consequences.

---

## 4. Experimental Results

### 4.1 Dataset

LibriSpeech test-clean (Panayotov et al. 2015): 2,620 utterances, clean read speech, fully labelled. Used as the held-out baseline benchmark. No noisy or accented benchmark data has been registered at the time of writing.

### 4.2 Pre-LoRA Baseline CER

| Category | Sample Count | Avg CER | Min CER | Max CER |
|----------|-------------|---------|---------|---------|
| clean    | 2620        | —       | —       | —       |
| noisy    | —           | —       | —       | —       |
| accented | —           | —       | —       | —       |
| medical  | —           | —       | —       | —       |

*(Benchmark to be run after backend resources are available for full inference pass.)*

### 4.3 Post-LoRA Results

LoRA training requires ≥5 remedial audio samples in the `transcriptions` table (`remedial_audio_path IS NOT NULL`). At the time of writing, the remediation pipeline is operational but no live transcription sessions with non-clean errors have been run against the updated schema. Training and evaluation results will be added in the next revision.

| Category | Avg CER Before | Avg CER After (Epoch 3) | Δ CER |
|----------|---------------|------------------------|-------|
| all      | —             | —                      | —     |

---

## 5. Conclusion and Future Work

ADAPT-Synthetix demonstrates a complete closed-loop architecture for self-building ASR adaptation datasets. The diagnostic layer, priority queue, drift detector, and LoRA training infrastructure are fully operational. The primary remaining step is accumulating sufficient real-world speech with non-clean error types to populate the remedial training data and run quantitative adaptation experiments.

**Future work:**
- Run baseline benchmark on LibriSpeech clean-100 and noisy subsets to establish pre-LoRA CER numbers
- Collect accented and medical vocabulary recordings to populate non-clean dataset categories
- Execute LoRA training (3 epochs per expert) and report before/after CER
- Evaluate Experience Replay effectiveness by comparing CER on held-out clean data after noisy adaptation
- Explore mixture-of-experts routing: select the noise-appropriate LoRA adapter at inference time
- Migrate to GPU inference for production-scale deployment
- Validate noise fingerprint classifier against MUSAN-labelled samples

---

## References

1. Baevski, A., Zhou, Y., Mohamed, A., & Auli, M. (2020). *wav2vec 2.0: A Framework for Self-Supervised Learning of Speech Representations.* NeurIPS 2020. https://arxiv.org/abs/2006.11477

2. Hu, E. J., Shen, Y., Wallis, P., Allen-Zhu, Z., Li, Y., Wang, S., Wang, L., & Chen, W. (2021). *LoRA: Low-Rank Adaptation of Large Language Models.* ICLR 2022. https://arxiv.org/abs/2106.09685

3. Schumacher, P., et al. (2023). *Bark: A Transformer-Based Text-to-Audio Model.* suno-ai/bark. https://github.com/suno-ai/bark

4. Panayotov, V., Chen, G., Povey, D., & Khudanpur, S. (2015). *LibriSpeech: An ASR corpus based on public domain audio books.* ICASSP 2015.

5. Snyder, D., et al. (2015). *MUSAN: A Music, Speech, and Noise Corpus.* https://arxiv.org/abs/1510.08484

6. Hu, E. J., et al. (2021). *PEFT: State-of-the-art Parameter-Efficient Fine-Tuning.* https://github.com/huggingface/peft
