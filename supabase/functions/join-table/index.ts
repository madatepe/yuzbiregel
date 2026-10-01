import { ApiError, cleanNickname, handler, str } from '../_shared/http.ts'
import { loadSeats, touchTable, type TableRow } from '../_shared/tables.ts'

Deno.serve(
  handler(async ({ db, user, body }) => {
    const code = str(body.code).toUpperCase()
    const nickname = cleanNickname(body.nickname)
    const seatNo = Number(body.seat)
    if (!Number.isInteger(seatNo) || seatNo < 0 || seatNo > 3) throw new ApiError('BAD_REQUEST')

    const { data: tableData, error } = await db.from('game_tables').select('*').eq('code', code).maybeSingle()
    if (error) throw error
    if (!tableData) throw new ApiError('TABLE_NOT_FOUND', 404)
    const table = tableData as TableRow
    if (table.status === 'closed') throw new ApiError('TABLE_CLOSED')

    await db.from('profiles').upsert({ id: user.id, nickname, updated_at: new Date().toISOString() })

    const seats = await loadSeats(db, table.id)
    const mine = seats.find((s) => s.player_id === user.id)

    // Already seated (or returning to the seat they left): reclaim it.
    if (mine) {
      if (mine.left_at) {
        const { error: e } = await db
          .from('table_seats')
          .update({ left_at: null, nickname })
          .eq('table_id', table.id)
          .eq('seat', mine.seat)
        if (e) throw e
        await touchTable(db, table.id)
      }
      return { tableId: table.id, code: table.code, seat: mine.seat }
    }

    const target = seats.find((s) => s.seat === seatNo)
    if (table.status === 'waiting') {
      if (target) throw new ApiError(seats.length >= 4 ? 'TABLE_FULL' : 'SEAT_TAKEN')
      const { error: e } = await db
        .from('table_seats')
        .insert({ table_id: table.id, seat: seatNo, player_id: user.id, nickname })
      if (e?.code === '23505') throw new ApiError('SEAT_TAKEN')
      if (e) throw e
    } else {
      // Game in progress: only seats vacated by a leaving player can be taken over.
      if (!target || !target.left_at) {
        throw new ApiError(seats.every((s) => !s.left_at) ? 'TABLE_FULL' : 'SEAT_TAKEN')
      }
      const { data: updated, error: e } = await db
        .from('table_seats')
        .update({ player_id: user.id, nickname, left_at: null, joined_at: new Date().toISOString() })
        .eq('table_id', table.id)
        .eq('seat', seatNo)
        .not('left_at', 'is', null)
        .select('seat')
      if (e) throw e
      if (!updated?.length) throw new ApiError('SEAT_TAKEN')
      await db.from('game_hands').update({ player_id: user.id }).eq('table_id', table.id).eq('seat', seatNo)
    }

    await touchTable(db, table.id)
    return { tableId: table.id, code: table.code, seat: seatNo }
  }),
)
