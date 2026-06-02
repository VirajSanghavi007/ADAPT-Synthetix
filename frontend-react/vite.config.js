import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  base: '/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/transcribe': 'http://localhost:5000',
      '/synthesize': 'http://localhost:5000',
      '/health': 'http://localhost:5000',
      '/sessions': 'http://localhost:5000',
      '/history': 'http://localhost:5000',
      '/remediation_status': 'http://localhost:5000',
      '/drift_report': 'http://localhost:5000',
      '/confidence_histogram': 'http://localhost:5000',
      '/phoneme_error_report': 'http://localhost:5000',
      '/noise_report': 'http://localhost:5000',
      '/priority_queue': 'http://localhost:5000',
      '/vocabulary_check': 'http://localhost:5000',
      '/dataset_stats': 'http://localhost:5000',
      '/lora_status': 'http://localhost:5000',
      '/lora_experts_status': 'http://localhost:5000',
      '/tts_status': 'http://localhost:5000',
      '/temp': 'http://localhost:5000',
      '/fetch_drive': 'http://localhost:5000',
    },
  },
  build: {
    outDir: 'build',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          charts: ['recharts'],
          motion: ['framer-motion'],
          query: ['@tanstack/react-query'],
        },
      },
    },
  },
})
