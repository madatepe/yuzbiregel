import { useEffect } from 'react'
import { useNavigate } from 'react-router'
import Game from '@/pages/Game'
import { FullScreenLoader } from '@/components/ui/FullScreenLoader'
import { startLocalOkey, stopLocalOkey } from '@/lib/okeyLocal'
import { useSession } from '@/stores/session'
import { useTable } from '@/stores/table'

export function OkeySoloPage() {
  const navigate = useNavigate()
  const userId = useSession((s) => s.userId)
  const nickname = useSession((s) => s.nickname)
  const ready = useSession((s) => s.ready)
  const pub = useTable((s) => s.pub)

  useEffect(() => {
    if (!ready) return
    const name = nickname.trim()
    if (name.length < 2) {
      navigate('/', { replace: true })
      return
    }
    startLocalOkey(name, userId)
    return () => stopLocalOkey()
  }, [nickname, userId, ready, navigate])

  if (!pub) return <FullScreenLoader label="Botlar oturuyor..." />
  return <Game />
}
