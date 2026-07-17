import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

// ── Persisted store — survives page refresh / browser close ───────────────────
// Everything in here is saved to localStorage and restored on next visit.
export const useSessionStore = create(
  persist(
    (set, get) => ({
      // ── Identity ────────────────────────────────────────────
      sessionId:   crypto.randomUUID(),

      // ── Transcribe state ─────────────────────────────────────
      referenceTranscript: '',
      // Last 10 reference transcripts used (for autocomplete)
      recentRefs:          [],

      // ── Last transcription result (restored on dashboard) ────
      lastResult: null,

      // ── Navigation — last page the user was on ────────────────
      lastPage: '/',

      // ── History page filters ──────────────────────────────────
      historySearch: '',
      historyFilter: 'all',

      // ── Visit tracking ────────────────────────────────────────
      visitCount: 0,
      firstSeen:  null,   // ISO string
      lastSeen:   null,   // ISO string

      // ── Cookie consent ────────────────────────────────────────
      cookieConsentDismissed: false,

      // ── Actions ───────────────────────────────────────────────
      setReferenceTranscript: (v) => {
        set({ referenceTranscript: v })
        if (!v.trim()) return
        const prev = get().recentRefs.filter((r) => r !== v)
        set({ recentRefs: [v, ...prev].slice(0, 10) })
      },

      setLastResult: (r) => set({ lastResult: r }),

      setLastPage: (path) => set({ lastPage: path }),

      setHistorySearch: (v) => set({ historySearch: v }),
      setHistoryFilter: (v) => set({ historyFilter: v }),

      clearRecentRefs: () => set({ recentRefs: [] }),

      dismissCookieConsent: () => set({ cookieConsentDismissed: true }),

      recordVisit: () => {
        const now = new Date().toISOString()
        set((s) => ({
          visitCount: s.visitCount + 1,
          firstSeen:  s.firstSeen ?? now,
          lastSeen:   now,
        }))
      },

      regenerateSession: () => set({ sessionId: crypto.randomUUID() }),
    }),
    {
      name:    'mercury-session-v2',
      storage: createJSONStorage(() => localStorage),
      // Only persist these specific keys — don't bloat storage
      partialize: (s) => ({
        referenceTranscript:    s.referenceTranscript,
        recentRefs:             s.recentRefs,
        lastResult:             s.lastResult,
        lastPage:               s.lastPage,
        historySearch:          s.historySearch,
        historyFilter:          s.historyFilter,
        visitCount:             s.visitCount,
        firstSeen:              s.firstSeen,
        lastSeen:               s.lastSeen,
        cookieConsentDismissed: s.cookieConsentDismissed,
      }),
    },
  ),
)

// ── Ephemeral UI store — cleared on page refresh ──────────────────────────────
let toastId = 0

export const useUIStore = create((set, get) => ({
  isRecording: false,
  paletteOpen: false,
  toasts:      [],

  setRecording: (v) => set({ isRecording: v }),
  setPalette:   (v) => set({ paletteOpen: v }),

  toast: (message, type = 'info', duration = 4000) => {
    const id = ++toastId
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }))
    setTimeout(() => get().dismissToast(id), duration)
  },
  dismissToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))
