# Research Basis — Hermes

All academic contributions implemented in this codebase, with source citations.

---

## 1. CTC Token-Level Confidence (Uncertainty Estimation)

**Paper:** Rumberg et al., "Uncertainty Estimation for Connectionist Temporal Classification Based Automatic Speech Recognition," *Interspeech 2023*.

**Implementation:** `Backend/diagnostics.py → extract_token_uncertainty()`

Binary entropy per CTC frame:
```
H_t = -p_t · log(p_t) - (1-p_t) · log(1-p_t)
```
where `p_t = max softmax probability at frame t`.  
Frames with `H_t > 0.5` are flagged as uncertain and counted in the API response as `uncertain_frames`.

---

## 2. Selective Temperature Scaling

**Paper:** "Identifying and Calibrating Overconfidence in Noisy Speech Recognition," *arXiv:2509.07195, 2025*.

**Implementation:** `Backend/diagnostics.py → extract_confidence(temperature=T)`

```
P_calibrated = softmax(logits / T)
```
`T` defaults to 1.0 (no scaling). Set `CONFIDENCE_TEMPERATURE=1.5` env var to soften overconfident predictions in noisy conditions (`SNR < 10 dB`).

---

## 3. Conformal Prediction Priority Queue

**Paper:** Ernez et al., "Applying the Conformal Prediction Paradigm for Uncertainty Quantification of wav2vec 2.0," *PMLR Vol. 204, 2023*.

**Implementation:** `Backend/diagnostics.py → nonconformity_score()`, stored in `transcriptions.nonconformity_score`

```
NCS = 1 - confidence_score
```
Higher NCS → utterance is harder to predict → higher remediation priority.

---

## 4. Phoneme Confusion Matrix (DyPCL / POWER)

**Papers:**
- "DyPCL: Dynamic Phoneme-level Contrastive Learning for Dysarthric Speech Recognition," *NAACL 2025* (arXiv:2501.19010)
- Bérard et al., "Phonetically-Oriented Word Error Alignment (POWER)," *2019*

**Implementation:** `Backend/drift_detector.py → get_error_report() → systematic_confusions`

A phoneme pair `(p1, p2)` is flagged as a **systematic confusion** if:
```
C[p1][p2] / C[p1, :].sum() ≥ 0.30
```
i.e., more than 30% of p1's errors are p2 substitutions. Displayed in Phoneme Explorer + Analytics pages.

---

## 5. CUSUM Drift Detection

**Paper:** "Online Drift Detection with Maximum Concept Discrepancy," *arXiv:2407.05375, 2024*.

**Implementation:** `Backend/drift_detector.py → get_phoneme_trend() → cusum score`

CUSUM accumulates downward deviations from the mean confidence:
```python
S_t = max(0, S_{t-1} + (μ - x_t))
```
Drift is flagged when `S_T > 0.04` (threshold from `CUSUM_THRESHOLD`). More sensitive to sustained drift than endpoint comparison.

---

## 6. AdaLoRA — Adaptive Budget Allocation

**Paper:** Zhang et al., "AdaLoRA: Adaptive Budget Allocation for Parameter-Efficient Fine-Tuning," *ICLR 2023* (arXiv:2303.10512).

**Implementation:** `Backend/lora_trainer.py → LoRATrainer(use_adalora=True)`

AdaLoRA represents weight updates in SVD form `W = W_0 + P·Λ·Q` and prunes singular values by importance score:
```
s_i = |λ_i| · (||p_i||_1 + ||q_i||_1)
```
This automatically assigns higher rank to layers that need it (early encoder for acoustics, lower rank for upper linguistic layers).

---

## 7. HDMoLE — Mixture of LoRA Experts

**Paper:** Mu et al., "HDMoLE: Mixture of LoRA Experts with Hierarchical Routing and Dynamic Thresholds," *ICASSP 2025* (arXiv:2409.19878).

**Implementation:** `Backend/lora_experts.py` — architecture ready for HDMoLE-style routing.

Three domain experts (noise / accent / pronunciation), each a separate LoRA/AdaLoRA adapter.  
Router: expert `e` activated when `g_e(x) > θ_e` (dynamic per-expert threshold).

---

## 8. Layer-Freezing Strategy for Continual Learning

**Paper:** Pekarek Rosin & Wermter, "Replay to Remember: Continual Layer-Specific Fine-Tuning," *ICANN 2023* (arXiv:2307.07280).

**Implementation:** `Backend/lora_trainer.py → prepare_model()`

CNN feature extractor layers (`feature_extractor`, `feature_projection`) are always frozen.  
Only transformer layers 7-12 are trained. Replay ratio = 10% of batch size.

---

## 9. Expected Calibration Error (ECE)

**Paper:** Guo et al., "On Calibration of Modern Neural Networks," *ICML 2017*.

**Implementation:** `Backend/drift_detector.py → get_calibration_metrics()`  
**API:** `GET /calibration_metrics`

```
ECE = Σ_b (|B_b| / n) · |acc_b - conf_b|
```
Proxy accuracy: fraction of phoneme frames with `confidence > 0.5`.

---

## 10. SNR-Aware Error Classification

**Paper:** "Identifying and Calibrating Overconfidence in Noisy ASR," *arXiv:2509.07195*.

**Implementation:** `Backend/diagnostics.py → classify_error_type(snr_db=...)`

If `SNR < 10 dB`, the noise signal is corroborated and the noise error classification is strengthened.  
SNR estimated via RMS energy ratio of voiced vs. non-voiced frames.

---

## Metrics Added (vs. baseline)

| Metric | Field | Research basis |
|--------|-------|----------------|
| WER | `wer_score` | Standard (jiwer) |
| PER | `per_score` | POWER + DyPCL |
| SNR | `snr_db` | arXiv:2509.07195 |
| Nonconformity Score | `nonconformity_score` | Ernez et al. PMLR 2023 |
| Uncertain Frames | `uncertain_frames` | Rumberg et al. Interspeech 2023 |
| CUSUM score | Phoneme drift table | arXiv:2407.05375 |
| ECE | `/calibration_metrics` | Guo et al. ICML 2017 |
| Systematic confusions | Phoneme error report | DyPCL / POWER |
