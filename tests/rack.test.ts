import { describe, expect, it } from 'vitest'
import { okeyFromIndicator } from '@engine/index.ts'
import {
  RACK_COLS,
  RACK_SLOTS,
  arrangedMeldTiles,
  balancedLayout,
  emptyRack,
  groupLayout,
  moveInRack,
  normalizeRack,
  pairGroups,
  placeNewTiles,
  rackTiles,
  seriesGroups,
} from '@/lib/rack'

const id = (color: number, value: number, copy = 0) => color * 26 + (value - 1) * 2 + copy
// Indicator black 1 -> okey black 2, so the reds/blues below are plain tiles.
const okey = okeyFromIndicator(id(3, 1))

describe('rack slots', () => {
  it('moves a tile into an empty slot leaving a gap behind', () => {
    const slots = balancedLayout([1, 2, 3])
    const next = moveInRack(slots, 1, 5)
    expect(next[0]).toBeNull()
    expect(next[5]).toBe(1)
    expect(rackTiles(next).sort()).toEqual([1, 2, 3])
  })

  it('pushes neighbours toward the nearest gap when dropping on a tile', () => {
    const slots = emptyRack()
    ;[10, 11, 12].forEach((t, i) => (slots[i] = t))
    slots[6] = 13
    const next = moveInRack(slots, 13, 1)
    expect(next.slice(0, 4)).toEqual([10, 13, 11, 12])
    expect(next[6]).toBeNull()
  })

  it('swaps when the target row is full', () => {
    const slots = emptyRack()
    for (let i = 0; i < RACK_COLS; i++) slots[i] = i + 100
    slots[RACK_COLS] = 7
    const next = moveInRack(slots, 7, 3)
    expect(next[3]).toBe(7)
    expect(next[RACK_COLS]).toBe(103)
  })

  it('places drawn tiles after the last tile', () => {
    const slots = emptyRack()
    slots[0] = 1
    slots[4] = 2
    expect(placeNewTiles(slots, [3])[5]).toBe(3)
  })

  it('converts the old flat order format', () => {
    const slots = normalizeRack([5, 6, 7])
    expect(slots).toHaveLength(RACK_SLOTS)
    expect(slots.slice(0, 3)).toEqual([5, 6, 7])
  })

  it('lays out groups with a gap and keeps groups on one row', () => {
    const slots = groupLayout([[1, 2, 3], [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]])
    expect(slots.slice(0, 4)).toEqual([1, 2, 3, null])
    expect(slots[RACK_COLS]).toBe(4)
  })

  it('falls back to a compact layout when gaps do not fit', () => {
    const groups = Array.from({ length: 22 }, (_, i) => [i + 200])
    expect(rackTiles(groupLayout(groups))).toHaveLength(22)
  })

  it('groups consecutive runs and pairs', () => {
    const red = [id(0, 3), id(0, 4), id(0, 5), id(0, 9)]
    const blue = [id(1, 7), id(1, 7, 1)]
    const series = seriesGroups([...red, ...blue], okey)
    expect(series[0]).toEqual([id(0, 3), id(0, 4), id(0, 5)])
    const pairs = pairGroups([...red, ...blue], okey)
    expect(pairs[0]).toEqual([id(1, 7), id(1, 7, 1)])
  })

  it('counts pairs arranged side by side on the rack', () => {
    const slots = emptyRack()
    ;[id(0, 9), id(0, 9, 1), null, id(1, 1), id(1, 1, 1), id(0, 4)].forEach((t, i) => (slots[i] = t))
    slots[RACK_COLS - 1] = id(1, 5)
    slots[RACK_COLS] = id(1, 5, 1)
    expect(arrangedMeldTiles(slots, okey, 'pairs')).toEqual([id(0, 9), id(0, 9, 1), id(1, 1), id(1, 1, 1)])
  })

  it('counts runs and sets inside rack groups, skipping loose tiles', () => {
    const slots = emptyRack()
    ;[id(0, 13), id(1, 4), id(1, 5), id(1, 6), id(1, 7), null, id(0, 10), id(1, 10), id(2, 10)].forEach(
      (t, i) => (slots[i] = t),
    )
    expect(arrangedMeldTiles(slots, okey, 'series')).toEqual([
      id(1, 4), id(1, 5), id(1, 6), id(1, 7), id(0, 10), id(1, 10), id(2, 10),
    ])
  })
})
