// End-to-end smoke test against the linked Supabase project.
// Usage: node --env-file=.env.local scripts/smoke.mjs
import { createClient } from '@supabase/supabase-js'

const url = process.env.VITE_SUPABASE_URL
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY
const names = ['Mert', 'Ahmet', 'Ali', 'Ayşe']

const assert = (cond, msg) => {
  if (!cond) throw new Error(`ASSERT: ${msg}`)
  console.log(`  ✓ ${msg}`)
}

async function call(client, name, body) {
  const { data, error } = await client.functions.invoke(name, { body, region: process.env.VITE_SUPABASE_FUNCTIONS_REGION })
  if (error) {
    const payload = await error.context?.json?.().catch(() => null)
    return { error: payload?.error?.code ?? error.message }
  }
  return { data }
}

const players = []
for (const n of names) {
  const c = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data, error } = await c.auth.signInAnonymously()
  if (error) throw error
  players.push({ name: n, c, id: data.user.id })
}
console.log('signed in 4 anonymous users')

const created = await call(players[0].c, 'create-table', { nickname: 'Mert', mode: 'team', rounds: 1 })
assert(created.data?.code?.length === 6, `table created ${created.data?.code}`)
const { code, tableId } = created.data

const startEarly = await call(players[0].c, 'start-game', { tableId })
assert(startEarly.error === 'NEED_4_PLAYERS', 'cannot start with 1 player')

const taken = await call(players[1].c, 'join-table', { code, seat: 0, nickname: 'Ahmet' })
assert(taken.error === 'SEAT_TAKEN', 'occupied seat rejected')

for (let i = 1; i < 4; i++) {
  const r = await call(players[i].c, 'join-table', { code, seat: i, nickname: names[i] })
  assert(r.data?.seat === i, `${names[i]} joined seat ${i}`)
}

const notOwner = await call(players[1].c, 'start-game', { tableId })
assert(notOwner.error === 'NOT_OWNER', 'only owner can start')

// Realtime listener for player 2
let rtEvents = 0
const ch = players[1].c
  .channel(`table:${tableId}`)
  .on('postgres_changes', { event: '*', schema: 'public', table: 'game_public', filter: `table_id=eq.${tableId}` }, () => rtEvents++)
await new Promise((res) => ch.subscribe((s) => s === 'SUBSCRIBED' && res()))

const started = await call(players[0].c, 'start-game', { tableId })
assert(!started.error, 'game started')

const pubRes = await players[2].c.from('game_public').select('*').eq('table_id', tableId).single()
assert(pubRes.data?.state?.deckCount === 20, 'public state has 20 tiles in deck')

const ownHands = await players[1].c.from('game_hands').select('seat').eq('table_id', tableId)
assert(ownHands.data?.length === 1 && ownHands.data[0].seat === 1, 'RLS: player sees only own hand')
const secret = await players[1].c.from('game_secret').select('*').eq('table_id', tableId)
assert((secret.data ?? []).length === 0, 'RLS: secret state hidden')

async function state() {
  const { data } = await players[0].c.from('game_public').select('state, version').eq('table_id', tableId).single()
  return data
}
async function handOf(p) {
  const { data } = await p.c.from('game_hands').select('tiles').eq('table_id', tableId).single()
  return data.tiles
}

let s = await state()
const starter = s.state.turn
const wrong = players[(starter + 1) % 4]
const wrongRes = await call(wrong.c, 'game-action', { tableId, action: { type: 'discard', tile: (await handOf(wrong))[0] } })
assert(wrongRes.error === 'NOT_YOUR_TURN', 'out-of-turn move rejected')

const p0 = players[starter]
const bad101 = await call(p0.c, 'game-action', { tableId, action: { type: 'open_series', tiles: (await handOf(p0)).slice(0, 3) } })
assert(['INVALID_MELD', 'NEED_101'].includes(bad101.error), `invalid opening rejected (${bad101.error})`)

let moves = 0
while (moves < 80) {
  s = await state()
  const t = await players[0].c.from('game_tables').select('status').eq('id', tableId).single()
  if (t.data.status !== 'playing') break
  const p = players[s.state.turn]
  const action = s.state.phase === 'draw' ? { type: 'draw_deck' } : { type: 'discard', tile: (await handOf(p))[0] }
  const r = await call(p.c, 'game-action', { tableId, action })
  if (r.error) throw new Error(`move failed: ${r.error}`)
  moves++
}
s = await state()
const t = await players[0].c.from('game_tables').select('status').eq('id', tableId).single()
assert(t.data.status === 'finished', `round ended after ${moves} moves, table finished`)
assert(s.state.result?.reason === 'deck_empty' || s.state.result?.reason === 'finish', `result reason ${s.state.result?.reason}`)
const scores = await players[3].c.from('round_scores').select('*').eq('table_id', tableId)
assert(scores.data?.length === 4, 'round scores written for 4 seats')

await new Promise((r) => setTimeout(r, 1500))
assert(rtEvents >= moves, `realtime delivered ${rtEvents} game_public changes`)

const restart = await call(players[0].c, 'restart-game', { tableId })
assert(!restart.error, 'owner restarted -> waiting room')

const leave = await call(players[0].c, 'leave-table', { tableId })
assert(!leave.error, 'owner left')
const after = await players[1].c.from('game_tables').select('owner_id').eq('id', tableId).single()
assert(after.data.owner_id !== players[0].id, 'ownership transferred to another player')

const newOwner = players.find((p) => p.id === after.data.owner_id)
const close = await call(newOwner.c, 'close-table', { tableId })
assert(!close.error, 'new owner closed the table')
const joinClosed = await call(players[0].c, 'join-table', { code, seat: 0, nickname: 'Mert' })
assert(joinClosed.error === 'TABLE_CLOSED', 'closed table cannot be joined')

await players[1].c.removeChannel(ch)
console.log('\nSMOKE TEST PASSED')
process.exit(0)
