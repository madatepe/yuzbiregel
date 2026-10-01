import { useState } from 'react'
import { useNavigate } from 'react-router'
import { AnimatePresence, motion } from 'motion/react'
import { TableCode } from '@/components/lobby/TableCode'
import { RulesButton } from '@/components/game/RulesModal'
import { ActionButton } from '@/components/ui/ActionButton'
import { ConnectionBanner, ConnectionStatus } from '@/components/ui/ConnectionStatus'
import { Modal } from '@/components/ui/Modal'
import { PlayerAvatar } from '@/components/ui/PlayerAvatar'
import { SoundToggle } from '@/components/ui/SoundToggle'
import { api } from '@/lib/api'
import { errorMessage } from '@/lib/errors'
import { playSound } from '@/lib/sound'
import { useSession } from '@/stores/session'
import { useTable } from '@/stores/table'
import { toast } from '@/stores/toast'

export function WaitingRoom() {
  const navigate = useNavigate()
  const table = useTable((s) => s.table)!
  const seats = useTable((s) => s.seats)
  const online = useTable((s) => s.online)
  const userId = useSession((s) => s.userId)
  const [busy, setBusy] = useState<'start' | 'leave' | 'close' | null>(null)
  const [confirmClose, setConfirmClose] = useState(false)

  const active = seats.filter((s) => !s.left_at)
  const isOwner = table.owner_id === userId
  const canStart = active.length === 4

  const run = async (kind: 'start' | 'leave' | 'close') => {
    setBusy(kind)
    try {
      if (kind === 'start') {
        await api.startGame(table.id)
        playSound('open')
      } else if (kind === 'leave') {
        await api.leaveTable(table.id)
        navigate('/')
      } else {
        await api.closeTable(table.id)
      }
    } catch (err) {
      toast(errorMessage(err), 'error')
      playSound('invalid')
    } finally {
      setBusy(null)
    }
  }

  return (
    <main className="flex min-h-full flex-col items-center px-4 py-6">
      <ConnectionBanner />
      <div className="mb-4 flex w-full max-w-lg items-center justify-between">
        <ConnectionStatus />
        <div className="flex items-center gap-2">
          <SoundToggle />
          <RulesButton />
        </div>
      </div>

      <div className="flex w-full max-w-lg flex-col items-center gap-6 rounded-3xl border border-line bg-surface/85 p-6 shadow-2xl backdrop-blur animate-fade-up sm:p-8">
        <TableCode code={table.code} />

        <div className="w-full">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-lg font-extrabold tracking-wider">OYUNCULAR</h2>
            <span className={`text-sm font-bold ${canStart ? 'text-success' : 'text-ivory-300'}`} aria-live="polite">
              {active.length} / 4 OYUNCU
            </span>
          </div>
          <ul className="grid gap-2 sm:grid-cols-2">
            {[0, 1, 2, 3].map((i) => {
              const seat = active.find((s) => s.seat === i)
              return (
                <li key={i} className="relative">
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.div
                      key={seat?.player_id ?? `empty-${i}`}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.2 }}
                      className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 ${seat ? 'bg-black/25 ring-1 ring-white/8' : 'border-2 border-dashed border-white/10'}`}
                    >
                      <PlayerAvatar name={seat?.nickname ?? ''} size={40} empty={!seat} offline={seat && !online[seat.player_id]} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 truncate font-bold">
                          {seat ? seat.nickname : <span className="font-medium text-ivory-400">Bekleniyor...</span>}
                          {seat?.player_id === table.owner_id && (
                            <span title="Masa sahibi" aria-label="Masa sahibi">
                              👑
                            </span>
                          )}
                          {seat?.player_id === userId && <span className="text-xs font-semibold text-accent-strong">(sen)</span>}
                        </div>
                        <div className="text-xs text-ivory-400">
                          Koltuk {i + 1}
                          {table.mode === 'team' && ` · Takım ${(i % 2) + 1}`}
                        </div>
                        {seat && (
                          <div className={`text-xs ${online[seat.player_id] ? 'text-success' : 'text-ivory-400'}`}>
                            {online[seat.player_id] ? '● Çevrimiçi' : '○ Bağlantı yok'}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  </AnimatePresence>
                </li>
              )
            })}
          </ul>
        </div>

        <div className="flex w-full justify-center gap-6 rounded-2xl bg-black/20 py-3 text-center">
          <div>
            <div className="text-[11px] font-bold tracking-[0.2em] text-ivory-400">OYUN</div>
            <div className="font-extrabold">{table.mode === 'team' ? 'EŞLİ' : 'HERKES TEK'}</div>
          </div>
          <div className="w-px bg-white/10" />
          <div>
            <div className="text-[11px] font-bold tracking-[0.2em] text-ivory-400">EL SAYISI</div>
            <div className="font-extrabold">{table.total_rounds} EL</div>
          </div>
        </div>

        {isOwner ? (
          <ActionButton
            size="lg"
            block
            variant="success"
            disabled={!canStart}
            loading={busy === 'start'}
            onClick={() => run('start')}
            hint={!canStart ? `Başlatmak için ${4 - active.length} oyuncu daha gerekiyor` : undefined}
          >
            Oyunu başlat
          </ActionButton>
        ) : (
          <p className="text-center text-sm font-semibold text-ivory-300">
            {canStart ? 'Masa sahibinin oyunu başlatması bekleniyor...' : 'Diğer oyuncular bekleniyor...'}
          </p>
        )}

        <div className="flex gap-3">
          <ActionButton variant="ghost" size="sm" loading={busy === 'leave'} onClick={() => run('leave')}>
            Masadan ayrıl
          </ActionButton>
          {isOwner && (
            <ActionButton variant="ghost" size="sm" onClick={() => setConfirmClose(true)}>
              Masayı kapat
            </ActionButton>
          )}
        </div>
      </div>

      <Modal open={confirmClose} onClose={() => setConfirmClose(false)} title="Masayı kapat" size="sm">
        <p className="mb-5 text-ivory-200">Masa herkes için kapanacak ve kod artık kullanılamayacak.</p>
        <div className="flex gap-2">
          <ActionButton variant="secondary" block onClick={() => setConfirmClose(false)}>
            Vazgeç
          </ActionButton>
          <ActionButton variant="danger" block loading={busy === 'close'} onClick={() => run('close')}>
            Kapat
          </ActionButton>
        </div>
      </Modal>
    </main>
  )
}
