# testdata/

Manual test fixtures — not used by any automated test, just for exercising the UI
by hand (upload flow, format handling, long/short text).

## audio/

- `sample_20s.wav`, `sample_20s.mp3`, `sample_20s.mp4` — same 20-second synthetic
  tone, three formats, to check format handling across the upload/transcribe path.
- `sample_3s.wav` — a short 3-second clip.

All four are a plain sine-wave tone (no real speech) generated for format/pipeline
testing — expect garbage transcripts, that's not a bug.

## transcripts/

- `short_normal.txt` — a normal 2-sentence transcript.
- `long_01.txt` through `long_05.txt` — long synthetic transcripts (1,600-2,600
  words each) for testing long-text handling (TTS char limits, UI scroll/layout,
  reference-text comparison for Error Analysis).
