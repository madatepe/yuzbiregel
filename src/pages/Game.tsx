import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { attachableMelds, availableActions, type PublicRoundState, type TileId } from '@engine/index.ts'
import { ActionBar } from '@/components/game/ActionBar'
import { GameResult } from '@/components/game/GameResult'
import { GameMenu } from '@/components/game/GameMenu'
import { GameTable } from '@/components/game/GameTable'
import { GameTile } from '@/components/game/GameTile'
import { PlayerSeat } from '@/components/game/PlayerSeat'
import { RoundResult } from '@/components/game/RoundResult'
import { RulesButton } from '@/components/game/RulesModal'
import { ScoreBadge, Scoreboard, teamTotals } from '@/components/game/Scoreboard'
import { TileRack } from '@/components/game/TileRack'
import { TurnIndicator } from '@/components/game/TurnIndicator'
import { ActionButton } from '@/components/ui/ActionButton'
import { ConnectionBanner, ConnectionStatus } from '@/components/ui/ConnectionStatus'
import { FullScreenLoader } from '@/components/ui/FullScreenLoader'
import { Modal } from '@/components/ui/Modal'
import { PlayerAvatar } from '@/components/ui/PlayerAvatar'
import { SoundToggle } from '@/components/ui/SoundToggle'
import { useGameActions } from '@/hooks/useGameActions'
import { useGameAnimations } from '@/hooks/useGameAnimations'
import { sideOf, useMySeat, useSeatInfos, useTotals, type SeatInfo } from '@/hooks/useGameView'
import { api } from '@/lib/api'
import { errorMessage } from '@/lib/errors'
import { arrangedMeldTiles, groupLayout, pairGroups, rackTiles, seriesGroups } from '@/lib/rack'
import { useGameUi } from '@/stores/gameUi'
import { useSession } from '@/stores/session'
import { useTable } from '@/stores/table'
import { toast } from '@/stores/toast'

const collision: CollisionDetection = (args) => {
  const within = pointerWithin(args)
  const target = within.find((c) => c.id === 'discard' || String(c.id).startsWith('meld:'))
  if (target) return [target]
  const slot = within.find((c) => String(c.id).startsWith('slot:'))
  if (slot) return [slot]
  return rectIntersection({
    ...args,
    droppableContainers: args.droppableContainers.filter((c) => String(c.id).startsWith('slot:')),
  })
}

const EMPTY: TileId[] = []

const SORT_PILL =
  'rounded-full bg-black/30 px-3 py-1 text-[11px] font-bold text-ivory-200 ring-1 ring-white/10 transition active:bg-white/15'

function instructionFor(
  pub: PublicRoundState,
  mySeat: number,
  seats: SeatInfo[],
  hand: TileId[],
): string {
  const turnSeat = seats[pub.turn]
  if (pub.status !== 'playing') return 'El sona erdi.'
  if (pub.turn !== mySeat) {
    if (turnSeat.left) return `${turnSeat.nickname} masadan ayrıldı. Koltuğun devralınması bekleniyor.`
    return pub.phase === 'draw' ? `${turnSeat.nickname} taş çekiyor...` : `${turnSeat.nickname} oynuyor...`
  }
  if (pub.phase === 'draw') return 'Desteden taş çek ya da önceki oyuncunun attığı taşı al.'
  if (pub.pendingTake !== null && hand.includes(pub.pendingTake))
    return 'Aldığın taşı kullan: elini aç ya da işle. Kullanamazsan geri bırak (+101).'
  if (hand.length === 1) return 'Son taşını atarak bitir!'
  if (!pub.opened[mySeat]) return 'Perlerini ıstakada aralarında boşlukla diz, sonra elini aç. Ya da atacağın taşı seç.'
  return 'Per aç, işle ya da bir taş at.'
}

