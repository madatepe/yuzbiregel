import { memo, useMemo } from 'react'
import { prevSeat, type Meld, type PublicRoundState } from '@engine/index.ts'
import { DiscardPile } from './DiscardPile'
import { GameTile } from './GameTile'
import { MeldGroup } from './MeldGroup'
import { sideOf, type SeatInfo, type SeatSide } from '@/hooks/useGameView'
import { COLOR_NAMES, tileLabel } from '@/lib/tiles'

interface GameTableProps {
  pub: PublicRoundState
  mySeat: number
  seats: SeatInfo[]
  canDraw: boolean
  canTake: boolean
  canDiscard: boolean
  attachTargets: number[]
  onDraw: () => void
  onTake: () => void
  onDiscard: () => void
  onAttach: (meldId: number) => void
}

/** Each player's pile sits at the corner toward the next player (play goes right). */
const PILE_CORNER: Record<SeatSide, string> = {
  bottom: 'bottom-2 right-2 sm:bottom-3 sm:right-3',
  right: 'top-2 right-2 sm:top-3 sm:right-3',
  top: 'top-2 left-2 sm:top-3 sm:left-3',
  left: 'bottom-2 left-2 sm:bottom-3 sm:left-3',
}

function GameTableImpl({
  pub,
  mySeat,
  seats,
  canDraw,
  canTake,
  canDiscard,
  attachTargets,
  onDraw,
  onTake,
  onDiscard,
  onAttach,
}: GameTableProps) {
  const meldsByOwner = useMemo(() => {
    const groups: { seat: number; melds: Meld[] }[] = []
    // Top-to-bottom like the seating: across, right, left, then mine nearest the rack.
    for (const k of [2, 1, 3, 0]) {
      const seat = (mySeat + k) % 4
      const melds = pub.melds.filter((m) => m.owner === seat)
      if (melds.length) groups.push({ seat, melds })
    }
    return groups
  }, [pub.melds, mySeat])

  const attachSet = useMemo(() => new Set(attachTargets), [attachTargets])
  const meldSize = pub.melds.length > 10 ? 'xs' : 'sm'
  const takeFrom = prevSeat(mySeat)

  return (
    <div className="wood-rim relative h-full w-full rounded-[28px] p-2 shadow-[0_24px_60px_rgb(0_0_0/0.55)] sm:rounded-[44px] sm:p-3">
      <div className="felt relative h-full w-full overflow-hidden rounded-[22px] shadow-[inset_0_6px_30px_rgb(0_0_0/0.5)] sm:rounded-[34px]">
        {[0, 1, 2, 3].map((seat) => (
          <DiscardPile
            key={seat}
            seat={seat}
            tiles={pub.discards[seat]}
            okey={pub.okey}
            ownerName={seats[seat].nickname}
            takeable={canTake && seat === takeFrom}
            onTake={onTake}
            discardTarget={canDiscard && seat === mySeat}
            onDiscard={onDiscard}
            className={`absolute z-10 ${PILE_CORNER[sideOf(seat, mySeat)]}`}
          />
        ))}

        <div className="flex h-full flex-col items-center gap-2 px-14 pt-3 pb-3 sm:px-24 sm:pt-4">
          {/* Deck + indicator */}
          <div className="flex shrink-0 items-center gap-4 rounded-2xl bg-black/15 px-3 py-2">
            <button
              type="button"
              data-anchor="deck"
              disabled={!canDraw}
              onClick={onDraw}
              aria-label={`Desteden taş çek, ${pub.deckCount} taş kaldı`}
              className={`group relative flex items-center gap-2 rounded-xl p-1 transition ${canDraw ? 'animate-turn-pulse ring-2 ring-accent' : ''}`}
            >
              <div className="relative tile-sm" style={{ width: 'var(--tile-w)', height: 'var(--tile-h)' }}>
                {[2, 1, 0].map((i) => (
                  <div key={i} className="tile tile-sm tile-back absolute" style={{ top: -i * 2, left: i * 1 }} />
                ))}
              </div>
              <div className="flex flex-col items-start leading-tight">
                <span className="text-[10px] font-bold tracking-wider text-white/50">DESTE</span>
                <span className="text-lg font-black tabular-nums">{pub.deckCount}</span>
              </div>
              {canDraw && (
                <span className="absolute -top-2 -right-2 rounded-full bg-accent px-1.5 text-[9px] font-black text-accent-ink">ÇEK</span>
              )}
            </button>
            <div className="h-10 w-px bg-white/10" />
            <div className="flex items-center gap-2" aria-label={`Gösterge ${tileLabel(pub.indicator)}`}>
              <GameTile id={pub.indicator} size="sm" />
              <div className="flex flex-col leading-tight">
                <span className="text-[10px] font-bold tracking-wider text-white/50">GÖSTERGE</span>
                <span className="text-xs font-semibold text-ivory-200">
                  Okey:{' '}
                  <span className="font-black text-accent-strong">
                    {COLOR_NAMES[pub.okey.color]} {pub.okey.value}
                  </span>
                </span>
              </div>
            </div>
          </div>

          {/* Melds */}
          <div className="no-scrollbar flex min-h-0 w-full flex-1 flex-col items-center gap-2 overflow-y-auto py-1">
            {meldsByOwner.length === 0 ? (
              <div className="m-auto text-center text-xs font-semibold tracking-wider text-white/25">
                Açılan perler burada görünecek
              </div>
            ) : (
              meldsByOwner.map(({ seat, melds }) => (
                <div key={seat} className={`flex w-full flex-col items-center gap-1 ${seat === mySeat ? 'mt-auto' : ''}`}>
                  <span className="text-[10px] font-bold tracking-wider text-white/45 uppercase">
                    {seat === mySeat ? 'Senin perlerin' : seats[seat].nickname}
                  </span>
                  <div className="flex flex-wrap justify-center gap-1.5">
                    {melds.map((m) => (
                      <MeldGroup
                        key={m.id}
                        meld={m}
                        okey={pub.okey}
                        size={meldSize}
                        attachable={attachSet.has(m.id)}
                        onAttach={onAttach}
                      />
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export const GameTable = memo(GameTableImpl)
