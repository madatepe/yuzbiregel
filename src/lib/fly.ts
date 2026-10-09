import type { TileId } from '@engine/index.ts'

/** Rects of rack tiles captured right before the player sends a move. */
const remembered = new Map<TileId, DOMRect>()

export function rememberTiles(ids: TileId[]) {
  for (const id of ids) {
    const el = document.querySelector<HTMLElement>(`[data-rack] [data-tile-id="${id}"]`)
    if (el) remembered.set(id, el.getBoundingClientRect())
  }
}

export function takeRemembered(id: TileId): DOMRect | null {
  const r = remembered.get(id) ?? null
  remembered.delete(id)
  return r
}

/** Rect of the first visible element with the given anchor (hidden duplicates are skipped). */
export function anchorRect(name: string): DOMRect | null {
  for (const el of document.querySelectorAll<HTMLElement>(`[data-anchor="${name}"]`)) {
    const r = el.getBoundingClientRect()
    if (r.width && r.height) return r
  }
  return null
}

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

interface FlyOptions {
  /** Element that will be animated into place (it is hidden during the flight). */
  target: HTMLElement
  from: DOMRect
  delay?: number
  duration?: number
  rotate?: number
  faceDown?: boolean
}

/**
 * Animates a visual clone of `target` from `from` to the target's position.
 * Purely cosmetic: the target already reflects server state.
 */
export function flyTo({ target, from, delay = 0, duration = 420, rotate = 0, faceDown = false }: FlyOptions) {
  if (reduced()) return Promise.resolve()
  const to = target.getBoundingClientRect()
  if (!to.width || !from.width) return Promise.resolve()

  const clone = faceDown ? document.createElement('div') : (target.cloneNode(true) as HTMLElement)
  if (faceDown) {
    clone.className = `${target.className.includes('tile-sm') ? 'tile tile-sm' : target.className.includes('tile-xs') ? 'tile tile-xs' : 'tile'} tile-back`
  }
  clone.removeAttribute('data-tile-id')
  clone.setAttribute('aria-hidden', 'true')
  Object.assign(clone.style, {
    position: 'fixed',
    left: `${to.left}px`,
    top: `${to.top}px`,
    width: `${to.width}px`,
    height: `${to.height}px`,
    margin: '0',
    zIndex: '45',
    pointerEvents: 'none',
    transition: 'none',
  })
  document.body.appendChild(clone)

  const dx = from.left + from.width / 2 - (to.left + to.width / 2)
  const dy = from.top + from.height / 2 - (to.top + to.height / 2)
  const scale = from.width / to.width || 1

  const prevVisibility = target.style.visibility
  target.style.visibility = 'hidden'

  return new Promise<void>((resolve) => {
    const anim = clone.animate(
      [
        { transform: `translate(${dx}px, ${dy}px) scale(${scale}) rotate(0deg)`, opacity: 0.9 },
        {
          transform: `translate(${dx * 0.35}px, ${dy * 0.35 - 24}px) scale(${(scale + 1) / 2 + 0.06}) rotate(${rotate / 2}deg)`,
          opacity: 1,
          offset: 0.55,
        },
        { transform: 'translate(0, 0) scale(1) rotate(0deg)', opacity: 1 },
      ],
      { duration, delay, easing: 'cubic-bezier(.2,.75,.25,1)', fill: 'both' },
    )
    const done = () => {
      target.style.visibility = prevVisibility
      clone.remove()
      resolve()
    }
    anim.onfinish = done
    anim.oncancel = done
  })
}

/** Animates a face-down tile from one rect to another (e.g. deck to an opponent). */
export function flyBetween(from: DOMRect, to: DOMRect, size: 'tile' | 'tile tile-sm' | 'playing-card playing-card-sm' = 'tile tile-sm') {
  if (reduced() || !from.width || !to.width) return
  const el = document.createElement('div')
  el.className = size.includes('playing-card') ? `${size} playing-card-back` : `${size} tile-back`
  el.setAttribute('aria-hidden', 'true')
  document.body.appendChild(el)
  const w = el.offsetWidth
  const h = el.offsetHeight
  Object.assign(el.style, {
    position: 'fixed',
    left: `${from.left + from.width / 2 - w / 2}px`,
    top: `${from.top + from.height / 2 - h / 2}px`,
    zIndex: '45',
    pointerEvents: 'none',
  })
  const dx = to.left + to.width / 2 - (from.left + from.width / 2)
  const dy = to.top + to.height / 2 - (from.top + from.height / 2)
  const anim = el.animate(
    [
      { transform: 'translate(0,0) scale(1)', opacity: 1 },
      { transform: `translate(${dx}px, ${dy}px) scale(0.7)`, opacity: 0 },
    ],
    { duration: 420, easing: 'cubic-bezier(.3,.7,.3,1)', fill: 'both' },
  )
  anim.onfinish = () => el.remove()
  anim.oncancel = () => el.remove()
}