export default function Game() {
  const navigate = useNavigate()
  const userId = useSession((s) => s.userId)
  const table = useTable((s) => s.table)!
  const pub = useTable((s) => s.pub)
  const hand = useTable((s) => s.hand)
  const scores = useTable((s) => s.scores)
  const mySeat = useMySeat()
  const seats = useSeatInfos()
  const totals = useTotals()
  const perform = useGameActions()

  const selected = useGameUi((s) => s.selected)
  const openMode = useGameUi((s) => s.openMode)
  const feedback = useGameUi((s) => s.feedback)
  const syncRack = useGameUi((s) => s.syncRack)
  const setRackSlots = useGameUi((s) => s.setRackSlots)
  const moveTile = useGameUi((s) => s.moveTile)
  const setSelected = useGameUi((s) => s.setSelected)

  const [menuOpen, setMenuOpen] = useState(false)
  const [scoreOpen, setScoreOpen] = useState(false)
  const [leaveOpen, setLeaveOpen] = useState(false)
  const [showFinal, setShowFinal] = useState(false)
  const [busy, setBusy] = useState<'next' | 'restart' | 'leave' | null>(null)
  const [dragTile, setDragTile] = useState<TileId | null>(null)

  useGameAnimations(mySeat)

  useEffect(() => {
    if (!pub) return
    syncRack(`${table.id}:${table.game_no}:${pub.round}`, hand)
  }, [hand, pub?.round, table.id, table.game_no, syncRack, pub])

  useEffect(() => {
    if (!feedback) return
    const t = setTimeout(() => useGameUi.getState().clearFeedback(), 3200)
    return () => clearTimeout(t)
  }, [feedback])

  useEffect(() => {
    if (table.status !== 'finished') setShowFinal(false)
  }, [table.status])

  const rackSlots = useGameUi((s) => s.rackSlots)
  const arranged = useMemo(
    () => (pub && !pub.opened[mySeat] && selected.length === 0 ? arrangedMeldTiles(rackSlots, pub.okey, openMode) : []),
    [pub, mySeat, selected.length, rackSlots, openMode],
  )
  const openTiles = selected.length > 0 ? selected : arranged

  const actions = useMemo(() => {
    if (!pub) return null
    const base = availableActions(pub, mySeat, hand, selected, openMode)
    if (!base.open || selected.length > 0) return base
    return { ...base, open: availableActions(pub, mySeat, hand, arranged, openMode).open }
  }, [pub, mySeat, hand, selected, openMode, arranged])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 160, tolerance: 6 } }),
    useSensor(KeyboardSensor),
  )

  const pendingUnused = !!pub && pub.pendingTake !== null && hand.includes(pub.pendingTake)
  const inDiscardPhase = !!pub && pub.status === 'playing' && pub.turn === mySeat && pub.phase === 'discard'
  const canDropDiscard = inDiscardPhase && !pendingUnused
  const dragTargets = useMemo(
    () =>
      dragTile !== null && pub && inDiscardPhase && pub.opened[mySeat] && hand.length > 1
        ? attachableMelds(pub.melds, dragTile, pub.okey)
        : [],
    [dragTile, pub, inDiscardPhase, mySeat, hand.length],
  )

  const discard = useCallback(
    (tile: TileId) => perform({ type: 'discard', tile }, [tile]),
    [perform],
  )
  const attach = useCallback(
    (meldId: number, tile?: TileId) => {
      const t = tile ?? useGameUi.getState().selected[0]
      if (t === undefined) return
      void perform({ type: 'add_to_meld', tile: t, meldId }, [t])
    },
    [perform],
  )

  const handlers = useMemo(
    () => ({
      onDraw: () => void perform({ type: 'draw_deck' }),
      onTake: () => void perform({ type: 'take_discard' }),
      onReturn: () => void perform({ type: 'return_discard' }),
      onOpen: () => {
        const mode = useGameUi.getState().openMode
        void perform({ type: mode === 'series' ? 'open_series' : 'open_pairs', tiles: openTiles }, openTiles)
      },
      onLay: () => {
        const sel = useGameUi.getState().selected
        void perform({ type: 'lay', tiles: sel }, sel)
      },
      onDiscard: () => {
        const sel = useGameUi.getState().selected
        if (sel.length === 1) void discard(sel[0])
      },
      onSortSeries: () =>
        pub && setRackSlots(groupLayout(seriesGroups(rackTiles(useGameUi.getState().rackSlots), pub.okey))),
      onSortPairs: () =>
        pub && setRackSlots(groupLayout(pairGroups(rackTiles(useGameUi.getState().rackSlots), pub.okey))),
    }),
    [perform, discard, pub, setRackSlots, openTiles],
  )

  const onAttachSingle = useCallback(() => {
    if (actions?.attachTargets.length) attach(actions.attachTargets[0])
  }, [actions, attach])

  const onQuickDiscard = useCallback(
    (tile: TileId) => {
      if (canDropDiscard) {
        setSelected([tile])
        void discard(tile)
      }
    },
    [canDropDiscard, discard, setSelected],
  )

  const onDragStart = (e: DragStartEvent) => {
    const id = String(e.active.id)
    if (id.startsWith('tile:')) setDragTile(Number(id.slice(5)))
  }

  const onDragEnd = (e: DragEndEvent) => {
    const tile = dragTile
    setDragTile(null)
    if (tile === null || !e.over) return
    const overId = String(e.over.id)
    if (overId === 'discard') {
      if (canDropDiscard) void discard(tile)
      return
    }
    if (overId.startsWith('meld:')) {
      attach(Number(overId.slice(5)), tile)
      return
    }
    if (overId.startsWith('slot:')) moveTile(tile, Number(overId.slice(5)))
  }

  const continueRound = async () => {
    if (table.status === 'finished') {
      setShowFinal(true)
      return
    }
    setBusy('next')
    try {
      await api.nextRound(table.id)
    } catch (err) {
      toast(errorMessage(err), 'error')
    } finally {
      setBusy(null)
    }
  }

  const restart = async () => {
    setBusy('restart')
    try {
      await api.restartGame(table.id)
    } catch (err) {
      toast(errorMessage(err), 'error')
    } finally {
      setBusy(null)
    }
  }

  const leave = async () => {
    setBusy('leave')
    try {
      await api.leaveTable(table.id)
    } catch {
      // Leaving locally is fine even if the request failed; the seat stays reclaimable.
    } finally {
      setBusy(null)
      navigate('/')
    }
  }

  if (!pub || !actions) return <FullScreenLoader label="Masa hazırlanıyor..." />

  const me = seats[mySeat]
  const turnName = seats[pub.turn].nickname
  const teams = teamTotals(totals)
  const isOwner = table.owner_id === userId
  const opponents = [1, 2, 3].map((k) => (mySeat + k) % 4)
  const bySide = Object.fromEntries(opponents.map((s) => [sideOf(s, mySeat), s])) as Record<'left' | 'top' | 'right', number>
  const seatProps = (seat: number) => ({
    info: seats[seat],
    active: pub.status === 'playing' && pub.turn === seat,
    handCount: pub.handCounts[seat],
    opened: pub.opened[seat],
    total: totals[seat],
    penalty: pub.penalties[seat],
    team: table.mode === 'team' ? (seat % 2) + 1 : undefined,
  })
  const roundOver = (table.status === 'round_end' || table.status === 'finished') && !!pub.result
  const dragging = dragTile !== null

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collision}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setDragTile(null)}
    >
      <ConnectionBanner />
      <div className="flex h-dvh flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex shrink-0 items-center gap-2 px-3 py-2 sm:px-5">
          <div className="flex min-w-0 items-center gap-2">
            <span className="rounded-lg bg-black/30 px-2 py-1 text-xs font-black tracking-widest text-ivory-200" title="Masa kodu">
              {table.code}
            </span>
            <span className="whitespace-nowrap rounded-lg bg-accent/15 px-2 py-1 text-xs font-black tracking-wider text-accent-strong">
              EL {pub.round}/{table.total_rounds}
            </span>
            <span className="hidden text-xs font-bold text-ivory-400 sm:inline">
              {table.mode === 'team' ? 'EŞLİ' : 'HERKES TEK'}
            </span>
          </div>
          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            <ConnectionStatus compact />
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/8 text-ivory-200 ring-1 ring-white/10 transition hover:bg-white/14 md:hidden"
              aria-label="Menüyü aç"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
                <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          <div className="hidden items-center gap-2 md:flex">
            <ScoreBadge
              total={totals[mySeat]}
              mode={table.mode}
              teamTotal={teams[mySeat % 2]}
              onClick={() => setScoreOpen(true)}
            />
            <SoundToggle />
            <RulesButton />
            <button
              type="button"
              onClick={() => setLeaveOpen(true)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/8 text-ivory-200 ring-1 ring-white/10 transition hover:bg-danger/20 hover:text-danger"
              aria-label="Masadan ayrıl"
              title="Masadan ayrıl"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
                <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h11" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </header>

        {/* Table area */}
        <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[1fr] gap-3 px-2 sm:px-4 md:grid-cols-[auto_1fr_auto] md:grid-rows-[auto_1fr]">
          <div className="hidden justify-center md:col-start-2 md:row-start-1 md:flex">
            <PlayerSeat {...seatProps(bySide.top)} side="top" />
          </div>
          <div className="hidden items-center md:col-start-1 md:row-start-2 md:flex">
            <PlayerSeat {...seatProps(bySide.left)} side="left" />
          </div>
          <div className="min-h-[220px] md:col-start-2 md:row-start-2">
            <GameTable
              pub={pub}
              mySeat={mySeat}
              seats={seats}
              canDraw={actions.canDraw}
              canTake={actions.canTakeDiscard}
              canDiscard={dragging ? canDropDiscard : actions.canDiscard}
              attachTargets={dragging ? dragTargets : actions.attachTargets}
              onDraw={handlers.onDraw}
              onTake={handlers.onTake}
              onDiscard={handlers.onDiscard}
              onAttach={attach}
            />
          </div>
          <div className="hidden items-center md:col-start-3 md:row-start-2 md:flex">
            <PlayerSeat {...seatProps(bySide.right)} side="right" />
          </div>
        </div>

        {/* My area */}
        <section className="shrink-0 px-2 pt-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] sm:px-4" aria-label="Senin alanın">
          <div className="mx-auto flex max-w-6xl flex-col gap-2">
            <div className="flex items-center gap-3">
              <div
                data-anchor={`seat-${mySeat}`}
                className={`hidden shrink-0 items-center gap-2 rounded-2xl px-2.5 py-1.5 sm:flex ${actions.isMyTurn ? 'bg-accent/15 ring-2 ring-accent' : 'bg-black/25 ring-1 ring-white/8'}`}
              >
                <PlayerAvatar name={me.nickname} size={36} active={actions.isMyTurn} />
                <div className="leading-tight">
                  <div className="max-w-28 truncate text-sm font-extrabold">{me.nickname}</div>
                  <div className="text-[11px] text-ivory-300">
                    El cezası{' '}
                    <span className={pub.penalties[mySeat] ? 'font-bold text-danger' : ''}>{pub.penalties[mySeat]}</span>
                    {pub.opened[mySeat] && (
                      <span className="ml-1 font-bold text-success">· {pub.opened[mySeat] === 'pairs' ? 'Çift açtın' : 'Açtın'}</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex flex-1 justify-center">
                <TurnIndicator
                  isMyTurn={actions.isMyTurn}
                  over={pub.status !== 'playing'}
                  turnName={turnName}
                  instruction={instructionFor(pub, mySeat, seats, hand)}
                />
              </div>
              <div className="hidden w-[140px] shrink-0 text-right text-xs text-ivory-400 lg:block">
                {selected.length > 0 ? `${selected.length} taş seçili` : 'Taşları sürükleyerek diz'}
              </div>
            </div>

            <div className="-mb-1 flex justify-end gap-1.5 md:hidden">
              <button type="button" onClick={handlers.onSortSeries} className={SORT_PILL}>
                Seri diz
              </button>
              <button type="button" onClick={handlers.onSortPairs} className={SORT_PILL}>
                Çift diz
              </button>
            </div>

            <TileRack
              okey={pub.okey}
              round={pub.round}
              pendingTake={pub.pendingTake}
              counted={inDiscardPhase ? arranged : EMPTY}
              onQuickDiscard={onQuickDiscard}
            />

            <ActionBar
              actions={actions}
              selectedCount={selected.length}
              onDraw={handlers.onDraw}
              onTake={handlers.onTake}
              onReturn={handlers.onReturn}
              onOpen={handlers.onOpen}
              onLay={handlers.onLay}
              onAttachSingle={onAttachSingle}
              onDiscard={handlers.onDiscard}
              onSortSeries={handlers.onSortSeries}
              onSortPairs={handlers.onSortPairs}
            />
          </div>
        </section>
      </div>

      <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(.2,.8,.3,1)' }}>
        {dragTile !== null ? <GameTile id={dragTile} okey={pub.okey} selected className="cursor-grabbing" /> : null}
      </DragOverlay>

      <GameMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        players={[bySide.left, bySide.top, bySide.right].map((s) => (
          <PlayerSeat key={s} {...seatProps(s)} side={sideOf(s, mySeat)} compact />
        ))}
        scoreLabel={String(table.mode === 'team' ? teams[mySeat % 2] : totals[mySeat])}
        onScoreboard={() => {
          setMenuOpen(false)
          setScoreOpen(true)
        }}
        onLeave={() => {
          setMenuOpen(false)
          setLeaveOpen(true)
        }}
      />

      <Scoreboard
        open={scoreOpen}
        onClose={() => setScoreOpen(false)}
        scores={scores}
        seats={seats}
        mode={table.mode}
        totalRounds={table.total_rounds}
        mySeat={mySeat}
      />

      <Modal open={leaveOpen} onClose={() => setLeaveOpen(false)} title="Masadan ayrıl" size="sm">
        <p className="mb-5 text-ivory-200">
          Koltuğun ve taşların korunur. Aynı kodla geri dönebilir ya da yerine başka biri oturabilir.
        </p>
        <div className="flex gap-2">
          <ActionButton variant="secondary" block onClick={() => setLeaveOpen(false)}>
            Vazgeç
          </ActionButton>
          <ActionButton variant="danger" block onClick={leave} loading={busy === 'leave'}>
            Ayrıl
          </ActionButton>
        </div>
      </Modal>

      {roundOver && pub.result && (
        <RoundResult
          open={!showFinal}
          result={pub.result}
          okey={pub.okey}
          opened={pub.opened}
          seats={seats}
          mode={table.mode}
          round={pub.round}
          totalRounds={table.total_rounds}
          totals={totals}
          mySeat={mySeat}
          isLast={table.status === 'finished'}
          busy={busy === 'next'}
          onContinue={continueRound}
        />
      )}

      <GameResult
        open={table.status === 'finished' && showFinal}
        seats={seats}
        totals={totals}
        mode={table.mode}
        mySeat={mySeat}
        isOwner={isOwner}
        busy={busy === 'restart' ? 'restart' : busy === 'leave' ? 'leave' : null}
        onRestart={restart}
        onLeave={leave}
      />
    </DndContext>
  )
}
