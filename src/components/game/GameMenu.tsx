import type { ReactNode } from 'react'
import { Modal } from '@/components/ui/Modal'
import { SoundToggle } from '@/components/ui/SoundToggle'
import { RulesButton } from './RulesModal'

interface GameMenuProps {
  open: boolean
  onClose: () => void
  /** Opponent cards, shown here on narrow screens instead of above the table. */
  players: ReactNode
  scoreLabel: string
  onScoreboard: () => void
  onLeave: () => void
  rulesVariant?: 'okey' | 'pisti'
}

const ROW = 'flex h-11 w-full items-center gap-3 rounded-xl bg-white/6 px-3 text-sm font-bold ring-1 ring-white/8 transition hover:bg-white/12'

export function GameMenu({ open, onClose, players, scoreLabel, onScoreboard, onLeave, rulesVariant = 'okey' }: GameMenuProps) {
  return (
    <Modal open={open} onClose={onClose} title="Masa" variant="side">
      <div className="flex flex-col gap-6">
        <section className="flex flex-col gap-2">
          <h3 className="text-xs font-black tracking-widest text-ivory-400">OYUNCULAR</h3>
          <div className="flex flex-col gap-3 pt-2">{players}</div>
        </section>

        <section className="flex flex-col gap-2">
          <h3 className="text-xs font-black tracking-widest text-ivory-400">MENÜ</h3>
          <button type="button" onClick={onScoreboard} className={ROW}>
            <svg viewBox="0 0 24 24" className="h-4 w-4 text-accent-strong" aria-hidden>
              <path fill="currentColor" d="M4 20h4V10H4v10Zm6 0h4V4h-4v16Zm6 0h4v-7h-4v7Z" />
            </svg>
            Skor tablosu
            <span className="ml-auto tabular-nums text-ivory-300">{scoreLabel}</span>
          </button>
          <div className="flex gap-2">
            <SoundToggle showLabel />
            <RulesButton showLabel variant={rulesVariant} />
          </div>
          <button type="button" onClick={onLeave} className={`${ROW} text-danger`}>
            <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
              <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h11" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Masadan ayrıl
          </button>
        </section>
      </div>
    </Modal>
  )
}
