import { describe, expect, it } from 'vitest'
import {
  COLORS,
  GameError,
  analyzeRun,
  analyzeSet,
  applyAction,
  createRound,
  okeyFromIndicator,
  partitionPairs,
  partitionSeries,
  scoreRound,
  tryAttach,
  type RoundState,
  type TileColor,
} from '../supabase/functions/_shared/engine/index.ts'

const t = (color: TileColor, value: number, copy = 0) => COLORS.indexOf(color) * 26 + (value - 1) * 2 + copy
const okey = okeyFromIndicator(t('yellow', 4)) // okey = yellow 5
const J = t('yellow', 5)
const J2 = t('yellow', 5, 1)
const FAKE = 104

describe('tiles', () => {
  it('indicator 13 wraps okey to 1', () => {
    expect(okeyFromIndicator(t('black', 13))).toEqual({ color: 'black', value: 1 })
  })
})

describe('runs and sets', () => {
  it('validates a simple run', () => {
    expect(analyzeRun([t('red', 3), t('red', 4), t('red', 5)], okey)?.points).toBe(12)
  })
  it('rejects mixed colors', () => {
    expect(analyzeRun([t('red', 3), t('blue', 4), t('red', 5)], okey)).toBeNull()
  })
  it('fills gaps with joker and maximizes points at ends', () => {
    const a = analyzeRun([t('red', 3), J, t('red', 5)], okey)
    expect(a?.values).toEqual([3, 4, 5])
    const b = analyzeRun([t('red', 11), t('red', 12), J], okey)
    expect(b?.values).toEqual([11, 12, 13])
  })
  it('allows 12-13-1 but not 13-1-2', () => {
    expect(analyzeRun([t('red', 12), t('red', 13), t('red', 1)], okey)).not.toBeNull()
    expect(analyzeRun([t('red', 13), t('red', 1), t('red', 2)], okey)).toBeNull()
  })
  it('fake okey acts as the okey face', () => {
    expect(analyzeRun([t('yellow', 4), FAKE, t('yellow', 6)], okey)?.points).toBe(15)
  })
  it('validates sets', () => {
    expect(analyzeSet([t('red', 7), t('blue', 7), t('black', 7)], okey)?.points).toBe(21)
    expect(analyzeSet([t('red', 7), t('red', 7, 1), t('black', 7)], okey)).toBeNull()
    expect(analyzeSet([t('red', 7), J, t('black', 7), t('blue', 7)], okey)?.points).toBe(28)
  })
})

describe('partitionSeries', () => {
  it('finds a 101+ opening', () => {
    const tiles = [
      t('red', 10), t('red', 11), t('red', 12), t('red', 13), // 46
      t('blue', 13), t('black', 13), t('yellow', 13), // 39
      t('black', 4), t('black', 5), t('black', 6), // 15
      t('blue', 1), J, t('blue', 3), // 6
    ]
    const p = partitionSeries(tiles, okey)
    expect(p).not.toBeNull()
    expect(p!.points).toBe(106)
    expect(p!.melds.length).toBe(4)
  })
  it('returns null when a tile is left over', () => {
    expect(partitionSeries([t('red', 1), t('red', 2), t('red', 3), t('blue', 9)], okey)).toBeNull()
  })
  it('stays fast on full random hands', () => {
    const start = performance.now()
    for (let i = 0; i < 50; i++) {
      const s = createRound(1, 0, 'solo')
      partitionSeries(s.hands[0], s.okey)
    }
    expect(performance.now() - start).toBeLessThan(2000)
  })
  it('uses two jokers', () => {
    const p = partitionSeries([t('red', 1), J, J2, t('blue', 9), t('blue', 10), t('blue', 11)], okey)
    expect(p).not.toBeNull()
  })
})

describe('pairs', () => {
  it('counts pairs with jokers', () => {
    const r = partitionPairs([t('red', 1), t('red', 1, 1), t('blue', 2), J, t('black', 9)], okey)
    expect(r.pairs.length).toBe(2)
    expect(r.leftovers).toEqual([t('black', 9)])
  })
})

describe('attach', () => {
  it('extends runs and sets', () => {
    const run = { id: 1, owner: 0, kind: 'run' as const, tiles: [t('red', 3), t('red', 4), t('red', 5)] }
    expect(tryAttach(run, t('red', 6), okey)).toEqual({
      tiles: [t('red', 3), t('red', 4), t('red', 5), t('red', 6)],
      takenJoker: null,
    })
    expect(tryAttach(run, t('red', 8), okey)).toBeNull()
    const set = { id: 2, owner: 0, kind: 'set' as const, tiles: [t('red', 7), t('blue', 7), t('black', 7)] }
    expect(tryAttach(set, t('yellow', 7), okey)?.takenJoker).toBeNull()
    expect(tryAttach(set, t('red', 7, 1), okey)).toBeNull()
  })

  it('returns the joker when its gap is filled', () => {
    const run = { id: 1, owner: 0, kind: 'run' as const, tiles: [t('red', 10), J, t('red', 12), t('red', 13)] }
    const result = tryAttach(run, t('red', 11), okey)
    expect(result?.tiles).toEqual([t('red', 10), t('red', 11), t('red', 12), t('red', 13)])
    expect(result?.takenJoker).toBe(J)
    expect(tryAttach(run, t('red', 9), okey)).toEqual({
      tiles: [t('red', 9), t('red', 10), J, t('red', 12), t('red', 13)],
      takenJoker: null,
    })
  })

  it('does not let 1 attach after 13', () => {
    const run = { id: 1, owner: 0, kind: 'run' as const, tiles: [t('red', 11), t('red', 12), t('red', 13)] }
    expect(tryAttach(run, t('red', 1), okey)).toBeNull()
    const wrap = { id: 2, owner: 0, kind: 'run' as const, tiles: [t('red', 12), t('red', 13), t('red', 1)] }
    expect(tryAttach(wrap, t('red', 11), okey)).toBeNull()
    const low = { id: 3, owner: 0, kind: 'run' as const, tiles: [t('red', 2), t('red', 3), t('red', 4)] }
    expect(tryAttach(low, t('red', 1), okey)?.tiles[0]).toBe(t('red', 1))
  })

  it('takes the joker from a full set when the missing color is played', () => {
    const full = {
      id: 1,
      owner: 0,
      kind: 'set' as const,
      tiles: [t('red', 7), t('blue', 7), t('black', 7), J],
    }
    const result = tryAttach(full, t('yellow', 7), okey)
    expect(result?.takenJoker).toBe(J)
    expect(result?.tiles).toHaveLength(4)
    const open = { id: 2, owner: 0, kind: 'set' as const, tiles: [t('red', 7), t('blue', 7), J] }
    expect(tryAttach(open, t('black', 7), okey)?.takenJoker).toBeNull()
  })
})

