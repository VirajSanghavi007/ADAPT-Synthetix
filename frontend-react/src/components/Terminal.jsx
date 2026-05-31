import React, { useState, useRef, useEffect } from 'react';

const ACCENT = '#00e5ff';
const ERROR_COLOR = '#ff4500';
const DIM = '#555';

const styles = {
  container: {
    width: '100%',
    maxWidth: '700px',
    background: '#111111',
    borderRadius: '12px',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 10px 40px rgba(0,0,0,0.9)',
    border: '1px solid #1a1a1a',
    cursor: 'text',
  },
  header: {
    padding: '12px 20px',
    background: '#161616',
    display: 'flex',
    alignItems: 'center',
    fontSize: '0.65rem',
    color: DIM,
    letterSpacing: '2px',
    borderBottom: '1px solid #222',
  },
  dot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    marginRight: '12px',
    boxShadow: `0 0 8px ${ACCENT}`,
    background: ACCENT,
  },
  body: {
    height: '300px',
    padding: '1.5rem',
    overflowY: 'auto',
    fontSize: '0.85rem',
    lineHeight: 1.5,
    display: 'flex',
    flexDirection: 'column',
    background: '#0d0d0d',
    fontFamily: "'Space Mono', monospace",
  },
  line: { marginBottom: '6px', wordBreak: 'break-all', whiteSpace: 'pre-wrap' },
  inputRow: { display: 'flex', alignItems: 'center', color: ACCENT, marginTop: 'auto' },
  prompt: { marginRight: '10px', flexShrink: 0, color: ACCENT },
  input: {
    background: 'transparent',
    border: 'none',
    color: ACCENT,
    fontFamily: "'Space Mono', monospace",
    fontSize: '0.85rem',
    flex: 1,
    outline: 'none',
    padding: 0,
  },
};

