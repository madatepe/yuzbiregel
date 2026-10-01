import { create } from 'zustand'
import type { OpenKind, TileId } from '@engine/index.ts'
import { balancedLayout, moveInRack, normalizeRack, placeNewTiles, type RackSlot } from '@/lib/rack'

/** Local-only interaction state for the game screen (never synced). */
interface GameUiStore {
  rackKey: string | null
  rackSlots: RackSlot[]
  selected: TileId[]
  openMode: OpenKind
  busy: boolean
  /** Tiles involved in an in-flight move (visual hint only). */
  pendingTiles: TileId[]
  feedback: { message: string; seq: number } | null
  shakeSeq: number

  syncRack: (key: string, hand: TileId[]) => void
  setRackSlots: (slots: RackSlot[]) => void
  moveTile: (tile: TileId, slot: number) => void
  toggleSelect: (tile: TileId) => void
  setSelected: (tiles: TileId[]) => void
  clearSelection: () => void
  setOpenMode: (mode: OpenKind) => void
  setBusy: (busy: boolean, pendingTiles?: TileId[]) => void
  fail: (message: string) => void
  clearFeedback: () => void
}

const storageKey = (key: string) => `okey101:rack:${key}`

function loadSlots(key: string): RackSlot[] {
  try {
    const raw = localStorage.getItem(storageKey(key))
    return normalizeRack(raw ? JSON.parse(raw) : null)
  } catch {
    return normalizeRack(null)
  }
}

function saveSlots(key: string | null, slots: RackSlot[]) {
  if (key) localStorage.setItem(storageKey(key), JSON.stringify(slots))
}

let feedbackSeq = 0

export const useGameUi = create<GameUiStore>((set, get) => ({
  rackKey: null,
  rackSlots: normalizeRack(null),
  selected: [],
  openMode: 'series',
  busy: false,
  pendingTiles: [],
  feedback: null,
  shakeSeq: 0,

  syncRack: (key, hand) => {
    const state = get()
    const base = state.rackKey === key ? state.rackSlots : loadSlots(key)
    const inHand = new Set(hand)
    const seen = new Set<TileId>()
    let slots = base.map((t) => {
      if (t === null || !inHand.has(t) || seen.has(t)) return null
      seen.add(t)
      return t
    })
    const missing = hand.filter((t) => !seen.has(t))
    if (missing.length) slots = seen.size === 0 ? balancedLayout(hand) : placeNewTiles(slots, missing)
    const selected = state.selected.filter((t) => inHand.has(t))
    const pendingTiles = state.pendingTiles.filter((t) => inHand.has(t))
    if (pendingTiles.length !== state.pendingTiles.length) set({ pendingTiles })
    const changed =
      state.rackKey !== key ||
      slots.some((t, i) => t !== state.rackSlots[i]) ||
      selected.length !== state.selected.length
    if (!changed) return
    if (state.rackKey !== key) {
      // Drop stale racks from earlier rounds.
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i)
        if (k?.startsWith('okey101:rack:') && k !== storageKey(key)) localStorage.removeItem(k)
      }
    }
    saveSlots(key, slots)
    set({ rackKey: key, rackSlots: slots, selected })
  },
  setRackSlots: (slots) => {
    saveSlots(get().rackKey, slots)
    set({ rackSlots: slots })
  },
  moveTile: (tile, slot) => {
    const { rackSlots, rackKey } = get()
    const next = moveInRack(rackSlots, tile, slot)
    if (next === rackSlots) return
    saveSlots(rackKey, next)
    set({ rackSlots: next })
  },
  toggleSelect: (tile) =>
    set((s) => ({
      selected: s.selected.includes(tile) ? s.selected.filter((t) => t !== tile) : [...s.selected, tile],
    })),
  setSelected: (tiles) => set({ selected: tiles }),
  clearSelection: () => set({ selected: [] }),
  setOpenMode: (openMode) => set({ openMode }),
  setBusy: (busy, pendingTiles = []) => set({ busy, pendingTiles }),
  fail: (message) => set((s) => ({ feedback: { message, seq: ++feedbackSeq }, shakeSeq: s.shakeSeq + 1 })),
  clearFeedback: () => set({ feedback: null }),
}))
