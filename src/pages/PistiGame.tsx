import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { TARGET_SCORE, availablePistiActions, type CardId } from '@pisti/index.ts'
import { PlayingCard } from '@/components/pisti/PlayingCard'
import { PlayerSeat } from '@/components/game/PlayerSeat'
import { ReactionProvider } from '@/components/game/ReactionLayer'
import { GameMenu } from '@/components/game/GameMenu'
import { GameResult } from '@/components/game/GameResult'
import { RulesButton } from '@/components/game/RulesModal'
import { ScoreBadge } from '@/components/game/Scoreboard'
import { TurnIndicator } from '@/components/game/TurnIndicator'
import { ActionButton } from '@/components/ui/ActionButton'
import { ConnectionBanner, ConnectionStatus } from '@/components/ui/ConnectionStatus'
import { FullScreenLoader } from '@/components/ui/FullScreenLoader'
import { Modal } from '@/components/ui/Modal'
import { SoundToggle } from '@/components/ui/SoundToggle'
import { sideOf, useMySeat, useSeatInfos } from '@/hooks/useGameView'
import { usePistiActions } from '@/hooks/usePistiActions'
import { usePistiAnimations } from '@/hooks/usePistiAnimations'
import { api } from '@/lib/api'
import { errorMessage } from '@/lib/errors'
import { isLocalPisti, nextLocalDeal, restartLocalPisti, stopLocalPisti } from '@/lib/pistiLocal'
import { playSound } from '@/lib/sound'
import { useGameUi } from '@/stores/gameUi'
import { useSession } from '@/stores/session'
import { useTable } from '@/stores/table'
import { toast } from '@/stores/toast'

function instruction(pub: NonNullable<ReturnType<typeof useTable.getState>['pisti']>, mySeat: number, name: string) {
  if (pub.status !== 'playing') return 'El sona erdi.'
  if (pub.phase === 'await_bluff') {
    if (pub.turn === mySeat) return 'Rakip kapalı Pişti iddia etti. İnan veya blöf de.'
    return `${name} blöf kararı veriyor...`
  }
  if (pub.turn !== mySeat) return `${name} kart atıyor...`
  if (pub.pile.length === 1) return 'Açık kart at veya kapalı Pişti iddia et.'
  return 'Elinden bir kartı açık at.'
}

