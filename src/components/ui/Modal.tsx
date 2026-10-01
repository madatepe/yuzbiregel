import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'

interface ModalProps {
  open: boolean
  onClose?: () => void
  title?: ReactNode
  children: ReactNode
  /** 'center' dialog or 'side' slide-over panel. */
  variant?: 'center' | 'side'
  size?: 'sm' | 'md' | 'lg'
  dismissable?: boolean
}

const WIDTHS = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' }

export function Modal({ open, onClose, title, children, variant = 'center', size = 'md', dismissable = true }: ModalProps) {
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const prev = document.activeElement as HTMLElement | null
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dismissable) onClose?.()
    }
    window.addEventListener('keydown', onKey)
    requestAnimationFrame(() => panelRef.current?.focus())
    return () => {
      window.removeEventListener('keydown', onKey)
      prev?.focus?.()
    }
  }, [open, dismissable, onClose])

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className={`fixed inset-0 z-50 flex ${variant === 'side' ? 'justify-end' : 'items-center justify-center p-4'}`}>
          <motion.div
            className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={() => dismissable && onClose?.()}
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            tabIndex={-1}
            className={
              variant === 'side'
                ? 'relative h-full w-full max-w-md overflow-y-auto border-l border-line bg-surface p-6 shadow-2xl outline-none'
                : `relative max-h-[90vh] w-full ${WIDTHS[size]} overflow-y-auto rounded-3xl border border-line bg-surface p-6 shadow-[0_30px_80px_rgb(0_0_0/0.55)] outline-none`
            }
            initial={variant === 'side' ? { x: '100%' } : { opacity: 0, scale: 0.94, y: 12 }}
            animate={variant === 'side' ? { x: 0 } : { opacity: 1, scale: 1, y: 0 }}
            exit={variant === 'side' ? { x: '100%' } : { opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
          >
            {(title || (dismissable && onClose)) && (
              <div className="mb-4 flex items-center justify-between gap-4">
                {title && (
                  <h2 id={titleId} className="text-xl font-extrabold tracking-wide">
                    {title}
                  </h2>
                )}
                {dismissable && onClose && (
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="Kapat"
                    className="ml-auto flex h-9 w-9 items-center justify-center rounded-full text-ivory-300 transition hover:bg-white/10 hover:text-ivory-50"
                  >
                    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
                      <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                    </svg>
                  </button>
                )}
              </div>
            )}
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
