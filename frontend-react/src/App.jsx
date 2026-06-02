import { lazy, Suspense, useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import { Layout } from '@/components/layout/Layout'
import { PageLoader } from '@/components/ui/Spinner'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'

// Code-split every page for fast initial load
const Dashboard      = lazy(() => import('@/pages/Dashboard'))
const Transcribe     = lazy(() => import('@/pages/Transcribe'))
const Analytics      = lazy(() => import('@/pages/Analytics'))
const PhonemeExplorer= lazy(() => import('@/pages/PhonemeExplorer'))
const PriorityQueue  = lazy(() => import('@/pages/PriorityQueue'))
const History        = lazy(() => import('@/pages/History'))
const ModelHub       = lazy(() => import('@/pages/ModelHub'))

export default function App() {
  useKeyboardShortcuts()

  return (
    <Layout>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/"          element={<Dashboard />} />
          <Route path="/transcribe"element={<Transcribe />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/phonemes"  element={<PhonemeExplorer />} />
          <Route path="/queue"     element={<PriorityQueue />} />
          <Route path="/history"   element={<History />} />
          <Route path="/models"    element={<ModelHub />} />
        </Routes>
      </Suspense>
    </Layout>
  )
}
