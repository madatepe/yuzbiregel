import { useSearchParams } from 'react-router'
import { Lobby } from '@/components/lobby/Lobby'
import { RulesButton } from '@/components/game/RulesModal'
import { Logo } from '@/components/ui/Logo'
import type { GameKind } from '@/lib/gameKind'
import { useSession } from '@/stores/session'

const FLOATING = [
  { v: '7', c: 'text-tile-red', x: '8%', y: '18%', r: -14 },
  { v: '13', c: 'text-tile-blue', x: '86%', y: '14%', r: 12 },
  { v: '1', c: 'text-tile-black', x: '12%', y: '78%', r: 8 },
  { v: '9', c: 'text-tile-yellow', x: '88%', y: '72%', r: -10 },
]

const GAMES: { id: GameKind; title: string }[] = [
  { id: 'okey101', title: '101' },
  { id: 'pisti', title: 'Pişti' },
]

export function Home() {
  const error = useSession((s) => s.error)
  const [params, setParams] = useSearchParams()
  const game: GameKind = params.get('oyun') === 'pisti' ? 'pisti' : 'okey101'
  const pick = (next: GameKind) => {
    setParams(next === 'pisti' ? { oyun: 'pisti' } : {}, { replace: true })
  }

  return (
    <main className="relative flex min-h-full flex-col items-center overflow-hidden px-4 pt-8 pb-10 sm:pt-14 [@media(orientation:landscape)_and_(max-height:520px)]:pt-3 [@media(orientation:landscape)_and_(max-height:520px)]:pb-4">
      {game === 'okey101' &&
        FLOATING.map((t, i) => (
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
        <RulesButton variant={game === 'pisti' ? 'pisti' : 'okey'} />
      </div>

      <header className="mb-6 flex flex-col items-center gap-4 text-center">
        {game === 'okey101' && <Logo size="lg" />}
        <div
          role="tablist"
          aria-label="Oyun seçimi"
          className="grid grid-cols-2 rounded-2xl bg-black/30 p-1"
        >
          {GAMES.map((item) => {
            const active = game === item.id
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => pick(item.id)}
                className={`rounded-xl px-8 py-2 text-sm font-black tracking-wide transition ${active ? 'bg-accent text-accent-ink' : 'text-ivory-300 hover:text-ivory-50'}`}
              >
                {item.title}
              </button>
            )
          })}
        </div>
        <div>
          <h1 className="text-4xl font-black tracking-tight sm:text-5xl">
            {game === 'pisti' ? (
              <>
                Blöflü <span className="text-accent-strong">Pişti</span>
              </>
            ) : (
              <>
                101 <span className="text-accent-strong">Okey</span>
              </>
            )}
          </h1>
          <p className="mt-2 max-w-md text-ivory-300">
            {game === 'pisti'
              ? 'Tekli modda botlara karşı dene, ya da eşli masada arkadaşlarınla oyna.'
              : 'Arkadaşlarınla gerçek zamanlı 101. Masa kur, kodu paylaş, oyna.'}
          </p>
        </div>
      </header>

      {error && (
        <div className="mb-4 max-w-md rounded-2xl bg-danger/15 px-4 py-3 text-center text-sm font-semibold text-[#ffc9c9] ring-1 ring-danger/30" role="alert">
          {game === 'pisti'
            ? 'Sunucuya bağlanılamadı. Tekli mod tarayıcıda çalışır; eşli masa için bağlantı gerekir.'
            : 'Sunucuya bağlanılamadı. İnternet bağlantını kontrol edip sayfayı yenile.'}
        </div>
      )}

      <Lobby game={game} />
    </main>
  )
}
