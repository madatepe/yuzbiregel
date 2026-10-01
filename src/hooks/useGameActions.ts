import { useCallback } from 'react'
import type { GameAction, TileId } from '@engine/index.ts'
import { api } from '@/lib/api'
import { errorCode, errorMessage } from '@/lib/errors'
import { rememberTiles } from '@/lib/fly'
import { resyncTable } from '@/lib/realtime'
import { playSound } from '@/lib/sound'
import { useGameUi } from '@/stores/gameUi'
import { useTable } from '@/stores/table'

/** Sends moves to the server. The UI only changes once the authoritative state arrives. */
export function useGameActions() {
  return useCallback(async (action: GameAction, movingTiles: TileId[] = []) => {
    const ui = useGameUi.getState()
    const tableId = useTable.getState().tableId
    if (ui.busy || !tableId) return false
    rememberTiles(movingTiles)
    ui.setBusy(true, movingTiles)
    ui.clearFeedback()
    try {
      await api.action(tableId, action)
      if (action.type !== 'draw_deck' && action.type !== 'take_discard') ui.clearSelection()
      // Keep the pending hint until the realtime hand update removes the tiles.
      useGameUi.getState().setBusy(false, useGameUi.getState().pendingTiles)
      setTimeout(() => {
        if (!useGameUi.getState().busy) useGameUi.getState().setBusy(false, [])
      }, 2500)
      return true
    } catch (err) {
      useGameUi.getState().setBusy(false, [])
      ui.fail(errorMessage(err))
      playSound('invalid')
      const code = errorCode(err)
      if (code === 'CONFLICT' || code === 'BAD_STATE' || code === 'NETWORK') resyncTable()
      return false
    }
  }, [])
}
