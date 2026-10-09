import { ApiError, handler, str } from '../_shared/http.ts'
import { activeSeatOf, botSeatSet, loadSeats, loadTable, pistiFinishPatch } from '../_shared/tables.ts'
import { applyAction, toPublic, type GameAction, type RoundState } from '../_shared/engine/index.ts'
import {
  allHandPayloads,
  applyAction as applyPisti,
  isPistiState,
  playBots,
  toPublic as toPistiPublic,
  type PistiAction,
  type PistiState,
} from '../_shared/pisti/index.ts'

const OKEY_ACTIONS = new Set([
  'draw_deck',
  'take_discard',
  'return_discard',
  'discard',
  'open_series',
  'open_pairs',
  'lay',
  'add_to_meld',
])

const PISTI_ACTIONS = new Set(['play_open', 'play_closed', 'believe', 'call_bluff', 'ack_peek'])

function parseOkeyAction(raw: unknown): GameAction {
  if (!raw || typeof raw !== 'object') throw new ApiError('BAD_REQUEST')
  const a = raw as Record<string, unknown>
  if (typeof a.type !== 'string' || !OKEY_ACTIONS.has(a.type)) throw new ApiError('BAD_REQUEST')
  const tileIds = (v: unknown) => {
    if (!Array.isArray(v) || v.length === 0 || v.length > 22) throw new ApiError('BAD_REQUEST')
    return v.map((x) => {
      if (!Number.isInteger(x) || x < 0 || x > 105) throw new ApiError('BAD_REQUEST')
      return x as number
    })
  }
  switch (a.type) {
    case 'discard':
      return { type: 'discard', tile: tileIds([a.tile])[0] }
    case 'open_series':
    case 'open_pairs':
    case 'lay':
      return { type: a.type, tiles: tileIds(a.tiles) }
    case 'add_to_meld':
      if (!Number.isInteger(a.meldId)) throw new ApiError('BAD_REQUEST')
      return { type: 'add_to_meld', tile: tileIds([a.tile])[0], meldId: a.meldId as number }
    default:
      return { type: a.type } as GameAction
  }
}

function parsePistiAction(raw: unknown): PistiAction {
  if (!raw || typeof raw !== 'object') throw new ApiError('BAD_REQUEST')
  const a = raw as Record<string, unknown>
  if (typeof a.type !== 'string' || !PISTI_ACTIONS.has(a.type)) throw new ApiError('BAD_REQUEST')
  if (a.type === 'play_open' || a.type === 'play_closed') {
    const cardId = Number(a.cardId)
    if (!Number.isInteger(cardId) || cardId < 0 || cardId > 51) throw new ApiError('BAD_REQUEST')
    return { type: a.type, cardId }
  }
  return { type: a.type } as PistiAction
}

Deno.serve(
  handler(async ({ db, user, body }) => {
    const tableId = str(body.tableId)
    const [table, seats, secretRes] = await Promise.all([
      loadTable(db, tableId),
      loadSeats(db, tableId),
      db.from('game_secret').select('state, version').eq('table_id', tableId).single(),
    ])
    if (table.status !== 'playing') throw new ApiError('BAD_STATE')
    const seat = activeSeatOf(seats, user.id)
    const { data: secret, error } = secretRes
    if (error) throw error

    if (table.game_type === 'pisti' || isPistiState(secret.state)) {
      const action = parsePistiAction(body.action)
      const before = secret.state as PistiState
      let { state, events } = applyPisti(before, seat.seat, action)
      const bots = botSeatSet(seats)
      if (bots.size) {
        const bot = playBots(state, bots)
        state = bot.state
        events = [...events, ...bot.events]
      }
      const { tableStatus, scores } = pistiFinishPatch(state, seats)

      const { data: version, error: commitError } = await db.rpc('commit_move', {
        p_table: table.id,
        p_expected: secret.version,
        p_secret: state,
        p_public: toPistiPublic(state),
        p_events: events,
        p_hands: allHandPayloads(state),
        p_table_status: tableStatus,
        p_scores: scores,
      })
      if (commitError) throw new Error(commitError.message)
      return { ok: true, version }
    }

    const action = parseOkeyAction(body.action)
    const before = secret.state as RoundState
    const { state, events } = applyAction(before, seat.seat, action)

    const changedHands = state.hands
      .map((tiles, s) => ({ seat: s, tiles }))
      .filter(({ seat: s, tiles }) => tiles.join(',') !== before.hands[s].join(','))

    let tableStatus: string | null = null
    let scores: unknown = null
    if (state.status === 'finished' && state.result) {
      tableStatus = table.current_round >= table.total_rounds ? 'finished' : 'round_end'
      scores = state.result.scores.map((score, s) => ({
        seat: s,
        nickname: seats.find((x) => x.seat === s)?.nickname ?? `Oyuncu ${s + 1}`,
        score,
        hand_score: state.result!.handScores[s],
        penalty: state.result!.penalties[s],
      }))
    }

    const { data: version, error: commitError } = await db.rpc('commit_move', {
      p_table: table.id,
      p_expected: secret.version,
      p_secret: state,
      p_public: toPublic(state),
      p_events: events,
      p_hands: changedHands,
      p_table_status: tableStatus,
      p_scores: scores,
    })
    if (commitError) throw new Error(commitError.message)
    return { ok: true, version }
  }),
)
