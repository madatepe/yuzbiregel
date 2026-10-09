import { PlayerAvatar } from '@/components/ui/PlayerAvatar'
import type { SeatRow, TableStatus } from '@/lib/types'
import type { GameMode } from '@engine/index.ts'

interface SeatSelectorProps {
  seats: SeatRow[]
  mode: GameMode
  status: TableStatus
  selected: number | null
  onSelect: (seat: number) => void
  online: Record<string, true>
}

/** Seat i placed around the table: 0 bottom, 1 right, 2 top, 3 left (play goes to the right). */
const POSITIONS = [
  'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2',
  'right-0 top-1/2 translate-x-1/2 -translate-y-1/2',
  'top-0 left-1/2 -translate-x-1/2 -translate-y-1/2',
  'left-0 top-1/2 -translate-x-1/2 -translate-y-1/2',
]

export function seatAvailable(seat: SeatRow | undefined, status: TableStatus) {
  if (status === 'waiting') return !seat
  return !!seat?.left_at
}

export function SeatSelector({ seats, mode, status, selected, onSelect, online }: SeatSelectorProps) {
  return (
    <div className="relative mx-auto my-14 aspect-square w-full max-w-[300px]">
      <div className="wood-rim absolute inset-0 rounded-[36px] p-3 shadow-[0_20px_50px_rgb(0_0_0/0.5)]">
        <div className="felt flex h-full w-full flex-col items-center justify-center rounded-[26px] shadow-[inset_0_4px_20px_rgb(0_0_0/0.45)]">
          <span className="text-sm font-black tracking-[0.3em] text-white/50">101</span>
          <span className="text-[10px] font-bold tracking-[0.3em] text-white/30">MASASI</span>
        </div>
      </div>
      <div role="radiogroup" aria-label="Koltuk seç">
        {[0, 1, 2, 3].map((i) => {
          const seat = seats.find((s) => s.seat === i)
          const available = seatAvailable(seat, status)
          const isSelected = selected === i
          const vacated = !!seat?.left_at
          const label = available
            ? vacated
              ? `${seat!.nickname} ayrıldı · devral`
              : 'BOŞ'
            : seat!.nickname
          return (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-label={`Koltuk ${i + 1}: ${available ? 'boş' : `dolu, ${seat!.nickname}`}`}
              disabled={!available}
              onClick={() => onSelect(i)}
              className={`absolute flex w-28 flex-col items-center gap-1 rounded-2xl border-2 px-2 py-2 transition-all duration-200 ${POSITIONS[i]} ${
                isSelected
                  ? 'scale-105 border-accent bg-felt-900 shadow-[0_0_0_5px_rgb(246_185_59/0.18)]'
                  : available
                    ? 'border-dashed border-white/30 bg-felt-900/90 hover:scale-105 hover:border-accent/70'
                    : 'border-white/10 bg-felt-950/95'
              }`}
            >
              <PlayerAvatar
                name={seat?.nickname ?? ''}
                size={36}
                empty={available && !vacated}
                offline={vacated || (seat && !seat.is_bot && !!seat.player_id && !online[seat.player_id])}
              />
              <span className="flex max-w-full items-center gap-1 truncate text-xs font-bold">
                {!available && (
                  <span
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${seat?.is_bot || (seat?.player_id && online[seat.player_id]) ? 'bg-success' : 'bg-ivory-400'}`}
                    aria-hidden
                  />
                )}
                <span className={`truncate ${available ? 'text-ivory-300' : ''}`}>{label}</span>
              </span>
              {mode === 'team' && (
                <span className="text-[10px] font-bold tracking-wider text-ivory-400">TAKIM {(i % 2) + 1}</span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
