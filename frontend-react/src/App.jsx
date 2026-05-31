import React from 'react';
import Waveform from './components/Waveform';
import Terminal from './components/Terminal';
import StatsBar from './components/StatsBar';
import HistoryPanel from './components/HistoryPanel';
import FileUpload from './components/FileUpload';

const styles = {
  app: {
    background: '#0a0a0a',
    color: '#00e5ff',
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '2rem',
    fontFamily: "'Space Mono', 'Courier New', monospace",
  },
};

export default function App() {
  return (
    <div style={styles.app}>
      <StatsBar />
      <Waveform />
      <Terminal />
      <HistoryPanel />
      <FileUpload />
    </div>
  );
}
