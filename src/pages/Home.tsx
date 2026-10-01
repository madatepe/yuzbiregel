import { Lobby } from '@/components/lobby/Lobby'
import { RulesButton } from '@/components/game/RulesModal'
import { Logo } from '@/components/ui/Logo'
import { useSession } from '@/stores/session'

const FLOATING = [
  { v: '7', c: 'text-tile-red', x: '8%', y: '18%', r: -14 },
  { v: '13', c: 'text-tile-blue', x: '86%', y: '14%', r: 12 },
  { v: '1', c: 'text-tile-black', x: '12%', y: '78%', r: 8 },
  { v: '9', c: 'text-tile-yellow', x: '88%', y: '72%', r: -10 },
]

export function Home() {
  const error = useSession((s) => s.error)
  return (
    <main className="relative flex min-h-full flex-col items-center overflow-hidden px-4 pt-8 pb-10 sm:pt-14">
      {FLOATING.map((t, i) => (
        <div
          key={i}
          className={`tile pointer-events-none absolute hidden items-center justify-center font-black opacity-30 md:flex ${t.c}`}
          style={{ left: t.x, top: t.y, transform: `rotate(${t.r}deg) scale(1.3)`, fontSize: 'var(--tile-font)' }}
          aria-hidden
        >
          {t.v}
        </div>
      ))}

      <div className="absolute top-4 right-4">
        <RulesButton />
      </div>

      <header className="mb-8 flex flex-col items-center gap-4 text-center">
        <Logo size="lg" />
        <div>
          <h1 className="text-4xl font-black tracking-tight sm:text-5xl">
            101 <span className="text-accent-strong">Okey</span>
          </h1>
          <p className="mt-2 text-ivory-300">Arkadaşlarınla gerçek zamanlı 101. Masa kur, kodu paylaş, oyna.</p>
        </div>
      </header>

      {error && (
        <div className="mb-4 max-w-md rounded-2xl bg-danger/15 px-4 py-3 text-center text-sm font-semibold text-[#ffc9c9] ring-1 ring-danger/30" role="alert">
          Sunucuya bağlanılamadı. İnternet bağlantını kontrol edip sayfayı yenile.
        </div>
      )}

      <Lobby />
    </main>
  )
}
