import { isJoker, isPair, partitionSeries, tileFace, type OkeyInfo, type OpenKind, type TileId } from '@engine/index.ts'
import { sortBySeries } from './tiles'

/** The rack is a fixed grid of slots (2 rows) so players can leave gaps between groups. */
export const RACK_COLS = 15
export const RACK_ROWS = 2
export const RACK_SLOTS = RACK_COLS * RACK_ROWS

export type RackSlot = TileId | null

export const emptyRack = (): RackSlot[] => Array<RackSlot>(RACK_SLOTS).fill(null)

export const rackTiles = (slots: RackSlot[]): TileId[] => slots.filter((t): t is TileId => t !== null)

/** Accepts persisted data (including the old flat-order format) and returns a valid rack. */
export function normalizeRack(raw: unknown): RackSlot[] {
  if (!Array.isArray(raw)) return emptyRack()
  if (raw.length === RACK_SLOTS) return raw.map((v) => (typeof v === 'number' ? v : null))
  return compactLayout(raw.filter((v): v is TileId => typeof v === 'number'))
}

function compactLayout(tiles: TileId[]): RackSlot[] {
  const slots = emptyRack()
  tiles.slice(0, RACK_SLOTS).forEach((t, i) => (slots[i] = t))
  return slots
}

/** Initial deal: split evenly over both rows, leaving room at the row ends. */
export function balancedLayout(tiles: TileId[]): RackSlot[] {
  const slots = emptyRack()
  const top = Math.min(RACK_COLS, Math.ceil(tiles.length / 2))
  tiles.forEach((t, i) => {
    const index = i < top ? i : RACK_COLS + (i - top)
    if (index < RACK_SLOTS) slots[index] = t
  })
  return slots
}

/**
 * Places groups left to right with one empty slot between them. Prefers keeping each
 * group on a single row, then allows wrapping, and finally drops the gaps if space runs out.
 */
export function groupLayout(groups: TileId[][]): RackSlot[] {
  const groupsList = groups.filter((g) => g.length > 0)

  const strict = (): RackSlot[] | null => {
    const slots = emptyRack()
    let row = 0
    let col = 0
    for (const g of groupsList) {
      if (col > 0) col++
      if (col + g.length > RACK_COLS) {
        if (row + 1 >= RACK_ROWS || g.length > RACK_COLS) return null
        row++
        col = 0
      }
      g.forEach((t, i) => (slots[row * RACK_COLS + col + i] = t))
      col += g.length
    }
    return slots
  }

  const wrapping = (): RackSlot[] | null => {
    const cells = groupsList.reduce((n, g) => n + g.length, 0) + Math.max(0, groupsList.length - 1)
    if (cells > RACK_SLOTS) return null
    const slots = emptyRack()
    let i = 0
    groupsList.forEach((g, gi) => {
      if (gi > 0 && i % RACK_COLS !== 0) i++
      for (const t of g) slots[i++] = t
    })
    return slots
  }

  return strict() ?? wrapping() ?? compactLayout(groupsList.flat())
}

/** Runs of consecutive same-color tiles become groups; leftovers and okeys go last. */
export function seriesGroups(tiles: TileId[], okey: OkeyInfo): TileId[][] {
  const sorted = sortBySeries(tiles, okey)
  const jokers = sorted.filter((t) => isJoker(t, okey))
  const face = (id: TileId) => {
    const f = tileFace(id)
    return f.fake ? { color: okey.color, value: okey.value } : { color: f.color!, value: f.value! }
  }
  const runs: TileId[][] = []
  for (const t of sorted) {
    if (isJoker(t, okey)) continue
    const last = runs[runs.length - 1]
    const prev = last?.[last.length - 1]
    if (prev !== undefined && face(prev).color === face(t).color && face(t).value === face(prev).value + 1) last.push(t)
    else runs.push([t])
  }
  const kept = runs.filter((r) => r.length >= 2)
  const singles = runs.filter((r) => r.length < 2).flat()
  return [...kept, [...singles, ...jokers]]
}

