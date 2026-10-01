import { AnimatePresence, motion } from 'motion/react'
import { useToasts, type ToastTone } from '@/stores/toast'

const TONES: Record<ToastTone, string> = {
  info: 'bg-surface-2/95 text-ivory-50 ring-white/10',
  success: 'bg-[#123d2e]/95 text-[#b8f5d7] ring-success/30',
  warning: 'bg-[#3d2f12]/95 text-[#ffe0a3] ring-warning/30',
  error: 'bg-[#3d1515]/95 text-[#ffc9c9] ring-danger/30',
}

const DOTS: Record<ToastTone, string> = {
  info: 'bg-ivory-300',
  success: 'bg-success',
  warning: 'bg-warning',
  error: 'bg-danger',
}

export function Toaster() {
  const toasts = useToasts((s) => s.toasts)
  const dismiss = useToasts((s) => s.dismiss)
  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex flex-col items-center gap-2 px-3"
      role="status"
      aria-live="polite"
    >
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.button
            key={t.id}
            type="button"
            layout
            onClick={() => dismiss(t.id)}
            initial={{ opacity: 0, y: -12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className={`pointer-events-auto flex max-w-md items-center gap-2.5 rounded-full px-4 py-2 text-sm font-semibold shadow-xl ring-1 backdrop-blur ${TONES[t.tone]}`}
          >
            <span className={`h-2 w-2 shrink-0 rounded-full ${DOTS[t.tone]}`} aria-hidden />
            {t.message}
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  )
}
