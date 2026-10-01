import { useMemo, type CSSProperties } from 'react'

const COLORS = ['#f6b93b', '#d42a2a', '#1b5cc2', '#3ccf8e', '#fffdf7', '#d89a00']

/** Lightweight CSS confetti confined to its parent. */
export function Celebration({ intensity = 1 }: { intensity?: number }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: Math.round(28 * intensity) }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.5,
        duration: 1.4 + Math.random() * 1.1,
        dx: (Math.random() - 0.5) * 120,
        rot: 360 + Math.random() * 540,
        color: COLORS[i % COLORS.length],
        w: 6 + Math.random() * 5,
        h: 8 + Math.random() * 8,
      })),
    [intensity],
  )
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl" aria-hidden>
      {pieces.map((p, i) => (
        <span
          key={i}
          className="absolute top-0 rounded-[2px]"
          style={
            {
              left: `${p.left}%`,
              width: p.w,
              height: p.h,
              background: p.color,
              animation: `confetti-fall ${p.duration}s ${p.delay}s cubic-bezier(.25,.6,.4,1) forwards`,
              '--dx': `${p.dx}px`,
              '--rot': `${p.rot}deg`,
              opacity: 0,
            } as CSSProperties
          }
        />
      ))}
    </div>
  )
}