function baseState(overrides: Partial<RoundState> = {}): RoundState {
  const s = createRound(1, 0, 'solo')
  return { ...s, okey, indicator: t('yellow', 4), ...overrides }
}

describe('round flow', () => {
  it('deals 22/21 tiles', () => {
    const s = createRound(1, 2, 'solo')
    expect(s.hands.map((h) => h.length)).toEqual([21, 21, 22, 21])
    expect(s.deck.length).toBe(106 - 1 - 85)
    expect(s.phase).toBe('discard')
  })

  it('enforces turn and phase', () => {
    const s = baseState()
    expect(() => applyAction(s, 1, { type: 'draw_deck' })).toThrow(GameError)
    expect(() => applyAction(s, 0, { type: 'draw_deck' })).toThrow(/WRONG_PHASE/)
  })

  it('discard passes the turn and next player can take it', () => {
    const s = baseState()
    const tile = s.hands[0][0]
    const r1 = applyAction(s, 0, { type: 'discard', tile })
    expect(r1.state.turn).toBe(1)
    const r2 = applyAction(r1.state, 1, { type: 'take_discard' })
    expect(r2.state.hands[1]).toContain(tile)
    expect(r2.state.pendingTake).toBe(tile)
    expect(() => applyAction(r2.state, 1, { type: 'discard', tile: r2.state.hands[1][0] })).toThrow(/MUST_USE_TAKEN/)
    const r3 = applyAction(r2.state, 1, { type: 'return_discard' })
    expect(r3.state.penalties[1]).toBe(101)
    expect(r3.state.phase).toBe('draw')
  })

  it('opens with 101 and finishes', () => {
    const opening = [
      t('red', 10), t('red', 11), t('red', 12), t('red', 13),
      t('blue', 13), t('black', 13), t('yellow', 13),
      t('black', 4), t('black', 5), t('black', 6),
      t('blue', 1), J, t('blue', 3),
    ]
    const s = baseState({ hands: [[...opening, t('blue', 9)], [t('red', 2)], [], []] })
    expect(() => applyAction(s, 0, { type: 'open_series', tiles: opening.slice(0, 7) })).toThrow(/NEED_101/)
    const r = applyAction(s, 0, { type: 'open_series', tiles: opening })
    expect(r.state.opened[0]).toBe('series')
    expect(r.state.melds.length).toBe(4)
    const f = applyAction(r.state, 0, { type: 'discard', tile: t('blue', 9) })
    expect(f.state.status).toBe('finished')
    expect(f.state.result?.elden).toBe(true)
    expect(f.state.result?.scores[0]).toBe(-404)
    expect(f.state.result?.scores[1]).toBe(808)
  })

  it('gives the displaced joker to the attaching player', () => {
    const s = baseState({
      opened: ['series', null, null, null],
      hands: [[t('red', 11), t('blue', 2)], [], [], []],
      melds: [{ id: 1, owner: 1, kind: 'run', tiles: [t('red', 10), J, t('red', 12), t('red', 13)] }],
    })
    const r = applyAction(s, 0, { type: 'add_to_meld', tile: t('red', 11), meldId: 1 })
    expect(r.state.melds[0].tiles).toEqual([t('red', 10), t('red', 11), t('red', 12), t('red', 13)])
    expect(r.state.hands[0]).toEqual([t('blue', 2), J])
    expect(r.events.some((e) => e.type === 'TILE_ADDED' && e.taken === J)).toBe(true)
  })

  it('penalizes discarding a processable tile', () => {
    const s = baseState({
      hands: [[t('red', 6), t('blue', 2)], [], [], []],
      melds: [{ id: 1, owner: 1, kind: 'run', tiles: [t('red', 3), t('red', 4), t('red', 5)] }],
    })
    const r = applyAction(s, 0, { type: 'discard', tile: t('red', 6) })
    expect(r.state.penalties[0]).toBe(101)
  })

  it('scores team mode partner as zero', () => {
    const s = baseState({ mode: 'team', hands: [[], [t('red', 5)], [t('red', 9)], []], opened: ['series', 'series', 'series', null] })
    const res = scoreRound(s, 0, t('blue', 2))
    expect(res.scores).toEqual([-101, 5, 0, 202])
  })
})
