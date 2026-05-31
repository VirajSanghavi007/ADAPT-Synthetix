import React, { useState, useEffect } from 'react';

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
    marginBottom: '1.5rem',
    fontFamily: "'Space Mono', monospace",
    overflow: 'hidden',
  },
  header: {
    padding: '12px 20px',
    background: '#161616',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    cursor: 'pointer',
    borderBottom: '1px solid #222',
    fontSize: '0.7rem',
    color: DIM,
    letterSpacing: '2px',
  },
  body: { maxHeight: '220px', overflowY: 'auto', padding: '0.5rem 0' },
  row: {
    display: 'flex',
    alignItems: 'center',
    padding: '8px 20px',
    borderBottom: '1px solid #1a1a1a',
    fontSize: '0.75rem',
    gap: '12px',
  },
  time: { color: DIM, flexShrink: 0, width: '60px' },
  text: { color: ACCENT, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  badge: (type) => ({
    padding: '2px 6px',
    borderRadius: '3px',
    fontSize: '0.6rem',
    color: type === 'clean' ? ACCENT : ERROR_COLOR,
    border: `1px solid ${type === 'clean' ? ACCENT : ERROR_COLOR}`,
    flexShrink: 0,
  }),
  conf: { color: DIM, fontSize: '0.65rem', flexShrink: 0, width: '45px', textAlign: 'right' },
  empty: { padding: '1rem 20px', color: DIM, fontSize: '0.75rem' },
};

function fmtTime(ts) {
  if (!ts) return '--:--:--';
  try { return new Date(ts.replace(' ', 'T')).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }); }
  catch { return '--:--:--'; }
}

export default function HistoryPanel() {
  const [sessions, setSessions] = useState([]);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    async function poll() {
      try {
        const r = await fetch('/sessions');
        if (r.ok) {
          const data = await r.json();
          setSessions(Array.isArray(data) ? data.filter(s => s.transcription?.trim()) : []);
        }
      } catch {}
    }
    poll();
    const id = setInterval(poll, 10000);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={styles.card}>
      <div style={styles.header} onClick={() => setOpen(o => !o)}>
        <span>RECENT_SESSIONS</span>
        <span>{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div style={styles.body}>
          {sessions.length === 0
            ? <div style={styles.empty}>No sessions today. Record audio to begin.</div>
            : sessions.map(s => (
                <div key={s.id} style={styles.row}>
                  <span style={styles.time}>{fmtTime(s.timestamp)}</span>
                  <span style={styles.text}>{(s.transcription || '').slice(0, 60)}</span>
                  <span style={styles.badge(s.error_type || 'clean')}>{(s.error_type || 'CLEAN').toUpperCase()}</span>
                  <span style={styles.conf}>
                    {s.confidence_score != null ? `${(Number(s.confidence_score) * 100).toFixed(0)}%` : '--'}
                  </span>
                </div>
              ))
          }
        </div>
      )}
    </div>
  );
}
