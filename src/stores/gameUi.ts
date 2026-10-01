import { create } from 'zustand'
import type { OpenKind, TileId } from '@engine/index.ts'

/** Local-only interaction state for the game screen (never synced). */
interface GameUiStore {
  rackKey: string | null
  rackOrder: TileId[]
  selected: TileId[]
  openMode: OpenKind
  busy: boolean
  /** Tiles involved in an in-flight move (visual hint only). */
  pendingTiles: TileId[]
  feedback: { message: string; seq: number } | null
  shakeSeq: number

  syncRack: (key: string, hand: TileId[]) => void
  setRackOrder: (order: TileId[]) => void
  toggleSelect: (tile: TileId) => void
  setSelected: (tiles: TileId[]) => void
  clearSelection: () => void
  setOpenMode: (mode: OpenKind) => void
  setBusy: (busy: boolean, pendingTiles?: TileId[]) => void
  fail: (message: string) => void
  clearFeedback: () => void
}

const storageKey = (key: string) => `okey101:rack:${key}`

function loadOrder(key: string): TileId[] {
  try {
    const raw = localStorage.getItem(storageKey(key))
    return raw ? (JSON.parse(raw) as TileId[]) : []
  } catch {
    return []
  }
}

let feedbackSeq = 0

export const useGameUi = create<GameUiStore>((set, get) => ({
  rackKey: null,
  rackOrder: [],
  selected: [],
  openMode: 'series',
  busy: false,
  pendingTiles: [],
  feedback: null,
  shakeSeq: 0,

  syncRack: (key, hand) => {
    const state = get()
    const base = state.rackKey === key ? state.rackOrder : loadOrder(key)
    const inHand = new Set(hand)
    const kept = base.filter((t) => inHand.has(t))
    const keptSet = new Set(kept)
    const order = [...kept, ...hand.filter((t) => !keptSet.has(t))]
    const selected = state.selected.filter((t) => inHand.has(t))
    const pendingTiles = state.pendingTiles.filter((t) => inHand.has(t))
    if (pendingTiles.length !== state.pendingTiles.length) set({ pendingTiles })
    const changed =
      state.rackKey !== key ||
      order.length !== state.rackOrder.length ||
      order.some((t, i) => t !== state.rackOrder[i]) ||
      selected.length !== state.selected.length
    if (!changed) return
    if (state.rackKey !== key) {
      // Drop stale racks from earlier rounds.
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i)
        if (k?.startsWith('okey101:rack:') && k !== storageKey(key)) localStorage.removeItem(k)
      }
    }
    localStorage.setItem(storageKey(key), JSON.stringify(order))
    set({ rackKey: key, rackOrder: order, selected })
  },
  setRackOrder: (order) => {
    const { rackKey } = get()
    if (rackKey) localStorage.setItem(storageKey(rackKey), JSON.stringify(order))
    set({ rackOrder: order })
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
