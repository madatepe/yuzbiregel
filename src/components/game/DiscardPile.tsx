import { memo } from 'react'
import { useDroppable } from '@dnd-kit/core'
import type { OkeyInfo, TileId } from '@engine/index.ts'
import { GameTile } from './GameTile'
import { tileLabel } from '@/lib/tiles'

interface DiscardPileProps {
  seat: number
  tiles: TileId[]
  okey: OkeyInfo
  /** Previous player's pile that I may take from. */
  takeable: boolean
  onTake?: () => void
  /** My own pile: drop/click target for discarding. */
  discardTarget: boolean
  onDiscard?: () => void
  ownerName: string
  className?: string
}

function DiscardPileImpl({
  seat,
  tiles,
  okey,
  takeable,
  onTake,
  discardTarget,
  onDiscard,
  ownerName,
  className = '',
}: DiscardPileProps) {
  const { setNodeRef, isOver } = useDroppable({ id: 'discard', disabled: !discardTarget })
  const top = tiles[tiles.length - 1]
  const under = tiles.slice(-3, -1)
  const interactive = (takeable && !!onTake) || (discardTarget && !!onDiscard)
  const label = takeable
    ? `${tileLabel(top, okey)} taşını al`
    : discardTarget
      ? 'Seçili taşı buraya at'
      : top !== undefined
        ? `${ownerName} son attığı: ${tileLabel(top, okey)}`
        : `${ownerName} henüz taş atmadı`

  const content = (
    <div className="tile-sm relative" style={{ width: 'var(--tile-w)', height: 'var(--tile-h)' }}>
      {under.map((id, i) => (
        <div key={id} className="absolute inset-0" style={{ transform: `rotate(${(i - 1) * 7}deg) translate(${(i - 1) * 2}px, 2px)` }}>
          <GameTile id={id} okey={okey} size="sm" dimmed />
        </div>
      ))}
      {top !== undefined ? (
        <div key={top} className="absolute inset-0" style={{ transform: 'rotate(-3deg)' }}>
          <GameTile id={top} okey={okey} size="sm" highlight={takeable} />
        </div>
      ) : (
        <div className="absolute inset-0 rounded-md border-2 border-dashed border-white/15" />
      )}
    </div>
  )

  const cls = `flex flex-col items-center gap-1 rounded-xl p-1.5 transition-all duration-150 ${takeable ? 'bg-accent/15 ring-2 ring-accent animate-turn-pulse' : ''} ${discardTarget ? 'bg-white/8 ring-2 ring-dashed ring-white/40' : ''} ${isOver ? 'scale-110 bg-accent/25' : ''} ${className}`

  return interactive ? (
    <button
      ref={setNodeRef}
      type="button"
      data-anchor={`discard-${seat}`}
      onClick={takeable ? onTake : onDiscard}
      aria-label={label}
      className={cls}
    >
      {content}
      <span className="text-[10px] font-bold text-accent-strong">{takeable ? 'AL' : 'AT'}</span>
    </button>
  ) : (
    <div ref={setNodeRef} data-anchor={`discard-${seat}`} aria-label={label} role="img" className={cls}>
      {content}
      {tiles.length > 0 && <span className="text-[10px] font-semibold text-white/40 tabular-nums">{tiles.length}</span>}
    </div>
  )
}

export const DiscardPile = memo(DiscardPileImpl)
