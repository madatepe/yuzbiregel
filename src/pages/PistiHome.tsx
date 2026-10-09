import { Link } from 'react-router'
import { cardId } from '@pisti/index.ts'
import { Lobby } from '@/components/lobby/Lobby'
import { PlayingCard } from '@/components/pisti/PlayingCard'
import { RulesButton } from '@/components/game/RulesModal'
import { useSession } from '@/stores/session'

export function PistiHome() {
  const error = useSession((s) => s.error)
  return (
    <main className="relative flex min-h-full flex-col items-center overflow-hidden px-4 pt-8 pb-10 sm:pt-14">
      <div className="absolute top-4 right-4">
        <RulesButton variant="pisti" />
      </div>

      <header className="mb-8 flex flex-col items-center gap-4 text-center">
        <div className="flex gap-1" aria-hidden>
          <PlayingCard id={cardId('hearts', 1)} size="sm" />
          <PlayingCard id={cardId('spades', 11)} size="sm" />
          <PlayingCard id={cardId('diamonds', 5)} size="sm" />
        </div>
        <div>
          <h1 className="text-4xl font-black tracking-tight sm:text-5xl">
            Blöflü <span className="text-accent-strong">Pişti</span>
          </h1>
          <p className="mt-2 text-ivory-300">Tekli modda botlara karşı dene, ya da eşli masada arkadaşlarınla oyna.</p>
        </div>
      </header>

      {error && (
        <div className="mb-4 max-w-md rounded-2xl bg-danger/15 px-4 py-3 text-center text-sm font-semibold text-[#ffc9c9] ring-1 ring-danger/30" role="alert">
          Sunucuya bağlanılamadı. Tekli mod tarayıcıda çalışır; eşli masa için bağlantı gerekir.
        </div>
      )}

      <Lobby game="pisti" />
      <Link
        to="/"
        className="mt-8 text-sm font-bold tracking-wider text-ivory-300 underline-offset-4 hover:text-accent-strong hover:underline"
      >
        ← 101 Okey
      </Link>
    </main>
  )
}
