import { ApiError, cleanNickname, handler } from '../_shared/http.ts'
import {
  advancePistiBots,
  createPistiBotUsers,
  generateCode,
  loadSeats,
  loadTable,
  startRound,
  sweepTables,
} from '../_shared/tables.ts'
import { randomInt } from '../_shared/engine/index.ts'

Deno.serve(
  handler(async ({ db, user, body }) => {
    const nickname = cleanNickname(body.nickname)
    const gameType = body.gameType === 'pisti' ? 'pisti' : 'okey101'
    let mode = body.mode
    let rounds = Number(body.rounds)
    if (gameType === 'pisti') {
      mode = mode === 'solo' ? 'solo' : 'team'
      rounds = 1
    } else {
      if (mode !== 'solo' && mode !== 'team') throw new ApiError('BAD_REQUEST')
      if (![1, 6, 11].includes(rounds)) throw new ApiError('BAD_REQUEST')
    }

    await db.from('profiles').upsert({ id: user.id, nickname, updated_at: new Date().toISOString() })
    await sweepTables(db)

    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generateCode()
      const { data, error } = await db
        .from('game_tables')
        .insert({ code, owner_id: user.id, mode, total_rounds: rounds, game_type: gameType })
        .select('id, code')
        .single()
      if (error?.code === '23505') continue
      if (error?.message?.includes('game_type') || error?.code === 'PGRST204') throw new ApiError('SCHEMA_REQUIRED')
      if (error) throw error
      const { error: seatError } = await db
        .from('table_seats')
        .insert({ table_id: data.id, seat: 0, player_id: user.id, nickname })
      if (seatError) throw seatError

      if (gameType === 'pisti' && mode === 'solo') {
        const bots = await createPistiBotUsers(db)
        const rows = bots.map((b) => ({
          table_id: data.id,
          seat: b.seat,
          player_id: b.player_id,
          nickname: b.nickname,
          is_bot: true,
        }))
        const botInsert = await db.from('table_seats').insert(rows)
        if (botInsert.error?.message?.includes('is_bot') || botInsert.error?.code === 'PGRST204') {
          const { error: retry } = await db.from('table_seats').insert(
            bots.map((b) => ({
              table_id: data.id,
              seat: b.seat,
              player_id: b.player_id,
              nickname: b.nickname,
            })),
          )
          if (retry) throw retry
        } else if (botInsert.error) {
          throw botInsert.error
        }
        const table = await loadTable(db, data.id)
        const seats = await loadSeats(db, data.id)
        await startRound(db, table, seats, table.game_no, 1, randomInt(4), 'waiting')
        await advancePistiBots(db, table.id, seats)
      }

      return { tableId: data.id, code: data.code, seat: 0 }
    }
    throw new ApiError('INTERNAL', 500)
  }),
)
