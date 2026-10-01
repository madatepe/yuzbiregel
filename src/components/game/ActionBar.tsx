import { memo } from 'react'
import type { AvailableActions, OpenKind } from '@engine/index.ts'
import { ActionButton } from '@/components/ui/ActionButton'
import { OpeningModePicker } from './OpeningModePicker'
import { useGameUi } from '@/stores/gameUi'

interface ActionBarProps {
  actions: AvailableActions
  selectedCount: number
  onDraw: () => void
  onTake: () => void
  onReturn: () => void
  onOpen: () => void
  onLay: () => void
  onAttachSingle: () => void
  onDiscard: () => void
  onSortSeries: () => void
  onSortPairs: () => void
}

const OPEN_HINT: Record<string, (mode: OpenKind) => string> = {
  need_more: (m) => (m === 'series' ? '101 gerekiyor' : '5 çift gerekiyor'),
  invalid: () => 'Seçim geçerli per değil',
  must_use_taken: () => 'Aldığın taşı kullan',
  keep_one: () => 'Atmak için 1 taş bırak',
}

function ActionBarImpl({
  actions,
  selectedCount,
  onDraw,
  onTake,
  onReturn,
  onOpen,
  onLay,
  onAttachSingle,
  onDiscard,
  onSortSeries,
  onSortPairs,
}: ActionBarProps) {
  const busy = useGameUi((s) => s.busy)
  const openMode = useGameUi((s) => s.openMode)
  const setOpenMode = useGameUi((s) => s.setOpenMode)
  const feedback = useGameUi((s) => s.feedback)
  const inDraw = actions.canDraw || actions.canTakeDiscard
  const inDiscard = actions.isMyTurn && !inDraw

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex min-h-[68px] flex-wrap items-center justify-center gap-x-3 gap-y-2">
        {!actions.isMyTurn && (
          <span className="text-sm font-semibold text-ivory-400">Sıranı beklerken taşlarını dizebilirsin.</span>
        )}
        {inDraw && (
          <>
            <ActionButton size="md" onClick={onDraw} disabled={!actions.canDraw || busy} loading={busy}>
              Taş çek
            </ActionButton>
            {actions.canTakeDiscard && (
              <ActionButton variant="secondary" onClick={onTake} disabled={busy}>
                Taşı al
              </ActionButton>
            )}
          </>
        )}

        {inDiscard && (
          <>
            {actions.open && (
              <div className="flex flex-wrap items-center justify-center gap-3 rounded-2xl bg-black/20 px-3 py-1.5">
                <OpeningModePicker
                  mode={openMode}
                  onChange={setOpenMode}
                  progress={actions.open.progress}
                  target={actions.open.target}
                  invalid={actions.open.reason === 'invalid'}
                />
                <ActionButton
                  variant="success"
                  size="sm"
                  onClick={onOpen}
                  disabled={!actions.open.canOpen || busy}
                  hint={!actions.open.canOpen && actions.open.reason ? OPEN_HINT[actions.open.reason](openMode) : undefined}
                >
                  El aç
                </ActionButton>
              </div>
            )}
            {actions.opened && selectedCount > 1 && (
              <ActionButton
                variant="success"
                size="sm"
                onClick={onLay}
                disabled={!actions.canLay || busy}
                hint={!actions.canLay ? 'Seçim geçerli per değil' : undefined}
              >
                {actions.opened === 'pairs' ? 'Çift aç' : 'Per aç'}
              </ActionButton>
            )}
            {actions.attachTargets.length > 0 && (
              <ActionButton
                variant="success"
                size="sm"
                onClick={onAttachSingle}
                disabled={busy}
                hint={actions.attachTargets.length > 1 ? 'Ya da masadaki pere tıkla' : undefined}
              >
                İşle
              </ActionButton>
            )}
            {actions.canReturn && (
              <ActionButton variant="danger" size="sm" onClick={onReturn} disabled={busy} hint="+101 ceza">
                Geri bırak
              </ActionButton>
            )}
            <ActionButton
              size="md"
              variant={actions.discardPenalty ? 'danger' : undefined}
              onClick={onDiscard}
              disabled={!actions.canDiscard || busy}
              hint={
                actions.canReturn
                  ? 'Önce aldığın taşı kullan'
                  : selectedCount !== 1
                    ? 'Atmak için 1 taş seç'
                    : actions.discardPenalty
                      ? 'Bu taşı atarsan +101 ceza'
                      : undefined
              }
            >
              {actions.willFinish ? 'Bitir' : 'Taşı at'}
            </ActionButton>
          </>
        )}
      </div>

      <div className="flex min-h-5 items-center gap-3">
        {feedback ? (
          <span key={feedback.seq} className="animate-fade-up text-sm font-semibold text-danger" role="alert">
            {feedback.message}
          </span>
        ) : (
          <div className="flex items-center gap-1 text-[11px] font-semibold text-ivory-400">
            <span className="hidden sm:inline">Diz:</span>
            <button type="button" onClick={onSortSeries} className="rounded-md px-2 py-0.5 hover:bg-white/10 hover:text-ivory-50">
              Seri diz
            </button>
            <button type="button" onClick={onSortPairs} className="rounded-md px-2 py-0.5 hover:bg-white/10 hover:text-ivory-50">
              Çift diz
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export const ActionBar = memo(ActionBarImpl)