export default function Terminal() {
  const [lines, setLines] = useState([
    { text: 'ADAPT-Synthetix Initialization... [OK]', color: '#222' },
    { text: "Type 'help' for available commands.", color: '#333' },
  ]);
  const [inputVal, setInputVal] = useState('');
  const bodyRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [lines]);

  function print(text, color = ACCENT) {
    setLines(prev => [...prev, { text, color }]);
  }

  async function handleCommand(raw) {
    const cmd = raw.trim();
    if (!cmd) return;
    print(`> ${cmd}`, DIM);
    const [base, ...args] = cmd.split(' ');

    switch (base.toLowerCase()) {
      case 'echo': print(args.join(' ')); break;
      case 'clear': setLines([]); break;
      case 'help':
        ['ADAPT-Synthetix Terminal v1.0',
         'Commands: status, history, noise_report, queue_status,',
         '  dataset_stats, drift_report, lora_status, lora_experts_status,',
         '  remediation_status, confidence_histogram, synthesize [text],',
         '  set_reference [text], clear_reference, history, clear, echo [text]',
        ].forEach(t => print(t)); break;
      case 'status':
        try {
          const [h, t] = await Promise.all([fetch('/health'), fetch('/tts_status')]);
          const hd = await h.json(); const td = t.ok ? await t.json() : null;
          print(`ASR Engine : wav2vec2-base-960h`);
          print(`ASR Status : ONLINE`);
          print(`TTS Engine : ${td?.model || 'suno/bark-small'}`);
          print(`TTS Status : ${td?.available ? 'ONLINE' : 'OFFLINE'}`);
          print(`Session ID : ${(hd.session_id || '').slice(0, 8)}`);
        } catch { print('ERROR: Backend offline', ERROR_COLOR); }
        break;
      case 'history':
        try {
          const r = await fetch('/history');
          const d = await r.json();
          print('--- RECENT TRANSCRIPTIONS ---');
          [...d].filter(x => x.transcription?.trim()).reverse().forEach(x =>
            print(`[${x.timestamp?.split('T')[1]?.split('.')[0]}] ${x.transcription}`)
          );
        } catch { print('ERROR_FETCHING_HISTORY', ERROR_COLOR); }
        break;
      case 'noise_report':
        try {
          const r = await fetch('/noise_report'); const d = await r.json();
          print(`Total: ${d.total_analyzed} | Most common: ${d.most_common}`);
          Object.entries(d.breakdown || {}).forEach(([k, v]) => print(`  ${k}: ${v}`));
        } catch { print('ERROR: Noise report unavailable', ERROR_COLOR); }
        break;
      case 'queue_status':
        try {
          const r = await fetch('/priority_queue'); const d = await r.json();
          const s = d.stats || {};
          print(`Pending: ${s.pending ?? 0} | Completed: ${s.completed ?? 0} | Avg Priority: ${Number(s.avg_priority ?? 0).toFixed(2)}`);
        } catch { print('ERROR: Queue status unavailable', ERROR_COLOR); }
        break;
      case 'dataset_stats':
        try {
          const r = await fetch('/dataset_stats'); const d = await r.json();
          print(`Total: ${d.total}`);
          Object.entries(d.by_category || {}).forEach(([k, v]) => print(`  ${k}: ${v}`));
        } catch { print('ERROR: Dataset stats unavailable', ERROR_COLOR); }
        break;
      case 'drift_report':
        try {
          const r = await fetch('/drift_report'); const d = await r.json();
          print(`Tracked: ${d.total_phonemes_tracked} | High risk: ${(d.high_risk_phonemes || []).join(', ') || 'none'}`);
        } catch { print('ERROR: Drift report unavailable', ERROR_COLOR); }
        break;
      case 'lora_status':
        try {
          const r = await fetch('/lora_status'); const d = await r.json();
          print(`Adapter: ${d.adapter_exists ? 'EXISTS' : 'NOT TRAINED'} | Last trained: ${d.last_trained || 'never'}`);
        } catch { print('ERROR: LoRA status unavailable', ERROR_COLOR); }
        break;
      case 'lora_experts_status':
        try {
          const r = await fetch('/lora_experts_status'); const d = await r.json();
          Object.entries(d).forEach(([k, v]) => print(`  ${k}: ${v.exists ? 'EXISTS' : 'NOT TRAINED'} — ${v.path}`));
        } catch { print('ERROR: Experts status unavailable', ERROR_COLOR); }
        break;
      case 'remediation_status':
        try {
          const r = await fetch('/remediation_status'); const d = await r.json();
          print(`Total: ${d.total_transcriptions} | Clean: ${d.clean} | Remediated: ${d.remediated} | Rate: ${d.remediation_rate}%`);
        } catch { print('ERROR: Remediation status unavailable', ERROR_COLOR); }
        break;
      case 'confidence_histogram':
        try {
          const r = await fetch('/confidence_histogram'); const d = await r.json();
          print(`Confidence Histogram — ${d.total_samples} samples`);
          d.bins.forEach((b, i) => print(`  ${b.toFixed(1)}-${(b + 0.1).toFixed(1)}: ${'█'.repeat(Math.min(d.counts[i], 40))} ${d.counts[i]}`));
        } catch { print('ERROR: Histogram unavailable', ERROR_COLOR); }
        break;
      case 'synthesize':
        if (!args.length) { print('Usage: synthesize [text]'); break; }
        try {
          const r = await fetch('/synthesize', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: args.join(' ') }) });
          if (r.ok && r.headers.get('content-type')?.includes('audio')) {
            const blob = await r.blob();
            const audio = new Audio(URL.createObjectURL(blob));
            audio.play();
            print('TTS_PLAYBACK: STARTED');
          } else { print('TTS_ERROR', ERROR_COLOR); }
        } catch { print('TTS_NETWORK_ERROR', ERROR_COLOR); }
        break;
      default:
        print(`Command not found: ${base}. Type 'help'.`, DIM);
    }
  }

  return (
    <div style={styles.container} onClick={() => inputRef.current?.focus()}>
      <div style={styles.header}>
        <div style={styles.dot} />
        SYSTEM_TERMINAL [ACTIVE]
        <a href="/transmit.html" style={{ color: DIM, fontSize: '0.7rem', textDecoration: 'none', marginLeft: 'auto' }}>
          UPLOAD_FILE →
        </a>
      </div>
      <div style={styles.body} ref={bodyRef}>
        {lines.map((l, i) => (
          <div key={i} style={{ ...styles.line, color: l.color }}>{l.text}</div>
        ))}
        <div style={styles.inputRow}>
          <span style={styles.prompt}>&gt;</span>
          <input
            ref={inputRef}
            style={styles.input}
            value={inputVal}
            autoFocus
            spellCheck={false}
            autoComplete="off"
            onChange={e => setInputVal(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                handleCommand(inputVal);
                setInputVal('');
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}
