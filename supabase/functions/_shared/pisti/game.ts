import { PistiError } from './errors.ts'
import {
  allCardIds,
  cardPointValue,
  cardRank,
  isJack,
  nextSeat,
  partnerSeat,
  ranksMatch,
  shuffle,
  teamOf,
  type CardId,
  HAND_SIZE,
  SEATS,
  TARGET_SCORE,
} from './cards.ts'

export type PistiPhase = 'play' | 'await_bluff' | 'deal_end'
export type PistiStatus = 'playing' | 'finished'

export interface PendingBluff {
  seat: number
  cardId: CardId
  tableCardId: CardId
}

export interface PistiDealResult {
  cardPoints: [number, number]
  pistiPoints: [number, number]
  mostCards: [number, number]
  capturedCounts: [number, number]
  dealScores: [number, number]
  teamScores: [number, number]
  winner: 0 | 1 | null
}

export interface PistiState {
  kind: 'pisti'
  round: number
  dealer: number
  turn: number
  phase: PistiPhase
  deck: CardId[]
  hands: CardId[][]
  pile: CardId[]
  hole: CardId[]
  captured: CardId[][]
  pendingBluff: PendingBluff | null
  lastTaker: number | null
  firstCaptureDone: boolean
  peekHands: (CardId[] | null)[]
  teamScores: [number, number]
  dealPisti: [number, number]
  status: PistiStatus
  result: PistiDealResult | null
}

export type PistiAction =
  | { type: 'play_open'; cardId: CardId }
  | { type: 'play_closed'; cardId: CardId }
  | { type: 'believe' }
  | { type: 'call_bluff' }
  | { type: 'ack_peek' }

export type PistiEventType =
  | 'DEAL_STARTED'
  | 'CARD_PLAYED'
  | 'PILE_TAKEN'
  | 'BLUFF_CALLED'
  | 'BELIEVED'
  | 'TURN_CHANGED'
  | 'PEEK_AVAILABLE'
  | 'DEAL_FINISHED'
  | 'GAME_FINISHED'

export interface PistiEvent {
  type: PistiEventType
  seat: number
  cardId?: CardId
  faceDown?: boolean
  pisti?: number
  catchPoints?: number
  real?: boolean
  hidden?: boolean
  nextTurn?: number
  team?: number
  at: number
}

export interface PublicPistiState {
  kind: 'pisti'
  round: number
  dealer: number
  turn: number
  phase: PistiPhase
  deckCount: number
  handCounts: number[]
  pile: CardId[]
  holeCount: number
  pendingBluffSeat: number | null
  capturedCounts: number[]
  lastTaker: number | null
  firstCaptureDone: boolean
  teamScores: [number, number]
  dealPisti: [number, number]
  status: PistiStatus
  result: PistiDealResult | null
}

export interface PistiHandTiles {
  cards: CardId[]
  peek?: CardId[]
  pendingCard?: CardId
}

export interface ApplyPistiResult {
  state: PistiState
  events: PistiEvent[]
}

function now() {
  return Date.now()
}

export function pistiPoints(tableCardId: CardId, kind: 'normal' | 'wrong_call'): number {
  const five = cardRank(tableCardId) === 5
  if (kind === 'wrong_call') return five ? 100 : 20
  return five ? 50 : 10
}

export function createDeal(
  round: number,
  dealer: number,
  teamScores: [number, number] = [0, 0],
  deck?: CardId[],
): PistiState {
  const cards = deck ? deck.slice() : shuffle(allCardIds())
  const hands: CardId[][] = [[], [], [], []]
  for (let s = 0; s < SEATS; s++) hands[s] = cards.splice(0, HAND_SIZE)
  const open = cards.splice(0, 1)
  const hole = cards.splice(0, 3)
  return {
    kind: 'pisti',
    round,
    dealer,
    turn: nextSeat(dealer),
    phase: 'play',
    deck: cards,
    hands,
    pile: open,
    hole,
    captured: [[], [], [], []],
    pendingBluff: null,
    lastTaker: null,
    firstCaptureDone: false,
    peekHands: [null, null, null, null],
    teamScores: [teamScores[0], teamScores[1]],
    dealPisti: [0, 0],
    status: 'playing',
    result: null,
  }
}

