import { memo, useEffect, useState, type ReactNode } from 'react'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import type { OkeyInfo, TileId } from '@engine/index.ts'
import { GameTile } from './GameTile'
import { RACK_COLS, rackTiles } from '@/lib/rack'
import { playSound } from '@/lib/sound'
import { useGameUi } from '@/stores/gameUi'

const rackDndId = (id: TileId) => `tile:${id}`
const slotDndId = (index: number) => `slot:${index}`

interface RackTileProps {
  id: TileId
  okey: OkeyInfo
  selected: boolean
  pending: boolean
  inFlight: boolean
  dealDelay: number | null
  onToggle: (id: TileId) => void
  onQuickDiscard: (id: TileId) => void
}

const RackTile = memo(function RackTile({
  id,
  okey,
  selected,
  pending,
  inFlight,
  dealDelay,
  onToggle,
  onQuickDiscard,
}: RackTileProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: rackDndId(id) })
  return (
    <div
      ref={setNodeRef}
      style={{
        opacity: isDragging ? 0.3 : inFlight ? 0.45 : 1,
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

const RackSlotCell = memo(function RackSlotCell({ index, children }: { index: number; children?: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: slotDndId(index) })
  return (
    <div
      ref={setNodeRef}
      className={`relative rounded-[calc(var(--tile-w)*0.16)] transition-colors duration-100 ${
        isOver ? 'bg-accent/35 ring-2 ring-accent' : children ? '' : 'bg-black/12 shadow-[inset_0_2px_4px_rgb(0_0_0/0.25)]'
      }`}
      style={{ width: 'var(--tile-w)', height: 'var(--tile-h)' }}
    >
      {children}
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
  const slots = useGameUi((s) => s.rackSlots)
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

  const count = rackTiles(slots).length
  let ordinal = 0

  return (
    <div
      data-rack
      className={`rack rack-grid relative rounded-2xl px-1.5 pt-4 pb-2 shadow-[0_14px_30px_rgb(0_0_0/0.5),inset_0_-4px_0_rgb(0_0_0/0.25)] sm:px-4 ${shaking ? 'animate-shake' : ''}`}
      aria-label={`Istakan, ${count} taş${selected.length ? `, ${selected.length} seçili` : ''}`}
      role="group"
    >
      <div
        className="grid justify-center gap-x-px gap-y-3 sm:gap-x-1.5"
        style={{ gridTemplateColumns: `repeat(${RACK_COLS}, var(--tile-w))` }}
      >
        {slots.map((id, i) => {
          const deal = id !== null && dealRound === round ? ordinal++ * 35 : null
          return (
            <RackSlotCell key={i} index={i}>
              {id !== null && (
                <RackTile
                  id={id}
                  okey={okey}
                  selected={selected.includes(id)}
                  pending={pendingTake === id}
                  inFlight={pendingTiles.includes(id)}
                  dealDelay={deal}
                  onToggle={onToggle}
                  onQuickDiscard={onQuickDiscard}
                />
              )}
            </RackSlotCell>
          )
        })}
      </div>
    </div>
  )
}

export const TileRack = memo(TileRackImpl)
