import { COLORS } from '@engine/index.ts'

const DIGITS: { d: string; color: (typeof COLORS)[number]; rot: number }[] = [
  { d: '1', color: 'red', rot: -8 },
  { d: '0', color: 'black', rot: 2 },
  { d: '1', color: 'blue', rot: 9 },
]

const TEXT = { red: 'text-tile-red', black: 'text-tile-black', blue: 'text-tile-blue', yellow: 'text-tile-yellow' }

export function Logo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const scale = { sm: 'tile-xs', md: 'tile-sm', lg: '' }[size]
  return (
    <div className="flex items-center gap-1" aria-label="101 Okey">
      {DIGITS.map((x, i) => (
        <div
          key={i}
          className={`tile ${scale} flex items-center justify-center font-black ${TEXT[x.color]}`}
          style={{ transform: `rotate(${x.rot}deg)`, fontSize: 'var(--tile-font)' }}
          aria-hidden
        >
          {x.d}
        </div>
      ))}
    </div>
  )
}
