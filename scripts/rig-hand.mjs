// Dev-only: swaps tiles into one seat's hand on a test table so opening/attach UI can be
// exercised without waiting for a lucky deal. Tile counts per hand/deck stay unchanged.
// Usage: SUPABASE_ACCESS_TOKEN=... node scripts/rig-hand.mjs <CODE> <seat> <color:value,...>
//   e.g. node scripts/rig-hand.mjs ZPCHRK 0 red:10,red:11,red:12,red:13,blue:10,blue:11,blue:12,blue:13
const [code, seatArg, wantArg] = process.argv.slice(2)
const token = process.env.SUPABASE_ACCESS_TOKEN
if (!code || !seatArg || !wantArg || !token) throw new Error('usage: <CODE> <seat> <color:value,...> (SUPABASE_ACCESS_TOKEN env)')
const ref = new URL(process.env.VITE_SUPABASE_URL ?? 'https://pxaqnzbiqbatghsrtprq.supabase.co').hostname.split('.')[0]
const seat = Number(seatArg)
const COLORS = ['red', 'blue', 'yellow', 'black']

async function sql(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`)
  return res.json()
}

const [row] = await sql(
  `select t.id, s.state from game_tables t join game_secret s on s.table_id = t.id where t.code = '${code.replace(/'/g, '')}'`,
)
if (!row) throw new Error('table not found')
const state = row.state
const mine = state.hands[seat]

for (const spec of wantArg.split(',')) {
  const [color, v] = spec.split(':')
  const base = COLORS.indexOf(color) * 26 + (Number(v) - 1) * 2
  const copies = [base, base + 1]
  if (copies.some((id) => mine.includes(id))) continue
  const id = copies.find((c) => state.deck.includes(c) || state.hands.some((h, i) => i !== seat && h.includes(c)))
  if (id === undefined) {
    console.log(`skip ${spec}: not available`)
    continue
  }
  const wanted = new Set(wantArg.split(',').flatMap((s) => {
    const [c, val] = s.split(':')
    const b = COLORS.indexOf(c) * 26 + (Number(val) - 1) * 2
    return [b, b + 1]
  }))
  const give = mine.find((t) => !wanted.has(t))
  const src = state.deck.includes(id) ? state.deck : state.hands.find((h) => h.includes(id))
  src[src.indexOf(id)] = give
  mine[mine.indexOf(give)] = id
}

const json = (v) => `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`
const handUpdates = state.hands
  .map((tiles, i) => `update game_hands set tiles = ${json(tiles)}, version = version + 1 where table_id = '${row.id}' and seat = ${i};`)
  .join('\n')
await sql(`update game_secret set state = ${json(state)} where table_id = '${row.id}';\n${handUpdates}`)
console.log(`seat ${seat} hand:`, mine.length, 'tiles')
