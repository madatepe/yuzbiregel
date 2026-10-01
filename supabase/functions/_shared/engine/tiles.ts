export type TileColor = 'red' | 'blue' | 'yellow' | 'black'
export type TileId = number

export const COLORS: readonly TileColor[] = ['red', 'blue', 'yellow', 'black']
export const TILE_COUNT = 106
export const FAKE_OKEY_IDS: readonly TileId[] = [104, 105]

export interface TileFace {
  id: TileId
  /** Printed color; null for the fake okey (sahte okey). */
  color: TileColor | null
  /** Printed value 1-13; 0 for the fake okey. */
  value: number
  fake: boolean
}

export interface OkeyInfo {
  color: TileColor
  value: number
}

/** A tile resolved against the current okey: jokers are wildcards, fake okeys take the okey's face. */
export interface ResolvedTile {
  id: TileId
  joker: boolean
  color: TileColor
  value: number
}

export function tileFace(id: TileId): TileFace {
  if (id >= 104) return { id, color: null, value: 0, fake: true }
  const color = COLORS[Math.floor(id / 26)]
  const value = Math.floor((id % 26) / 2) + 1
  return { id, color, value, fake: false }
}

export function allTileIds(): TileId[] {
  return Array.from({ length: TILE_COUNT }, (_, i) => i)
}

export function okeyFromIndicator(indicator: TileId): OkeyInfo {
  const face = tileFace(indicator)
  if (face.fake || !face.color) throw new Error('Indicator cannot be a fake okey')
  return { color: face.color, value: face.value === 13 ? 1 : face.value + 1 }
}

export function isJoker(id: TileId, okey: OkeyInfo): boolean {
  const f = tileFace(id)
  return !f.fake && f.color === okey.color && f.value === okey.value
}

export function resolveTile(id: TileId, okey: OkeyInfo): ResolvedTile {
  const f = tileFace(id)
  if (f.fake) return { id, joker: false, color: okey.color, value: okey.value }
  return { id, joker: f.color === okey.color && f.value === okey.value, color: f.color!, value: f.value }
}

/** Penalty value of a tile left in hand. */
export function handTileValue(id: TileId, okey: OkeyInfo): number {
  const r = resolveTile(id, okey)
  return r.joker ? 101 : r.value
}

export function randomInt(max: number): number {
  const buf = new Uint32Array(1)
  crypto.getRandomValues(buf)
  return buf[0] % max
}

export function shuffle<T>(items: T[]): T[] {
  const a = items.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1)
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const COLOR_ORDER: Record<TileColor, number> = { red: 0, blue: 1, yellow: 2, black: 3 }

export function compareResolved(a: ResolvedTile, b: ResolvedTile): number {
  if (a.joker !== b.joker) return a.joker ? 1 : -1
  return COLOR_ORDER[a.color] - COLOR_ORDER[b.color] || a.value - b.value || a.id - b.id
}
