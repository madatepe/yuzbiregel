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
  if (reduced()) return
  const to = target.getBoundingClientRect()
  if (!to.width || !from.width) return

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
  }
  anim.onfinish = done
  anim.oncancel = done
}

/** Animates a face-down tile from one rect to another (e.g. deck to an opponent). */
export function flyBetween(from: DOMRect, to: DOMRect, size: 'tile' | 'tile tile-sm' = 'tile tile-sm') {
  if (reduced() || !from.width || !to.width) return
  const el = document.createElement('div')
  el.className = `${size} tile-back`
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
