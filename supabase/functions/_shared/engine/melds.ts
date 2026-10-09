import {
  compareResolved,
  isJoker,
  resolveTile,
  type OkeyInfo,
  type ResolvedTile,
  type TileColor,
  type TileId,
} from './tiles.ts'

export type MeldKind = 'run' | 'set' | 'pair'

export interface Meld {
  id: number
  owner: number
  kind: MeldKind
  /** Ordered for display: runs low to high, jokers placed where they stand. */
  tiles: TileId[]
}

export interface MeldAnalysis {
  kind: 'run' | 'set'
  tiles: TileId[]
  points: number
  /** Value represented by each tile position (jokers included). */
  values: number[]
}

export interface SeriesPartition {
  melds: MeldAnalysis[]
  points: number
}

export interface PairPartition {
  pairs: TileId[][]
  leftovers: TileId[]
}

const RUN_MIN = 3
const SET_MIN = 3
const SET_MAX = 4

function split(ids: TileId[], okey: OkeyInfo) {
  const resolved = ids.map((id) => resolveTile(id, okey))
  return {
    reals: resolved.filter((r) => !r.joker),
    jokers: resolved.filter((r) => r.joker).map((r) => r.id),
  }
}

/** Ace may follow 13 (12-13-1); that position is 14 and scores 1. */
function positionPoints(p: number): number {
  return p === 14 ? 1 : p
}

export function analyzeRun(ids: TileId[], okey: OkeyInfo): MeldAnalysis | null {
  const n = ids.length
  if (n < RUN_MIN || n > 14) return null
  const { reals, jokers } = split(ids, okey)
  if (reals.length === 0) return null
  const color = reals[0].color
  if (reals.some((r) => r.color !== color)) return null

  const baseValues = reals.map((r) => r.value)
  if (new Set(baseValues).size !== baseValues.length) return null

  const variants: { aceHigh: boolean; values: number[] }[] = [{ aceHigh: false, values: baseValues }]
  if (baseValues.includes(1)) {
    variants.push({ aceHigh: true, values: baseValues.map((v) => (v === 1 ? 14 : v)) })
  }

  let best: MeldAnalysis | null = null
  for (const variant of variants) {
    const min = Math.min(...variant.values)
    const max = Math.max(...variant.values)
    if (max - min + 1 > n) continue
    const lowLimit = variant.aceHigh ? 2 : 1
    const highLimit = !variant.aceHigh && baseValues.includes(1) ? 13 : 14
    for (let start = max - n + 1; start <= min; start++) {
      const end = start + n - 1
      if (start < lowLimit || end > highLimit) continue
      const byValue = new Map<number, ResolvedTile>()
      reals.forEach((r, i) => byValue.set(variant.values[i], r))
      const jokerQueue = jokers.slice()
      const tiles: TileId[] = []
      const values: number[] = []
      let points = 0
      for (let p = start; p <= end; p++) {
        const real = byValue.get(p)
        tiles.push(real ? real.id : jokerQueue.shift()!)
        values.push(p === 14 ? 1 : p)
        points += positionPoints(p)
      }
      if (!best || points > best.points) best = { kind: 'run', tiles, points, values }
    }
  }
  return best
}

export function analyzeSet(ids: TileId[], okey: OkeyInfo): MeldAnalysis | null {
  const n = ids.length
  if (n < SET_MIN || n > SET_MAX) return null
  const { reals, jokers } = split(ids, okey)
  if (reals.length === 0) return null
  const value = reals[0].value
  if (reals.some((r) => r.value !== value)) return null
  if (new Set(reals.map((r) => r.color)).size !== reals.length) return null
  const sorted = reals.slice().sort(compareResolved)
  return {
    kind: 'set',
    tiles: [...sorted.map((r) => r.id), ...jokers],
    points: value * n,
    values: Array(n).fill(value),
  }
}

export function analyzeMeld(ids: TileId[], okey: OkeyInfo): MeldAnalysis | null {
  const run = analyzeRun(ids, okey)
  const set = analyzeSet(ids, okey)
  if (run && set) return run.points >= set.points ? run : set
  return run ?? set
}

export function isPair(ids: TileId[], okey: OkeyInfo): boolean {
  if (ids.length !== 2) return false
  const [a, b] = ids.map((id) => resolveTile(id, okey))
  if (a.joker || b.joker) return true
  return a.color === b.color && a.value === b.value
}

/**
 * Splits the given tiles into valid runs/sets using every tile, maximizing points.
 * Returns null when no complete partition exists.
 */
