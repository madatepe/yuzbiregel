import { cardRank, cardSuit, type CardId } from '@pisti/index.ts'

const RANK: Record<number, string> = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' }
const SUIT = { clubs: '♣', diamonds: '♦', hearts: '♥', spades: '♠' } as const

export function rankLabel(id: CardId) {
  const r = cardRank(id)
  return RANK[r] ?? String(r)
}

export function suitSymbol(id: CardId) {
  return SUIT[cardSuit(id)]
}

export function isRedSuit(id: CardId) {
  const s = cardSuit(id)
  return s === 'hearts' || s === 'diamonds'
}

export function PlayingCard({
  id,
  faceDown = false,
  selected = false,
  size = 'md',
  onClick,
  label,
}: {
  id?: CardId
  faceDown?: boolean
  selected?: boolean
  size?: 'sm' | 'md' | 'lg'
  onClick?: () => void
  label?: string
}) {
  const sizeClass = size === 'sm' ? 'playing-card-sm' : size === 'lg' ? 'playing-card-lg' : ''
  if (faceDown || id == null) {
    const inner = (
      <span className={`playing-card playing-card-back ${sizeClass}`} aria-hidden data-card-id={id}>
        {' '}
      </span>
    )
    if (!onClick) return inner
    return (
      <button type="button" onClick={onClick} className="rounded-lg" aria-label={label ?? 'Kapalı kart'}>
        {inner}
      </button>
    )
  }
  const color = isRedSuit(id) ? 'text-tile-red' : 'text-tile-black'
  const text = `${rankLabel(id)}${suitSymbol(id)}`
  const body = (
    <span className={`playing-card ${sizeClass} ${color}`} aria-hidden data-card-id={id}>
      <span className="text-[0.95em]">{rankLabel(id)}</span>
      <span className="mt-0.5 text-[1.15em]">{suitSymbol(id)}</span>
    </span>
  )
  if (!onClick) {
    return (
      <span className={selected ? 'relative scale-105' : undefined} aria-label={label ?? text}>
        {body}
      </span>
    )
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label ?? text}
      aria-pressed={selected}
      className={`rounded-lg transition ${selected ? 'scale-105 ring-2 ring-accent ring-offset-2 ring-offset-felt-900' : 'hover:-translate-y-1'}`}
    >
      {body}
    </button>
  )
}
