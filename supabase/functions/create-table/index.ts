import { ApiError, cleanNickname, handler } from '../_shared/http.ts'
import { generateCode, sweepTables } from '../_shared/tables.ts'

Deno.serve(
  handler(async ({ db, user, body }) => {
    const nickname = cleanNickname(body.nickname)
    const mode = body.mode
    const rounds = Number(body.rounds)
    if (mode !== 'solo' && mode !== 'team') throw new ApiError('BAD_REQUEST')
    if (![1, 6, 11].includes(rounds)) throw new ApiError('BAD_REQUEST')

    await db.from('profiles').upsert({ id: user.id, nickname, updated_at: new Date().toISOString() })
    await sweepTables(db)

    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generateCode()
      const { data, error } = await db
        .from('game_tables')
        .insert({ code, owner_id: user.id, mode, total_rounds: rounds })
        .select('id, code')
        .single()
      if (error?.code === '23505') continue
      if (error) throw error
      const { error: seatError } = await db
        .from('table_seats')
        .insert({ table_id: data.id, seat: 0, player_id: user.id, nickname })
      if (seatError) throw seatError
      return { tableId: data.id, code: data.code, seat: 0 }
    }
    throw new ApiError('INTERNAL', 500)
  }),
)
