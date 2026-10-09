import { useLocation, useNavigate } from 'react-router'
import { ActionButton } from '@/components/ui/ActionButton'

const COPY = {
  closed: { title: 'MASA KAPANDI', body: 'Bu masa artık aktif değil.' },
  missing: { title: 'MASA BULUNAMADI', body: 'Bu masa artık mevcut değil. Kodu kontrol et.' },
  error: { title: 'BAĞLANILAMADI', body: 'Sunucuya şu anda ulaşılamıyor. Biraz sonra tekrar dene.' },
}

export function TableClosed({ reason }: { reason: keyof typeof COPY }) {
  const navigate = useNavigate()
  const pisti = useLocation().pathname.startsWith('/pisti')
  const c = COPY[reason]
  return (
    <main className="flex min-h-full items-center justify-center p-4">
      <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-3xl border border-line bg-surface/90 p-8 text-center shadow-2xl animate-fade-up">
        <div className="flex gap-1.5 opacity-80" aria-hidden>
          <div className="tile tile-sm tile-back rotate-[-8deg]" />
          <div className="tile tile-sm tile-back rotate-[4deg]" />
        </div>
        <h1 className="text-2xl font-black tracking-wider">{c.title}</h1>
        <p className="text-ivory-300">{c.body}</p>
        <ActionButton onClick={() => navigate(pisti ? '/pisti' : '/')} block>
          Ana sayfaya dön
        </ActionButton>
      </div>
    </main>
  )
}
