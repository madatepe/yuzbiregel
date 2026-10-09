import { FunctionsFetchError, FunctionsHttpError, type FunctionRegion } from '@supabase/supabase-js'
import type { GameAction } from '@engine/index.ts'
import type { PistiAction } from '@pisti/index.ts'
import type { GameKind } from '@/lib/gameKind'
import { AppError } from './errors'
import { supabase } from './supabase'

/** Run functions next to the database; every move makes several DB round trips. */
const region = (import.meta.env.VITE_SUPABASE_FUNCTIONS_REGION as FunctionRegion | undefined) || undefined

async function call<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body, region })
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const payload = await error.context.json().catch(() => null)
      throw new AppError(payload?.error?.code ?? payload?.code ?? 'INTERNAL')
    }
    if (error instanceof FunctionsFetchError) throw new AppError('NETWORK')
    throw new AppError('INTERNAL')
  }
  const fail = (data as { error?: { code?: string } } | null)?.error?.code
  if (fail) throw new AppError(fail)
  return data as T
}

export interface JoinResult {
  tableId: string
  code: string
  seat: number
}

export const api = {
  createTable: (p: { nickname: string; mode?: 'solo' | 'team'; rounds?: number; gameType?: GameKind }) =>
    call<JoinResult>('create-table', p),
  joinTable: (p: { code: string; seat: number; nickname: string }) => call<JoinResult>('join-table', p),
  leaveTable: (tableId: string) => call('leave-table', { tableId }),
  startGame: (tableId: string) => call('start-game', { tableId }),
  action: (tableId: string, action: GameAction | PistiAction) =>
    call<{ version: number }>('game-action', { tableId, action }),
  nextRound: (tableId: string) => call('next-round', { tableId }),
  restartGame: (tableId: string) => call('restart-game', { tableId }),
  closeTable: (tableId: string) => call('close-table', { tableId }),
}
