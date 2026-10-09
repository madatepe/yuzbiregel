import { GameError } from './errors.ts'
import {
  attachableMelds,
  isPair,
  partitionPairs,
  partitionSeries,
  tryAttach,
  type Meld,
} from './melds.ts'
import {
  allTileIds,
  handTileValue,
  isJoker,
  okeyFromIndicator,
  shuffle,
  tileFace,
  type OkeyInfo,
  type TileId,
} from './tiles.ts'

export type GameMode = 'solo' | 'team'
export type OpenKind = 'series' | 'pairs'
export type Phase = 'draw' | 'discard'

export const SEATS = 4
export const OPEN_SERIES_MIN = 101
export const OPEN_PAIRS_MIN = 5
export const PENALTY = 101
export const UNOPENED_PENALTY = 202
export const FINISH_SCORE = -101
export const STARTER_HAND = 22
export const HAND = 21

export interface RoundResult {
  reason: 'finish' | 'deck_empty'
  finisher: number | null
  okeyFinish: boolean
  pairsFinish: boolean
  elden: boolean
  multiplier: number
  /** Final per-seat round score (hand + penalties). */
  scores: number[]
  handScores: number[]
  penalties: number[]
  hands: TileId[][]
}

export interface RoundState {
  round: number
  mode: GameMode
  starter: number
  turn: number
  phase: Phase
  indicator: TileId
  okey: OkeyInfo
  deck: TileId[]
  hands: TileId[][]
  discards: TileId[][]
  melds: Meld[]
  opened: (OpenKind | null)[]
  openedThisTurn: boolean
  penalties: number[]
  pendingTake: TileId | null
  meldSeq: number
  status: 'playing' | 'finished'
  result: RoundResult | null
}

export type GameAction =
  | { type: 'draw_deck' }
  | { type: 'take_discard' }
  | { type: 'return_discard' }
  | { type: 'discard'; tile: TileId }
  | { type: 'open_series'; tiles: TileId[] }
  | { type: 'open_pairs'; tiles: TileId[] }
  | { type: 'lay'; tiles: TileId[] }
  | { type: 'add_to_meld'; tile: TileId; meldId: number }

export type GameEventType =
  | 'ROUND_STARTED'
  | 'TILE_DRAWN'
  | 'DISCARD_TAKEN'
  | 'DISCARD_RETURNED'
  | 'TILE_DISCARDED'
  | 'MELD_CREATED'
  | 'TILE_ADDED'
  | 'TURN_CHANGED'
  | 'ROUND_FINISHED'

export interface GameEvent {
  type: GameEventType
  seat: number
  tile?: TileId
  /** Joker returned to the attaching player's hand. */
  taken?: TileId
  meldIds?: number[]
  penalty?: number
  penaltyReason?: 'okey' | 'processable' | 'returned'
  nextTurn?: number
  at: number
}

export interface PublicRoundState {
  round: number
  mode: GameMode
  starter: number
  turn: number
  phase: Phase
  indicator: TileId
  okey: OkeyInfo
  deckCount: number
  discards: TileId[][]
  melds: Meld[]
  opened: (OpenKind | null)[]
  openedThisTurn: boolean
  handCounts: number[]
  penalties: number[]
  pendingTake: TileId | null
  status: 'playing' | 'finished'
  result: RoundResult | null
}

export const nextSeat = (seat: number) => (seat + 1) % SEATS
export const prevSeat = (seat: number) => (seat + SEATS - 1) % SEATS
export const partnerSeat = (seat: number) => (seat + 2) % SEATS

export function createRound(round: number, starter: number, mode: GameMode): RoundState {
  const tiles = shuffle(allTileIds())
  const indicatorIdx = tiles.findIndex((id) => !tileFace(id).fake)
  const [indicator] = tiles.splice(indicatorIdx, 1)
  const hands: TileId[][] = [[], [], [], []]
  for (let s = 0; s < SEATS; s++) {
    const count = s === starter ? STARTER_HAND : HAND
    hands[s] = tiles.splice(0, count)
  }
  return {
    round,
    mode,
    starter,
    turn: starter,
    phase: 'discard',
    indicator,
    okey: okeyFromIndicator(indicator),
    deck: tiles,
    hands,
    discards: [[], [], [], []],
    melds: [],
    opened: [null, null, null, null],
    openedThisTurn: false,
    penalties: [0, 0, 0, 0],
    pendingTake: null,
    meldSeq: 0,
    status: 'playing',
    result: null,
  }
}

