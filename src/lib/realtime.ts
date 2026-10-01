import type { RealtimeChannel } from '@supabase/supabase-js'
import type { GameEvent, PublicRoundState, TileId } from '@engine/index.ts'
import { supabase } from './supabase'
import type { ScoreRow, SeatRow, TableRow } from './types'
import { initialTableState, useTable } from '@/stores/table'
import { toast } from '@/stores/toast'

interface PublicRow {
  table_id: string
  state: PublicRoundState
  last_events: GameEvent[]
  version: number
}

interface HandRow {
  table_id: string
  seat: number
  player_id: string
  tiles: TileId[]
  version: number
}

const set = useTable.setState
const get = useTable.getState

function applyTable(row: TableRow) {
  const prev = get().table
  if (prev && prev.owner_id !== row.owner_id && row.status !== 'closed') toast('Masa sahibi değişti.', 'info')
  set({ table: row })
  return prev
}

function applyPublic(row: PublicRow | null) {
  if (!row) return
  const { version } = get()
  if (row.version < version) return
  if (row.version === version && get().pub) return
  set((s) => ({
    pub: row.state,
    version: row.version,
    events: row.last_events ?? [],
    eventSeq: s.eventSeq + 1,
  }))
}

function applyHand(row: HandRow | null, userId: string) {
  if (!row || row.player_id !== userId) return
  if (row.version < get().handVersion) return
  set({ hand: row.tiles ?? [], handVersion: row.version })
}

async function fetchSeats(tableId: string) {
  const { data } = await supabase.from('table_seats').select('*').eq('table_id', tableId).order('seat')
  if (get().tableId === tableId && data) set({ seats: data as SeatRow[] })
}

async function fetchScores(tableId: string, gameNo: number) {
  const { data } = await supabase
    .from('round_scores')
    .select('*')
    .eq('table_id', tableId)
    .eq('game_no', gameNo)
    .order('round')
  if (get().tableId === tableId && data) set({ scores: data as ScoreRow[] })
}

/** Returns false when the snapshot could not be read (e.g. network down). */
async function fetchAll(tableId: string, userId: string): Promise<boolean> {
  const [tableRes, pubRes, handRes, seatsRes] = await Promise.all([
    supabase.from('game_tables').select('*').eq('id', tableId).maybeSingle(),
    supabase.from('game_public').select('*').eq('table_id', tableId).maybeSingle(),
    supabase.from('game_hands').select('*').eq('table_id', tableId).eq('player_id', userId).maybeSingle(),
    supabase.from('table_seats').select('*').eq('table_id', tableId).order('seat'),
  ])
  if (get().tableId !== tableId) return true
  if (tableRes.error || pubRes.error || handRes.error || seatsRes.error) return false
  if (!tableRes.data) {
    set({ missing: true, loaded: true })
    return true
  }
  const table = tableRes.data as TableRow
  set({ table, seats: seatsRes.data as SeatRow[] })
  await fetchScores(tableId, table.game_no)
  // Force-accept the snapshot (it is the latest server truth after a reconnect).
  if (pubRes.data) {
    const row = pubRes.data as PublicRow
    set((s) => ({
      pub: row.state,
      version: row.version,
      events: s.version === row.version ? s.events : [],
      eventSeq: s.version === row.version ? s.eventSeq : s.eventSeq + 1,
    }))
  }
  if (handRes.data) {
    const h = handRes.data as HandRow
    set({ hand: h.tiles ?? [], handVersion: h.version })
  } else {
    set({ hand: [], handVersion: 0 })
  }
  set({ loaded: true })
  return true
}

/** Subscribes to every realtime stream of a table. Returns a cleanup function. */
export function connectTable(tableId: string, userId: string): () => void {
  set({ ...initialTableState, tableId, connection: 'connecting' })
  currentUser = userId
  let wasDisconnected = false
  let disposed = false
  let channel: RealtimeChannel | null = null
  let retryTimer: ReturnType<typeof setTimeout> | undefined

  const load = async () => {
    clearTimeout(retryTimer)
    const ok = await fetchAll(tableId, userId)
    if (!ok && !disposed) retryTimer = setTimeout(load, 2500)
    return ok
  }
  void load()

  const filter = `table_id=eq.${tableId}`
  channel = supabase
    .channel(`table:${tableId}`, { config: { presence: { key: userId } } })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'game_tables', filter: `id=eq.${tableId}` }, (p) => {
      const row = p.new as TableRow
      const prev = applyTable(row)
      void fetchSeats(tableId)
      if (!prev || prev.game_no !== row.game_no) void fetchScores(tableId, row.game_no)
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'table_seats', filter }, () => {
      void fetchSeats(tableId)
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'game_public', filter }, (p) => {
      applyPublic(p.new as PublicRow)
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'game_hands', filter }, (p) => {
      applyHand(p.new as HandRow, userId)
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'round_scores', filter }, (p) => {
      const row = p.new as ScoreRow
      const table = get().table
      if (table && row.game_no !== table.game_no) return
      set((s) =>
        s.scores.some((x) => x.round === row.round && x.seat === row.seat && x.game_no === row.game_no)
          ? s
          : { scores: [...s.scores, row] },
      )
    })
    .on('presence', { event: 'sync' }, () => {
      const state = channel!.presenceState()
      const online: Record<string, true> = {}
      for (const key of Object.keys(state)) online[key] = true
      set({ online })
    })
    .subscribe(async (status) => {
      if (disposed) return
      if (status === 'SUBSCRIBED') {
        await channel!.track({ user_id: userId, at: Date.now() })
        if (wasDisconnected) {
          wasDisconnected = false
          await load()
          toast('Bağlantı yeniden kuruldu.', 'success')
        }
        set({ connection: 'connected' })
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        wasDisconnected = true
        set({ connection: 'reconnecting' })
      }
    })

  const onOffline = () => {
    wasDisconnected = true
    set({ connection: 'reconnecting' })
  }
  // The socket may survive a short offline blip, in which case SUBSCRIBED never fires again.
  const onOnline = async () => {
    const ok = await load()
    if (!ok || disposed || channel?.state !== 'joined' || !wasDisconnected) return
    wasDisconnected = false
    set({ connection: 'connected' })
    toast('Bağlantı yeniden kuruldu.', 'success')
  }
  const onVisible = () => {
    if (document.visibilityState === 'visible') void load()
  }
  window.addEventListener('offline', onOffline)
  window.addEventListener('online', onOnline)
  document.addEventListener('visibilitychange', onVisible)

  return () => {
    disposed = true
    clearTimeout(retryTimer)
    window.removeEventListener('offline', onOffline)
    window.removeEventListener('online', onOnline)
    document.removeEventListener('visibilitychange', onVisible)
    if (channel) void supabase.removeChannel(channel)
    set({ ...initialTableState })
  }
}

let currentUser: string | null = null

/** Re-reads the full snapshot, e.g. after a rejected move. */
export function resyncTable() {
  const { tableId } = get()
  if (tableId && currentUser) void fetchAll(tableId, currentUser)
}
