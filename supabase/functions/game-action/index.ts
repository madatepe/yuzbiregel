import { ApiError, handler, str } from '../_shared/http.ts'
import { activeSeatOf, loadSeats, loadTable } from '../_shared/tables.ts'
import { applyAction, toPublic, type GameAction, type RoundState } from '../_shared/engine/index.ts'

const ACTIONS = new Set([
  'draw_deck',
  'take_discard',
  'return_discard',
  'discard',
  'open_series',
  'open_pairs',
  'lay',
  'add_to_meld',
])

function parseAction(raw: unknown): GameAction {
  if (!raw || typeof raw !== 'object') throw new ApiError('BAD_REQUEST')
  const a = raw as Record<string, unknown>
  if (typeof a.type !== 'string' || !ACTIONS.has(a.type)) throw new ApiError('BAD_REQUEST')
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

Deno.serve(
  handler(async ({ db, user, body }) => {
    const tableId = str(body.tableId)
    const action = parseAction(body.action)
    const [table, seats, secretRes] = await Promise.all([
      loadTable(db, tableId),
      loadSeats(db, tableId),
      db.from('game_secret').select('state, version').eq('table_id', tableId).single(),
    ])
    if (table.status !== 'playing') throw new ApiError('BAD_STATE')
    const seat = activeSeatOf(seats, user.id)
    const { data: secret, error } = secretRes
    if (error) throw error

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
