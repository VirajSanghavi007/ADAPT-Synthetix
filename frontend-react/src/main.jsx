import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import './styles/globals.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime:                  15_000,
      gcTime:                     60_000,
      retry:                      1,
      refetchOnWindowFocus:       false,
      refetchIntervalInBackground:false,  // stop polling when tab hidden
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename="/">
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
)
