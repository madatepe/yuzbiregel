import type { CardId } from './cards.ts'
import type { PistiHandTiles, PublicPistiState } from './game.ts'

export interface PistiAvailable {
  playOpen: boolean
  playClosed: boolean
  believe: boolean
  callBluff: boolean
  ackPeek: boolean
}

export function availablePistiActions(
  pub: PublicPistiState,
  seat: number,
  hand: PistiHandTiles,
  selected?: CardId | null,
): PistiAvailable {
  const mine = pub.turn === seat && pub.status === 'playing'
  const hasCard = selected != null && hand.cards.includes(selected)
  return {
    playOpen: mine && pub.phase === 'play' && hasCard,
    playClosed: mine && pub.phase === 'play' && hasCard && pub.pile.length === 1,
    believe: mine && pub.phase === 'await_bluff',
    callBluff: mine && pub.phase === 'await_bluff',
    ackPeek: !!hand.peek?.length,
  }
}
