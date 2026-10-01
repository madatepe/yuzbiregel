import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { createRound, toPublic, type GameMode, type RoundState } from './engine/index.ts'
import { ApiError } from './http.ts'

export interface TableRow {
  id: string
  code: string
  owner_id: string
  mode: GameMode
  total_rounds: number
  status: 'waiting' | 'playing' | 'round_end' | 'finished' | 'closed'
  game_no: number
  current_round: number
}

export interface SeatRow {
  table_id: string
  seat: number
  player_id: string
  nickname: string
  left_at: string | null
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

export async function startRound(
  db: SupabaseClient,
  table: TableRow,
  seats: SeatRow[],
  gameNo: number,
  round: number,
  starter: number,
  fromStatus: 'waiting' | 'round_end',
) {
  const state: RoundState = createRound(round, starter, table.mode)
  const hands = seats.map((s) => ({ seat: s.seat, player_id: s.player_id, tiles: state.hands[s.seat] }))
  const events = [{ type: 'ROUND_STARTED', seat: starter, at: Date.now() }]
  const { error } = await db.rpc('init_round', {
    p_table: table.id,
    p_game_no: gameNo,
    p_round: round,
    p_secret: state,
    p_public: toPublic(state),
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
