import { memo, useEffect, useState } from 'react'
import { SortableContext, rectSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { OkeyInfo, TileId } from '@engine/index.ts'
import { GameTile } from './GameTile'
import { playSound } from '@/lib/sound'
import { useGameUi } from '@/stores/gameUi'

export const rackDndId = (id: TileId) => `tile:${id}`

interface SortableTileProps {
  id: TileId
  okey: OkeyInfo
  selected: boolean
  pending: boolean
  inFlight: boolean
  dealDelay: number | null
  onToggle: (id: TileId) => void
  onQuickDiscard: (id: TileId) => void
}

const SortableTile = memo(function SortableTile({
  id,
  okey,
  selected,
  pending,
  inFlight,
  dealDelay,
  onToggle,
  onQuickDiscard,
}: SortableTileProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: rackDndId(id) })
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        transition,
        opacity: isDragging ? 0.35 : inFlight ? 0.45 : 1,
        animationDelay: dealDelay !== null ? `${dealDelay}ms` : undefined,
      }}
      className={`touch-none ${dealDelay !== null ? 'animate-tile-in' : ''}`}
      {...attributes}
      {...listeners}
      tabIndex={-1}
      role="presentation"
    >
      <GameTile
        id={id}
        okey={okey}
        selected={selected}
        onClick={() => onToggle(id)}
        onDoubleClick={() => onQuickDiscard(id)}
        badge={
          pending ? (
            <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 rounded-full bg-warning px-1 text-[8px] font-black text-[#3a2500]">
              ALINDI
            </span>
          ) : undefined
        }
      />
    </div>
  )
})

interface TileRackProps {
  okey: OkeyInfo
  round: number
  pendingTake: TileId | null
  onQuickDiscard: (id: TileId) => void
}

function TileRackImpl({ okey, round, pendingTake, onQuickDiscard }: TileRackProps) {
  const order = useGameUi((s) => s.rackOrder)
  const selected = useGameUi((s) => s.selected)
  const toggleSelect = useGameUi((s) => s.toggleSelect)
  const shakeSeq = useGameUi((s) => s.shakeSeq)
  const pendingTiles = useGameUi((s) => s.pendingTiles)
  const [dealRound, setDealRound] = useState<number | null>(null)
  const [shaking, setShaking] = useState(false)

  useEffect(() => {
    setDealRound(round)
    const t = setTimeout(() => setDealRound(null), 1400)
    return () => clearTimeout(t)
  }, [round])

  useEffect(() => {
    if (!shakeSeq) return
    setShaking(true)
    const t = setTimeout(() => setShaking(false), 380)
    return () => clearTimeout(t)
  }, [shakeSeq])

  const onToggle = (id: TileId) => {
    playSound('select')
    toggleSelect(id)
  }

  return (
    <div
      data-rack
      className={`rack relative rounded-2xl px-2 pt-4 pb-2 shadow-[0_14px_30px_rgb(0_0_0/0.5),inset_0_-4px_0_rgb(0_0_0/0.25)] sm:px-4 ${shaking ? 'animate-shake' : ''}`}
      aria-label={`Istakan, ${order.length} taş${selected.length ? `, ${selected.length} seçili` : ''}`}
      role="group"
    >
      <SortableContext items={order.map(rackDndId)} strategy={rectSortingStrategy}>
        <div
          className="grid justify-center gap-x-0.5 gap-y-3 sm:gap-x-1.5"
          style={{ gridTemplateColumns: `repeat(${Math.max(Math.ceil(order.length / 2), 6)}, var(--tile-w))` }}
        >
          {order.map((id, i) => (
            <SortableTile
              key={id}
              id={id}
              okey={okey}
              selected={selected.includes(id)}
              pending={pendingTake === id}
              inFlight={pendingTiles.includes(id)}
              dealDelay={dealRound === round ? i * 35 : null}
              onToggle={onToggle}
              onQuickDiscard={onQuickDiscard}
            />
          ))}
        </div>
      </SortableContext>
      {order.length === 0 && <div className="py-6 text-center text-sm text-white/50">Istakan boş</div>}
    </div>
  )
}

export const TileRack = memo(TileRackImpl)
