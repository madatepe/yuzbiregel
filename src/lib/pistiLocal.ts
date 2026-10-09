import {
  applyAction,
  chooseBotAction,
  createDeal,
  handPayload,
  nextSeat,
  randomInt,
  TARGET_SCORE,
  toPublic,
  type PistiAction,
  type PistiEvent,
  type PistiState,
} from '@pisti/index.ts'
import { useGameUi } from '@/stores/gameUi'
import { initialTableState, useTable } from '@/stores/table'
import type { ScoreRow, SeatRow, TableRow } from '@/lib/types'

export const LOCAL_PISTI_ID = 'local-pisti'
const BOTS = new Set([1, 2, 3])
const BOT_NAMES = ['Bot Ada', 'Bot Cem', 'Bot Ege'] as const

let secret: PistiState | null = null
let scores: ScoreRow[] = []
let humanName = 'Oyuncu'
let humanId = 'local-player'
let botTimer: ReturnType<typeof setTimeout> | null = null
let botGen = 0

function seats(): SeatRow[] {
  return [
    {
      table_id: LOCAL_PISTI_ID,
      seat: 0,
      player_id: humanId,
      nickname: humanName,
      left_at: null,
      joined_at: new Date().toISOString(),
      is_bot: false,
    },
    ...BOT_NAMES.map((nickname, i) => ({
      table_id: LOCAL_PISTI_ID,
      seat: i + 1,
      player_id: `bot-${i + 1}`,
      nickname,
      left_at: null,
      joined_at: new Date().toISOString(),
      is_bot: true,
    })),
  ]
}

function reducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function delayFor(events: PistiEvent[], first = false): number {
  if (reducedMotion()) return 80
  if (first) return 720
  if (events.some((e) => e.type === 'DEAL_FINISHED' || e.type === 'GAME_FINISHED')) return 420
  if (events.some((e) => e.type === 'CARD_PLAYED' && e.faceDown)) return 920
  if (events.some((e) => e.type === 'PILE_TAKEN')) return 1750
  if (events.some((e) => e.type === 'CARD_PLAYED')) return 1080
  if (events.some((e) => e.type === 'BLUFF_CALLED' || e.type === 'BELIEVED')) return 1100
  return 240
}

function publish(events: PistiEvent[] = []) {
  if (!secret) return
  const finished = secret.status === 'finished'
  const gameOver =
    finished &&
    (secret.result?.winner != null || secret.teamScores[0] >= TARGET_SCORE || secret.teamScores[1] >= TARGET_SCORE)
  const table: TableRow = {
    id: LOCAL_PISTI_ID,
    code: 'TEKLI',
    owner_id: humanId,
    mode: 'solo',
    total_rounds: 1,
    status: gameOver ? 'finished' : finished ? 'round_end' : 'playing',
    game_no: 1,
    current_round: secret.round,
    game_type: 'pisti',
    updated_at: new Date().toISOString(),
  }
  if (finished && secret.result) {
    const exists = scores.some((s) => s.round === secret!.round)
    if (!exists) {
      scores = [
        ...scores,
        ...[0, 1, 2, 3].map((seat) => ({
          table_id: LOCAL_PISTI_ID,
          game_no: 1,
          round: secret!.round,
          seat,
          nickname: seats()[seat]!.nickname,
          score: secret!.result!.dealScores[seat % 2],
          hand_score: secret!.result!.cardPoints[seat % 2],
          penalty: secret!.result!.pistiPoints[seat % 2],
        })),
      ]
    }
  }
  useTable.setState({
    tableId: LOCAL_PISTI_ID,
    table,
    seats: seats(),
    scores,
    online: { [humanId]: true },
    connection: 'connected',
    loaded: true,
    missing: false,
    pub: null,
    pisti: toPublic(secret),
    pistiHand: handPayload(secret, 0),
    pistiEvents: events,
    hand: [],
    version: (useTable.getState().version || 0) + 1,
    handVersion: (useTable.getState().handVersion || 0) + 1,
    events: [],
    eventSeq: useTable.getState().eventSeq + 1,
  })
}

function clearBotTimer() {
  botGen += 1
  if (botTimer != null) {
    clearTimeout(botTimer)
    botTimer = null
  }
}

function botActor(state: PistiState): number {
  const peekSeat = [0, 1, 2, 3].find((s) => BOTS.has(s) && !!state.peekHands[s]?.length)
  if (peekSeat != null) return peekSeat
  if (BOTS.has(state.turn)) return state.turn
  return -1
}

function queueBots(firstDelay?: number) {
  if (secret?.peekHands[0]?.length) {
    useGameUi.getState().setBusy(false)
    return
  }
  const id = ++botGen
  if (botTimer != null) clearTimeout(botTimer)
  useGameUi.getState().setBusy(true)
  const tick = () => {
    if (id !== botGen || !secret) return
    if (secret.peekHands[0]?.length) {
      useGameUi.getState().setBusy(false)
      return
    }
    const seat = botActor(secret)
    if (seat < 0) {
      useGameUi.getState().setBusy(false)
      return
    }
    const action = chooseBotAction(secret, seat)
    if (!action) {
      useGameUi.getState().setBusy(false)
      return
    }
    const result = applyAction(secret, seat, action)
    secret = result.state
    publish(result.events)
    if (secret.peekHands[0]?.length) {
      useGameUi.getState().setBusy(false)
      return
    }
    botTimer = setTimeout(tick, delayFor(result.events))
  }
  botTimer = setTimeout(tick, firstDelay ?? delayFor([], true))
}

export function isLocalPisti() {
  return useTable.getState().tableId === LOCAL_PISTI_ID
}

export function startLocalPisti(nickname: string, userId: string | null) {
  clearBotTimer()
  humanName = nickname.trim() || 'Oyuncu'
  humanId = userId || 'local-player'
  scores = []
  secret = createDeal(1, randomInt(4), [0, 0])
  publish()
  queueBots(780)
}

export function applyLocalPisti(action: PistiAction) {
  if (!secret) throw new Error('NO_GAME')
  const applied = applyAction(secret, 0, action)
  secret = applied.state
  publish(applied.events)
  queueBots(delayFor(applied.events))
}

export function nextLocalDeal() {
  if (!secret?.result) return
  clearBotTimer()
  const next = createDeal(secret.round + 1, nextSeat(secret.dealer), secret.teamScores)
  secret = next
  publish()
  queueBots(780)
}

export function restartLocalPisti() {
  startLocalPisti(humanName, humanId)
}

export function stopLocalPisti() {
  clearBotTimer()
  secret = null
  scores = []
  useGameUi.getState().setBusy(false)
  useTable.setState({ ...initialTableState })
}
