import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { anchorRect } from '@/lib/fly'
import {
  dispatchReaction,
  EMOJI_REACTIONS,
  PHRASE_REACTIONS,
  reactionById,
  subscribeReactions,
  type ReactionBurst,
} from '@/lib/reactions'
import { useMySeat } from '@/hooks/useGameView'

const MAX_ON_SCREEN = 6
const FLIGHT_MS = 2500
const REDUCED_MS = 1800

interface ReactionActions {
  mySeat: number
  openPicker: (seat: number, anchor: HTMLElement) => void
}

const ReactionActionsContext = createContext<ReactionActions | null>(null)

export function useReactionActions() {
  return useContext(ReactionActionsContext)
}

interface PickerState {
  seat: number
  anchor: HTMLElement
}

export function ReactionProvider({ children }: { children: ReactNode }) {
  const mySeat = useMySeat()
  const [picker, setPicker] = useState<PickerState | null>(null)
  const [items, setItems] = useState<ReactionBurst[]>([])

  const closePicker = useCallback(() => setPicker(null), [])
  const openPicker = useCallback((seat: number, anchor: HTMLElement) => {
    setPicker((prev) => (prev?.seat === seat ? null : { seat, anchor }))
  }, [])

  const send = useCallback(
    (kind: string) => {
      if (!picker) return
      if (dispatchReaction(mySeat, picker.seat, kind)) closePicker()
    },
    [closePicker, mySeat, picker],
  )

  useEffect(() => subscribeReactions((burst) => {
    setItems((prev) => [...prev, burst].slice(-MAX_ON_SCREEN))
  }), [])

  const remove = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id))
  }, [])

  const actions = useMemo(() => ({ mySeat, openPicker }), [mySeat, openPicker])

  return (
    <ReactionActionsContext.Provider value={actions}>
      {children}
      <ReactionPicker picker={picker} onClose={closePicker} onSend={send} />
      <ReactionFlight items={items} onDone={remove} />
    </ReactionActionsContext.Provider>
  )
}

function ReactionPicker({
  picker,
  onClose,
  onSend,
}: {
  picker: PickerState | null
  onClose: () => void
  onSend: (kind: string) => void
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState<DOMRect | null>(null)

  useEffect(() => {
    if (!picker) return
    const update = () => {
      if (!picker.anchor.isConnected) {
        onClose()
        return
      }
      setBox(picker.anchor.getBoundingClientRect())
    }
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    const timer = window.setInterval(update, 400)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
      clearInterval(timer)
    }
  }, [picker, onClose])

  useEffect(() => {
    if (!picker) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopImmediatePropagation()
      onClose()
    }
    const onPointer = (e: PointerEvent) => {
      const target = e.target
      if (!(target instanceof Node)) return
      if (panelRef.current?.contains(target)) return
      if (target instanceof Element && target.closest('[data-reaction-trigger]')) return
      onClose()
    }
    window.addEventListener('keydown', onKey, true)
    window.addEventListener('pointerdown', onPointer, true)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      window.removeEventListener('pointerdown', onPointer, true)
    }
  }, [picker, onClose])

  if (!picker || !box) return null

  const width = 280
  const left = Math.max(8, Math.min(box.left + box.width / 2 - width / 2, window.innerWidth - width - 8))
  const openAbove = box.top > 240
  const top = openAbove ? Math.max(8, box.top - 8) : box.bottom + 8

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Tepki gönder"
      className="fixed z-[80] max-h-[min(70vh,340px)] w-[280px] overflow-y-auto rounded-2xl border border-white/10 bg-felt-950/95 p-3 shadow-[0_16px_40px_rgb(0_0_0/0.45)]"
      style={{ left, top, transform: openAbove ? 'translateY(-100%)' : undefined }}
    >
      <div className="mb-2 text-[10px] font-black tracking-widest text-ivory-400">TEPKİ</div>
      <div className="grid grid-cols-3 gap-1">
        {EMOJI_REACTIONS.map((item) => (
          <button
            key={item.id}
            type="button"
            title={item.label}
            aria-label={item.label}
            onClick={() => onSend(item.id)}
            className="flex h-11 items-center justify-center rounded-xl text-2xl transition hover:bg-white/10"
          >
            {item.emoji}
          </button>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {PHRASE_REACTIONS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onSend(item.id)}
            className="rounded-full bg-white/8 px-2.5 py-1 text-xs font-bold text-ivory-100 ring-1 ring-white/10 transition hover:bg-accent/20 hover:text-accent-strong"
          >
            {item.text}
          </button>
        ))}
      </div>
    </div>,
    document.body,
  )
}

