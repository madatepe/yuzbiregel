import { ApiError, handler, str } from '../_shared/http.ts'
import { activeSeatOf, advancePistiBots, loadSeats, loadTable, startRound } from '../_shared/tables.ts'
import { nextSeat, type RoundState } from '../_shared/engine/index.ts'
import { isPistiState, nextSeat as pistiNext, type PistiState } from '../_shared/pisti/index.ts'

Deno.serve(
  handler(async ({ db, user, body }) => {
    const tableId = str(body.tableId)
    const [table, seats, secretRes] = await Promise.all([
      loadTable(db, tableId),
      loadSeats(db, tableId),
      db.from('game_secret').select('state').eq('table_id', tableId).single(),
    ])
    activeSeatOf(seats, user.id)
    if (table.status === 'playing') return { ok: true }
    if (table.status !== 'round_end') throw new ApiError('BAD_STATE')
    if (seats.length !== 4) throw new ApiError('NEED_4_PLAYERS')
    if (secretRes.error) throw secretRes.error

    try {
      if (table.game_type === 'pisti' || isPistiState(secretRes.data.state)) {
        const prev = secretRes.data.state as PistiState
        await startRound(
          db,
          table,
          seats,
          table.game_no,
          table.current_round + 1,
          pistiNext(prev.dealer),
          'round_end',
          prev.teamScores,
        )
        await advancePistiBots(db, table.id, seats)
      } else {
        const prev = secretRes.data.state as RoundState
        await startRound(db, table, seats, table.game_no, table.current_round + 1, nextSeat(prev.starter), 'round_end')
      }
    } catch (err) {
      if (err instanceof ApiError && err.code === 'BAD_STATE') return { ok: true }
      throw err
    }
    return { ok: true }
  }),
)
