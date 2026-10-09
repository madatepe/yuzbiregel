import { motion } from 'motion/react'
import type { GameMode } from '@engine/index.ts'
import { ActionButton } from '@/components/ui/ActionButton'
import { Modal } from '@/components/ui/Modal'
import { PlayerAvatar } from '@/components/ui/PlayerAvatar'
import { Celebration } from './Celebration'
import { scoreClass, teamTotals } from './Scoreboard'
import type { SeatInfo } from '@/hooks/useGameView'

interface GameResultProps {
  open: boolean
  seats: SeatInfo[]
  totals: number[]
  mode: GameMode
  mySeat: number
  isOwner: boolean
  busy: 'restart' | 'leave' | null
  onRestart: () => void
  onLeave: () => void
  higherWins?: boolean
}

const MEDALS = ['🥇', '🥈', '🥉', '']

export function GameResult({ open, seats, totals, mode, mySeat, isOwner, busy, onRestart, onLeave, higherWins = false }: GameResultProps) {
  const order = [0, 1, 2, 3].sort((a, b) => (higherWins ? totals[b] - totals[a] : totals[a] - totals[b]))
  // Equal totals share a rank (competition ranking: 1, 1, 3, 4).
  const rankOf = (seat: number) => totals.filter((t) => (higherWins ? t > totals[seat] : t < totals[seat])).length
  const teams = teamTotals(totals)
  const winningTeam = teams[0] === teams[1] ? null : higherWins ? (teams[0] > teams[1] ? 0 : 1) : teams[0] < teams[1] ? 0 : 1
  const soloWinners = order.filter((s) => rankOf(s) === 0)
  const iWon =
    mode === 'team' ? winningTeam !== null && mySeat % 2 === winningTeam : soloWinners.length === 1 && soloWinners[0] === mySeat
  const title =
    mode === 'team'
      ? winningTeam === null
        ? 'BERABERE'
        : `TAKIM ${winningTeam + 1} KAZANDI`
      : soloWinners.length > 1
        ? 'BERABERE'
        : `${seats[soloWinners[0]].nickname.toLocaleUpperCase('tr')} KAZANDI`

  return (
    <Modal open={open} dismissable={false} size="md">
      <div className="relative flex flex-col items-center gap-5 text-center">
        <Celebration intensity={iWon ? 1.8 : 0.8} />
        <span className="text-xs font-black tracking-[0.35em] text-ivory-400">OYUN BİTTİ</span>
        <h2 className="text-3xl font-black">{title}</h2>

        {mode === 'team' && (
          <div className="grid w-full grid-cols-2 gap-3">
            {teams.map((t, i) => (
              <div
                key={i}
                className={`rounded-2xl p-4 ring-1 ${i === winningTeam ? 'bg-accent/15 ring-accent/50' : 'bg-black/25 ring-white/10'}`}
              >
                <div className="text-xs font-bold tracking-widest text-ivory-400">TAKIM {i + 1}</div>
                <div className="truncate text-xs text-ivory-300">
                  {seats[i].nickname} + {seats[i + 2].nickname}
                </div>
                <div className={`mt-1 text-3xl font-black tabular-nums ${scoreClass(t)}`}>{t}</div>
              </div>
            ))}
          </div>
        )}

        <ol className="w-full divide-y divide-white/5 rounded-2xl bg-black/25 ring-1 ring-white/8">
          {order.map((seat, i) => (
            <motion.li
              key={seat}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.08 }}
              className={`flex items-center gap-3 px-4 py-2.5 ${seat === mySeat ? 'bg-accent/8' : ''}`}
            >
              <span className="w-6 text-lg" aria-label={`${rankOf(seat) + 1}.`}>
                {MEDALS[rankOf(seat)] || `${rankOf(seat) + 1}.`}
              </span>
              <PlayerAvatar name={seats[seat].nickname} size={34} />
              <span className="flex-1 truncate text-left font-bold">
                {seats[seat].nickname}
                {seat === mySeat && <span className="ml-1 text-xs text-accent-strong">(sen)</span>}
              </span>
              <span className={`text-xl font-black tabular-nums ${scoreClass(totals[seat])}`}>{totals[seat]}</span>
            </motion.li>
          ))}
        </ol>

        <div className="flex w-full flex-col gap-2 sm:flex-row">
          {isOwner ? (
            <ActionButton size="lg" block variant="success" onClick={onRestart} loading={busy === 'restart'}>
              Tekrar oyna
            </ActionButton>
          ) : (
            <p className="flex-1 self-center text-sm text-ivory-300">Masa sahibi yeni bir oyun başlatabilir.</p>
          )}
          <ActionButton size="lg" block variant="secondary" onClick={onLeave} loading={busy === 'leave'}>
            Masadan ayrıl
          </ActionButton>
        </div>
      </div>
    </Modal>
  )
}