export function partitionSeries(ids: TileId[], okey: OkeyInfo): SeriesPartition | null {
  if (ids.length < RUN_MIN) return null
  const { reals, jokers } = split(ids, okey)
  reals.sort(compareResolved)
  let best: SeriesPartition | null = null

  const recurse = (remaining: ResolvedTile[], jokersLeft: TileId[], acc: MeldAnalysis[], points: number) => {
    if (remaining.length === 0) {
      if (jokersLeft.length === 0 && (!best || points > best.points)) {
        best = { melds: acc.slice(), points }
      }
      return
    }
    const [t, ...rest] = remaining

    const tryMeld = (meldIds: TileId[], usedReals: ResolvedTile[], jokersUsed: number, kind: 'run' | 'set') => {
      const analysis = kind === 'run' ? analyzeRun(meldIds, okey) : analyzeSet(meldIds, okey)
      if (!analysis) return
      const usedSet = new Set(usedReals.map((r) => r.id))
      acc.push(analysis)
      recurse(
        rest.filter((r) => !usedSet.has(r.id)),
        jokersLeft.slice(jokersUsed),
        acc,
        points + analysis.points,
      )
      acc.pop()
    }

    // Sets containing t
    const sameValue = rest.filter((r) => r.value === t.value && r.color !== t.color)
    const byColor = new Map<string, ResolvedTile>()
    for (const r of sameValue) if (!byColor.has(r.color)) byColor.set(r.color, r)
    const candidates = [...byColor.values()]
    const subsetCount = 1 << candidates.length
    for (let mask = 0; mask < subsetCount; mask++) {
      const subset = candidates.filter((_, i) => mask & (1 << i))
      for (let j = 0; j <= jokersLeft.length; j++) {
        const size = 1 + subset.length + j
        if (size < SET_MIN || size > SET_MAX) continue
        tryMeld([t.id, ...subset.map((r) => r.id), ...jokersLeft.slice(0, j)], subset, j, 'set')
      }
    }

    // Runs where t is the lowest real tile (tiles are sorted, so lower ones of its color are gone)
    const extend = (next: number, used: ResolvedTile[], jokersUsed: number, length: number, pool: ResolvedTile[]) => {
      if (length >= RUN_MIN) {
        tryMeld([t.id, ...used.map((r) => r.id), ...jokersLeft.slice(0, jokersUsed)], used, jokersUsed, 'run')
      }
      if (next > 14 || (next === 14 && t.value === 1)) return
      const wanted = next === 14 ? 1 : next
      const realIdx = pool.findIndex((r) => r.color === t.color && r.value === wanted)
      if (realIdx >= 0) {
        const real = pool[realIdx]
        extend(next + 1, [...used, real], jokersUsed, length + 1, pool.filter((_, i) => i !== realIdx))
      }
      if (jokersUsed < jokersLeft.length) {
        extend(next + 1, used, jokersUsed + 1, length + 1, pool)
      }
    }
    for (let below = 0; below <= jokersLeft.length; below++) {
      if (t.value - below < 1) break
      extend(t.value + 1, [], below, 1 + below, rest)
    }

    // Ace used after 13 (…12-13-1)
    if (t.value === 1) {
      const down = (prev: number, used: ResolvedTile[], jokersUsed: number, length: number, pool: ResolvedTile[]) => {
        if (length >= RUN_MIN) {
          tryMeld([t.id, ...used.map((r) => r.id), ...jokersLeft.slice(0, jokersUsed)], used, jokersUsed, 'run')
        }
        if (prev < 2) return
        const realIdx = pool.findIndex((r) => r.color === t.color && r.value === prev)
        if (realIdx >= 0) {
          down(prev - 1, [...used, pool[realIdx]], jokersUsed, length + 1, pool.filter((_, i) => i !== realIdx))
        }
        if (jokersUsed < jokersLeft.length) down(prev - 1, used, jokersUsed + 1, length + 1, pool)
      }
      down(13, [], 0, 1, rest)
    }
  }

  recurse(reals, jokers, [], 0)
  return best
}

export function partitionPairs(ids: TileId[], okey: OkeyInfo): PairPartition {
  const { reals, jokers } = split(ids, okey)
  const groups = new Map<string, TileId[]>()
  for (const r of reals) {
    const key = `${r.color}:${r.value}`
    const g = groups.get(key) ?? []
    g.push(r.id)
    groups.set(key, g)
  }
  const pairs: TileId[][] = []
  const singles: TileId[] = []
  for (const g of groups.values()) {
    for (let i = 0; i + 1 < g.length; i += 2) pairs.push([g[i], g[i + 1]])
    if (g.length % 2 === 1) singles.push(g[g.length - 1])
  }
  const jokerQueue = jokers.slice()
  const leftovers: TileId[] = []
  for (const s of singles) {
    if (jokerQueue.length) pairs.push([s, jokerQueue.shift()!])
    else leftovers.push(s)
  }
  while (jokerQueue.length >= 2) pairs.push([jokerQueue.shift()!, jokerQueue.shift()!])
  leftovers.push(...jokerQueue)
  return { pairs, leftovers }
}

