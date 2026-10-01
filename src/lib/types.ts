import type { GameMode } from '@engine/index.ts'

export type TableStatus = 'waiting' | 'playing' | 'round_end' | 'finished' | 'closed'

export interface TableRow {
  id: string
  code: string
  owner_id: string
  mode: GameMode
  total_rounds: number
  status: TableStatus
  game_no: number
  current_round: number
  updated_at: string
}

export interface SeatRow {
  table_id: string
  seat: number
  player_id: string
  nickname: string
  left_at: string | null
  joined_at: string
}

export interface ScoreRow {
  table_id: string
  game_no: number
  round: number
  seat: number
  nickname: string
  score: number
  hand_score: number
  penalty: number
}

export type ConnectionState = 'connecting' | 'connected' | 'reconnecting'
