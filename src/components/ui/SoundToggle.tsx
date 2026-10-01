import { useSound } from '@/lib/sound'

export function SoundToggle() {
  const enabled = useSound((s) => s.enabled)
  const toggle = useSound((s) => s.toggle)
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={enabled}
      aria-label={enabled ? 'Sesi kapat' : 'Sesi aç'}
      title={enabled ? 'Ses: AÇIK' : 'Ses: KAPALI'}
      className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white/8 px-3 text-xs font-bold tracking-wider text-ivory-200 ring-1 ring-white/10 transition hover:bg-white/14 hover:text-ivory-50"
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
        <path fill="currentColor" d="M4 9v6h4l5 4V5L8 9H4Z" />
        {enabled ? (
          <path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" />
        ) : (
          <path d="M16.5 9.5l5 5M21.5 9.5l-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        )}
      </svg>
      <span className="hidden sm:inline">{enabled ? 'SES AÇIK' : 'SES KAPALI'}</span>
    </button>
  )
}
