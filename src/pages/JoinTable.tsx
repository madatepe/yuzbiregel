import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { SeatSelector, seatAvailable } from '@/components/lobby/SeatSelector'
import { NicknameField, validNickname } from '@/components/lobby/NicknameField'
import { ActionButton } from '@/components/ui/ActionButton'
import { ConnectionStatus } from '@/components/ui/ConnectionStatus'
import { api } from '@/lib/api'
import { errorCode, errorMessage } from '@/lib/errors'
import { playSound } from '@/lib/sound'
import { useSession } from '@/stores/session'
import { useTable } from '@/stores/table'
import { toast } from '@/stores/toast'

export function JoinTable() {
  const navigate = useNavigate()
  const table = useTable((s) => s.table)!
  const seats = useTable((s) => s.seats)
  const online = useTable((s) => s.online)
  const userId = useSession((s) => s.userId)
  const nickname = useSession((s) => s.nickname)
  const [selected, setSelected] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [nickInvalid, setNickInvalid] = useState(false)

  const leftSeat = seats.find((s) => s.player_id === userId && s.left_at)
  const available = [0, 1, 2, 3].filter((i) => seatAvailable(seats.find((s) => s.seat === i), table.status))
  const full = available.length === 0 && !leftSeat

  useEffect(() => {
    if (selected !== null && !available.includes(selected)) setSelected(null)
  }, [available, selected])

  const join = async (seat: number) => {
    if (!validNickname(nickname)) {
      setNickInvalid(true)
      playSound('invalid')
      return
    }
    setBusy(true)
    try {
      await api.joinTable({ code: table.code, seat, nickname: nickname.trim() })
      playSound('open')
    } catch (err) {
      toast(errorMessage(err), 'error')
      if (errorCode(err) === 'TABLE_CLOSED' || errorCode(err) === 'TABLE_NOT_FOUND') navigate('/')
    } finally {
      setBusy(false)
    }
  }

  const statusLabel = table.status === 'waiting' ? 'Oyuncular bekleniyor' : 'Oyun devam ediyor'

  return (
    <main className="flex min-h-full flex-col items-center px-4 py-8">
      <div className="flex w-full max-w-md flex-col gap-2 rounded-3xl border border-line bg-surface/85 p-6 shadow-2xl backdrop-blur animate-fade-up">
        <div className="flex items-center justify-between">
          <button type="button" onClick={() => navigate('/')} className="text-sm font-semibold text-ivory-300 hover:text-ivory-50">
            ← Ana sayfa
          </button>
          <ConnectionStatus compact />
        </div>
        <div className="mt-2 text-center">
          <h1 className="text-2xl font-black tracking-wider">101 MASASI</h1>
          <p className="text-sm text-ivory-300">
            Kod <span className="font-bold tracking-widest text-ivory-50">{table.code}</span> ·{' '}
            {table.mode === 'team' ? 'EŞLİ' : 'HERKES TEK'} · {table.total_rounds} EL · {statusLabel}
          </p>
        </div>

        {leftSeat ? (
          <div className="my-6 flex flex-col items-center gap-4 text-center">
            <p className="text-ivory-200">Bu masada koltuğun hâlâ seni bekliyor.</p>
            <ActionButton size="lg" onClick={() => join(leftSeat.seat)} loading={busy}>
              Masaya geri dön
            </ActionButton>
          </div>
        ) : (
          <>
            <SeatSelector
              seats={seats}
              mode={table.mode}
              status={table.status}
              selected={selected}
              onSelect={(s) => {
                playSound('select')
                setSelected(s)
              }}
              online={online}
            />
            {full ? (
              <p className="text-center font-semibold text-warning" role="alert">
                Masa dolu.
              </p>
            ) : (
              <div className="flex flex-col gap-4">
                <NicknameField invalid={nickInvalid} />
                <ActionButton
                  size="lg"
                  block
                  disabled={selected === null}
                  loading={busy}
                  onClick={() => selected !== null && join(selected)}
                  hint={selected === null ? 'Boş bir koltuk seç' : undefined}
                >
                  Masaya otur
                </ActionButton>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  )
}
