import { create } from 'zustand'
import { supabase } from '@/lib/supabase'

const NICK_KEY = 'okey101:nickname'

interface SessionStore {
  userId: string | null
  nickname: string
  ready: boolean
  error: boolean
  init: () => Promise<void>
  setNickname: (nickname: string) => void
}

let initPromise: Promise<void> | null = null

export const useSession = create<SessionStore>((set) => ({
  userId: null,
  nickname: localStorage.getItem(NICK_KEY) ?? '',
  ready: false,
  error: false,
  init: () => {
    initPromise ??= (async () => {
      try {
        const { data } = await supabase.auth.getSession()
        let user = data.session?.user ?? null
        if (!user) {
          const { data: signIn, error } = await supabase.auth.signInAnonymously()
          if (error) throw error
          user = signIn.user
        }
        set({ userId: user?.id ?? null, ready: true, error: false })
      } catch {
        initPromise = null
        set({ ready: true, error: true })
      }
    })()
    return initPromise
  },
  setNickname: (nickname) => {
    localStorage.setItem(NICK_KEY, nickname)
    set({ nickname })
  },
}))
