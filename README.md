# ADAPT-Synthetix
### Adaptive Closed-Loop ASR Framework with Phoneme-Level Error Diagnosis

ADAPT-Synthetix is a research-first speech pipeline that links automatic speech recognition with a diagnostic layer and text-to-speech remediation. Instead of only returning transcripts, it also estimates confidence and acoustic context to classify likely recognition error sources.

The system is designed for iterative academic experimentation: collect speech, transcribe, diagnose, store metadata, and optionally synthesize corrective audio in one loop. This makes it suitable for studying robust ASR under real-world noise and speaker variability.

## Quick Setup
```bash
git clone <repo-url>
cd ADAPT-Synthetix
python -m venv vir_env
vir_env\Scripts\activate
pip install -r requirements.txt
```

## Quick Run
```bash
python Backend/app.py
python pipeline_test.py path/to/audio.mp3
```

Open `Frontend/index.html` in a browser for the UI.

## Full Documentation
- Technical reference: [`DOCUMENTATION.md`](DOCUMENTATION.md)
- Research contribution statement: [`DOCUMENTATION.md#11-research-contribution`](DOCUMENTATION.md#11-research-contribution)
