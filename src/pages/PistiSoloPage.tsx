import { useEffect } from 'react'
import { useNavigate } from 'react-router'
import PistiGame from '@/pages/PistiGame'
import { FullScreenLoader } from '@/components/ui/FullScreenLoader'
import { startLocalPisti, stopLocalPisti } from '@/lib/pistiLocal'
import { useSession } from '@/stores/session'
import { useTable } from '@/stores/table'

export function PistiSoloPage() {
  const navigate = useNavigate()
  const userId = useSession((s) => s.userId)
  const nickname = useSession((s) => s.nickname)
  const ready = useSession((s) => s.ready)
  const pisti = useTable((s) => s.pisti)

  useEffect(() => {
    if (!ready) return
    const name = nickname.trim()
    if (name.length < 2) {
      navigate('/pisti', { replace: true })
      return
    }
    startLocalPisti(name, userId)
    return () => stopLocalPisti()
  }, [nickname, userId, ready, navigate])

  if (!pisti) return <FullScreenLoader label="Botlar oturuyor..." />
  return <PistiGame />
}
