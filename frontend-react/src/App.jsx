import React from 'react';
import Waveform from './components/Waveform';
import Terminal from './components/Terminal';

const styles = {
  app: {
    background: '#0a0a0a',
    color: '#00e5ff',
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem',
    fontFamily: "'Space Mono', 'Courier New', monospace",
  },
};

export default function App() {
  return (
    <div style={styles.app}>
      <Waveform />
      <Terminal />
    </div>
  );
}
