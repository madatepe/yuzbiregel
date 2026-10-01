import { create } from 'zustand'

export type ToastTone = 'info' | 'success' | 'warning' | 'error'

export interface Toast {
  id: number
  message: string
  tone: ToastTone
}

interface ToastStore {
  toasts: Toast[]
  push: (message: string, tone?: ToastTone, ms?: number) => void
  dismiss: (id: number) => void
}

let seq = 0

export const useToasts = create<ToastStore>((set, get) => ({
  toasts: [],
  push: (message, tone = 'info', ms = 2800) => {
    if (get().toasts.some((t) => t.message === message)) return
    const id = ++seq
    set((s) => ({ toasts: [...s.toasts.slice(-3), { id, message, tone }] }))
    setTimeout(() => get().dismiss(id), ms)
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))

export const toast = (message: string, tone?: ToastTone, ms?: number) => useToasts.getState().push(message, tone, ms)
