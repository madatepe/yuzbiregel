import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useSession } from '@/stores/session'
import { LOCAL_PISTI_ID } from '@/lib/pistiLocal'
import { mySeatOf, useTable } from '@/stores/table'
import type { ScoreRow } from '@/lib/types'

export type SeatSide = 'bottom' | 'right' | 'top' | 'left'
export const SIDES: SeatSide[] = ['bottom', 'right', 'top', 'left']

export function sideOf(seat: number, mySeat: number): SeatSide {
  return SIDES[(seat - mySeat + 4) % 4]
}

export function useMySeat(): number {
  const userId = useSession((s) => s.userId)
  return useTable((s) => (s.tableId === LOCAL_PISTI_ID ? 0 : mySeatOf(s.seats, userId)?.seat ?? 0))
}

export function totalsFrom(scores: ScoreRow[]): number[] {
  const totals = [0, 0, 0, 0]
  for (const r of scores) totals[r.seat] += r.score
  return totals
}

export function useTotals(): number[] {
  const scores = useTable((s) => s.scores)
  return useMemo(() => totalsFrom(scores), [scores])
}

export interface SeatInfo {
  seat: number
  nickname: string
  playerId: string | null
  left: boolean
  online: boolean
  isOwner: boolean
  isBot: boolean
}

export function useSeatInfos(): SeatInfo[] {
  const { seats, online, ownerId } = useTable(
    useShallow((s) => ({ seats: s.seats, online: s.online, ownerId: s.table?.owner_id })),
  )
  return useMemo(
    () =>
      [0, 1, 2, 3].map((i) => {
        const row = seats.find((x) => x.seat === i)
        const isBot = !!row?.is_bot || !!row?.nickname?.startsWith('Bot ')
        return {
          seat: i,
          nickname: row?.nickname ?? `Oyuncu ${i + 1}`,
          playerId: row?.player_id ?? null,
          left: !row || !!row.left_at,
          online: isBot || (!!row && !row.left_at && !!row.player_id && !!online[row.player_id]),
          isOwner: !!row && !!row.player_id && row.player_id === ownerId,
          isBot,
        }
      }),
    [seats, online, ownerId],
  )
}
