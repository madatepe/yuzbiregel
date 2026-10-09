export type Suit = 'clubs' | 'diamonds' | 'hearts' | 'spades'
export type CardId = number

export const SUITS: readonly Suit[] = ['clubs', 'diamonds', 'hearts', 'spades']
export const DECK_SIZE = 52
export const SEATS = 4
export const TARGET_SCORE = 205
export const HAND_SIZE = 4

export function cardSuit(id: CardId): Suit {
  return SUITS[Math.floor(id / 13)]!
}

export function cardRank(id: CardId): number {
  return (id % 13) + 1
}

export function cardId(suit: Suit, rank: number): CardId {
  return SUITS.indexOf(suit) * 13 + (rank - 1)
}

export function isJack(id: CardId): boolean {
  return cardRank(id) === 11
}

export function ranksMatch(a: CardId, b: CardId): boolean {
  return cardRank(a) === cardRank(b)
}

/** Sinek 2 = 2, Karo 10 = 3, every Ace/Jack = 1. */
export function cardPointValue(id: CardId): number {
  const suit = cardSuit(id)
  const rank = cardRank(id)
  if (suit === 'clubs' && rank === 2) return 2
  if (suit === 'diamonds' && rank === 10) return 3
  if (rank === 1 || rank === 11) return 1
  return 0
}

export function allCardIds(): CardId[] {
  return Array.from({ length: DECK_SIZE }, (_, i) => i)
}

export function randomInt(max: number): number {
  const buf = new Uint32Array(1)
  crypto.getRandomValues(buf)
  return buf[0]! % max
}

export function shuffle<T>(items: T[]): T[] {
  const a = items.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1)
    ;[a[i], a[j]] = [a[j]!, a[i]!]
  }
  return a
}

export const nextSeat = (seat: number) => (seat + 1) % SEATS
export const partnerSeat = (seat: number) => (seat + 2) % SEATS
export const teamOf = (seat: number) => (seat % 2) as 0 | 1