export function toPublic(state: RoundState): PublicRoundState {
  return {
    round: state.round,
    mode: state.mode,
    starter: state.starter,
    turn: state.turn,
    phase: state.phase,
    indicator: state.indicator,
    okey: state.okey,
    deckCount: state.deck.length,
    discards: state.discards,
    melds: state.melds,
    opened: state.opened,
    openedThisTurn: state.openedThisTurn,
    handCounts: state.hands.map((h) => h.length),
    penalties: state.penalties,
    pendingTake: state.pendingTake,
    status: state.status,
    result: state.result,
  }
}

function clone(state: RoundState): RoundState {
  return structuredClone(state)
}

function removeFromHand(hand: TileId[], tiles: TileId[]) {
  for (const t of tiles) {
    const i = hand.indexOf(t)
    if (i < 0) throw new GameError('TILE_NOT_IN_HAND')
    hand.splice(i, 1)
  }
}

function assertInHand(hand: TileId[], tiles: TileId[]) {
  if (new Set(tiles).size !== tiles.length) throw new GameError('INVALID_MELD')
  for (const t of tiles) if (!hand.includes(t)) throw new GameError('TILE_NOT_IN_HAND')
}

function addMelds(state: RoundState, seat: number, melds: Omit<Meld, 'id' | 'owner'>[]): number[] {
  const ids: number[] = []
  for (const m of melds) {
    const id = ++state.meldSeq
    state.melds.push({ id, owner: seat, kind: m.kind, tiles: m.tiles })
    ids.push(id)
  }
  return ids
}

function afterTilesLeftHand(state: RoundState, seat: number, used: TileId[]) {
  if (state.pendingTake !== null && used.includes(state.pendingTake)) state.pendingTake = null
  if (state.hands[seat].length === 0) throw new GameError('MUST_KEEP_DISCARD')
}

export interface ApplyResult {
  state: RoundState
  events: GameEvent[]
}

