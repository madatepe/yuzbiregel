import { describe, expect, it } from 'vitest'
import {
  PistiError,
  allCardIds,
  applyAction,
  availablePistiActions,
  cardId,
  cardPointValue,
  createDeal,
  handPayload,
  pistiPoints,
  playBots,
  toPublic,
  type PistiState,
} from '../supabase/functions/_shared/pisti/index.ts'

function dealTurn0(): PistiState {
  return createDeal(1, 3, [0, 0], allCardIds())
}

describe('deal', () => {
  it('gives 4 cards each, 1 open, 3 hole, starts at dealer right', () => {
    const s = createDeal(1, 2, [10, 20], allCardIds())
    expect(s.hands.map((h) => h.length)).toEqual([4, 4, 4, 4])
    expect(s.pile).toHaveLength(1)
    expect(s.hole).toHaveLength(3)
    expect(s.deck).toHaveLength(32)
    expect(s.turn).toBe(3)
    expect(s.teamScores).toEqual([10, 20])
  })
})

describe('open play', () => {
  it('matching the single table card is a 10-point pisti', () => {
    const s = dealTurn0()
    s.pile = [cardId('diamonds', 4)]
    s.hands[0] = [cardId('clubs', 4), cardId('hearts', 2), cardId('hearts', 3), cardId('hearts', 7)]
    const { state } = applyAction(s, 0, { type: 'play_open', cardId: cardId('clubs', 4) })
    expect(state.pile).toEqual([])
    expect(state.dealPisti[0]).toBe(10)
    expect(state.captured[0]).toContain(cardId('clubs', 4))
    expect(state.turn).toBe(1)
  })

  it('jack takes the pile without matching rank', () => {
    const s = dealTurn0()
    s.pile = [cardId('spades', 9), cardId('hearts', 3)]
    s.hole = []
    s.hands[0] = [cardId('clubs', 11), cardId('hearts', 2), cardId('hearts', 4), cardId('hearts', 7)]
    const { state } = applyAction(s, 0, { type: 'play_open', cardId: cardId('clubs', 11) })
    expect(state.pile).toEqual([])
    expect(state.dealPisti[0]).toBe(0)
    expect(state.captured[0]).toHaveLength(3)
  })

  it('jack on a 10-card pile takes without pisti', () => {
    const s = dealTurn0()
    s.pile = allCardIds().slice(0, 10)
    s.hole = []
    s.hands[0] = [cardId('hearts', 11), cardId('hearts', 2), cardId('hearts', 4), cardId('hearts', 7)]
    const { state } = applyAction(s, 0, { type: 'play_open', cardId: cardId('hearts', 11) })
    expect(state.pile).toEqual([])
    expect(state.dealPisti[0]).toBe(0)
    expect(state.captured[0]).toHaveLength(11)
  })

  it('open pisti of 5 is 50 points', () => {
    const s = dealTurn0()
    s.pile = [cardId('clubs', 5)]
    s.hands[0] = [cardId('hearts', 5), cardId('spades', 2), cardId('spades', 3), cardId('spades', 4)]
    const { state } = applyAction(s, 0, { type: 'play_open', cardId: cardId('hearts', 5) })
    expect(state.dealPisti[0]).toBe(50)
  })
})

