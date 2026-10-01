import {
  OPEN_PAIRS_MIN,
  OPEN_SERIES_MIN,
  previewSelection,
  prevSeat,
  type OpenKind,
  type PublicRoundState,
} from './game.ts'
import { attachableMelds } from './melds.ts'
import { isJoker, type TileId } from './tiles.ts'

export interface AvailableActions {
  isMyTurn: boolean
  canDraw: boolean
  canTakeDiscard: boolean
  takeableTile: TileId | null
  canReturn: boolean
  /** Discard is blocked while a taken tile is still unused. */
  canDiscard: boolean
  /** The selected tile would cost a penalty if discarded (okey or processable). */
  discardPenalty: boolean
  opened: OpenKind | null
  open: {
    mode: OpenKind
    progress: number
    target: number
    canOpen: boolean
    reason: 'need_more' | 'invalid' | 'must_use_taken' | 'keep_one' | null
  } | null
  canLay: boolean
  attachTargets: number[]
  willFinish: boolean
}

/**
 * Derives what the player may do right now from public state + own hand.
 * The server re-validates every action; this only drives the UI.
 */
export function availableActions(
  pub: PublicRoundState,
  seat: number,
  hand: TileId[],
  selected: TileId[],
  openMode: OpenKind,
): AvailableActions {
  const isMyTurn = pub.status === 'playing' && pub.turn === seat
  const inDraw = isMyTurn && pub.phase === 'draw'
  const inDiscard = isMyTurn && pub.phase === 'discard'
  const pile = pub.discards[prevSeat(seat)] ?? []
  const takeableTile = pile.length ? pile[pile.length - 1] : null
  const pendingUnused = pub.pendingTake !== null && hand.includes(pub.pendingTake)
  const opened = pub.opened[seat]
  const keepsOne = selected.length < hand.length

  let open: AvailableActions['open'] = null
  let canLay = false
  if (!opened) {
    const preview = previewSelection(selected, pub.okey)
    if (openMode === 'series') {
      const progress = preview.series.valid ? preview.series.points : 0
      let reason: NonNullable<AvailableActions['open']>['reason'] = null
      if (selected.length > 0 && !preview.series.valid) reason = 'invalid'
      else if (progress < OPEN_SERIES_MIN) reason = 'need_more'
      else if (pendingUnused && !selected.includes(pub.pendingTake!)) reason = 'must_use_taken'
      else if (!keepsOne) reason = 'keep_one'
      open = { mode: 'series', progress, target: OPEN_SERIES_MIN, canOpen: inDiscard && reason === null, reason }
    } else {
      const progress = preview.pairs.count
      let reason: NonNullable<AvailableActions['open']>['reason'] = null
      if (selected.length > 0 && !preview.pairs.valid) reason = 'invalid'
      else if (progress < OPEN_PAIRS_MIN) reason = 'need_more'
      else if (pendingUnused && !selected.includes(pub.pendingTake!)) reason = 'must_use_taken'
      else if (!keepsOne) reason = 'keep_one'
      open = { mode: 'pairs', progress, target: OPEN_PAIRS_MIN, canOpen: inDiscard && reason === null, reason }
    }
  } else if (inDiscard && selected.length > 0 && keepsOne) {
    const preview = previewSelection(selected, pub.okey)
    canLay = opened === 'series' ? preview.series.valid : preview.pairs.valid
  }

  const attachTargets =
    inDiscard && opened && selected.length === 1 && hand.length > 1
      ? attachableMelds(pub.melds, selected[0], pub.okey)
      : []

  return {
    isMyTurn,
    canDraw: inDraw && pub.deckCount > 0,
    canTakeDiscard: inDraw && takeableTile !== null,
    takeableTile,
    canReturn: inDiscard && pendingUnused,
    canDiscard: inDiscard && !pendingUnused && selected.length === 1,
    discardPenalty:
      inDiscard &&
      selected.length === 1 &&
      hand.length > 1 &&
      (isJoker(selected[0], pub.okey) || attachableMelds(pub.melds, selected[0], pub.okey).length > 0),
    opened,
    open,
    canLay,
    attachTargets,
    willFinish: inDiscard && hand.length === 1,
  }
}
