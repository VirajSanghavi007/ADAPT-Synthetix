import React, { useState, useEffect } from 'react';

const ACCENT = '#00e5ff';
const DIM = '#555';

const styles = {
  bar: {
    width: '100%',
    maxWidth: '700px',
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '1rem',
    marginBottom: '1.5rem',
    fontFamily: "'Space Mono', monospace",
  },
  card: {
    background: '#111111',
    border: '1px solid #1a1a1a',
    borderRadius: '10px',
    padding: '1rem',
    textAlign: 'center',
  },
  label: { color: DIM, fontSize: '0.6rem', letterSpacing: '2px', marginBottom: '0.5rem' },
  value: { color: ACCENT, fontSize: '1.3rem', fontWeight: 'bold' },
};

const INIT = { total: '--', remRate: '--', phonemes: '--', queue: '--' };

export default function StatsBar() {
  const [stats, setStats] = useState(INIT);

  async function fetchStats() {
    try {
      const [remRes, driftRes, queueRes] = await Promise.all([
        fetch('/remediation_status'),
        fetch('/drift_report'),
        fetch('/priority_queue'),
      ]);
      const rem = remRes.ok ? await remRes.json() : {};
      const drift = driftRes.ok ? await driftRes.json() : {};
      const queue = queueRes.ok ? await queueRes.json() : {};
      setStats({
        total: rem.total_transcriptions ?? '--',
        remRate: rem.remediation_rate != null ? `${rem.remediation_rate}%` : '--',
        phonemes: drift.total_phonemes_tracked ?? '--',
        queue: queue.stats?.pending ?? '--',
      });
    } catch {}
  }

  useEffect(() => {
    fetchStats();
    const id = setInterval(fetchStats, 30000);
    return () => clearInterval(id);
  }, []);

  const cards = [
    { label: 'TOTAL_TX', value: stats.total },
    { label: 'REM_RATE', value: stats.remRate },
    { label: 'PHONEMES', value: stats.phonemes },
    { label: 'QUEUE', value: stats.queue },
  ];

  return (
    <div style={styles.bar}>
      {cards.map(c => (
        <div key={c.label} style={styles.card}>
          <div style={styles.label}>{c.label}</div>
          <div style={styles.value}>{c.value}</div>
        </div>
      ))}
    </div>
  );
}
