import { useState } from 'react'
import { ActionButton } from '@/components/ui/ActionButton'
import type { GameKind } from '@/lib/gameKind'
import { tablePath } from '@/lib/gameKind'
import { toast } from '@/stores/toast'
import { useTable } from '@/stores/table'

export function tableUrl(code: string, kind: GameKind = 'okey101') {
  return new URL(tablePath(code, kind), window.location.origin).toString()
}

export function whatsappShareUrl(code: string, kind: GameKind = 'okey101') {
  const title = kind === 'pisti' ? 'Blöflü Pişti masama gel!' : '101 Okey masama gel! 🎲'
  const text = `${title}\nMasa kodu: ${code}\n${tableUrl(code, kind)}`
  const url = new URL('https://wa.me/')
  url.searchParams.set('text', text)
  return url.toString()
}

export function TableCode({ code, compact = false }: { code: string; compact?: boolean }) {
  const kind = useTable((s) => s.table?.game_type) ?? 'okey101'
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      toast('Masa kodu kopyalandı.', 'success')
      setTimeout(() => setCopied(false), 1600)
    } catch {
      toast('Kopyalanamadı, kodu elle seçebilirsin.', 'warning')
    }
  }

  return (
    <div className="flex flex-col items-center gap-3">
      {!compact && <span className="text-xs font-bold tracking-[0.3em] text-ivory-300">MASA KODU</span>}
      <div className="flex gap-1.5" aria-label={`Masa kodu ${code.split('').join(' ')}`}>
        {code.split('').map((ch, i) => (
          <span
            key={i}
            className={`tile ${compact ? 'tile-sm' : ''} flex items-center justify-center font-black text-tile-black`}
            style={{ fontSize: 'var(--tile-font)' }}
            aria-hidden
          >
            {ch}
          </span>
        ))}
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <ActionButton variant="secondary" size="sm" onClick={copy}>
          {copied ? '✓ Kopyalandı' : 'Kodu kopyala'}
        </ActionButton>
        <a
          href={whatsappShareUrl(code, kind)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#25d366] px-3 text-sm font-bold tracking-wide text-[#05301a] uppercase shadow-[0_3px_0_#14964a] transition hover:brightness-105 active:translate-y-[2px] active:shadow-none"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
            <path
              fill="currentColor"
              d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2c-1.5 0-3-.4-4.3-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.4.1-.7.3-.2.3-.9.9-.9 2.2s.9 2.5 1 2.7c.1.2 1.8 2.8 4.4 3.9 1.6.7 2.3.8 3.1.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.2-.2-.5-.3Z"
            />
          </svg>
          WhatsApp'ta paylaş
        </a>
      </div>
    </div>
  )
}