export function applyAction(input: RoundState, seat: number, action: GameAction): ApplyResult {
  if (input.status !== 'playing') throw new GameError('ROUND_OVER')
  if (input.turn !== seat) throw new GameError('NOT_YOUR_TURN')
  const state = clone(input)
  const hand = state.hands[seat]
  const at = Date.now()
  const events: GameEvent[] = []

  switch (action.type) {
    case 'draw_deck': {
      if (state.phase !== 'draw') throw new GameError('WRONG_PHASE')
      const tile = state.deck.pop()
      if (tile === undefined) throw new GameError('DECK_EMPTY')
      hand.push(tile)
      state.phase = 'discard'
      events.push({ type: 'TILE_DRAWN', seat, at })
      break
    }
    case 'take_discard': {
      if (state.phase !== 'draw') throw new GameError('WRONG_PHASE')
      const pile = state.discards[prevSeat(seat)]
      const tile = pile.pop()
      if (tile === undefined) throw new GameError('NO_DISCARD')
      hand.push(tile)
      state.pendingTake = tile
      state.phase = 'discard'
      events.push({ type: 'DISCARD_TAKEN', seat, tile, at })
      break
    }
    case 'return_discard': {
      const tile = state.pendingTake
      if (state.phase !== 'discard' || tile === null || !hand.includes(tile)) {
        throw new GameError('NOTHING_TO_RETURN')
      }
      removeFromHand(hand, [tile])
      state.discards[prevSeat(seat)].push(tile)
      state.pendingTake = null
      state.penalties[seat] += PENALTY
      state.phase = 'draw'
      events.push({ type: 'DISCARD_RETURNED', seat, tile, penalty: PENALTY, penaltyReason: 'returned', at })
      break
    }
    case 'open_series': {
      if (state.phase !== 'discard') throw new GameError('WRONG_PHASE')
      if (state.opened[seat]) throw new GameError('ALREADY_OPENED')
      assertInHand(hand, action.tiles)
      const partition = partitionSeries(action.tiles, state.okey)
      if (!partition) throw new GameError('INVALID_MELD')
      if (partition.points < OPEN_SERIES_MIN) throw new GameError('NEED_101')
      if (state.pendingTake !== null && !action.tiles.includes(state.pendingTake)) {
        throw new GameError('MUST_USE_TAKEN')
      }
      removeFromHand(hand, action.tiles)
      afterTilesLeftHand(state, seat, action.tiles)
      state.opened[seat] = 'series'
      state.openedThisTurn = true
      const meldIds = addMelds(
        state,
        seat,
        partition.melds.map((m) => ({ kind: m.kind, tiles: m.tiles })),
      )
      events.push({ type: 'MELD_CREATED', seat, meldIds, at })
      break
    }
    case 'open_pairs': {
      if (state.phase !== 'discard') throw new GameError('WRONG_PHASE')
      if (state.opened[seat]) throw new GameError('ALREADY_OPENED')
      assertInHand(hand, action.tiles)
      const { pairs, leftovers } = partitionPairs(action.tiles, state.okey)
      if (leftovers.length) throw new GameError('INVALID_MELD')
      if (pairs.length < OPEN_PAIRS_MIN) throw new GameError('NEED_5_PAIRS')
      if (state.pendingTake !== null && !action.tiles.includes(state.pendingTake)) {
        throw new GameError('MUST_USE_TAKEN')
      }
      removeFromHand(hand, action.tiles)
      afterTilesLeftHand(state, seat, action.tiles)
      state.opened[seat] = 'pairs'
      state.openedThisTurn = true
      const meldIds = addMelds(state, seat, pairs.map((tiles) => ({ kind: 'pair' as const, tiles })))
      events.push({ type: 'MELD_CREATED', seat, meldIds, at })
      break
    }
    case 'lay': {
      if (state.phase !== 'discard') throw new GameError('WRONG_PHASE')
      const kind = state.opened[seat]
      if (!kind) throw new GameError('NOT_OPENED')
      assertInHand(hand, action.tiles)
      let melds: Omit<Meld, 'id' | 'owner'>[]
      if (kind === 'series') {
        const partition = partitionSeries(action.tiles, state.okey)
        if (!partition) throw new GameError('INVALID_MELD')
        melds = partition.melds.map((m) => ({ kind: m.kind, tiles: m.tiles }))
      } else {
        const { pairs, leftovers } = partitionPairs(action.tiles, state.okey)
        if (leftovers.length || pairs.length === 0 || !pairs.every((p) => isPair(p, state.okey))) {
          throw new GameError('INVALID_MELD')
        }
        melds = pairs.map((tiles) => ({ kind: 'pair' as const, tiles }))
      }
      removeFromHand(hand, action.tiles)
      afterTilesLeftHand(state, seat, action.tiles)
      const meldIds = addMelds(state, seat, melds)
      events.push({ type: 'MELD_CREATED', seat, meldIds, at })
      break
    }
    case 'add_to_meld': {
      if (state.phase !== 'discard') throw new GameError('WRONG_PHASE')
      if (!state.opened[seat]) throw new GameError('NOT_OPENED')
      assertInHand(hand, [action.tile])
      const meld = state.melds.find((m) => m.id === action.meldId)
      if (!meld) throw new GameError('MELD_NOT_FOUND')
      const attached = tryAttach(meld, action.tile, state.okey)
      if (!attached) throw new GameError('CANNOT_ATTACH')
      removeFromHand(hand, [action.tile])
      if (attached.takenJoker !== null) hand.push(attached.takenJoker)
      afterTilesLeftHand(state, seat, [action.tile])
      meld.tiles = attached.tiles
      events.push({
        type: 'TILE_ADDED',
        seat,
        tile: action.tile,
        taken: attached.takenJoker ?? undefined,
        meldIds: [meld.id],
        at,
      })
      break
    }
    case 'discard': {
      if (state.phase !== 'discard') throw new GameError('WRONG_PHASE')
      if (state.pendingTake !== null && hand.includes(state.pendingTake)) {
        throw new GameError('MUST_USE_TAKEN')
      }
      assertInHand(hand, [action.tile])
      removeFromHand(hand, [action.tile])
      state.discards[seat].push(action.tile)

      if (hand.length === 0) {
        events.push({ type: 'TILE_DISCARDED', seat, tile: action.tile, at })
        state.result = scoreRound(state, seat, action.tile)
        state.status = 'finished'
        events.push({ type: 'ROUND_FINISHED', seat, at })
        break
      }

      let penaltyReason: GameEvent['penaltyReason']
      if (isJoker(action.tile, state.okey)) penaltyReason = 'okey'
      else if (attachableMelds(state.melds, action.tile, state.okey).length > 0) penaltyReason = 'processable'
      if (penaltyReason) state.penalties[seat] += PENALTY
      events.push({
        type: 'TILE_DISCARDED',
        seat,
        tile: action.tile,
        penalty: penaltyReason ? PENALTY : undefined,
        penaltyReason,
        at,
      })

      if (state.deck.length === 0) {
        state.result = scoreRound(state, null, null)
        state.status = 'finished'
        events.push({ type: 'ROUND_FINISHED', seat, at })
        break
      }
      state.turn = nextSeat(seat)
      state.phase = 'draw'
      state.openedThisTurn = false
      state.pendingTake = null
      events.push({ type: 'TURN_CHANGED', seat, nextTurn: state.turn, at })
      break
    }
    default:
      throw new GameError('UNKNOWN_ACTION')
  }

  return { state, events }
}

