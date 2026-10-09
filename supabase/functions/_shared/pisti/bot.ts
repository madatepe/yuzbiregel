import { cardRank, isJack, randomInt, ranksMatch, type CardId } from './cards.ts'
import { applyAction, type PistiAction, type PistiEvent, type PistiState } from './game.ts'

function chance(p: number): boolean {
  return randomInt(1000) < Math.round(p * 1000)
}

function dumpCard(hand: CardId[]): CardId {
  const ranked = hand.slice().sort((a, b) => cardRank(a) - cardRank(b))
  return ranked.find((c) => !isJack(c)) ?? ranked[0]!
}

export function chooseBotAction(state: PistiState, seat: number): PistiAction | null {
  if (state.peekHands[seat]?.length) return { type: 'ack_peek' }
  if (state.status !== 'playing') return null
  if (state.phase === 'await_bluff') {
    if (state.turn !== seat || !state.pendingBluff) return null
    const five = cardRank(state.pendingBluff.tableCardId) === 5
    return chance(five ? 0.55 : 0.38) ? { type: 'call_bluff' } : { type: 'believe' }
  }
  if (state.phase !== 'play' || state.turn !== seat) return null
  const hand = state.hands[seat]!
  if (!hand.length) return null
  const top = state.pile[state.pile.length - 1]
  const match = top != null ? hand.find((c) => ranksMatch(c, top)) : undefined
  const jack = hand.find((c) => isJack(c))

  if (state.pile.length === 1 && match) {
    return chance(0.3) ? { type: 'play_closed', cardId: match } : { type: 'play_open', cardId: match }
  }
  if (top != null && match) return { type: 'play_open', cardId: match }
  if (top != null && jack) return { type: 'play_open', cardId: jack }
  if (state.pile.length === 1 && chance(0.22)) {
    return { type: 'play_closed', cardId: dumpCard(hand) }
  }
  return { type: 'play_open', cardId: dumpCard(hand) }
}

/** Plays bot seats until a human must act or the deal ends. */
export function playBots(input: PistiState, botSeats: ReadonlySet<number>, maxMoves = 80): { state: PistiState; events: PistiEvent[] } {
  let state = input
  const events: PistiEvent[] = []
  for (let i = 0; i < maxMoves; i++) {
    const peekSeat = [0, 1, 2, 3].find((s) => botSeats.has(s) && !!state.peekHands[s]?.length)
    const seat = peekSeat ?? (botSeats.has(state.turn) ? state.turn : -1)
    if (seat < 0) break
    const action = chooseBotAction(state, seat)
    if (!action) break
    const result = applyAction(state, seat, action)
    state = result.state
    events.push(...result.events)
  }
  return { state, events }
}
