import { memo } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { meldValues, type Meld, type OkeyInfo } from '@engine/index.ts'
import { GameTile, type TileSize } from './GameTile'

interface MeldGroupProps {
  meld: Meld
  okey: OkeyInfo
  attachable: boolean
  onAttach?: (meldId: number) => void
  size?: TileSize
}

function MeldGroupImpl({ meld, okey, attachable, onAttach, size = 'sm' }: MeldGroupProps) {
  const { setNodeRef, isOver } = useDroppable({ id: `meld:${meld.id}`, disabled: !attachable })
  const values = meldValues(meld, okey)
  const kindLabel = meld.kind === 'run' ? 'Seri' : meld.kind === 'set' ? 'Küt' : 'Çift'

  const body = meld.tiles.map((id, i) => (
    <GameTile key={id} id={id} okey={okey} size={size} representsValue={values[i]} className="-ml-1 first:ml-0" />
  ))

  const cls = `flex items-center rounded-lg p-1 transition-all duration-150 ${attachable ? 'bg-accent/25 outline-2 outline-offset-2 outline-accent' : 'bg-black/15'} ${isOver ? 'scale-105 bg-accent/30' : ''}`

  if (attachable && onAttach) {
    return (
      <button
        ref={setNodeRef}
        type="button"
        data-anchor={`meld-${meld.id}`}
        onClick={() => onAttach(meld.id)}
        className={`${cls} animate-turn-pulse`}
        aria-label={`${kindLabel} perine işle`}
      >
        {body}
      </button>
    )
  }
  return (
    <div ref={setNodeRef} data-anchor={`meld-${meld.id}`} className={cls} role="group" aria-label={`${kindLabel} per`}>
      {body}
    </div>
  )
}

export const MeldGroup = memo(MeldGroupImpl)
