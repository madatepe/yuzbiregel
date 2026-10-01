import { motion } from 'motion/react'
import type { GameMode, OkeyInfo, OpenKind, RoundResult as Result } from '@engine/index.ts'
import { ActionButton } from '@/components/ui/ActionButton'
import { Modal } from '@/components/ui/Modal'
import { PlayerAvatar } from '@/components/ui/PlayerAvatar'
import { Celebration } from './Celebration'
import { GameTile } from './GameTile'
import { scoreClass, teamTotals } from './Scoreboard'
import { useCountUp } from '@/hooks/useCountUp'
import type { SeatInfo } from '@/hooks/useGameView'

interface RoundResultProps {
  open: boolean
  result: Result
  okey: OkeyInfo
  opened: (OpenKind | null)[]
  seats: SeatInfo[]
  mode: GameMode
  round: number
  totalRounds: number
  totals: number[]
  mySeat: number
  isLast: boolean
  busy: boolean
  onContinue: () => void
}

const MAX_SHOWN = 13

function finishBadges(r: Result): string[] {
  if (r.reason === 'deck_empty') return ['Deste bitti']
  const b: string[] = []
  if (r.elden) b.push('Elden bitti x4')
  if (r.okeyFinish) b.push('Okey ile bitti x2')
  if (r.pairsFinish) b.push('Çiftten bitti x2')
  if (!b.length) b.push('Normal bitiş')
  return b
}

function ScoreValue({ value, delay }: { value: number; delay: number }) {
  const v = useCountUp(value, 600, delay)
  return <span className={`tabular-nums ${scoreClass(value)}`}>{v > 0 ? `+${v}` : v}</span>
}

export function RoundResult({
  open,
  result,
  okey,
  opened,
  seats,
  mode,
  round,
  totalRounds,
  totals,
  mySeat,
  isLast,
  busy,
  onContinue,
}: RoundResultProps) {
  const winner = result.finisher !== null ? seats[result.finisher] : null
  const special = result.multiplier > 1
  const order = [0, 1, 2, 3].sort((a, b) => result.scores[a] - result.scores[b])

  return (
    <Modal open={open} dismissable={false} size="md">
      <div className="relative flex flex-col items-center gap-4 text-center">
        {winner && <Celebration intensity={special ? 1.6 : 1} />}
        <span className="text-xs font-black tracking-[0.35em] text-ivory-400">EL TAMAMLANDI</span>

        {winner ? (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 18 }}
            className="flex flex-col items-center gap-2"
          >
            <div className="relative">
              <PlayerAvatar name={winner.nickname} size={68} active />
              <span className="absolute -top-3 -right-3 text-3xl" aria-hidden>
                🏆
              </span>
            </div>
            <div className="text-2xl font-black tracking-wide">{winner.nickname.toLocaleUpperCase('tr')}</div>
            <div className="text-4xl font-black text-success tabular-nums">{result.scores[result.finisher!]}</div>
          </motion.div>
        ) : (
          <div className="text-2xl font-black">Kimse bitiremedi</div>
        )}

        <div className="flex flex-wrap justify-center gap-1.5">
          {finishBadges(result).map((b) => (
            <span
              key={b}
              className={`rounded-full px-3 py-1 text-xs font-bold ${special ? 'bg-accent/20 text-accent-strong ring-1 ring-accent/40' : 'bg-white/10 text-ivory-200'}`}
            >
              {b}
            </span>
          ))}
        </div>

        <ul className="w-full divide-y divide-white/5 rounded-2xl bg-black/25 ring-1 ring-white/8">
          {order.map((seat, i) => (
            <motion.li
              key={seat}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 + i * 0.07, duration: 0.25 }}
              className={`flex items-center gap-3 px-3 py-2 ${seat === mySeat ? 'bg-accent/8' : ''}`}
            >
              <PlayerAvatar name={seats[seat].nickname} size={30} />
              <div className="min-w-0 flex-1 text-left">
                <div className="truncate text-sm font-bold">
                  {seats[seat].nickname}
                  {seat === mySeat && <span className="ml-1 text-xs text-accent-strong">(sen)</span>}
                </div>
                {seat !== result.finisher && (
                  <div className="text-[11px] font-semibold text-ivory-400">
                    {opened[seat] ? `El toplamı ${result.handScores[seat]}` : 'El açmadı'}
                  </div>
                )}
                {result.hands[seat].length > 0 && (
                  <div className="mt-1 flex flex-wrap items-center gap-0.5" aria-label="Elde kalan taşlar">
                    {result.hands[seat].slice(0, MAX_SHOWN).map((t) => (
                      <GameTile key={t} id={t} okey={okey} size="xs" />
                    ))}
                    {result.hands[seat].length > MAX_SHOWN && (
                      <span className="ml-1 text-[11px] font-bold text-ivory-400">+{result.hands[seat].length - MAX_SHOWN}</span>
                    )}
                  </div>
                )}
                {result.penalties[seat] > 0 && (
                  <div className="text-[11px] font-semibold text-danger">Ceza +{result.penalties[seat]}</div>
                )}
              </div>
              <div className="text-right">
                <div className="text-lg font-black">
                  <ScoreValue value={result.scores[seat]} delay={200 + i * 70} />
                </div>
                <div className="text-[10px] text-ivory-400 tabular-nums">Toplam {totals[seat]}</div>
              </div>
            </motion.li>
          ))}
        </ul>

        {mode === 'team' && (
          <div className="grid w-full grid-cols-2 gap-3">
            {teamTotals(totals).map((t, i) => (
              <div key={i} className="rounded-xl bg-black/25 py-2 ring-1 ring-white/8">
                <div className="text-[11px] font-bold tracking-widest text-ivory-400">TAKIM {i + 1}</div>
                <div className={`text-xl font-black tabular-nums ${scoreClass(t)}`}>{t}</div>
              </div>
            ))}
          </div>
        )}

        <div className="text-sm font-bold text-ivory-300">
          El: {round} / {totalRounds}
        </div>

        <ActionButton size="lg" block onClick={onContinue} loading={busy}>
          {isLast ? 'Sonuçları gör' : 'Sonraki el'}
        </ActionButton>
      </div>
    </Modal>
  )
}
