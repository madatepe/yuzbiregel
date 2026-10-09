import { useEffect, useLayoutEffect, useRef } from 'react'
import { prevSeat, type TileId } from '@engine/index.ts'
import { anchorRect, flyBetween, flyTo, takeRemembered } from '@/lib/fly'
import { playSound } from '@/lib/sound'
import { useTable } from '@/stores/table'

function tileEl(scope: string, id: TileId) {
  return document.querySelector<HTMLElement>(`${scope} [data-tile-id="${id}"]`)
}

/**
 * Turns authoritative server events into short cosmetic animations and sounds.
 * Nothing here changes game state.
 */
export function useGameAnimations(mySeat: number) {
  const eventSeq = useTable((s) => s.eventSeq)
  const handVersion = useTable((s) => s.handVersion)
  const lastSeq = useRef(eventSeq)
  const lastHand = useRef<TileId[] | null>(null)

  useLayoutEffect(() => {
    if (eventSeq === lastSeq.current) return
    lastSeq.current = eventSeq
    const { events, pub } = useTable.getState()
    if (!pub) return
    for (const e of events) {
      const seatAnchor = anchorRect(`seat-${e.seat}`) ?? anchorRect(`discard-${e.seat}`)
      const mine = e.seat === mySeat
      switch (e.type) {
        case 'TILE_DRAWN': {
          playSound('draw')
          if (!mine) {
            const deck = anchorRect('deck')
            if (deck && seatAnchor) flyBetween(deck, seatAnchor)
          }
          break
        }
        case 'DISCARD_TAKEN': {
          playSound('draw')
          if (!mine) {
            const pile = anchorRect(`discard-${prevSeat(e.seat)}`)
            if (pile && seatAnchor) flyBetween(pile, seatAnchor)
          }
          break
        }
        case 'TILE_DISCARDED':
        case 'DISCARD_RETURNED': {
          playSound('discard')
          if (e.tile === undefined) break
          const pileSeat = e.type === 'TILE_DISCARDED' ? e.seat : prevSeat(e.seat)
          const target = tileEl(`[data-anchor="discard-${pileSeat}"]`, e.tile)
          const from = (mine ? takeRemembered(e.tile) : null) ?? seatAnchor
          if (target && from) flyTo({ target, from, rotate: 10, duration: 460 })
          break
        }
        case 'MELD_CREATED': {
          playSound('open')
          const ids = new Set(e.meldIds ?? [])
          let delay = 0
          for (const meld of pub.melds.filter((m) => ids.has(m.id))) {
            for (const tile of meld.tiles) {
              const target = tileEl(`[data-anchor="meld-${meld.id}"]`, tile)
              const from = (mine ? takeRemembered(tile) : null) ?? seatAnchor
              if (target && from) flyTo({ target, from, delay, duration: 480 })
              delay += 28
            }
          }
          break
        }
        case 'TILE_ADDED': {
          playSound('open')
          const meldId = e.meldIds?.[0]
          if (meldId === undefined || e.tile === undefined) break
          const target = tileEl(`[data-anchor="meld-${meldId}"]`, e.tile)
          const from = (mine ? takeRemembered(e.tile) : null) ?? seatAnchor
          if (target && from) flyTo({ target, from, duration: 440 })
          if (e.taken !== undefined) {
            const jokerTarget = mine ? tileEl('[data-rack]', e.taken) : null
            const jokerFrom = anchorRect(`meld-${meldId}`) ?? seatAnchor
            if (jokerTarget && jokerFrom) flyTo({ target: jokerTarget, from: jokerFrom, duration: 480 })
            else if (!mine && jokerFrom && seatAnchor) flyBetween(jokerFrom, seatAnchor)
          }
          break
        }
        case 'TURN_CHANGED':
          if (e.nextTurn === mySeat) playSound('turn')
          break
        case 'ROUND_FINISHED':
          playSound(useTable.getState().table?.status === 'finished' ? 'gameEnd' : 'roundEnd')
          break
        default:
          break
      }
    }
  }, [eventSeq, mySeat])

  // Tiles entering my rack fly in from the deck or the discard pile they came from.
  useEffect(() => {
    const { hand, events } = useTable.getState()
    const prev = lastHand.current
    lastHand.current = hand
    if (!prev) return
    const added = hand.filter((t) => !prev.includes(t))
    if (added.length !== 1) return
    const source = [...events].reverse().find((e) => e.seat === mySeat && (e.type === 'TILE_DRAWN' || e.type === 'DISCARD_TAKEN'))
    if (!source) return
    const fromRect =
      source.type === 'TILE_DRAWN' ? anchorRect('deck') : anchorRect(`discard-${prevSeat(mySeat)}`)
    requestAnimationFrame(() => {
      const target = tileEl('[data-rack]', added[0])
      if (target && fromRect) flyTo({ target, from: fromRect, duration: 480 })
    })
  }, [handVersion, mySeat])
}
