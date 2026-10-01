import { create } from 'zustand'
import type { GameEvent, PublicRoundState, TileId } from '@engine/index.ts'
import type { ConnectionState, ScoreRow, SeatRow, TableRow } from '@/lib/types'

/** Mirror of server state for the current table. Written only by the realtime controller. */
export interface TableStore {
  tableId: string | null
  table: TableRow | null
  seats: SeatRow[]
  scores: ScoreRow[]
  online: Record<string, true>
  connection: ConnectionState
  loaded: boolean
  missing: boolean

  pub: PublicRoundState | null
  version: number
  events: GameEvent[]
  /** Increments whenever a new batch of events arrives. */
  eventSeq: number

  hand: TileId[]
  handVersion: number
}

export const initialTableState: TableStore = {
  tableId: null,
  table: null,
  seats: [],
  scores: [],
  online: {},
  connection: 'connecting',
  loaded: false,
  missing: false,
  pub: null,
  version: 0,
  events: [],
  eventSeq: 0,
  hand: [],
  handVersion: 0,
}

export const useTable = create<TableStore>(() => ({ ...initialTableState }))

export function mySeatOf(seats: SeatRow[], userId: string | null): SeatRow | null {
  return seats.find((s) => s.player_id === userId && !s.left_at) ?? null
}
