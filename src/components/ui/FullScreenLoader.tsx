import { Logo } from './Logo'

export function FullScreenLoader({ label = 'Bağlanıyor...' }: { label?: string }) {
  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-5" role="status" aria-live="polite">
      <div className="animate-pulse">
        <Logo />
      </div>
      <span className="text-sm font-semibold tracking-wider text-ivory-300">{label}</span>
    </div>
  )
}
