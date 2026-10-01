import { memo } from 'react'
import type { OpenKind } from '@engine/index.ts'
import { PlayerAvatar } from '@/components/ui/PlayerAvatar'
import type { SeatInfo, SeatSide } from '@/hooks/useGameView'

interface PlayerSeatProps {
  info: SeatInfo
  side: SeatSide
  active: boolean
  handCount: number
  opened: OpenKind | null
  total: number
  penalty: number
  team?: number
  compact?: boolean
}

function StatusLine({ info }: { info: SeatInfo }) {
  if (info.left) return <span className="text-warning">○ Ayrıldı</span>
  return info.online ? (
    <span className="text-success">● Çevrimiçi</span>
  ) : (
    <span className="text-ivory-400">○ Bağlantı yok</span>
  )
}

function PlayerSeatImpl({ info, side, active, handCount, opened, total, penalty, team, compact }: PlayerSeatProps) {
  const vertical = side === 'left' || side === 'right'
  const fan = Math.min(handCount, 7)

  if (compact) {
    return (
      <div
        data-anchor={`seat-${info.seat}`}
        className={`relative flex min-w-0 flex-1 items-center gap-2 rounded-xl px-2 py-1.5 transition-all duration-300 ${active ? 'bg-accent/15 ring-2 ring-accent' : 'bg-black/25 ring-1 ring-white/8'}`}
        aria-label={`${info.nickname}, ${handCount} taş, toplam ${total}${active ? ', sıra onda' : ''}`}
      >
        <PlayerAvatar name={info.nickname} size={30} active={active} offline={info.left || !info.online} />
        <div className="min-w-0 flex-1 leading-tight">
          <div className="flex items-center gap-1 truncate text-xs font-bold">
            {info.isOwner && <span aria-hidden>👑</span>}
            <span className="truncate">{info.nickname}</span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] font-semibold text-ivory-300">
            <span>{handCount} taş</span>
            <span aria-hidden>·</span>
            <span className="tabular-nums">{total}</span>
            {opened && <span className="rounded bg-success/20 px-1 text-success">{opened === 'pairs' ? 'ÇİFT' : 'AÇTI'}</span>}
          </div>
        </div>
        {active && <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-accent px-1.5 text-[9px] font-black text-accent-ink">SIRA</span>}
      </div>
    )
  }

  return (
    <div
      data-anchor={`seat-${info.seat}`}
      className={`relative flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-all duration-300 ${vertical ? 'flex-col text-center' : ''} ${active ? 'bg-felt-900/90 shadow-[0_0_0_2px_var(--color-accent),0_10px_30px_rgb(246_185_59/0.18)]' : 'bg-felt-950/70 ring-1 ring-white/8'}`}
      aria-label={`${info.nickname}, ${handCount} taş, toplam ${total}${active ? ', sıra onda' : ''}`}
    >
      {active && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 animate-fade-up rounded-full bg-accent px-2.5 py-0.5 text-[10px] font-black tracking-wider whitespace-nowrap text-accent-ink shadow">
          SIRA ONDA
        </span>
      )}
      <PlayerAvatar name={info.nickname} size={vertical ? 52 : 46} active={active} offline={info.left || !info.online} />
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
          <StatusLine info={info} />
          {team !== undefined && <span className="text-ivory-400"> · T{team}</span>}
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-ivory-400">Toplam</span>
          <span className="font-bold tabular-nums">{total}</span>
          {penalty > 0 && <span className="rounded bg-danger/20 px-1 text-[10px] font-bold text-danger">+{penalty}</span>}
        </div>
        {opened && (
          <span className="w-fit rounded-md bg-success/15 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-success">
            {opened === 'pairs' ? 'ÇİFT AÇTI' : 'ELİ AÇIK'}
          </span>
        )}
      </div>
      <div className={`flex ${vertical ? 'mt-1' : 'ml-1'} items-end`} aria-hidden>
        <div className="flex items-end pt-1">
          {Array.from({ length: fan }).map((_, i) => (
            <div
              key={i}
              className="tile tile-xs tile-back -ml-3.5 origin-bottom first:ml-0"
              style={{ transform: `rotate(${(i - (fan - 1) / 2) * 7}deg) translateY(${Math.abs(i - (fan - 1) / 2) * 1.5}px)` }}
            />
          ))}
        </div>
        <span className="ml-2 rounded-md bg-black/30 px-1.5 text-xs font-bold text-ivory-200 tabular-nums">{handCount}</span>
      </div>
    </div>
  )
}

export const PlayerSeat = memo(PlayerSeatImpl)
