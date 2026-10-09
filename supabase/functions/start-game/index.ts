import { ApiError, handler, str } from '../_shared/http.ts'
import { advancePistiBots, loadSeats, loadTable, startRound } from '../_shared/tables.ts'
import { randomInt } from '../_shared/engine/index.ts'

Deno.serve(
  handler(async ({ db, user, body }) => {
    const table = await loadTable(db, str(body.tableId))
    if (table.owner_id !== user.id) throw new ApiError('NOT_OWNER', 403)
    if (table.status !== 'waiting') throw new ApiError('BAD_STATE')
    const seats = await loadSeats(db, table.id)
    if (seats.length !== 4 || seats.some((s) => s.left_at)) throw new ApiError('NEED_4_PLAYERS')

    await startRound(db, table, seats, table.game_no, 1, randomInt(4), 'waiting')
    if (table.game_type === 'pisti') await advancePistiBots(db, table.id, seats)
    return { ok: true }
  }),
)