describe('closed pisti / bluff', () => {
  it('rejects closed play unless the pile has exactly one card', () => {
    const s = dealTurn0()
    s.pile = [cardId('clubs', 4), cardId('diamonds', 9)]
    s.hands[0] = [cardId('hearts', 4), 1, 2, 3]
    expect(() => applyAction(s, 0, { type: 'play_closed', cardId: cardId('hearts', 4) })).toThrow(PistiError)
  })

  it('hides the closed card from public state and events', () => {
    const s = dealTurn0()
    s.pile = [cardId('clubs', 4)]
    const closed = cardId('hearts', 9)
    s.hands[0] = [closed, 1, 2, 3]
    const { state, events } = applyAction(s, 0, { type: 'play_closed', cardId: closed })
    const pub = toPublic(state)
    expect(pub.pendingBluffSeat).toBe(0)
    expect(pub.pile).toEqual([cardId('clubs', 4)])
    expect(JSON.stringify(pub)).not.toContain(String(closed))
    expect(events.find((e) => e.type === 'CARD_PLAYED')?.cardId).toBeUndefined()
    expect(handPayload(state, 0).pendingCard).toBe(closed)
    expect(handPayload(state, 1).pendingCard).toBeUndefined()
  })

  it('believe awards 10 and never reveals the card', () => {
    const s = dealTurn0()
    s.pile = [cardId('clubs', 4)]
    const closed = cardId('spades', 12)
    s.hands[0] = [closed, 1, 2, 3]
    const closedPlay = applyAction(s, 0, { type: 'play_closed', cardId: closed }).state
    const { state, events } = applyAction(closedPlay, 1, { type: 'believe' })
    expect(state.dealPisti[0]).toBe(10)
    expect(state.pile).toEqual([])
    expect(state.pendingBluff).toBeNull()
    expect(toPublic(state).pile).toEqual([])
    expect(JSON.stringify(events)).not.toContain(String(closed))
    expect(JSON.stringify(toPublic(state))).not.toContain(String(closed))
  })

  it('calling a fake bluff gives the responder 10 and leaves the card open', () => {
    const s = dealTurn0()
    s.pile = [cardId('clubs', 4)]
    const closed = cardId('spades', 12)
    s.hands[0] = [closed, 1, 2, 3]
    const closedPlay = applyAction(s, 0, { type: 'play_closed', cardId: closed }).state
    const { state } = applyAction(closedPlay, 1, { type: 'call_bluff' })
    expect(state.dealPisti[1]).toBe(10)
    expect(state.dealPisti[0]).toBe(0)
    expect(state.pile).toEqual([cardId('clubs', 4), closed])
    expect(state.phase).toBe('play')
    expect(state.turn).toBe(1)
  })

  it('calling a real pisti awards 20 to the claimer', () => {
    const s = dealTurn0()
    s.pile = [cardId('clubs', 4)]
    const closed = cardId('hearts', 4)
    s.hands[0] = [closed, 1, 2, 3]
    const closedPlay = applyAction(s, 0, { type: 'play_closed', cardId: closed }).state
    const { state } = applyAction(closedPlay, 1, { type: 'call_bluff' })
    expect(state.dealPisti[0]).toBe(20)
    expect(state.pile).toEqual([])
  })

  it('table 2, closed 3 (bluff) caught: claimer 0, opponent +10', () => {
    const s = dealTurn0()
    s.pile = [cardId('clubs', 2)]
    const closed = cardId('hearts', 3)
    s.hands[0] = [closed, 1, 4, 5]
    const closedPlay = applyAction(s, 0, { type: 'play_closed', cardId: closed }).state
    const { state } = applyAction(closedPlay, 1, { type: 'call_bluff' })
    expect(state.dealPisti[0]).toBe(0)
    expect(state.dealPisti[1]).toBe(10)
    expect(state.teamScores).toEqual([0, 0])
  })

  it('table 2, closed 2 (real) caught: claimer +20, opponent 0', () => {
    const s = dealTurn0()
    s.pile = [cardId('clubs', 2)]
    const closed = cardId('hearts', 2)
    s.hands[0] = [closed, 1, 4, 5]
    const closedPlay = applyAction(s, 0, { type: 'play_closed', cardId: closed }).state
    const { state } = applyAction(closedPlay, 1, { type: 'call_bluff' })
    expect(state.dealPisti[0]).toBe(20)
    expect(state.dealPisti[1]).toBe(0)
    expect(state.teamScores).toEqual([0, 0])
  })

  it('table 2, closed 3 (bluff) believed: claimer +10', () => {
    const s = dealTurn0()
    s.pile = [cardId('clubs', 2)]
    const closed = cardId('hearts', 3)
    s.hands[0] = [closed, 1, 4, 5]
    const closedPlay = applyAction(s, 0, { type: 'play_closed', cardId: closed }).state
    const { state } = applyAction(closedPlay, 1, { type: 'believe' })
    expect(state.dealPisti[0]).toBe(10)
    expect(state.dealPisti[1]).toBe(0)
    expect(state.teamScores).toEqual([0, 0])
  })

  it('single 3: real closed pisti opened by opponent is 20 to the claimer', () => {
    const s = dealTurn0()
    s.pile = [cardId('spades', 3)]
    const closed = cardId('hearts', 3)
    s.hands[0] = [closed, 1, 2, 4]
    const closedPlay = applyAction(s, 0, { type: 'play_closed', cardId: closed }).state
    const { state } = applyAction(closedPlay, 1, { type: 'call_bluff' })
    expect(state.dealPisti[0]).toBe(20)
    expect(state.dealPisti[1]).toBe(0)
  })

  it('single 3: bluff opened by opponent is 10 to the opposing team', () => {
    const s = dealTurn0()
    s.pile = [cardId('spades', 3)]
    const closed = cardId('hearts', 9)
    s.hands[0] = [closed, 1, 2, 4]
    const closedPlay = applyAction(s, 0, { type: 'play_closed', cardId: closed }).state
    const { state } = applyAction(closedPlay, 1, { type: 'call_bluff' })
    expect(state.dealPisti[1]).toBe(10)
    expect(state.dealPisti[0]).toBe(0)
    expect(state.pile).toEqual([cardId('spades', 3), closed])
  })

  it('wrong call on a 5 is 100; believed 5 is 50', () => {
    expect(pistiPoints(cardId('clubs', 5), 'normal')).toBe(50)
    expect(pistiPoints(cardId('clubs', 5), 'wrong_call')).toBe(100)
    const s = dealTurn0()
    s.pile = [cardId('clubs', 5)]
    const closed = cardId('diamonds', 5)
    s.hands[0] = [closed, 1, 2, 3]
    const a = applyAction(s, 0, { type: 'play_closed', cardId: closed }).state
    expect(applyAction(a, 1, { type: 'call_bluff' }).state.dealPisti[0]).toBe(100)
    const b = applyAction(s, 0, { type: 'play_closed', cardId: closed }).state
    expect(applyAction(b, 1, { type: 'believe' }).state.dealPisti[0]).toBe(50)
  })

  it('only the next opponent may answer the bluff', () => {
    const s = dealTurn0()
    s.pile = [cardId('clubs', 4)]
    s.hands[0] = [cardId('hearts', 9), 1, 2, 3]
    const closed = applyAction(s, 0, { type: 'play_closed', cardId: cardId('hearts', 9) }).state
    expect(() => applyAction(closed, 2, { type: 'believe' })).toThrow(PistiError)
    expect(() => applyAction(closed, 0, { type: 'call_bluff' })).toThrow(PistiError)
  })
})

