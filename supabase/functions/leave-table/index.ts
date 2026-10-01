import { handler, str } from '../_shared/http.ts'
import { loadSeats, loadTable, touchTable } from '../_shared/tables.ts'
import { randomInt } from '../_shared/engine/index.ts'

Deno.serve(
  handler(async ({ db, user, body }) => {
    const table = await loadTable(db, str(body.tableId))
    const seats = await loadSeats(db, table.id)
    const mine = seats.find((s) => s.player_id === user.id && !s.left_at)
    if (!mine) return { ok: true }

    if (table.status === 'waiting') {
      const { error } = await db.from('table_seats').delete().eq('table_id', table.id).eq('seat', mine.seat)
      if (error) throw error
    } else {
      // Keep the seat and hand so the player (or someone else) can take it back.
      const { error } = await db
        .from('table_seats')
        .update({ left_at: new Date().toISOString() })
        .eq('table_id', table.id)
        .eq('seat', mine.seat)
      if (error) throw error
    }

    const remaining = seats.filter((s) => s.seat !== mine.seat && !s.left_at)
    const patch: Record<string, unknown> = {}
    if (remaining.length === 0) {
      patch.status = 'closed'
    } else if (table.owner_id === user.id) {
      patch.owner_id = remaining[randomInt(remaining.length)].player_id
    }
    await touchTable(db, table.id, patch)
    return { ok: true }
  }),
)
