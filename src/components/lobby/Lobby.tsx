import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { ActionButton } from '@/components/ui/ActionButton'
import { NicknameField, validNickname } from './NicknameField'
import { api } from '@/lib/api'
import { errorMessage } from '@/lib/errors'
import { playSound } from '@/lib/sound'
import { useSession } from '@/stores/session'
import { toast } from '@/stores/toast'

type Mode = 'solo' | 'team'

const MODES: { id: Mode; title: string; sub: string; icon: string }[] = [
  { id: 'solo', title: 'HERKES TEK', sub: 'Dört oyuncu, herkes kendi için', icon: '👤' },
  { id: 'team', title: 'EŞLİ', sub: 'Karşılıklı oturanlar takım', icon: '👥' },
]

const ROUNDS = [1, 6, 11] as const

export function Lobby() {
  const navigate = useNavigate()
  const nickname = useSession((s) => s.nickname)
  const ready = useSession((s) => s.ready && !s.error)
  const [tab, setTab] = useState<'create' | 'join'>('create')
  const [mode, setMode] = useState<Mode>('solo')
  const [rounds, setRounds] = useState<number>(6)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [nickInvalid, setNickInvalid] = useState(false)
  const [codeInvalid, setCodeInvalid] = useState(false)

  const checkNick = () => {
    const ok = validNickname(nickname)
    setNickInvalid(!ok)
    if (!ok) playSound('invalid')
    return ok
  }

  const create = async () => {
    if (!checkNick()) return
    setBusy(true)
    try {
      const res = await api.createTable({ nickname: nickname.trim(), mode, rounds })
      playSound('open')
      navigate(`/masa/${res.code}`)
    } catch (err) {
      toast(errorMessage(err), 'error')
    } finally {
      setBusy(false)
    }
  }

  const find = (e: FormEvent) => {
    e.preventDefault()
    const clean = code.trim().toUpperCase()
    if (!/^[A-Z0-9]{6}$/.test(clean)) {
      setCodeInvalid(true)
      playSound('invalid')
      return
    }
    navigate(`/masa/${clean}`)
  }

  return (
    <div className="w-full max-w-md rounded-3xl border border-line bg-surface/85 p-5 shadow-[0_30px_80px_rgb(0_0_0/0.45)] backdrop-blur sm:p-7">
      <div role="tablist" aria-label="Masa seçenekleri" className="mb-6 grid grid-cols-2 rounded-2xl bg-black/30 p-1">
        {(['create', 'join'] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`h-11 rounded-xl text-sm font-extrabold tracking-wider transition-all duration-200 ${tab === t ? 'bg-ivory-50 text-felt-900 shadow' : 'text-ivory-300 hover:text-ivory-50'}`}
          >
            {t === 'create' ? 'MASA OLUŞTUR' : 'MASAYA KATIL'}
          </button>
        ))}
      </div>

      <div className="mb-6">
        <NicknameField invalid={nickInvalid} />
      </div>

      {tab === 'create' ? (
        <div className="flex flex-col gap-6 animate-fade-up">
          <fieldset>
            <legend className="mb-2 text-xs font-bold tracking-[0.2em] text-ivory-300">OYUN TÜRÜ</legend>
            <div className="grid grid-cols-2 gap-3">
              {MODES.map((m) => {
                const active = mode === m.id
                return (
                  <label
                    key={m.id}
                    className={`relative flex cursor-pointer flex-col items-center gap-1 rounded-2xl border-2 p-4 text-center transition-all duration-200 ${active ? 'border-accent bg-accent/10 shadow-[0_0_0_4px_rgb(246_185_59/0.12)]' : 'border-white/10 bg-black/20 hover:border-white/25'}`}
                  >
                    <input
                      type="radio"
                      name="mode"
                      className="sr-only"
                      checked={active}
                      onChange={() => setMode(m.id)}
                    />
                    <span className="text-2xl" aria-hidden>
                      {m.icon}
                    </span>
                    <span className="font-extrabold tracking-wide">{m.title}</span>
                    <span className="text-xs text-ivory-300">{m.sub}</span>
                    {active && (
                      <span className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-xs font-black text-accent-ink" aria-hidden>
                        ✓
                      </span>
                    )}
                  </label>
                )
              })}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-xs font-bold tracking-[0.2em] text-ivory-300">EL SAYISI</legend>
            <div className="grid grid-cols-3 gap-2">
              {ROUNDS.map((r) => {
                const active = rounds === r
                return (
                  <label
                    key={r}
                    className={`flex h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 font-extrabold transition-all duration-200 ${active ? 'border-accent bg-accent/10 text-accent-strong' : 'border-white/10 bg-black/20 text-ivory-200 hover:border-white/25'}`}
                  >
                    <input type="radio" name="rounds" className="sr-only" checked={active} onChange={() => setRounds(r)} />
                    <span
                      className={`h-3.5 w-3.5 rounded-full border-2 ${active ? 'border-accent bg-accent' : 'border-ivory-400'}`}
                      aria-hidden
                    />
                    {r} EL
                  </label>
                )
              })}
            </div>
          </fieldset>

          <ActionButton size="lg" block onClick={create} loading={busy} disabled={!ready}>
            Masa oluştur
          </ActionButton>
        </div>
      ) : (
        <form className="flex flex-col gap-6 animate-fade-up" onSubmit={find}>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="table-code" className="text-xs font-bold tracking-[0.2em] text-ivory-300">
              MASA KODU
            </label>
            <input
              id="table-code"
              value={code}
              onChange={(e) => {
                setCodeInvalid(false)
                setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))
              }}
              placeholder="7K4P9A"
              inputMode="text"
              autoCapitalize="characters"
              autoComplete="off"
              aria-invalid={codeInvalid || undefined}
              className={`h-16 rounded-2xl border-2 bg-black/30 text-center text-3xl font-black tracking-[0.45em] text-ivory-50 uppercase placeholder:text-ivory-400/30 outline-none transition focus:border-accent ${codeInvalid ? 'animate-shake border-danger' : 'border-white/10'}`}
            />
            {codeInvalid && <span className="text-xs font-medium text-danger">Masa kodu 6 karakter olmalı.</span>}
          </div>
          <ActionButton type="submit" size="lg" block disabled={!ready}>
            Masayı bul
          </ActionButton>
        </form>
      )}
    </div>
  )
}
