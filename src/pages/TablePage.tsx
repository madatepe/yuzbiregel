import { lazy, Suspense, useEffect, useState } from 'react'
import { useParams } from 'react-router'
import { connectTable } from '@/lib/realtime'
import { supabase } from '@/lib/supabase'
import { useSession } from '@/stores/session'
import { mySeatOf, useTable } from '@/stores/table'
import { JoinTable } from './JoinTable'
import { WaitingRoom } from './WaitingRoom'
import { TableClosed } from './TableClosed'
import { FullScreenLoader } from '@/components/ui/FullScreenLoader'

const Game = lazy(() => import('./Game'))

export function TablePage() {
  const { code = '' } = useParams()
  const userId = useSession((s) => s.userId)
  const ready = useSession((s) => s.ready)
  const [tableId, setTableId] = useState<string | null>(null)
  const [lookup, setLookup] = useState<'loading' | 'found' | 'missing' | 'error'>('loading')

  useEffect(() => {
    if (!ready || !userId) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    setLookup('loading')
    const attempt = (left: number) => {
      supabase
        .from('game_tables')
        .select('id')
        .eq('code', code.toUpperCase())
        .maybeSingle()
        .then(({ data, error }) => {
          if (cancelled) return
          if (error) {
            if (left > 0) timer = setTimeout(() => attempt(left - 1), 2000)
            else setLookup('error')
          } else if (!data) setLookup('missing')
          else {
            setTableId(data.id)
            setLookup('found')
          }
        })
    }
    attempt(4)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [code, ready, userId])

  useEffect(() => {
    if (!tableId || !userId) return
    return connectTable(tableId, userId)
  }, [tableId, userId])

  const table = useTable((s) => s.table)
  const loaded = useTable((s) => s.loaded)
  const missing = useTable((s) => s.missing)
  const seated = useTable((s) => !!mySeatOf(s.seats, userId))

  if (ready && !userId) return <TableClosed reason="error" />
  if (lookup === 'missing' || missing) return <TableClosed reason="missing" />
  if (lookup === 'error') return <TableClosed reason="error" />
  if (lookup === 'loading' || !loaded || !table) return <FullScreenLoader label="Masaya bağlanıyor..." />
  if (table.status === 'closed') return <TableClosed reason="closed" />
  if (!seated) return <JoinTable />
  if (table.status === 'waiting') return <WaitingRoom />
  return (
    <Suspense fallback={<FullScreenLoader label="Masa hazırlanıyor..." />}>
      <Game />
    </Suspense>
  )
}