export function sparkleBurst(at: DOMRect, count = 12): Promise<void> {
  if (reduced() || !at.width) return Promise.resolve()
  const cx = at.left + at.width / 2
  const cy = at.top + at.height / 2
  const dots: HTMLElement[] = []
  for (let i = 0; i < count; i++) {
    const d = document.createElement('span')
    d.setAttribute('aria-hidden', 'true')
    const size = 5 + (i % 3) * 3
    Object.assign(d.style, {
      position: 'fixed',
      left: `${cx}px`,
      top: `${cy}px`,
      width: `${size}px`,
      height: `${size}px`,
      margin: `-${size / 2}px 0 0 -${size / 2}px`,
      borderRadius: '999px',
      background: i % 2 ? '#ffcf66' : '#fff6d6',
      boxShadow: '0 0 8px #f6b93b',
      zIndex: '50',
      pointerEvents: 'none',
    })
    document.body.appendChild(d)
    dots.push(d)
    const ang = (Math.PI * 2 * i) / count + (i % 2) * 0.2
    const dist = 36 + (i % 4) * 14
    d.animate(
      [
        { transform: 'translate(0,0) scale(0.4)', opacity: 1 },
        { transform: `translate(${Math.cos(ang) * dist}px, ${Math.sin(ang) * dist - 10}px) scale(1)`, opacity: 1, offset: 0.45 },
        { transform: `translate(${Math.cos(ang) * dist * 1.35}px, ${Math.sin(ang) * dist * 1.2 - 18}px) scale(0.2)`, opacity: 0 },
      ],
      { duration: 560, easing: 'cubic-bezier(.15,.8,.25,1)', fill: 'forwards' },
    )
  }
  return new Promise((resolve) => {
    window.setTimeout(() => {
      for (const d of dots) d.remove()
      resolve()
    }, 560)
  })
}

export function flyNodeTo(target: HTMLElement, to: DOMRect, duration = 540): Promise<void> {
  if (reduced() || !to.width) return Promise.resolve()
  const from = target.getBoundingClientRect()
  if (!from.width) return Promise.resolve()
  const clone = target.cloneNode(true) as HTMLElement
  clone.setAttribute('aria-hidden', 'true')
  Object.assign(clone.style, {
    position: 'fixed',
    left: `${from.left}px`,
    top: `${from.top}px`,
    width: `${from.width}px`,
    height: `${from.height}px`,
    margin: '0',
    zIndex: '47',
    pointerEvents: 'none',
  })
  document.body.appendChild(clone)
  const prev = target.style.visibility
  target.style.visibility = 'hidden'
  const dx = to.left + to.width / 2 - (from.left + from.width / 2)
  const dy = to.top + to.height / 2 - (from.top + from.height / 2)
  return new Promise((resolve) => {
    const anim = clone.animate(
      [
        { transform: 'translate(0,0) scale(1)', opacity: 1, filter: 'brightness(1.2)' },
        { transform: `translate(${dx}px, ${dy}px) scale(0.45)`, opacity: 0 },
      ],
      { duration, easing: 'cubic-bezier(.35,.7,.2,1)', fill: 'forwards' },
    )
    const done = () => {
      target.style.visibility = prev
      clone.remove()
      resolve()
    }
    anim.onfinish = done
    anim.oncancel = done
  })
}

export function flyPlayingCard(
  from: DOMRect,
  to: DOMRect,
  opts: { faceDown?: boolean; markup?: HTMLElement; duration?: number; holdMs?: number } = {},
): Promise<void> {
  const duration = opts.duration ?? 520
  if (reduced() || !from.width || !to.width) return Promise.resolve()
  const el = opts.markup ? (opts.markup.cloneNode(true) as HTMLElement) : document.createElement('span')
  if (!opts.markup) {
    el.className = opts.faceDown ? 'playing-card playing-card-back playing-card-lg' : 'playing-card playing-card-lg'
  }
  el.removeAttribute('data-card-id')
  el.setAttribute('aria-hidden', 'true')
  const w = 72
  const h = 102
  Object.assign(el.style, {
    position: 'fixed',
    left: `${to.left + to.width / 2 - w / 2}px`,
    top: `${to.top + to.height / 2 - h / 2}px`,
    width: `${w}px`,
    height: `${h}px`,
    margin: '0',
    zIndex: '46',
    pointerEvents: 'none',
  })
  document.body.appendChild(el)
  const dx = from.left + from.width / 2 - (to.left + to.width / 2)
  const dy = from.top + from.height / 2 - (to.top + to.height / 2)
  return new Promise((resolve) => {
    const anim = el.animate(
      [
        { transform: `translate(${dx}px, ${dy}px) scale(0.72)`, opacity: 0.85 },
        {
          transform: `translate(${dx * 0.4}px, ${dy * 0.4 - 28}px) scale(1.06)`,
          opacity: 1,
          offset: 0.55,
        },
        { transform: 'translate(0, 0) scale(1)', opacity: 1 },
      ],
      { duration, easing: 'cubic-bezier(.2,.75,.25,1)', fill: 'both' },
    )
    const finish = () => {
      const hold = opts.holdMs ?? 0
      window.setTimeout(() => {
        el.remove()
        resolve()
      }, hold)
    }
    anim.onfinish = finish
    anim.oncancel = finish
  })
}
