import { lazy, Suspense, useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import { Layout }          from '@/components/layout/Layout'
import { PageLoader }      from '@/components/ui/Spinner'
import { LoadingScreen }   from '@/components/ui/LoadingScreen'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'

const Dashboard       = lazy(() => import('@/pages/Dashboard'))
const Transcribe      = lazy(() => import('@/pages/Transcribe'))
const Analytics       = lazy(() => import('@/pages/Analytics'))
const PhonemeExplorer = lazy(() => import('@/pages/PhonemeExplorer'))
const PriorityQueue   = lazy(() => import('@/pages/PriorityQueue'))
const History         = lazy(() => import('@/pages/History'))
const ModelHub        = lazy(() => import('@/pages/ModelHub'))

function AppRoutes() {
  useKeyboardShortcuts()
  return (
    <Layout>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/"           element={<Dashboard />} />
          <Route path="/transcribe" element={<Transcribe />} />
          <Route path="/analytics"  element={<Analytics />} />
          <Route path="/phonemes"   element={<PhonemeExplorer />} />
          <Route path="/queue"      element={<PriorityQueue />} />
          <Route path="/history"    element={<History />} />
          <Route path="/models"     element={<ModelHub />} />
        </Routes>
      </Suspense>
    </Layout>
  )
}

export default function App() {
  const [ready, setReady] = useState(false)

  return (
    <>
      <LoadingScreen onDone={() => setReady(true)} />
      {ready && <AppRoutes />}
    </>
  )
}
