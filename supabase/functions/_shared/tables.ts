import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { createRound, toPublic, type GameMode, type RoundState } from './engine/index.ts'
import {
  allHandPayloads,
  createDeal,
  handPayload,
  isPistiState,
  playBots,
  TARGET_SCORE,
  toPublic as toPistiPublic,
  type PistiState,
} from './pisti/index.ts'
import { ApiError } from './http.ts'

export type GameKind = 'okey101' | 'pisti'

export interface TableRow {
  id: string
  code: string
  owner_id: string
  mode: GameMode
  total_rounds: number
  status: 'waiting' | 'playing' | 'round_end' | 'finished' | 'closed'
  game_no: number
  current_round: number
  game_type: GameKind
}

export interface SeatRow {
  table_id: string
  seat: number
  player_id: string | null
  nickname: string
  left_at: string | null
  is_bot?: boolean
}

export const PISTI_BOT_NAMES = ['Bot Ada', 'Bot Cem', 'Bot Ege'] as const

export function isBotSeat(s: SeatRow): boolean {
  return s.is_bot === true || s.nickname.startsWith('Bot ')
}

export function botSeatSet(seats: SeatRow[]): Set<number> {
  return new Set(seats.filter(isBotSeat).map((s) => s.seat))
}

export async function createPistiBotUsers(
  db: SupabaseClient,
): Promise<{ seat: number; player_id: string; nickname: string }[]> {
  const bots: { seat: number; player_id: string; nickname: string }[] = []
  for (let i = 0; i < PISTI_BOT_NAMES.length; i++) {
    const nickname = PISTI_BOT_NAMES[i]!
    const email = `${crypto.randomUUID()}@pisti.bot`
    const { data, error } = await db.auth.admin.createUser({
      email,
      password: `${crypto.randomUUID()}Aa1!`,
      email_confirm: true,
      user_metadata: { bot: true, nickname },
    })
    if (error || !data.user) throw error ?? new Error('BOT_USER')
    bots.push({ seat: i + 1, player_id: data.user.id, nickname })
  }
  return bots
}

export function pistiFinishPatch(state: PistiState, seats: SeatRow[]) {
  if (state.status !== 'finished' || !state.result) return { tableStatus: null as string | null, scores: null as unknown }
  const gameOver =
    state.result.winner !== null || state.teamScores[0] >= TARGET_SCORE || state.teamScores[1] >= TARGET_SCORE
  return {
    tableStatus: gameOver ? 'finished' : 'round_end',
    scores: seats.map((s) => ({
      seat: s.seat,
      nickname: s.nickname,
      score: state.result!.dealScores[s.seat % 2],
      hand_score: state.result!.cardPoints[s.seat % 2],
      penalty: state.result!.pistiPoints[s.seat % 2],
    })),
  }
}

/** After a deal starts or a human moves, bots play until the human is on turn. */
export async function advancePistiBots(db: SupabaseClient, tableId: string, seats: SeatRow[]) {
  const bots = botSeatSet(seats)
  if (!bots.size) return
  const { data: secret, error } = await db.from('game_secret').select('state, version').eq('table_id', tableId).single()
  if (error || !secret || !isPistiState(secret.state)) return
  const { state, events } = playBots(secret.state, bots)
  if (!events.length) return
  const { tableStatus, scores } = pistiFinishPatch(state, seats)
  const { error: commitError } = await db.rpc('commit_move', {
    p_table: tableId,
    p_expected: secret.version,
    p_secret: state,
    p_public: toPistiPublic(state),
    p_events: events,
    p_hands: allHandPayloads(state),
    p_table_status: tableStatus,
    p_scores: scores,
  })
  if (commitError) throw new Error(commitError.message)
}

export async function loadTable(db: SupabaseClient, tableId: string): Promise<TableRow> {
  const { data, error } = await db.from('game_tables').select('*').eq('id', tableId).maybeSingle()
  if (error) throw error
  if (!data) throw new ApiError('TABLE_NOT_FOUND', 404)
  if (data.status === 'closed') throw new ApiError('TABLE_CLOSED')
  return data as TableRow
}

export async function loadSeats(db: SupabaseClient, tableId: string): Promise<SeatRow[]> {
  const { data, error } = await db.from('table_seats').select('*').eq('table_id', tableId).order('seat')
  if (error) throw error
  return (data ?? []) as SeatRow[]
}

export function activeSeatOf(seats: SeatRow[], userId: string): SeatRow {
  const seat = seats.find((s) => s.player_id === userId && !s.left_at)
  if (!seat) throw new ApiError('NOT_SEATED', 403)
  return seat
}

export async function touchTable(db: SupabaseClient, tableId: string, patch: Record<string, unknown> = {}) {
  const { error } = await db
    .from('game_tables')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', tableId)
  if (error) throw error
}

/** Seats, hands, game state and scores are removed by `on delete cascade`. */
export async function deleteTable(db: SupabaseClient, tableId: string) {
  const { error } = await db.from('game_tables').delete().eq('id', tableId)
  if (error) throw error
}

/**
 * Removes tables closed by their owner (kept briefly so connected players see the
 * close) and tables nobody has touched for a day (e.g. everyone just closed the tab).
 */
export async function sweepTables(db: SupabaseClient) {
  const closedBefore = new Date(Date.now() - 10 * 60_000).toISOString()
  const idleBefore = new Date(Date.now() - 24 * 3600_000).toISOString()
  const { error } = await db
    .from('game_tables')
    .delete()
    .or(`and(status.eq.closed,updated_at.lt.${closedBefore}),updated_at.lt.${idleBefore}`)
  if (error) console.error('sweepTables', error)
}

export async function startRound(
  db: SupabaseClient,
  table: TableRow,
  seats: SeatRow[],
  gameNo: number,
  round: number,
  starter: number,
  fromStatus: 'waiting' | 'round_end',
  pistiScores: [number, number] = [0, 0],
) {
  const isPisti = table.game_type === 'pisti'
  const state = isPisti ? createDeal(round, starter, pistiScores) : createRound(round, starter, table.mode)
  const hands = isPisti
    ? seats.map((s) => ({ seat: s.seat, player_id: s.player_id, tiles: handPayload(state as PistiState, s.seat) }))
    : seats.map((s) => ({ seat: s.seat, player_id: s.player_id, tiles: (state as RoundState).hands[s.seat] }))
  const events = isPisti
    ? [{ type: 'DEAL_STARTED', seat: starter, at: Date.now() }]
    : [{ type: 'ROUND_STARTED', seat: starter, at: Date.now() }]
  const { error } = await db.rpc('init_round', {
    p_table: table.id,
    p_game_no: gameNo,
    p_round: round,
    p_secret: state,
    p_public: isPisti ? toPistiPublic(state as PistiState) : toPublic(state as RoundState),
    p_events: events,
    p_hands: hands,
    p_from_status: fromStatus,
  })
  if (error?.message?.includes('BAD_STATE')) throw new ApiError('BAD_STATE')
  if (error) throw error
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function generateCode(): string {
  const buf = new Uint32Array(6)
  crypto.getRandomValues(buf)
  return Array.from(buf, (n) => CODE_ALPHABET[n % CODE_ALPHABET.length]).join('')
}
