import {
  analyzeMeld,
  applyAction,
  attachableMelds,
  createRound,
  isJoker,
  OPEN_SERIES_MIN,
  partitionPairs,
  resolveTile,
  toPublic,
  type GameAction,
  type GameEvent,
  type OkeyInfo,
  type RoundState,
  type TileId,
} from '@engine/index.ts'
import { seriesGroups } from '@/lib/rack'
import { useGameUi } from '@/stores/gameUi'
import { initialTableState, useTable } from '@/stores/table'
import type { ScoreRow, SeatRow, TableRow } from '@/lib/types'

export const LOCAL_OKEY_ID = 'local-okey'
const TOTAL_ROUNDS = 5
const BOTS = new Set([1, 2, 3])
const BOT_NAMES = ['Bot Ada', 'Bot Cem', 'Bot Ege'] as const

let secret: RoundState | null = null
let scores: ScoreRow[] = []
let humanName = 'Oyuncu'
let humanId = 'local-player'
let botTimer: ReturnType<typeof setTimeout> | null = null
let botGen = 0

function seats(): SeatRow[] {
  return [
    {
      table_id: LOCAL_OKEY_ID,
      seat: 0,
      player_id: humanId,
      nickname: humanName,
      left_at: null,
      joined_at: new Date().toISOString(),
      is_bot: false,
    },
    ...BOT_NAMES.map((nickname, i) => ({
      table_id: LOCAL_OKEY_ID,
      seat: i + 1,
      player_id: `bot-${i + 1}`,
      nickname,
      left_at: null,
      joined_at: new Date().toISOString(),
      is_bot: true,
    })),
  ]
}

function publish(events: GameEvent[] = []) {
  if (!secret) return
  const finished = secret.status === 'finished'
  const gameOver = finished && secret.round >= TOTAL_ROUNDS
  const table: TableRow = {
    id: LOCAL_OKEY_ID,
    code: 'TEKLI',
    owner_id: humanId,
    mode: 'solo',
    total_rounds: TOTAL_ROUNDS,
    status: gameOver ? 'finished' : finished ? 'round_end' : 'playing',
    game_no: 1,
    current_round: secret.round,
    game_type: 'okey101',
    updated_at: new Date().toISOString(),
  }
  if (finished && secret.result) {
    const exists = scores.some((s) => s.round === secret!.round)
    if (!exists) {
      const result = secret.result
      scores = [
        ...scores,
        ...[0, 1, 2, 3].map((seat) => ({
          table_id: LOCAL_OKEY_ID,
          game_no: 1,
          round: secret!.round,
          seat,
          nickname: seats()[seat]!.nickname,
          score: result.scores[seat] ?? 0,
          hand_score: result.handScores[seat] ?? 0,
          penalty: result.penalties[seat] ?? 0,
        })),
      ]
    }
  }
  useTable.setState({
    tableId: LOCAL_OKEY_ID,
    table,
    seats: seats(),
    scores,
    online: { [humanId]: true },
    connection: 'connected',
    loaded: true,
    missing: false,
    pub: toPublic(secret),
    pisti: null,
    pistiHand: null,
    pistiEvents: [],
    hand: secret.hands[0]?.slice() ?? [],
    version: (useTable.getState().version || 0) + 1,
    handVersion: (useTable.getState().handVersion || 0) + 1,
    events,
    eventSeq: useTable.getState().eventSeq + 1,
  })
}

function seriesOpen(hand: TileId[], okey: OkeyInfo): TileId[] | null {
  const jokers = hand.filter((t) => isJoker(t, okey))
  let jokersLeft = jokers.length
  const chunks: { tiles: TileId[]; points: number }[] = []
  for (const group of seriesGroups(hand, okey)) {
    if (!group.length || group.some((t) => isJoker(t, okey))) continue
    const candidate =
      group.length >= 3 ? group : jokersLeft > 0 ? [...group, jokers[jokers.length - jokersLeft]!] : null
    if (!candidate || candidate.length < 3) continue
    const analysis = analyzeMeld(candidate, okey)
    if (!analysis) continue
    if (candidate.some((t) => isJoker(t, okey))) jokersLeft -= 1
    chunks.push({ tiles: candidate, points: analysis.points })
  }
  chunks.sort((a, b) => b.points - a.points)
  const picked: TileId[] = []
  let points = 0
  for (const chunk of chunks) {
    if (picked.length + chunk.tiles.length >= hand.length) continue
    picked.push(...chunk.tiles)
    points += chunk.points
  }
  if (points < OPEN_SERIES_MIN || !picked.length || picked.length >= hand.length) return null
  return picked
}

