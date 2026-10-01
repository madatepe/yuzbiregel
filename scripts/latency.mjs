// Measures edge function round-trip latency.
// Usage: node --env-file=.env.local scripts/latency.mjs
import { createClient } from '@supabase/supabase-js'

const c = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false },
})
await c.auth.signInAnonymously()

for (const region of [undefined, process.env.VITE_SUPABASE_FUNCTIONS_REGION]) {
  for (let i = 0; i < 4; i++) {
    const t0 = performance.now()
    await c.functions.invoke('next-round', { body: { tableId: '00000000-0000-0000-0000-000000000000' }, region })
    console.log(`next-round [${region ?? 'nearest'}]: ${Math.round(performance.now() - t0)}ms`)
  }
}
const t0 = performance.now()
await c.from('game_tables').select('id').limit(1)
console.log(`plain REST select: ${Math.round(performance.now() - t0)}ms`)
