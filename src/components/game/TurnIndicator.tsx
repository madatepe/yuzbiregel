import { AnimatePresence, motion } from 'motion/react'
import type { ReactNode } from 'react'

interface TurnIndicatorProps {
  isMyTurn: boolean
  over?: boolean
  turnName: string
  instruction: string
  /** Shown in place of the turn-name pill. 101 uses the hand total. */
  badge?: ReactNode
}

export function TurnIndicator({ isMyTurn, over = false, turnName, instruction, badge }: TurnIndicatorProps) {
  const label = over ? 'EL BİTTİ' : isMyTurn ? 'SENİN SIRAN' : `SIRA: ${turnName.toLocaleUpperCase('tr')}`
  const showBadge = !!badge && !over
  const highlight = isMyTurn && !over && !showBadge
  const spoken = over ? 'El bitti' : isMyTurn ? 'Sıra sende' : `Sıra ${turnName} üzerinde`
  return (
    <div className="flex w-full min-w-0 flex-col items-center gap-0.5 overflow-hidden text-center" aria-live="polite">
      <span className="sr-only">{spoken}</span>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={showBadge ? 'badge' : label}
          initial={{ opacity: 0, y: 8, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.95 }}
          transition={{ duration: 0.22 }}
          className={
            showBadge
              ? 'inline-flex'
              : `inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-black tracking-[0.15em] ${
                  highlight ? 'animate-turn-pulse bg-accent text-accent-ink' : 'bg-black/30 text-ivory-200 ring-1 ring-white/10'
                }`
          }
        >
          {!showBadge && (
            <span
              className={`h-2 w-2 rounded-full ${highlight ? 'bg-accent-ink' : over ? 'bg-ivory-400' : 'animate-pulse bg-ivory-300'}`}
              aria-hidden
            />
          )}
          {showBadge ? badge : label}
        </motion.div>
      </AnimatePresence>
      {instruction ? <p className="w-full truncate px-1 text-xs font-medium text-ivory-300 sm:text-[13px]">{instruction}</p> : null}
    </div>
  )
}
