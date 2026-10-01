import { useTable } from '@/stores/table'

export function ConnectionStatus({ compact = false }: { compact?: boolean }) {
  const connection = useTable((s) => s.connection)
  const map = {
    connecting: { dot: 'bg-warning animate-pulse', label: 'Bağlanıyor...' },
    connected: { dot: 'bg-success', label: 'Bağlı' },
    reconnecting: { dot: 'bg-danger animate-pulse', label: 'Tekrar bağlanılıyor...' },
  }[connection]
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full bg-black/25 px-2.5 py-1 text-xs font-semibold text-ivory-200"
      role="status"
      aria-live="polite"
      title={map.label}
    >
      <span className={`h-2 w-2 rounded-full ${map.dot}`} aria-hidden />
      <span className={compact ? 'sr-only sm:not-sr-only' : ''}>{map.label}</span>
    </span>
  )
}

/** Blocking-free banner shown while the realtime link is down. */
export function ConnectionBanner() {
  const connection = useTable((s) => s.connection)
  if (connection !== 'reconnecting') return null
  return (
    <div className="pointer-events-none fixed inset-x-0 top-12 z-40 flex justify-center p-2" role="alert">
      <div className="flex items-center gap-2 rounded-full bg-[#3d1515]/95 px-4 py-2 text-sm font-semibold text-[#ffc9c9] shadow-xl ring-1 ring-danger/30">
        <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />
        Bağlantı kesildi · Tekrar bağlanılıyor...
      </div>
    </div>
  )
}
