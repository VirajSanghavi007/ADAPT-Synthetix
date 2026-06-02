import { lazy, Suspense, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Layout }            from '@/components/layout/Layout'
import { PageLoader }        from '@/components/ui/Spinner'
import { LoadingScreen }     from '@/components/ui/LoadingScreen'
import { CookieBanner }      from '@/components/ui/CookieBanner'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { useRouteTracker }   from '@/hooks/useRouteTracker'
import { useAuth }           from '@/hooks/useAuth'

const Dashboard       = lazy(() => import('@/pages/Dashboard'))
const Transcribe      = lazy(() => import('@/pages/Transcribe'))
const Analytics       = lazy(() => import('@/pages/Analytics'))
const PhonemeExplorer = lazy(() => import('@/pages/PhonemeExplorer'))
const PriorityQueue   = lazy(() => import('@/pages/PriorityQueue'))
const History         = lazy(() => import('@/pages/History'))
const ModelHub        = lazy(() => import('@/pages/ModelHub'))
const Login           = lazy(() => import('@/pages/Login'))

function AppRoutes() {
  useKeyboardShortcuts()
  // Restore last page on login + track page changes
  useRouteTracker({ shouldRestore: true })

  const { user, isLoading, isAuthenticated } = useAuth()

  if (isLoading) return <PageLoader />

  if (!isAuthenticated) {
    return (
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="*"      element={<Navigate to="/login" replace />} />
        </Routes>
      </Suspense>
    )
  }

  return (
    <Layout user={user}>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/"           element={<Dashboard />} />
          <Route path="/transcribe" element={<Transcribe />} />
          <Route path="/analytics"  element={<Analytics />} />
          <Route path="/phonemes"   element={<PhonemeExplorer />} />
          <Route path="/queue"      element={<PriorityQueue />} />
          <Route path="/history"    element={<History />} />
          <Route path="/models"     element={<ModelHub />} />
          <Route path="/login"      element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      <CookieBanner />
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
