import { useCallback } from 'react'
import type { PistiAction } from '@pisti/index.ts'
import { api } from '@/lib/api'
import { errorCode, errorMessage } from '@/lib/errors'
import { applyLocalPisti, isLocalPisti } from '@/lib/pistiLocal'
import { resyncTable } from '@/lib/realtime'
import { playSound } from '@/lib/sound'
import { useGameUi } from '@/stores/gameUi'
import { useTable } from '@/stores/table'

export function usePistiActions() {
  return useCallback(async (action: PistiAction) => {
    const ui = useGameUi.getState()
    const tableId = useTable.getState().tableId
    if (ui.busy || !tableId) return false
    ui.setBusy(true)
    ui.clearFeedback()
    try {
      if (isLocalPisti()) {
        applyLocalPisti(action)
        return true
      }
      await api.action(tableId, action)
      useGameUi.getState().setBusy(false)
      return true
    } catch (err) {
      useGameUi.getState().setBusy(false)
      ui.fail(errorMessage(err))
      playSound('invalid')
      const code = errorCode(err)
      if (code === 'CONFLICT' || code === 'BAD_STATE' || code === 'NETWORK') resyncTable()
      return false
    }
  }, [])
}
