import { memo } from 'react'

const PALETTE = [
  ['#f6b93b', '#8a5a00'],
  ['#4fc3f7', '#0b4f6c'],
  ['#ef6f6c', '#7a1f1d'],
  ['#81c784', '#1f5a24'],
  ['#ba8cf0', '#4a2378'],
  ['#ffa270', '#7a3510'],
  ['#4dd0c4', '#0d5a53'],
  ['#f48fb1', '#7a2546'],
]

function hash(s: string) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

interface PlayerAvatarProps {
  name: string
  size?: number
  active?: boolean
  offline?: boolean
  empty?: boolean
}

function PlayerAvatarImpl({ name, size = 48, active, offline, empty }: PlayerAvatarProps) {
  if (empty) {
    return (
      <div
        className="flex shrink-0 items-center justify-center rounded-full border-2 border-dashed border-white/20 text-white/30"
        style={{ width: size, height: size }}
        aria-hidden
      >
        <svg viewBox="0 0 24 24" className="h-1/2 w-1/2" aria-hidden>
          <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </div>
    )
  }
  const [light, dark] = PALETTE[hash(name) % PALETTE.length]
  const initials = name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toLocaleUpperCase('tr')
  return (
    <div
      className={`relative flex shrink-0 items-center justify-center rounded-full font-extrabold transition-all duration-300 ${active ? 'animate-turn-pulse ring-[3px] ring-accent' : 'ring-2 ring-white/15'} ${offline ? 'opacity-50 grayscale' : ''}`}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        background: `radial-gradient(circle at 30% 25%, ${light}, ${dark})`,
        color: '#fff',
        textShadow: '0 1px 2px rgb(0 0 0 / 0.4)',
      }}
      aria-hidden
    >
      {initials}
    </div>
  )
}

export const PlayerAvatar = memo(PlayerAvatarImpl)