export function scoreRound(state: RoundState, finisher: number | null, lastTile: TileId | null): RoundResult {
  const elden = finisher !== null && state.openedThisTurn
  const okeyFinish = finisher !== null && lastTile !== null && isJoker(lastTile, state.okey)
  const pairsFinish = finisher !== null && state.opened[finisher] === 'pairs'
  const multiplier = finisher === null ? 1 : (elden ? 4 : 1) * (okeyFinish ? 2 : 1) * (pairsFinish ? 2 : 1)

  const handScores = state.hands.map((hand, seat) => {
    if (seat === finisher) return FINISH_SCORE * multiplier
    if (finisher !== null && state.mode === 'team' && seat === partnerSeat(finisher)) return 0
    const opened = state.opened[seat]
    if (!opened) return UNOPENED_PENALTY * multiplier
    const sum = hand.reduce((acc, id) => acc + handTileValue(id, state.okey), 0)
    return sum * (opened === 'pairs' ? 2 : 1) * multiplier
  })

  return {
    reason: finisher === null ? 'deck_empty' : 'finish',
    finisher,
    okeyFinish,
    pairsFinish,
    elden,
    multiplier,
    handScores,
    penalties: state.penalties.slice(),
    scores: handScores.map((s, i) => s + state.penalties[i]),
    hands: state.hands.map((h) => h.slice()),
  }
}

export interface SelectionPreview {
  series: { valid: boolean; points: number; meldCount: number }
  pairs: { count: number; valid: boolean }
}

/** Non-authoritative preview of a tile selection for the UI. */
export function previewSelection(tiles: TileId[], okey: OkeyInfo): SelectionPreview {
  const partition = tiles.length >= 3 ? partitionSeries(tiles, okey) : null
  const { pairs, leftovers } = partitionPairs(tiles, okey)
  return {
    series: {
      valid: partition !== null,
      points: partition?.points ?? 0,
      meldCount: partition?.melds.length ?? 0,
    },
    pairs: { count: pairs.length, valid: leftovers.length === 0 && pairs.length > 0 },
  }
}

export function teamOf(seat: number): 0 | 1 {
  return (seat % 2) as 0 | 1
}
