// Dev-only helper: seats three real anonymous test users at a table and lets them
// play simple moves on their turn (draw, open/lay/attach when possible, discard),
// so the UI can be tested alone.
// Usage: node --env-file=.env.local scripts/sim-players.mjs <CODE> [seats=1,2,3] [delayMs=1200]
import { createClient } from '@supabase/supabase-js'
import { analyzeMeld, attachableMelds, isJoker, resolveTile } from '../supabase/functions/_shared/engine/index.ts'

/** Valid joker-free melds that can be formed from the hand. */
function candidateMelds(hand, okey) {
  const byFace = new Map()
  for (const id of hand) {
    if (isJoker(id, okey)) continue
    const r = resolveTile(id, okey)
    const key = `${r.color}:${r.value}`
    if (!byFace.has(key)) byFace.set(key, [])
    byFace.get(key).push(id)
  }
  const pick = (color, value) => byFace.get(`${color}:${value === 14 ? 1 : value}`)?.[0]
  const out = []
  for (const color of ['red', 'blue', 'yellow', 'black']) {
    for (let start = 1; start <= 12; start++) {
      const ids = []
      for (let v = start; v <= 14; v++) {
        const id = pick(color, v)
        if (id === undefined) break
        ids.push(id)
        if (ids.length >= 3) out.push([...ids])
      }
    }
  }
  for (let v = 1; v <= 13; v++) {
    const ids = ['red', 'blue', 'yellow', 'black'].map((c) => pick(c, v)).filter((x) => x !== undefined)
    if (ids.length >= 3) {
      out.push(ids)
      if (ids.length === 4) for (let skip = 0; skip < 4; skip++) out.push(ids.filter((_, i) => i !== skip))
    }
  }
  return out
    .map((ids) => ({ ids, a: analyzeMeld(ids, okey) }))
    .filter((m) => m.a)
    .map((m) => ({ ids: m.ids, points: m.a.points }))
}

/** Best disjoint combination of melds, keeping at least one tile for the discard. */
function bestMelds(hand, okey) {
  const cands = candidateMelds(hand, okey).sort((a, b) => b.points - a.points).slice(0, 40)
  let best = { points: 0, melds: [] }
  let steps = 0
  const walk = (i, used, points, melds) => {
    if (++steps > 20000) return
    if (points > best.points && used.size < hand.length) best = { points, melds: [...melds] }
    for (let j = i; j < cands.length; j++) {
      const c = cands[j]
      if (c.ids.some((id) => used.has(id))) continue
      c.ids.forEach((id) => used.add(id))
      melds.push(c.ids)
      walk(j + 1, used, points + c.points, melds)
      melds.pop()
      c.ids.forEach((id) => used.delete(id))
    }
  }
  walk(0, new Set(), 0, [])
  return best
}

const [code, seatsArg = '1,2,3', delayArg = '1200'] = process.argv.slice(2)
if (!code) throw new Error('table code required')
const seats = seatsArg.split(',').map(Number)
const delay = Number(delayArg)
const region = process.env.VITE_SUPABASE_FUNCTIONS_REGION
const names = { 0: 'Deniz', 1: 'Ahmet', 2: 'Ali', 3: 'Ayşe' }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function call(c, name, body) {
  const { data, error } = await c.functions.invoke(name, { body, region })
  if (error) {
    const payload = await error.context?.json?.().catch(() => null)
    return { error: payload?.error?.code ?? error.message }
  }
  return { data }
}

const players = []
for (const seat of seats) {
  const c = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false },
  })
  const { data } = await c.auth.signInAnonymously()
  const r = await call(c, 'join-table', { code, seat, nickname: names[seat] })
  if (r.error) throw new Error(`join ${seat}: ${r.error}`)
  const tableId = r.data.tableId
  const ch = c.channel(`table:${tableId}`, { config: { presence: { key: data.user.id } } })
  await new Promise((res) => ch.subscribe(async (s) => s === 'SUBSCRIBED' && (await ch.track({ user_id: data.user.id }), res())))
  players.push({ seat, c, tableId })
  console.log(`${names[seat]} joined seat ${seat}`)
}

const tableId = players[0].tableId
let busy = false
async function tick() {
  if (busy) return
  busy = true
  try {
    const { data: t } = await players[0].c.from('game_tables').select('status').eq('id', tableId).single()
    if (!t || t.status === 'closed') process.exit(0)
    if (t.status === 'round_end') {
      await call(players[0].c, 'next-round', { tableId })
      return
    }
    if (t.status !== 'playing') return
    const { data: pub } = await players[0].c.from('game_public').select('state').eq('table_id', tableId).single()
    const p = players.find((x) => x.seat === pub.state.turn)
    if (!p) return
    await sleep(delay)
    if (pub.state.phase === 'draw') {
      await call(p.c, 'game-action', { tableId, action: { type: 'draw_deck' } })
      await sleep(delay)
    }
    const act = (action) => call(p.c, 'game-action', { tableId, action })
    const loadHand = async () =>
      (await p.c.from('game_hands').select('tiles').eq('table_id', tableId).single()).data.tiles
    const loadPub = async () =>
      (await p.c.from('game_public').select('state').eq('table_id', tableId).single()).data.state
    let hand = await loadHand()
    let state = await loadPub()
    const okey = state.okey

    const best = bestMelds(hand, okey)
    if (!state.opened[p.seat] && best.points >= 101) {
      const r = await act({ type: 'open_series', tiles: best.melds.flat() })
      console.log(`${names[p.seat]} opens ${best.points}: ${r.error ?? 'ok'}`)
      await sleep(delay)
    } else if (state.opened[p.seat] === 'series') {
      for (const ids of best.melds) {
        const r = await act({ type: 'lay', tiles: ids })
        if (r.error) console.log(`${names[p.seat]} lay: ${r.error}`)
        await sleep(delay / 2)
      }
    }

    hand = await loadHand()
    state = await loadPub()
    if (state.opened[p.seat]) {
      for (const tile of hand) {
        if (hand.length <= 1) break
        const targets = attachableMelds(state.melds, tile, okey)
        if (!targets.length) continue
        const r = await act({ type: 'add_to_meld', tile, meldId: targets[0] })
        if (!r.error) {
          hand = hand.filter((t) => t !== tile)
          state = await loadPub()
          await sleep(delay / 2)
        }
      }
    }

    if (state.turn !== p.seat || state.status !== 'playing') return
    const safe = hand.filter((t) => !isJoker(t, okey) && !attachableMelds(state.melds, t, okey).length)
    const pool = safe.length ? safe : hand
    const tile = pool[Math.floor(Math.random() * pool.length)]
    const r = await act({ type: 'discard', tile })
    if (r.error) console.log(`${names[p.seat]}: ${r.error}`)
  } finally {
    busy = false
  }
}
setInterval(tick, 700)