/** Identical tiles side by side as separate groups; the rest last. */
export function pairGroups(tiles: TileId[], okey: OkeyInfo): TileId[][] {
  const key = (id: TileId) => {
    const f = tileFace(id)
    return f.fake ? `${okey.color}:${okey.value}` : `${f.color}:${f.value}`
  }
  const sorted = sortBySeries(tiles, okey)
  const jokers = sorted.filter((t) => isJoker(t, okey))
  const buckets = new Map<string, TileId[]>()
  for (const t of sorted) {
    if (isJoker(t, okey)) continue
    const k = key(t)
    buckets.set(k, [...(buckets.get(k) ?? []), t])
  }
  const pairs: TileId[][] = []
  const rest: TileId[] = []
  for (const group of buckets.values()) {
    if (group.length >= 2) pairs.push(group.slice(0, 2))
    rest.push(...group.slice(2), ...(group.length < 2 ? group : []))
  }
  return [...pairs, [...rest, ...jokers]]
}

/**
 * Moves a tile to a slot. An occupied target pushes its neighbours toward the nearest
 * empty slot in the same row; if that row is full the two tiles swap.
 */
export function moveInRack(slots: RackSlot[], tile: TileId, to: number): RackSlot[] {
  const from = slots.indexOf(tile)
  if (from < 0 || from === to || to < 0 || to >= RACK_SLOTS) return slots
  const next = slots.slice()
  next[from] = null
  if (next[to] === null) {
    next[to] = tile
    return next
  }
  const start = Math.floor(to / RACK_COLS) * RACK_COLS
  const end = start + RACK_COLS
  let right = -1
  for (let i = to + 1; i < end; i++) if (next[i] === null) { right = i; break }
  let left = -1
  for (let i = to - 1; i >= start; i--) if (next[i] === null) { left = i; break }

  if (right >= 0 && (left < 0 || right - to <= to - left)) {
    for (let j = right; j > to; j--) next[j] = next[j - 1]
  } else if (left >= 0) {
    for (let j = left; j < to; j++) next[j] = next[j + 1]
  } else {
    next[from] = next[to]
  }
  next[to] = tile
  return next
}

/** Runs of adjacent tiles on the same row; an empty slot or the row end splits them. */
export function rackGroups(slots: RackSlot[]): TileId[][] {
  const groups: TileId[][] = []
  let current: TileId[] = []
  slots.forEach((t, i) => {
    if (i % RACK_COLS === 0 && current.length) {
      groups.push(current)
      current = []
    }
    if (t === null) {
      if (current.length) groups.push(current)
      current = []
    } else current.push(t)
  })
  if (current.length) groups.push(current)
  return groups
}

/**
 * Tiles the player has arranged into valid melds (series) or adjacent pairs on the rack.
 * Within a group, the longest valid stretch starting at each position wins.
 */
export function arrangedMeldTiles(slots: RackSlot[], okey: OkeyInfo, mode: OpenKind): TileId[] {
  const out: TileId[] = []
  for (const g of rackGroups(slots)) {
    let i = 0
    while (i < g.length) {
      if (mode === 'pairs') {
        if (i + 1 < g.length && isPair([g[i], g[i + 1]], okey)) {
          out.push(g[i], g[i + 1])
          i += 2
        } else i++
        continue
      }
      let end = -1
      for (let j = g.length; j >= i + 3; j--) {
        if (partitionSeries(g.slice(i, j), okey)) {
          end = j
          break
        }
      }
      if (end < 0) i++
      else {
        out.push(...g.slice(i, end))
        i = end
      }
    }
  }
  return out
}

/** Puts newly received tiles into the first free slot after the last occupied one. */
export function placeNewTiles(slots: RackSlot[], tiles: TileId[]): RackSlot[] {
  const next = slots.slice()
  for (const t of tiles) {
    let last = -1
    next.forEach((s, i) => s !== null && (last = i))
    let index = next.findIndex((s, i) => s === null && i > last)
    if (index < 0) index = next.indexOf(null)
    if (index < 0) break
    next[index] = t
  }
  return next
}