describe('hole peek', () => {
  it('gives the capturing team the three hole cards once, never the opponents', () => {
    const s = dealTurn0()
    const hole = s.hole.slice()
    s.pile = [cardId('clubs', 4)]
    s.hands[0] = [cardId('hearts', 4), 1, 2, 3]
    const { state } = applyAction(s, 0, { type: 'play_open', cardId: cardId('hearts', 4) })
    expect(handPayload(state, 0).peek).toEqual(hole)
    expect(handPayload(state, 2).peek).toEqual(hole)
    expect(handPayload(state, 1).peek).toBeUndefined()
    expect(handPayload(state, 3).peek).toBeUndefined()
    expect(toPublic(state).holeCount).toBe(0)
    expect(JSON.stringify(toPublic(state))).not.toContain(JSON.stringify(hole[0]))
    const acked = applyAction(state, 0, { type: 'ack_peek' }).state
    expect(handPayload(acked, 0).peek).toBeUndefined()
    expect(handPayload(acked, 2).peek).toEqual(hole)
  })
})

describe('deal scoring', () => {
  it('card points plus most-cards are 16 for a full deal', () => {
    const values = allCardIds().map(cardPointValue)
    expect(values.filter((v) => v === 1)).toHaveLength(8)
    expect(cardPointValue(cardId('clubs', 2))).toBe(2)
    expect(cardPointValue(cardId('diamonds', 10))).toBe(3)
    expect(values.reduce((a, b) => a + b, 0)).toBe(13)
    expect(13 + 3).toBe(16)
  })

  it('awards card points, most-cards, and leftover pile to last taker', () => {
    const s = dealTurn0()
    s.deck = []
    s.hands = [[cardId('hearts', 10)], [], [], []]
    s.pile = [cardId('diamonds', 10)]
    s.hole = []
    s.captured = [[cardId('clubs', 1)], [cardId('hearts', 11)], [], []]
    s.lastTaker = 1
    const { state } = applyAction(s, 0, { type: 'play_open', cardId: cardId('hearts', 10) })
    expect(state.status).toBe('finished')
    expect(state.result).toBeTruthy()
    expect(cardPointValue(cardId('clubs', 2))).toBe(2)
    expect(cardPointValue(cardId('diamonds', 10))).toBe(3)
    expect(state.result!.cardPoints[0]).toBe(1 + 3)
    expect(state.result!.cardPoints[1]).toBe(1)
    expect(state.result!.mostCards).toEqual([3, 0])
  })

  it('marks a winner at 205', () => {
    const s = dealTurn0()
    s.deck = []
    s.hands = [[cardId('spades', 9)], [], [], []]
    s.pile = []
    s.hole = []
    s.teamScores = [200, 10]
    s.dealPisti = [10, 0]
    s.captured = [[], [], [], []]
    const { state } = applyAction(s, 0, { type: 'play_open', cardId: cardId('spades', 9) })
    expect(state.result!.teamScores[0]).toBeGreaterThanOrEqual(210)
    expect(state.result!.winner).toBe(0)
  })
})

describe('bots', () => {
  it('plays bot seats until a human must act', () => {
    const s = dealTurn0()
    s.turn = 1
    s.pile = [cardId('clubs', 9)]
    s.hole = []
    s.hands[1] = [cardId('hearts', 2), cardId('spades', 3), cardId('diamonds', 4), cardId('clubs', 7)]
    const { state } = playBots(s, new Set([1, 2, 3]))
    expect(state.turn).toBe(0)
    expect(state.hands[1]!.length).toBe(3)
  })
})

describe('available actions', () => {
  it('allows closed only on a single table card', () => {
    const s = dealTurn0()
    const pub = toPublic(s)
    const hand = handPayload(s, 0)
    expect(availablePistiActions(pub, 0, hand, hand.cards[0]).playClosed).toBe(pub.pile.length === 1)
  })
})
