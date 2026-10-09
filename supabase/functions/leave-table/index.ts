import { handler, str } from '../_shared/http.ts'
import { deleteTable, isBotSeat, loadSeats, loadTable, sweepTables, touchTable } from '../_shared/tables.ts'
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
    const humans = remaining.filter((s) => !isBotSeat(s) && s.player_id)
    if (humans.length === 0) {
      await deleteTable(db, table.id)
    } else {
      await touchTable(
        db,
        table.id,
        table.owner_id === user.id ? { owner_id: humans[randomInt(humans.length)]!.player_id } : {},
      )
    }
    await sweepTables(db)
    return { ok: true }
  }),
)
