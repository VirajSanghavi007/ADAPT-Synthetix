# ADAPT-Synthetix
### Adaptive Closed-Loop ASR Framework with Phoneme-Level Error Diagnosis

ADAPT-Synthetix is a research-first speech pipeline that links automatic speech recognition with a diagnostic layer and text-to-speech remediation. Instead of only returning transcripts, it estimates confidence and acoustic context, and it can compute measured CER/phoneme errors when a reference transcript is provided.

The system is designed for iterative academic experimentation: collect speech, transcribe, diagnose, store metadata, and optionally synthesize corrective audio in one loop. Diagnostics without a reference transcript are heuristic estimates; diagnostics with a reference transcript are reference-aligned measurements suitable for benchmarking and adaptation experiments.

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
uvicorn Backend.app:app --host 0.0.0.0 --port 5000 --reload
python pipeline_test.py path/to/audio.mp3
```

For measured diagnostics through the API, pass an optional `reference_transcript` form field with the audio upload.

Open `Frontend/index.html` in a browser for the UI.

## Docker Quick Start
```bash
docker-compose up
# Then open Frontend/index.html in browser
```

## Full Documentation
- Technical reference: [`DOCUMENTATION.md`](DOCUMENTATION.md)
- Research contribution statement: [`DOCUMENTATION.md#11-research-contribution`](DOCUMENTATION.md#11-research-contribution)
