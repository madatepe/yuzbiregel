import { ApiError, handler, str } from '../_shared/http.ts'
import { loadSeats, loadTable, touchTable } from '../_shared/tables.ts'

Deno.serve(
  handler(async ({ db, user, body }) => {
    const table = await loadTable(db, str(body.tableId))
    if (table.owner_id !== user.id) throw new ApiError('NOT_OWNER', 403)
    if (table.status === 'waiting') return { ok: true }
    if (table.status !== 'finished') throw new ApiError('BAD_STATE')

    const seats = await loadSeats(db, table.id)
    const vacated = seats.filter((s) => s.left_at).map((s) => s.seat)
    if (vacated.length) {
      const { error } = await db.from('table_seats').delete().eq('table_id', table.id).in('seat', vacated)
      if (error) throw error
    }
    await touchTable(db, table.id, { status: 'waiting', game_no: table.game_no + 1, current_round: 0 })
    return { ok: true }
  }),
)
