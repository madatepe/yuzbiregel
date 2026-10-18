import { memo } from 'react'
import type { OpenKind } from '@engine/index.ts'
import { useReactionActions } from '@/components/game/ReactionLayer'
import { PlayerAvatar } from '@/components/ui/PlayerAvatar'
import type { SeatInfo, SeatSide } from '@/hooks/useGameView'

interface PlayerSeatProps {
  info: SeatInfo
  side: SeatSide
  active: boolean
  opened: OpenKind | null
  total: number
  penalty: number
  team?: number
  compact?: boolean
}

function StatusLine({ info, onYellow }: { info: SeatInfo; onYellow?: boolean }) {
  const tone = onYellow ? 'text-accent-ink' : undefined
  if (info.isBot) return <span className={tone ?? 'text-accent-strong'}>{onYellow ? 'Bot' : '● Bot'}</span>
  if (info.left) return <span className={tone ?? 'text-warning'}>{onYellow ? 'Ayrıldı' : '○ Ayrıldı'}</span>
  return info.online ? (
    <span className={tone ?? 'text-success'}>{onYellow ? 'Çevrimiçi' : '● Çevrimiçi'}</span>
  ) : (
    <span className={tone ?? 'text-ivory-400'}>{onYellow ? 'Bağlantı yok' : '○ Bağlantı yok'}</span>
  )
}

function SeatFace({ info, size }: { info: SeatInfo; size: number }) {
  const actions = useReactionActions()
  const avatar = <PlayerAvatar name={info.nickname} size={size} offline={info.left || !info.online} />
  const face =
    !actions || info.left || info.seat === actions.mySeat ? (
      avatar
    ) : (
      <button
        type="button"
        data-reaction-trigger
        title="Tepki gönder"
        aria-label={`${info.nickname} adlı oyuncuya tepki gönder`}
        onClick={(e) => actions.openPicker(info.seat, e.currentTarget)}
        className="shrink-0 cursor-pointer rounded-full ring-2 ring-transparent transition hover:ring-accent/80 focus-visible:ring-accent focus-visible:outline-none"
      >
        {avatar}
      </button>
    )
  return (
    <span data-anchor={`face-${info.seat}`} className="inline-flex">
      {face}
    </span>
  )
}

function PlayerSeatImpl({ info, side, active, opened, total, penalty, team, compact }: PlayerSeatProps) {
  const vertical = side === 'left' || side === 'right'

  if (compact) {
    return (
      <div
        data-anchor={`seat-${info.seat}`}
        className={`relative flex min-w-0 flex-1 items-center gap-2 rounded-xl px-2 py-1.5 transition-all duration-300 ${active ? 'bg-accent text-accent-ink' : 'bg-black/25 ring-1 ring-white/8'}`}
        aria-label={`${info.nickname}, toplam ${total}${active ? ', sıra onda' : ''}`}
      >
        <SeatFace info={info} size={30} />
        <div className="min-w-0 flex-1 leading-tight">
          <div className="flex items-center gap-1 truncate text-xs font-bold">
            {info.isOwner && <span aria-hidden>👑</span>}
            <span className="truncate">{info.nickname}</span>
          </div>
          <div className={`flex items-center gap-1.5 text-[10px] font-semibold ${active ? 'text-accent-ink/80' : 'text-ivory-300'}`}>
            <span className="tabular-nums">{total}</span>
            {penalty > 0 && (
              <span className={`rounded px-1 ${active ? 'bg-black/15' : 'bg-accent/20 text-accent-strong'}`}>+{penalty}</span>
            )}
            {opened && (
              <span className={`rounded px-1 ${active ? 'bg-black/15' : 'bg-success/20 text-success'}`}>
                {opened === 'pairs' ? 'ÇİFT' : 'AÇTI'}
              </span>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      data-anchor={`seat-${info.seat}`}
      className={`relative flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-all duration-300 ${vertical ? 'flex-col text-center' : ''} ${active ? 'bg-accent text-accent-ink' : 'bg-felt-950/70 ring-1 ring-white/8'}`}
      aria-label={`${info.nickname}, toplam ${total}${active ? ', sıra onda' : ''}`}
    >
      <SeatFace info={info} size={vertical ? 52 : 46} />
      <div className={`flex min-w-0 flex-col gap-0.5 ${vertical ? 'items-center' : ''}`}>
        <div className="flex max-w-36 items-center gap-1 truncate font-extrabold">
          {info.isOwner && (
            <span title="Masa sahibi" aria-label="Masa sahibi">
              👑
            </span>
          )}
          <span className="truncate">{info.nickname}</span>
        </div>
        <div className="text-[11px] font-semibold">
          <StatusLine info={info} onYellow={active} />
          {team !== undefined && <span className={active ? 'text-accent-ink/80' : 'text-ivory-400'}> · T{team}</span>}
        </div>
        <div className={`flex items-center gap-1.5 text-xs ${active ? 'text-accent-ink' : ''}`}>
          <span className={active ? 'text-accent-ink/80' : 'text-ivory-400'}>Toplam</span>
          <span className="font-bold tabular-nums">{total}</span>
          {penalty > 0 && (
            <span className={`rounded px-1 text-[10px] font-bold ${active ? 'bg-black/15' : 'bg-accent/20 text-accent-strong'}`}>
              +{penalty}
            </span>
          )}
        </div>
        {opened && (
          <span
            className={`w-fit rounded-md px-1.5 py-0.5 text-[10px] font-bold tracking-wider ${active ? 'bg-black/15 text-accent-ink' : 'bg-success/15 text-success'}`}
          >
            {opened === 'pairs' ? 'ÇİFT AÇTI' : 'ELİ AÇIK'}
          </span>
        )}
      </div>
    </div>
  )
}

export const PlayerSeat = memo(PlayerSeatImpl)