export interface AttachResult {
  tiles: TileId[]
  /** Joker taken from the meld after its gap was filled. */
  takenJoker: TileId | null
}

/**
 * Attaching never wraps 13→1 (12-13-1 is only valid as a laid meld).
 * Filling a joker's exact seat returns that joker to the player.
 */
export function tryAttach(meld: Meld, tile: TileId, okey: OkeyInfo): AttachResult | null {
  if (meld.kind === 'pair') return null
  return meld.kind === 'run' ? tryAttachRun(meld, tile, okey) : tryAttachSet(meld, tile, okey)
}

function firstRealColor(ids: TileId[], okey: OkeyInfo): TileColor | null {
  for (const id of ids) {
    const r = resolveTile(id, okey)
    if (!r.joker) return r.color
  }
  return null
}

function isAceHighRun(values: number[]): boolean {
  return values.includes(13) && values.includes(1) && !values.includes(2)
}

function tryAttachRun(meld: Meld, tile: TileId, okey: OkeyInfo): AttachResult | null {
  const analysis = analyzeRun(meld.tiles, okey)
  if (!analysis) return null
  const resolved = resolveTile(tile, okey)
  const color = firstRealColor(analysis.tiles, okey)
  if (!color) return null
  const aceHigh = isAceHighRun(analysis.values)
  const seq = analysis.values.map((v) => (aceHigh && v === 1 ? 14 : v))

  if (!resolved.joker && resolved.color === color) {
    for (let i = 0; i < analysis.tiles.length; i++) {
      if (!isJoker(analysis.tiles[i], okey) || seq[i] !== resolved.value) continue
      const next = analysis.tiles.slice()
      const takenJoker = next[i]
      next[i] = tile
      const checked = analyzeRun(next, okey)
      if (!checked) return null
      return { tiles: checked.tiles, takenJoker }
    }
  }

  // 12-13-1 cannot grow; 1 cannot be processed onto a run that ends at 13.
  if (aceHigh) return null

  const min = seq[0]
  const max = seq[seq.length - 1]
  let next: TileId[] | null = null
  if (resolved.joker) {
    const canAppend = max < 13
    const canPrepend = min > 1
    if (canAppend && (!canPrepend || positionPoints(max + 1) >= positionPoints(min - 1))) next = [...analysis.tiles, tile]
    else if (canPrepend) next = [tile, ...analysis.tiles]
  } else if (resolved.color === color) {
    if (resolved.value === max + 1 && max < 13) next = [...analysis.tiles, tile]
    else if (resolved.value === min - 1 && min > 1) next = [tile, ...analysis.tiles]
  }
  if (!next) return null
  const checked = analyzeRun(next, okey)
  return checked ? { tiles: checked.tiles, takenJoker: null } : null
}

function tryAttachSet(meld: Meld, tile: TileId, okey: OkeyInfo): AttachResult | null {
  const analysis = analyzeSet(meld.tiles, okey)
  if (!analysis) return null
  const extended = analyzeSet([...meld.tiles, tile], okey)
  if (extended) return { tiles: extended.tiles, takenJoker: null }

  const resolved = resolveTile(tile, okey)
  if (resolved.joker) return null
  const { reals, jokers } = split(meld.tiles, okey)
  if (!jokers.length || resolved.value !== reals[0].value) return null
  if (reals.some((r) => r.color === resolved.color)) return null
  const checked = analyzeSet([...reals.map((r) => r.id), tile, ...jokers.slice(1)], okey)
  return checked ? { tiles: checked.tiles, takenJoker: jokers[0] } : null
}

export function attachableMelds(melds: Meld[], tile: TileId, okey: OkeyInfo): number[] {
  return melds.filter((m) => tryAttach(m, tile, okey)).map((m) => m.id)
}

/** Represented values for display (jokers shown as the value they stand for). */
export function meldValues(meld: Meld, okey: OkeyInfo): number[] {
  if (meld.kind === 'pair') {
    const r = meld.tiles.map((id) => resolveTile(id, okey))
    const real = r.find((x) => !x.joker)
    return r.map((x) => (x.joker ? (real?.value ?? okey.value) : x.value))
  }
  const analysis = meld.kind === 'run' ? analyzeRun(meld.tiles, okey) : analyzeSet(meld.tiles, okey)
  return analysis?.values ?? meld.tiles.map(() => 0)
}