export default function PistiGame() {
  const navigate = useNavigate()
  const userId = useSession((s) => s.userId)
  const table = useTable((s) => s.table)!
  const pub = useTable((s) => s.pisti)
  const hand = useTable((s) => s.pistiHand)
  const scores = useTable((s) => s.scores)
  const mySeat = useMySeat()
  const seats = useSeatInfos()
  const perform = usePistiActions()
  const feedback = useGameUi((s) => s.feedback)
  const busyUi = useGameUi((s) => s.busy)
  const hold = usePistiAnimations(mySeat)

  const [selected, setSelected] = useState<CardId | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [scoreOpen, setScoreOpen] = useState(false)
  const [leaveOpen, setLeaveOpen] = useState(false)
  const [showFinal, setShowFinal] = useState(false)
  const [busy, setBusy] = useState<'next' | 'restart' | 'leave' | null>(null)

  useEffect(() => {
    if (!feedback) return
    const t = setTimeout(() => useGameUi.getState().clearFeedback(), 3200)
    return () => clearTimeout(t)
  }, [feedback])

  useEffect(() => {
    if (table.status !== 'finished') setShowFinal(false)
  }, [table.status])

  useEffect(() => {
    if (selected != null && hand && !hand.cards.includes(selected)) setSelected(null)
  }, [hand, selected])

  if (!pub || !hand) return <FullScreenLoader label="Masa hazırlanıyor..." />

  const actions = availablePistiActions(pub, mySeat, hand, selected)
  const committed = pub.result?.teamScores ?? pub.teamScores
  const dealPts = pub.dealPisti
  const myTeam = mySeat % 2
  const turnName = seats[pub.turn]?.nickname ?? 'Oyuncu'
  const local = isLocalPisti()
  const isOwner = local || table.owner_id === userId
  const dealOver = (table.status === 'round_end' || table.status === 'finished') && !!pub.result
  const peek = hand.peek

  const playOpen = () => {
    if (selected == null) return
    playSound('discard')
    void perform({ type: 'play_open', cardId: selected }).then((ok) => {
      if (ok) setSelected(null)
    })
  }
  const playClosed = () => {
    if (selected == null) return
    playSound('discard')
    void perform({ type: 'play_closed', cardId: selected }).then((ok) => {
      if (ok) setSelected(null)
    })
  }

  const continueDeal = async () => {
    if (table.status === 'finished') {
      setShowFinal(true)
      return
    }
    setBusy('next')
    try {
      if (local) nextLocalDeal()
      else await api.nextRound(table.id)
    } catch (err) {
      toast(errorMessage(err), 'error')
    } finally {
      setBusy(null)
    }
  }

  const restart = async () => {
    setBusy('restart')
    try {
      if (local) restartLocalPisti()
      else await api.restartGame(table.id)
    } catch (err) {
      toast(errorMessage(err), 'error')
    } finally {
      setBusy(null)
    }
  }

  const leave = async () => {
    setBusy('leave')
    try {
      if (local) stopLocalPisti()
      else await api.leaveTable(table.id)
    } finally {
      setBusy(null)
      navigate('/pisti')
    }
  }

  const opponents = [1, 2, 3].map((k) => (mySeat + k) % 4)
  const bySide = Object.fromEntries(opponents.map((s) => [sideOf(s, mySeat), s])) as Record<'left' | 'top' | 'right', number>
  const seatProps = (seat: number) => ({
    info: seats[seat],
    active: pub.status === 'playing' && pub.turn === seat,
    handCount: pub.handCounts[seat],
    opened: null,
    total: committed[seat % 2],
    penalty: pub.status === 'playing' ? dealPts[seat % 2] : 0,
    team: (seat % 2) + 1,
  })

  const pendingMine = pub.pendingBluffSeat === mySeat
  const shownPile =
    hold != null
      ? hold.incoming != null && !hold.faceDown
        ? [...hold.cards, hold.incoming]
        : hold.cards
      : pub.pile

  return (
    <ReactionProvider>
    <>
      <ConnectionBanner />
      <div className="flex h-dvh flex-col overflow-hidden">
        <header className="flex shrink-0 items-center gap-2 px-3 py-2 sm:px-5">
          <div className="flex min-w-0 items-center gap-2">
            <span className="rounded-lg bg-black/30 px-2 py-1 text-xs font-black tracking-widest text-ivory-200">{table.code}</span>
            <span className="whitespace-nowrap rounded-lg bg-accent/15 px-2 py-1 text-xs font-black tracking-wider text-accent-strong">
              EL {pub.round}
            </span>
            <span className="hidden text-xs font-bold text-ivory-400 sm:inline">
              {table.mode === 'solo' ? 'TEKLİ · BOTLAR' : 'BLÖFLÜ PİŞTİ'}
            </span>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <ConnectionStatus compact />
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/8 text-ivory-200 ring-1 ring-white/10 md:hidden"
              aria-label="Menüyü aç"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
                <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          <div className="hidden items-center gap-2 md:flex">
            <ScoreBadge total={committed[myTeam]} mode="team" teamTotal={committed[myTeam]} onClick={() => setScoreOpen(true)} />
            <SoundToggle />
            <RulesButton variant="pisti" />
            <button
              type="button"
              onClick={() => setLeaveOpen(true)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/8 text-ivory-200 ring-1 ring-white/10 hover:bg-danger/20 hover:text-danger"
              aria-label="Masadan ayrıl"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
                <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h11" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 px-2 sm:px-4 md:grid-cols-[auto_1fr_auto] md:grid-rows-[auto_1fr]">
          <div className="hidden md:block">
            <PlayerSeat {...seatProps(bySide.left)} side="left" />
          </div>
          <div className="flex min-h-0 flex-col gap-2 md:row-span-2">
            <div className="hidden justify-center md:flex">
              <PlayerSeat {...seatProps(bySide.top)} side="top" />
            </div>
            <div className="flex min-h-0 flex-1 items-center justify-center">
              <div className="felt wood-rim relative flex h-full min-h-[220px] w-full max-w-xl flex-col items-center justify-center gap-4 rounded-[2.5rem] p-4 ring-1 ring-white/10">
                <div className="absolute top-3 left-4 text-[11px] font-bold tracking-widest text-ivory-200/80">
                  DESTE {pub.deckCount}
                </div>
                <div className="absolute top-3 right-4 flex flex-col items-end gap-0.5 text-[11px] font-bold tabular-nums text-ivory-200/80">
                  <span>
                    {committed[0]} – {committed[1]} / {TARGET_SCORE}
                  </span>
                  {pub.status === 'playing' && (dealPts[0] > 0 || dealPts[1] > 0) && (
                    <span className="text-accent-strong">
                       +{dealPts[0]} / +{dealPts[1]}
                    </span>
                  )}
                </div>
                <div className="flex items-end gap-2">
                  {pub.holeCount > 0 && (
                    <div className="flex -space-x-6 pr-2" aria-label={`${pub.holeCount} kapalı kart`}>
                      {Array.from({ length: pub.holeCount }).map((_, i) => (
                        <PlayingCard key={i} faceDown size="sm" />
                      ))}
                    </div>
                  )}
                  <div
                    data-anchor="pisti-pile"
                    className={`relative flex min-h-[102px] min-w-[72px] items-end justify-center ${hold?.sparkle ? 'pile-sparkle' : ''}`}
                  >
                    {shownPile.length > 1 && (
                      <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[11px] font-bold text-ivory-300">
                        {shownPile.length} kart
                      </span>
                    )}
                    {shownPile.length > 0 ? (
                      <div className="flex items-end gap-1.5">
                        {shownPile.slice(-2).map((id, i, shown) => (
                          <div
                            key={`${id}-${shownPile.length - shown.length + i}`}
                            className={hold && i === shown.length - 1 && hold.incoming === id ? 'animate-tile-in' : undefined}
                          >
                            <PlayingCard id={id} size={i === shown.length - 1 ? 'lg' : 'md'} />
                          </div>
                        ))}
                      </div>
                    ) : pub.pendingBluffSeat == null && !hold ? (
                      <span className="text-sm font-semibold text-ivory-300">Yer boş</span>
                    ) : null}
                    {(pub.pendingBluffSeat != null || hold?.faceDown) && (
                      <div className="ml-2 animate-tile-in">
                        <PlayingCard faceDown size="lg" label="Kapalı Pişti iddiası" />
                      </div>
                    )}
                    {pendingMine && hand.pendingCard != null && (
                      <span className="absolute -bottom-5 text-[11px] font-bold text-accent-strong">Senin kapalı kartın</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="hidden md:block">
            <PlayerSeat {...seatProps(bySide.right)} side="right" />
          </div>
        </div>

        <div className="flex md:hidden gap-1 px-2 pb-1">
          {opponents.map((s) => (
            <PlayerSeat key={s} {...seatProps(s)} side="bottom" compact />
          ))}
        </div>

        <div className="shrink-0 px-3 pb-3 sm:px-5">
          <TurnIndicator
            isMyTurn={pub.status === 'playing' && pub.turn === mySeat}
            over={pub.status !== 'playing'}
            turnName={turnName}
            instruction={instruction(pub, mySeat, turnName)}
          />
          {feedback && <p className="mt-1 text-center text-sm font-semibold text-danger">{feedback.message}</p>}
          <div data-anchor={`seat-${mySeat}`} className="mt-2 flex justify-center gap-2">
            {hand.cards.map((id) => (
              <PlayingCard
                key={id}
                id={id}
                selected={selected === id}
                onClick={() => setSelected(selected === id ? null : id)}
              />
            ))}
          </div>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {actions.believe && (
              <>
                <ActionButton variant="success" onClick={() => void perform({ type: 'believe' })} disabled={busyUi}>
                  İnan
                </ActionButton>
                <ActionButton variant="danger" onClick={() => void perform({ type: 'call_bluff' })} disabled={busyUi}>
                  Blöf de
                </ActionButton>
              </>
            )}
            {pub.phase === 'play' && pub.turn === mySeat && (
              <>
                <ActionButton onClick={playOpen} disabled={!actions.playOpen || busyUi}>
                  Açık at
                </ActionButton>
                <ActionButton variant="secondary" onClick={playClosed} disabled={!actions.playClosed || busyUi}>
                  Kapalı Pişti
                </ActionButton>
              </>
            )}
          </div>
        </div>
      </div>

      <Modal open={!!peek?.length} dismissable={false} title="Kapalı kartlar" size="sm">
        <p className="mb-4 text-sm text-ivory-200">Açık kartı ilk alan takım olarak alttaki üç kartı bir kez görebilirsiniz. Rakip göremez.</p>
        <div className="mb-5 flex justify-center gap-2">
          {peek?.map((id) => (
            <PlayingCard key={id} id={id} />
          ))}
        </div>
        <ActionButton block onClick={() => void perform({ type: 'ack_peek' })}>
          Gördüm
        </ActionButton>
      </Modal>

      <Modal open={dealOver && !showFinal} dismissable={false} title="El bitti" size="md">
        {pub.result && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              {pub.result.dealScores.map((d, i) => (
                <div key={i} className={`rounded-2xl p-3 ring-1 ${myTeam === i ? 'bg-accent/10 ring-accent/40' : 'bg-black/25 ring-white/10'}`}>
                  <div className="text-xs font-bold tracking-widest text-ivory-400">TAKIM {i + 1}</div>
                  <div className="text-xs text-ivory-300">
                    Kart {pub.result!.cardPoints[i]} · Pişti {pub.result!.pistiPoints[i]} · En çok {pub.result!.mostCards[i]}
                  </div>
                  <div className="text-2xl font-black tabular-nums">+{d}</div>
                  <div className="text-sm text-ivory-300">Toplam {pub.result!.teamScores[i]}</div>
                </div>
              ))}
            </div>
            <ActionButton block loading={busy === 'next'} onClick={() => void continueDeal()}>
              {table.status === 'finished' ? 'Sonucu gör' : 'Sonraki el'}
            </ActionButton>
          </div>
        )}
      </Modal>

      <GameResult
        open={showFinal && table.status === 'finished'}
        seats={seats}
        totals={[committed[0], committed[1], 0, 0]}
        mode="team"
        higherWins
        mySeat={mySeat}
        isOwner={isOwner}
        busy={busy === 'restart' || busy === 'leave' ? busy : null}
        onRestart={() => void restart()}
        onLeave={() => void leave()}
      />

      <Modal open={scoreOpen} onClose={() => setScoreOpen(false)} title="Skor" variant="side">
        <div className="flex flex-col gap-3">
          <p className="text-sm text-ivory-300">Hedef {TARGET_SCORE} puan. Tabloya yalnız biten eller yazılır.</p>
          {[0, 1].map((i) => (
            <div key={i} className="rounded-2xl bg-black/25 p-4 ring-1 ring-white/10">
              <div className="text-xs font-bold tracking-widest text-ivory-400">TAKIM {i + 1}</div>
              <div className="text-xs text-ivory-300">
                {seats[i].nickname} + {seats[i + 2].nickname}
              </div>
              <div className="text-3xl font-black tabular-nums">{committed[i]}</div>
              {pub.status === 'playing' && dealPts[i] > 0 && (
                <div className="mt-1 text-xs font-bold text-accent-strong"> +{dealPts[i]} (el bitince yazılır)</div>
              )}
            </div>
          ))}
          <ol className="text-sm text-ivory-200">
            {[...new Set(scores.map((s) => s.round))].sort((a, b) => a - b).map((round) => {
              const a = scores.find((s) => s.round === round && s.seat === 0)?.score ?? 0
              const b = scores.find((s) => s.round === round && s.seat === 1)?.score ?? 0
              return (
                <li key={round} className="flex justify-between py-1">
                  <span>El {round}</span>
                  <span className="tabular-nums">
                    {a} – {b}
                  </span>
                </li>
              )
            })}
          </ol>
        </div>
      </Modal>

      <GameMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        players={opponents.map((s) => (
          <PlayerSeat key={s} {...seatProps(s)} side="bottom" compact />
        ))}
        scoreLabel={`${committed[myTeam]}`}
        onScoreboard={() => {
          setMenuOpen(false)
          setScoreOpen(true)
        }}
        onLeave={() => {
          setMenuOpen(false)
          setLeaveOpen(true)
        }}
        rulesVariant="pisti"
      />

      <Modal open={leaveOpen} onClose={() => setLeaveOpen(false)} title="Masadan ayrıl" size="sm">
        <p className="mb-5 text-ivory-200">Koltuk boşalır; oyun devam ederse geri dönebilirsin.</p>
        <div className="flex gap-2">
          <ActionButton variant="secondary" block onClick={() => setLeaveOpen(false)}>
            Vazgeç
          </ActionButton>
          <ActionButton variant="danger" block loading={busy === 'leave'} onClick={() => void leave()}>
            Ayrıl
          </ActionButton>
        </div>
      </Modal>
    </>
    </ReactionProvider>
  )
}
