import { useId } from 'react'
import { useSession } from '@/stores/session'

export function NicknameField({ invalid }: { invalid?: boolean }) {
  const id = useId()
  const nickname = useSession((s) => s.nickname)
  const setNickname = useSession((s) => s.setNickname)
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-bold tracking-[0.2em] text-ivory-300">
        TAKMA ADIN
      </label>
      <input
        id={id}
        value={nickname}
        maxLength={16}
        onChange={(e) => setNickname(e.target.value)}
        placeholder="Örn. Mert"
        autoComplete="nickname"
        aria-invalid={invalid || undefined}
        className={`h-12 rounded-xl border bg-black/25 px-4 text-lg font-semibold text-ivory-50 placeholder:text-ivory-400/60 transition outline-none focus:border-accent focus:bg-black/35 ${invalid ? 'animate-shake border-danger' : 'border-white/10'}`}
      />
      {invalid && <span className="text-xs font-medium text-danger">En az 2 karakterlik bir takma ad gir.</span>}
    </div>
  )
}

export function validNickname(nick: string) {
  return nick.trim().length >= 2
}
