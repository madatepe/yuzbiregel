import { useMemo } from 'react'
import type { GameMode } from '@engine/index.ts'
import { Modal } from '@/components/ui/Modal'
import { totalsFrom, type SeatInfo } from '@/hooks/useGameView'
import type { ScoreRow } from '@/lib/types'

interface ScoreboardProps {
  open: boolean
  onClose: () => void
  scores: ScoreRow[]
  seats: SeatInfo[]
  mode: GameMode
  totalRounds: number
  mySeat: number
}

export function teamTotals(totals: number[]): [number, number] {
  return [totals[0] + totals[2], totals[1] + totals[3]]
}

export function scoreClass(v: number) {
  return v < 0 ? 'text-success' : v > 0 ? 'text-ivory-50' : 'text-ivory-400'
}

export function Scoreboard({ open, onClose, scores, seats, mode, totalRounds, mySeat }: ScoreboardProps) {
  const rounds = useMemo(() => [...new Set(scores.map((s) => s.round))].sort((a, b) => a - b), [scores])
  const totals = useMemo(() => totalsFrom(scores), [scores])
  const cell = (round: number, seat: number) => scores.find((s) => s.round === round && s.seat === seat)

  return (
    <Modal open={open} onClose={onClose} title="Skor tablosu" variant="side">
      <div className="flex flex-col gap-5">
        <p className="text-sm text-ivory-300">
          Oynanan el: <span className="font-bold text-ivory-50">{rounds.length} / {totalRounds}</span> · En düşük puan kazanır.
        </p>

        {mode === 'team' && (
          <div className="grid grid-cols-2 gap-3">
            {teamTotals(totals).map((t, i) => (
              <div key={i} className={`rounded-2xl p-4 text-center ring-1 ${mySeat % 2 === i ? 'bg-accent/10 ring-accent/40' : 'bg-black/25 ring-white/10'}`}>
                <div className="text-xs font-bold tracking-widest text-ivory-400">TAKIM {i + 1}</div>
                <div className="truncate text-xs text-ivory-300">
                  {seats[i].nickname} + {seats[i + 2].nickname}
                </div>
                <div className={`mt-1 text-2xl font-black tabular-nums ${scoreClass(t)}`}>{t}</div>
              </div>
            ))}
          </div>
        )}

        <div className="overflow-x-auto rounded-2xl ring-1 ring-white/10">
          <table className="w-full text-sm">
            <thead className="bg-black/30 text-xs text-ivory-300">
              <tr>
                <th scope="col" className="px-3 py-2 text-left font-bold">El</th>
                {seats.map((s) => (
                  <th key={s.seat} scope="col" className={`px-2 py-2 text-right font-bold ${s.seat === mySeat ? 'text-accent-strong' : ''}`}>
                    <span className="block max-w-20 truncate">{s.nickname}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rounds.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-ivory-400">
                    Henüz tamamlanan el yok.
                  </td>
                </tr>
              )}
              {rounds.map((r) => (
                <tr key={r} className="border-t border-white/5">
                  <th scope="row" className="px-3 py-2 text-left font-semibold text-ivory-300">
                    {r}
                  </th>
                  {seats.map((s) => {
                    const c = cell(r, s.seat)
                    return (
                      <td key={s.seat} className={`px-2 py-2 text-right font-semibold tabular-nums ${c ? scoreClass(c.score) : ''}`}>
                        {c?.score ?? '–'}
                        {c && c.penalty > 0 && <span className="block text-[10px] font-bold text-danger">ceza +{c.penalty}</span>}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-white/15 bg-black/20">
              <tr>
                <th scope="row" className="px-3 py-2.5 text-left text-xs font-black tracking-wider">TOPLAM</th>
                {totals.map((t, i) => (
                  <td key={i} className={`px-2 py-2.5 text-right text-base font-black tabular-nums ${scoreClass(t)}`}>
                    {t}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </Modal>
  )
}

interface ScoreBadgeProps {
  total: number
  roundScore?: number
  mode: GameMode
  teamTotal?: number
  onClick: () => void
}

export function ScoreBadge({ total, mode, teamTotal, onClick }: ScoreBadgeProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-9 items-center gap-2 rounded-full bg-white/8 px-3 text-xs font-bold ring-1 ring-white/10 transition hover:bg-white/14"
      aria-label={`Skor tablosunu aç. Toplam puanın ${total}`}
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4 text-accent-strong" aria-hidden>
        <path fill="currentColor" d="M4 20h4V10H4v10Zm6 0h4V4h-4v16Zm6 0h4v-7h-4v7Z" />
      </svg>
      <span className="text-ivory-300">{mode === 'team' ? 'Takım' : 'Toplam'}</span>
      <span className={`tabular-nums ${scoreClass(mode === 'team' ? (teamTotal ?? 0) : total)}`}>
        {mode === 'team' ? teamTotal : total}
      </span>
    </button>
  )
}