export function toPublic(state: PistiState): PublicPistiState {
  return {
    kind: 'pisti',
    round: state.round,
    dealer: state.dealer,
    turn: state.turn,
    phase: state.phase,
    deckCount: state.deck.length,
    handCounts: state.hands.map((h) => h.length),
    pile: state.pile.slice(),
    holeCount: state.hole.length,
    pendingBluffSeat: state.pendingBluff?.seat ?? null,
    capturedCounts: state.captured.map((c) => c.length),
    lastTaker: state.lastTaker,
    firstCaptureDone: state.firstCaptureDone,
    teamScores: [state.teamScores[0], state.teamScores[1]],
    dealPisti: [state.dealPisti[0], state.dealPisti[1]],
    status: state.status,
    result: state.result,
  }
}

export function handPayload(state: PistiState, seat: number): PistiHandTiles {
  const tiles: PistiHandTiles = { cards: state.hands[seat]!.slice() }
  const peek = state.peekHands[seat]
  if (peek?.length) tiles.peek = peek.slice()
  if (state.pendingBluff?.seat === seat) tiles.pendingCard = state.pendingBluff.cardId
  return tiles
}

export function allHandPayloads(state: PistiState): { seat: number; tiles: PistiHandTiles }[] {
  return [0, 1, 2, 3].map((seat) => ({ seat, tiles: handPayload(state, seat) }))
}

function takeCard(hand: CardId[], cardId: CardId): CardId[] {
  const i = hand.indexOf(cardId)
  if (i < 0) throw new PistiError('CARD_NOT_IN_HAND')
  return [...hand.slice(0, i), ...hand.slice(i + 1)]
}

function addPisti(state: PistiState, seat: number, points: number) {
  state.dealPisti[teamOf(seat)] += points
}

function capture(state: PistiState, seat: number, extra: CardId[], events: PistiEvent[], opts: { pisti?: number; hidden?: boolean }) {
  const hole = state.hole
  const taken = [...state.pile, ...hole, ...extra]
  state.pile = []
  state.hole = []
  state.captured[seat]!.push(...taken)
  state.lastTaker = seat
  events.push({
    type: 'PILE_TAKEN',
    seat,
    pisti: opts.pisti,
    hidden: opts.hidden,
    at: now(),
  })
  if (!state.firstCaptureDone && hole.length) {
    state.firstCaptureDone = true
    const mate = partnerSeat(seat)
    state.peekHands[seat] = hole.slice()
    state.peekHands[mate] = hole.slice()
    events.push({ type: 'PEEK_AVAILABLE', seat, team: teamOf(seat), at: now() })
  } else {
    state.firstCaptureDone = true
  }
}

function maybeContinue(state: PistiState, events: PistiEvent[]) {
  if (state.hands.some((h) => h.length > 0)) return
  if (state.deck.length >= SEATS * HAND_SIZE) {
    for (let s = 0; s < SEATS; s++) state.hands[s] = state.deck.splice(0, HAND_SIZE)
    return
  }
  finishDeal(state, events)
}

function finishDeal(state: PistiState, events: PistiEvent[]) {
  if (state.pendingBluff) {
    state.pile.push(state.pendingBluff.cardId)
    state.pendingBluff = null
  }
  const leftover = [...state.pile, ...state.hole]
  if (leftover.length) {
    const taker = state.lastTaker ?? state.dealer
    state.captured[taker]!.push(...leftover)
    state.pile = []
    state.hole = []
  }
  state.peekHands = [null, null, null, null]

  const capturedCounts: [number, number] = [
    state.captured[0]!.length + state.captured[2]!.length,
    state.captured[1]!.length + state.captured[3]!.length,
  ]
  const cardPoints: [number, number] = [0, 0]
  for (let s = 0; s < SEATS; s++) {
    for (const id of state.captured[s]!) cardPoints[teamOf(s)] += cardPointValue(id)
  }
  const mostCards: [number, number] = [0, 0]
  if (capturedCounts[0] > capturedCounts[1]) mostCards[0] = 3
  else if (capturedCounts[1] > capturedCounts[0]) mostCards[1] = 3

  const dealScores: [number, number] = [
    cardPoints[0] + state.dealPisti[0] + mostCards[0],
    cardPoints[1] + state.dealPisti[1] + mostCards[1],
  ]
  state.teamScores[0] += dealScores[0]
  state.teamScores[1] += dealScores[1]

  let winner: 0 | 1 | null = null
  const a = state.teamScores[0]
  const b = state.teamScores[1]
  if (a >= TARGET_SCORE || b >= TARGET_SCORE) {
    if (a > b) winner = 0
    else if (b > a) winner = 1
  }

  state.result = {
    cardPoints,
    pistiPoints: [state.dealPisti[0], state.dealPisti[1]],
    mostCards,
    capturedCounts,
    dealScores,
    teamScores: [state.teamScores[0], state.teamScores[1]],
    winner,
  }
  state.phase = 'deal_end'
  state.status = 'finished'
  events.push({ type: winner !== null ? 'GAME_FINISHED' : 'DEAL_FINISHED', seat: state.dealer, at: now() })
}

