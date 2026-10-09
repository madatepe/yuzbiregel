import { useLayoutEffect, useRef, useState } from 'react'
import type { CardId, PistiEvent } from '@pisti/index.ts'
import { isRedSuit, rankLabel, suitSymbol } from '@/components/pisti/PlayingCard'
import { anchorRect, flyNodeTo, flyPlayingCard, sparkleBurst } from '@/lib/fly'
import { playSound } from '@/lib/sound'
import { useTable } from '@/stores/table'

export interface PistiHold {
  cards: CardId[]
  incoming?: CardId
  faceDown?: boolean
  sparkle: boolean
}

function cardMarkup(cardId: number | undefined, faceDown?: boolean): HTMLElement | undefined {
  if (faceDown || cardId == null) return undefined
  const el = document.createElement('span')
  el.className = `playing-card playing-card-lg ${isRedSuit(cardId) ? 'text-tile-red' : 'text-tile-black'}`
  const rank = document.createElement('span')
  rank.className = 'text-[0.95em]'
  rank.textContent = rankLabel(cardId)
  const suit = document.createElement('span')
  suit.className = 'mt-0.5 text-[1.15em]'
  suit.textContent = suitSymbol(cardId)
  el.append(rank, suit)
  return el
}

export function usePistiAnimations(mySeat: number): PistiHold | null {
  const eventSeq = useTable((s) => s.eventSeq)
  const pile = useTable((s) => s.pisti?.pile)
  const lastPile = useRef<CardId[]>([])
  const lastSeq = useRef(eventSeq)
  const [hold, setHold] = useState<PistiHold | null>(null)
  const gen = useRef(0)

  useLayoutEffect(() => {
    if (pile?.length) lastPile.current = pile
  }, [pile])

  useLayoutEffect(() => {
    if (eventSeq === lastSeq.current) return
    lastSeq.current = eventSeq
    const events = useTable.getState().pistiEvents
    if (!events.length) return
    const id = ++gen.current
    void playFx(events, mySeat, lastPile.current, (next) => {
      if (id === gen.current) setHold(next)
    })
  }, [eventSeq, mySeat])

  return hold
}

async function playFx(
  events: PistiEvent[],
  mySeat: number,
  priorPile: CardId[],
  setHold: (hold: PistiHold | null) => void,
) {
  const played = events.find((e) => e.type === 'CARD_PLAYED')
  const taken = events.find((e) => e.type === 'PILE_TAKEN')
  const from = played ? anchorRect(`seat-${played.seat}`) : null
  const pileEl = () => document.querySelector<HTMLElement>('[data-anchor="pisti-pile"]')
  const pileRect = () => pileEl()?.getBoundingClientRect() ?? anchorRect('pisti-pile')

  if (taken && priorPile.length) {
    setHold({ cards: priorPile, sparkle: false, faceDown: played?.faceDown, incoming: undefined })
    await new Promise((r) => requestAnimationFrame(() => r(null)))
    if (played) {
      playSound('discard')
      const pile = pileRect()
      if (from && pile) {
        const land = new DOMRect(pile.right - 40, pile.bottom - 90, 72, 102)
        await flyPlayingCard(from, land, {
          faceDown: played.faceDown,
          markup: cardMarkup(played.cardId, played.faceDown),
          holdMs: 40,
        })
      }
      setHold({
        cards: priorPile,
        incoming: played.cardId,
        faceDown: played.faceDown,
        sparkle: true,
      })
    } else {
      setHold({ cards: priorPile, sparkle: true, faceDown: true })
    }
    await new Promise((r) => requestAnimationFrame(() => r(null)))
    playSound(taken.pisti ? 'open' : 'draw')
    const sparkAt = pileRect()
    if (sparkAt) await sparkleBurst(sparkAt, taken.pisti ? 16 : 10)
    const node = pileEl()
    const to = anchorRect(`seat-${taken.seat}`)
    if (node && to) await flyNodeTo(node, to)
    setHold(null)
  } else if (played) {
    playSound('discard')
    const pile = pileRect()
    const live =
      played.cardId != null
        ? document.querySelector<HTMLElement>(`[data-anchor="pisti-pile"] [data-card-id="${played.cardId}"]`)
        : null
    if (from && pile) {
      await flyPlayingCard(from, live?.getBoundingClientRect() ?? pile, {
        faceDown: played.faceDown,
        markup: live ?? cardMarkup(played.cardId, played.faceDown),
        holdMs: 80,
      })
    }
  }

  const turn = events.find((e) => e.type === 'TURN_CHANGED')
  if (turn?.nextTurn === mySeat) playSound('turn')
  if (events.some((e) => e.type === 'DEAL_FINISHED' || e.type === 'GAME_FINISHED')) {
    playSound(events.some((e) => e.type === 'GAME_FINISHED') ? 'gameEnd' : 'roundEnd')
  }
}
