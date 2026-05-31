import React, { useState, useRef } from 'react';

const ACCENT = '#00e5ff';
const ERROR_COLOR = '#ff4500';
const DIM = '#555';

const styles = {
  card: {
    width: '100%',
    maxWidth: '700px',
    background: '#111111',
    border: '1px solid #1a1a1a',
    borderRadius: '12px',
    padding: '1.5rem',
    marginBottom: '1.5rem',
    fontFamily: "'Space Mono', monospace",
  },
  title: { color: ACCENT, fontSize: '0.75rem', letterSpacing: '3px', marginBottom: '1rem' },
  dropzone: {
    border: `1px dashed ${DIM}`,
    borderRadius: '8px',
    padding: '2rem',
    textAlign: 'center',
    color: DIM,
    fontSize: '0.75rem',
    cursor: 'pointer',
    marginBottom: '1rem',
    transition: 'border-color 0.2s',
  },
  dropzoneActive: { borderColor: ACCENT, color: ACCENT },
  input: {
    width: '100%',
    background: '#0d0d0d',
    border: '1px solid #222',
    color: ACCENT,
    padding: '8px',
    fontSize: '0.75rem',
    borderRadius: '4px',
    outline: 'none',
    marginBottom: '1rem',
    fontFamily: "'Space Mono', monospace",
  },
  btn: {
    background: 'transparent',
    border: `1px solid ${ACCENT}`,
    color: ACCENT,
    padding: '8px 16px',
    fontSize: '0.7rem',
    cursor: 'pointer',
    borderRadius: '4px',
    width: '100%',
    fontFamily: "'Space Mono', monospace",
  },
  result: {
    marginTop: '1rem',
    padding: '1rem',
    background: '#0d0d0d',
    borderRadius: '4px',
    fontSize: '0.8rem',
    lineHeight: 1.6,
  },
};

export default function FileUpload() {
  const [dragging, setDragging] = useState(false);
  const [reference, setReference] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef(null);

  async function uploadFile(file) {
    if (!file) return;
    setLoading(true);
    setResult(null);
    const formData = new FormData();
    formData.append('audio', file, file.name);
    if (reference.trim()) formData.append('reference_transcript', reference.trim());

    try {
      const res = await fetch('/transcribe', { method: 'POST', body: formData });
      const data = await res.json();
      setResult(data);
    } catch (e) {
      setResult({ error: 'Server connection failed' });
    } finally {
      setLoading(false);
    }
  }

  function onDrop(e) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  }

  return (
    <div style={styles.card}>
      <div style={styles.title}>FILE_UPLOAD</div>
      <div
        style={{ ...styles.dropzone, ...(dragging ? styles.dropzoneActive : {}) }}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => fileRef.current?.click()}
      >
        {loading ? 'PROCESSING...' : 'Drop audio file here or click to select'}
        <input
          ref={fileRef}
          type="file"
          accept=".wav,.mp3,.m4a,.flac,.webm,.ogg"
          style={{ display: 'none' }}
          onChange={e => uploadFile(e.target.files[0])}
        />
      </div>
      <input
        style={styles.input}
        placeholder="Optional reference transcript"
        value={reference}
        onChange={e => setReference(e.target.value)}
        spellCheck={false}
      />
      {result && (
        <div style={styles.result}>
          {result.error
            ? <span style={{ color: ERROR_COLOR }}>ERROR: {result.error}</span>
            : <>
                <div style={{ color: ACCENT, marginBottom: '0.5rem' }}>{result.transcription}</div>
                {result.cer_score != null && <div style={{ color: DIM }}>CER: {Number(result.cer_score).toFixed(4)}</div>}
                {result.diagnostic_basis && <div style={{ color: DIM }}>BASIS: {result.diagnostic_basis}</div>}
                {result.error_type && <div style={{ color: result.error_type === 'clean' ? ACCENT : ERROR_COLOR }}>TYPE: {result.error_type?.toUpperCase()}</div>}
              </>
          }
        </div>
      )}
    </div>
  );
}