function ReactionFlight({ items, onDone }: { items: ReactionBurst[]; onDone: (id: string) => void }) {
  if (items.length === 0) return null
  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[70]" aria-hidden>
      {items.map((burst) => (
        <FlyingReaction key={burst.id} burst={burst} onDone={onDone} />
      ))}
    </div>,
    document.body,
  )
}

function FlyingReaction({ burst, onDone }: { burst: ReactionBurst; onDone: (id: string) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const def = reactionById(burst.kind)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el || !def) {
      onDone(burst.id)
      return
    }
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const from = anchorRect(`face-${burst.fromSeat}`) ?? anchorRect(`seat-${burst.fromSeat}`)
    const to = anchorRect(`face-${burst.toSeat}`) ?? anchorRect(`seat-${burst.toSeat}`)
    const place = (x: number, y: number) => {
      el.style.left = `${x}px`
      el.style.top = `${y}px`
    }
    const target = to ?? from
    if (target) place(target.left + target.width / 2, target.top + target.height / 2)
    else place(window.innerWidth / 2, window.innerHeight * 0.72)

    let anim: Animation | undefined
    if (reduced || !from || !to) {
      anim = el.animate(
        [
          { opacity: 0, transform: 'translate(-50%, -50%) scale(0.92)' },
          { opacity: 1, transform: 'translate(-50%, -50%) scale(1)', offset: 0.12 },
          { opacity: 1, transform: 'translate(-50%, -50%) scale(1)', offset: 0.78 },
          { opacity: 0, transform: 'translate(-50%, -50%) scale(0.96)' },
        ],
        { duration: REDUCED_MS, fill: 'forwards' },
      )
    } else {
      const dx = from.left + from.width / 2 - (to.left + to.width / 2)
      const dy = from.top + from.height / 2 - (to.top + to.height / 2)
      anim = el.animate(
        [
          { transform: `translate(-50%, -50%) translate(${dx}px, ${dy}px) scale(0.35) rotate(-8deg)`, opacity: 0.2 },
          {
            transform: `translate(-50%, -50%) translate(${dx * 0.42}px, ${dy * 0.42 - 42}px) scale(1.4) rotate(6deg)`,
            opacity: 1,
            offset: 0.38,
          },
          { transform: 'translate(-50%, -50%) scale(1.12) rotate(0deg)', opacity: 1, offset: 0.55 },
          { transform: 'translate(-50%, -50%) scale(1.05)', opacity: 1, offset: 0.82 },
          { transform: 'translate(-50%, -50%) scale(0.86)', opacity: 0 },
        ],
        { duration: FLIGHT_MS, easing: 'cubic-bezier(.22,.8,.24,1)', fill: 'forwards' },
      )
    }
    const timer = window.setTimeout(() => onDone(burst.id), reduced || !from || !to ? REDUCED_MS : FLIGHT_MS)
    return () => {
      anim?.cancel()
      clearTimeout(timer)
    }
  }, [burst, def, onDone])

  if (!def) return null
  return (
    <div ref={ref} className="fixed top-0 left-0" style={{ transform: 'translate(-50%, -50%)' }}>
      {def.text ? (
        <span className="block rounded-full bg-felt-950/95 px-3 py-1.5 text-sm font-extrabold whitespace-nowrap text-ivory-50 shadow-lg ring-1 ring-accent/50">
          {def.text}
        </span>
      ) : (
        <span className="block text-5xl leading-none drop-shadow-[0_8px_12px_rgb(0_0_0/0.45)]">{def.emoji}</span>
      )}
    </div>
  )
}
