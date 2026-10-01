import { AnimatePresence, motion } from 'motion/react'

interface TurnIndicatorProps {
  isMyTurn: boolean
  over?: boolean
  turnName: string
  instruction: string
}

export function TurnIndicator({ isMyTurn, over = false, turnName, instruction }: TurnIndicatorProps) {
  const label = over ? 'EL BİTTİ' : isMyTurn ? 'SENİN SIRAN' : `SIRA: ${turnName.toLocaleUpperCase('tr')}`
  const highlight = isMyTurn && !over
  return (
    <div className="flex min-w-0 flex-col items-center gap-0.5 text-center" aria-live="polite">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={label}
          initial={{ opacity: 0, y: 8, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.95 }}
          transition={{ duration: 0.22 }}
          className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-black tracking-[0.15em] ${
            highlight ? 'animate-turn-pulse bg-accent text-accent-ink' : 'bg-black/30 text-ivory-200 ring-1 ring-white/10'
          }`}
        >
          <span
            className={`h-2 w-2 rounded-full ${highlight ? 'bg-accent-ink' : over ? 'bg-ivory-400' : 'animate-pulse bg-ivory-300'}`}
            aria-hidden
          />
          {label}
        </motion.div>
      </AnimatePresence>
      <p className="max-w-md truncate text-xs font-medium text-ivory-300 sm:text-[13px]">{instruction}</p>
    </div>
  )
}
