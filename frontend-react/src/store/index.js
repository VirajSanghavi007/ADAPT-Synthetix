import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

// ── Session store (persisted) ─────────────────────────────────
export const useSessionStore = create(
  persist(
    (set) => ({
      sessionId:           crypto.randomUUID(),
      referenceTranscript: '',
      theme:               'dark', // reserved for future light mode
      setReferenceTranscript: (v) => set({ referenceTranscript: v }),
      regenerateSession:   ()  => set({ sessionId: crypto.randomUUID() }),
    }),
    { name: 'adapt-session', storage: createJSONStorage(() => localStorage) },
  ),
)

// ── UI store (ephemeral) ──────────────────────────────────────
let toastId = 0

export const useUIStore = create((set, get) => ({
  isRecording:   false,
  lastResult:    null,
  paletteOpen:   false,
  toasts:        [],

  setRecording:  (v) => set({ isRecording: v }),
  setLastResult: (r) => set({ lastResult: r }),
  setPalette:    (v) => set({ paletteOpen: v }),

  toast: (message, type = 'info', duration = 4000) => {
    const id = ++toastId
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }))
    setTimeout(() => get().dismissToast(id), duration)
  },
  dismissToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))