function takesPile(played: CardId, pile: CardId[]): boolean {
  if (!pile.length) return false
  const top = pile[pile.length - 1]!
  return ranksMatch(played, top) || isJack(played)
}

export function applyAction(input: PistiState, seat: number, action: PistiAction): ApplyPistiResult {
  if (input.status !== 'playing' && action.type !== 'ack_peek') throw new PistiError('DEAL_OVER')
  const state = structuredClone(input) as PistiState
  const events: PistiEvent[] = []

  switch (action.type) {
    case 'ack_peek': {
      if (!state.peekHands[seat]?.length) throw new PistiError('NO_PEEK')
      state.peekHands[seat] = null
      return { state, events }
    }
    case 'play_open': {
      if (state.phase !== 'play') throw new PistiError('WRONG_PHASE')
      if (state.turn !== seat) throw new PistiError('NOT_YOUR_TURN')
      state.hands[seat] = takeCard(state.hands[seat]!, action.cardId)
      events.push({ type: 'CARD_PLAYED', seat, cardId: action.cardId, faceDown: false, at: now() })
      const single = state.pile.length === 1
      if (takesPile(action.cardId, state.pile)) {
        const pts = single ? pistiPoints(state.pile[0]!, 'normal') : 0
        if (pts) addPisti(state, seat, pts)
        capture(state, seat, [action.cardId], events, { pisti: pts || undefined })
      } else {
        state.pile.push(action.cardId)
      }
      state.turn = nextSeat(seat)
      events.push({ type: 'TURN_CHANGED', seat, nextTurn: state.turn, at: now() })
      maybeContinue(state, events)
      return { state, events }
    }
    case 'play_closed': {
      if (state.phase !== 'play') throw new PistiError('WRONG_PHASE')
      if (state.turn !== seat) throw new PistiError('NOT_YOUR_TURN')
      if (state.pile.length !== 1) throw new PistiError('CANNOT_PLAY_CLOSED')
      state.hands[seat] = takeCard(state.hands[seat]!, action.cardId)
      state.pendingBluff = { seat, cardId: action.cardId, tableCardId: state.pile[0]! }
      state.phase = 'await_bluff'
      state.turn = nextSeat(seat)
      events.push({ type: 'CARD_PLAYED', seat, faceDown: true, at: now() })
      events.push({ type: 'TURN_CHANGED', seat, nextTurn: state.turn, at: now() })
      return { state, events }
    }
    case 'believe':
    case 'call_bluff': {
      if (state.phase !== 'await_bluff' || !state.pendingBluff) throw new PistiError('WRONG_PHASE')
      if (state.turn !== seat) throw new PistiError('NOT_BLUFF_RESPONDER')
      const claim = state.pendingBluff
      const table = claim.tableCardId
      if (action.type === 'believe') {
        const pts = pistiPoints(table, 'normal')
        addPisti(state, claim.seat, pts)
        events.push({ type: 'BELIEVED', seat, at: now() })
        capture(state, claim.seat, [claim.cardId], events, { pisti: pts, hidden: true })
      } else {
        const real = ranksMatch(claim.cardId, table)
        if (real) {
          const pts = pistiPoints(table, 'wrong_call')
          addPisti(state, claim.seat, pts)
          events.push({ type: 'BLUFF_CALLED', seat, cardId: claim.cardId, real: true, pisti: pts, at: now() })
          capture(state, claim.seat, [claim.cardId], events, { pisti: pts })
        } else {
          addPisti(state, seat, 10)
          state.pile.push(claim.cardId)
          events.push({ type: 'BLUFF_CALLED', seat, cardId: claim.cardId, real: false, catchPoints: 10, at: now() })
        }
      }
      state.pendingBluff = null
      state.phase = 'play'
      maybeContinue(state, events)
      return { state, events }
    }
    default:
      throw new PistiError('UNKNOWN_ACTION')
  }
}

export function isPistiState(value: unknown): value is PistiState {
  return !!value && typeof value === 'object' && (value as PistiState).kind === 'pisti'
}
