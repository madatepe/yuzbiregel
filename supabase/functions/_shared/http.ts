import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { GameError } from './engine/index.ts'

export type ApiErrorCode =
  | 'UNAUTHORIZED'
  | 'BAD_REQUEST'
  | 'TABLE_NOT_FOUND'
  | 'TABLE_CLOSED'
  | 'TABLE_FULL'
  | 'SEAT_TAKEN'
  | 'NOT_SEATED'
  | 'NOT_OWNER'
  | 'NEED_4_PLAYERS'
  | 'BAD_STATE'
  | 'CONFLICT'
  | 'INTERNAL'

export class ApiError extends Error {
  code: string
  status: number
  constructor(code: ApiErrorCode, status = 400) {
    super(code)
    this.code = code
    this.status = status
  }
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-region, x-supabase-api-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

// Module-level so the JWKS cache survives across requests in a warm isolate.
const db: SupabaseClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
})

export interface Ctx {
  db: SupabaseClient
  user: { id: string }
  body: Record<string, unknown>
}

/** Wraps a handler with CORS, auth and error translation. */
export function handler(fn: (ctx: Ctx) => Promise<unknown>) {
  return async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
    try {
      const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
      if (!token) throw new ApiError('UNAUTHORIZED', 401)
      const [{ data, error }, body] = await Promise.all([
        db.auth.getClaims(token),
        req.json().catch(() => ({})) as Promise<Record<string, unknown>>,
      ])
      const sub = data?.claims?.sub
      if (error || !sub || data.claims.role !== 'authenticated') throw new ApiError('UNAUTHORIZED', 401)
      const result = await fn({ db, user: { id: sub }, body })
      return json(result ?? { ok: true })
    } catch (err) {
      if (err instanceof ApiError) return json({ error: { code: err.code } }, err.status)
      if (err instanceof GameError) return json({ error: { code: err.code } }, 400)
      const message = err instanceof Error ? err.message : String(err)
      if (message.includes('VERSION_CONFLICT')) return json({ error: { code: 'CONFLICT' } }, 409)
      console.error(err)
      return json({ error: { code: 'INTERNAL' } }, 500)
    }
  }
}

export function str(value: unknown): string {
  const s = typeof value === 'string' ? value.trim() : ''
  if (!s) throw new ApiError('BAD_REQUEST')
  return s
}

export function cleanNickname(value: unknown): string {
  const nick = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, 16) : ''
  if (nick.length < 2) throw new ApiError('BAD_REQUEST')
  return nick
}