function pairsOpen(hand: TileId[], okey: OkeyInfo): TileId[] | null {
  const { pairs } = partitionPairs(hand, okey)
  if (pairs.length < 5) return null
  const tiles = pairs.slice(0, 5).flat()
  if (tiles.length >= hand.length) return null
  return tiles
}

function chooseOkeyBot(state: RoundState, seat: number): GameAction | null {
  const hand = state.hands[seat] ?? []
  if (!hand.length) return null
  if (state.phase === 'draw') {
    if (!state.deck.length) return null
    return { type: 'draw_deck' }
  }
  if (!state.opened[seat]) {
    const series = seriesOpen(hand, state.okey)
    if (series) return { type: 'open_series', tiles: series }
    const pairs = pairsOpen(hand, state.okey)
    if (pairs) return { type: 'open_pairs', tiles: pairs }
  } else if (hand.length > 1) {
    for (const tile of hand) {
      const meldId = attachableMelds(state.melds, tile, state.okey)[0]
      if (meldId !== undefined) return { type: 'add_to_meld', tile, meldId }
    }
    if (state.opened[seat] === 'series' && state.opened.some((kind) => kind === 'pairs') && hand.length > 2) {
      const pair = partitionPairs(hand, state.okey).pairs[0]
      if (pair) return { type: 'lay', tiles: pair }
    }
  }
  const ranked = [...hand].sort((a, b) => resolveTile(b, state.okey).value - resolveTile(a, state.okey).value)
  const tile =
    ranked.find((t) => !isJoker(t, state.okey) && attachableMelds(state.melds, t, state.okey).length === 0) ??
    ranked.find((t) => !isJoker(t, state.okey)) ??
    ranked[0]
  return tile === undefined ? null : { type: 'discard', tile }
}

function clearBotTimer() {
  botGen += 1
  if (botTimer != null) {
    clearTimeout(botTimer)
    botTimer = null
  }
}

function queueBots(delay = 640) {
  if (!secret || secret.status !== 'playing' || !BOTS.has(secret.turn)) {
    useGameUi.getState().setBusy(false, [])
    return
  }
  const id = ++botGen
  if (botTimer != null) clearTimeout(botTimer)
  useGameUi.getState().setBusy(true)
  const tick = () => {
    if (id !== botGen || !secret || secret.status !== 'playing' || !BOTS.has(secret.turn)) {
      useGameUi.getState().setBusy(false, [])
      return
    }
    const state = secret
    let action = chooseOkeyBot(state, state.turn)
    if (!action) {
      useGameUi.getState().setBusy(false, [])
      return
    }
    try {
      let result
      try {
        result = applyAction(state, state.turn, action)
      } catch {
        const hand = state.hands[state.turn] ?? []
        const tile = hand.find((t) => !isJoker(t, state.okey)) ?? hand[0]
        if (tile === undefined || action.type === 'discard') throw new Error('BOT_STUCK')
        action = { type: 'discard', tile }
        result = applyAction(state, state.turn, action)
      }
      secret = result.state
      publish(result.events)
    } catch {
      useGameUi.getState().setBusy(false, [])
      return
    }
    if (!secret || secret.status !== 'playing' || !BOTS.has(secret.turn)) {
      useGameUi.getState().setBusy(false, [])
      return
    }
    botTimer = setTimeout(tick, 640)
  }
  botTimer = setTimeout(tick, delay)
}

export function isLocalOkey() {
  return useTable.getState().tableId === LOCAL_OKEY_ID
}

export function startLocalOkey(nickname: string, userId: string | null) {
  clearBotTimer()
  humanName = nickname.trim() || 'Oyuncu'
  humanId = userId || 'local-player'
  scores = []
  secret = createRound(1, Math.floor(Math.random() * 4), 'solo')
  publish()
  queueBots(780)
}

export function applyLocalOkey(action: GameAction) {
  if (!secret) throw new Error('NO_GAME')
  const applied = applyAction(secret, 0, action)
  secret = applied.state
  publish(applied.events)
  queueBots()
}

export function nextLocalOkey() {
  if (!secret?.result || secret.round >= TOTAL_ROUNDS) return
  clearBotTimer()
  secret = createRound(secret.round + 1, (secret.starter + 1) % 4, 'solo')
  publish()
  queueBots(780)
}

export function restartLocalOkey() {
  startLocalOkey(humanName, humanId)
}

export function stopLocalOkey() {
  clearBotTimer()
  secret = null
  scores = []
  useGameUi.getState().setBusy(false, [])
  useTable.setState({ ...initialTableState })
}
