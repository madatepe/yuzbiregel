import { memo, type CSSProperties, type MouseEvent, type ReactNode } from 'react'
import { isJoker, tileFace, type OkeyInfo, type TileColor, type TileId } from '@engine/index.ts'
import { COLOR_CLASS, tileLabel } from '@/lib/tiles'

export type TileSize = 'md' | 'sm' | 'xs'

interface GameTileProps {
  id?: TileId | null
  okey?: OkeyInfo | null
  size?: TileSize
  faceDown?: boolean
  selected?: boolean
  highlight?: boolean
  dimmed?: boolean
  /** Value a joker stands for inside a meld. */
  representsValue?: number
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void
  onDoubleClick?: () => void
  disabled?: boolean
  className?: string
  style?: CSSProperties
  badge?: ReactNode
  ariaLabel?: string
}

const SIZE_CLASS: Record<TileSize, string> = { md: '', sm: 'tile-sm', xs: 'tile-xs' }

/** Small shape per color so color is never the only cue. */
function ColorMark({ color }: { color: TileColor }) {
  const common = 'fill-current'
  return (
    <svg viewBox="0 0 10 10" className="h-[calc(var(--tile-font)*0.32)] w-[calc(var(--tile-font)*0.32)]" aria-hidden>
      {color === 'red' && <circle cx="5" cy="5" r="4.2" className={common} />}
      {color === 'blue' && <rect x="1" y="1" width="8" height="8" rx="1.2" className={common} />}
      {color === 'yellow' && <path d="M5 0.6 9.6 9.2H0.4Z" className={common} />}
      {color === 'black' && <path d="M5 0.4 9.6 5 5 9.6 0.4 5Z" className={common} />}
    </svg>
  )
}

function FakeOkeyMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-[calc(var(--tile-font)*1.05)] w-[calc(var(--tile-font)*1.05)] text-felt-600" aria-hidden>
      <path
        className="fill-current"
        d="M12 2.5c1.6 0 2.9 1.3 2.9 2.9 0 .6-.2 1.2-.5 1.7 1.9-.5 3.9.6 4.4 2.5.5 1.9-.6 3.9-2.5 4.4-1 .3-2 .1-2.8-.4l1.4 6.9H9.1l1.4-6.9c-.8.5-1.8.7-2.8.4-1.9-.5-3-2.5-2.5-4.4.5-1.9 2.5-3 4.4-2.5-.3-.5-.5-1.1-.5-1.7 0-1.6 1.3-2.9 2.9-2.9Z"
      />
    </svg>
  )
}

function GameTileImpl({
  id,
  okey,
  size = 'md',
  faceDown,
  selected,
  highlight,
  dimmed,
  representsValue,
  onClick,
  onDoubleClick,
  disabled,
  className = '',
  style,
  badge,
  ariaLabel,
}: GameTileProps) {
  const interactive = !!onClick && !disabled
  const base = `tile ${SIZE_CLASS[size]} relative flex shrink-0 select-none flex-col items-center justify-center`
  // Outline instead of ring: .tile owns box-shadow for its 3D look.
  const state = [
    selected ? '-translate-y-3 outline-[2.5px] outline-offset-1 outline-accent' : '',
    highlight ? 'outline-2 outline-offset-1 outline-accent-strong' : '',
    dimmed ? 'opacity-55' : '',
    interactive && !selected ? 'hover:-translate-y-1' : '',
  ].join(' ')

  if (faceDown || id === null || id === undefined) {
    return (
      <div
        className={`tile tile-back ${SIZE_CLASS[size]} shrink-0 ${className}`}
        style={style}
        aria-label={ariaLabel ?? 'Kapalı taş'}
        role="img"
      />
    )
  }

  const face = tileFace(id)
  const joker = !!okey && isJoker(id, okey)
  const label = ariaLabel ?? tileLabel(id, okey)

  const content = face.fake ? (
    <FakeOkeyMark />
  ) : (
    <>
      <span
        className={`${COLOR_CLASS[face.color!]} font-extrabold leading-none tracking-tight`}
        style={{ fontSize: 'var(--tile-font)' }}
      >
        {face.value}
      </span>
      <span className={`${COLOR_CLASS[face.color!]} mt-[calc(var(--tile-font)*0.12)]`}>
        <ColorMark color={face.color!} />
      </span>
    </>
  )

  const extras = (
    <>
      {joker && (
        <span
          className="absolute -top-1 -right-1 flex h-[calc(var(--tile-font)*0.62)] w-[calc(var(--tile-font)*0.62)] items-center justify-center rounded-full bg-accent text-[calc(var(--tile-font)*0.4)] font-black text-accent-ink shadow"
          aria-hidden
        >
          ★
        </span>
      )}
      {joker && representsValue !== undefined && (
        <span
          className="absolute bottom-0.5 left-0.5 rounded-sm bg-black/70 px-0.5 text-[calc(var(--tile-font)*0.38)] font-bold leading-tight text-white"
          aria-hidden
        >
          {representsValue}
        </span>
      )}
      {badge}
    </>
  )

  if (onClick) {
    return (
      <button
        type="button"
        data-tile-id={id}
        className={`${base} ${state} ${className}`}
        style={style}
        onClick={onClick}
        onDoubleClick={onDoubleClick}
        disabled={disabled}
        aria-pressed={selected}
        aria-label={label + (selected ? ', seçili' : '')}
      >
        {content}
        {extras}
      </button>
    )
  }

  return (
    <div data-tile-id={id} className={`${base} ${state} ${className}`} style={style} role="img" aria-label={label}>
      {content}
      {extras}
    </div>
  )
}

export const GameTile = memo(GameTileImpl)
