import { create } from 'zustand'

export type SoundName = 'draw' | 'discard' | 'select' | 'open' | 'invalid' | 'turn' | 'roundEnd' | 'gameEnd'

const STORAGE_KEY = 'okey101:sound'

interface Note {
  freq: number
  at: number
  dur: number
  type?: OscillatorType
  gain?: number
}

/** Short synthesized cues; no external audio assets. */
const CUES: Record<SoundName, Note[]> = {
  select: [{ freq: 880, at: 0, dur: 0.04, type: 'triangle', gain: 0.05 }],
  draw: [
    { freq: 320, at: 0, dur: 0.05, type: 'square', gain: 0.04 },
    { freq: 520, at: 0.04, dur: 0.06, type: 'triangle', gain: 0.06 },
  ],
  discard: [
    { freq: 180, at: 0, dur: 0.06, type: 'square', gain: 0.06 },
    { freq: 140, at: 0.03, dur: 0.08, type: 'triangle', gain: 0.06 },
  ],
  open: [
    { freq: 523, at: 0, dur: 0.1, type: 'triangle', gain: 0.07 },
    { freq: 659, at: 0.08, dur: 0.1, type: 'triangle', gain: 0.07 },
    { freq: 784, at: 0.16, dur: 0.16, type: 'triangle', gain: 0.07 },
  ],
  invalid: [
    { freq: 220, at: 0, dur: 0.09, type: 'sawtooth', gain: 0.035 },
    { freq: 185, at: 0.09, dur: 0.12, type: 'sawtooth', gain: 0.035 },
  ],
  turn: [
    { freq: 660, at: 0, dur: 0.08, type: 'sine', gain: 0.07 },
    { freq: 990, at: 0.09, dur: 0.12, type: 'sine', gain: 0.06 },
  ],
  roundEnd: [
    { freq: 523, at: 0, dur: 0.12, type: 'triangle', gain: 0.07 },
    { freq: 784, at: 0.12, dur: 0.12, type: 'triangle', gain: 0.07 },
    { freq: 1046, at: 0.24, dur: 0.25, type: 'triangle', gain: 0.07 },
  ],
  gameEnd: [
    { freq: 523, at: 0, dur: 0.14, type: 'triangle', gain: 0.07 },
    { freq: 659, at: 0.14, dur: 0.14, type: 'triangle', gain: 0.07 },
    { freq: 784, at: 0.28, dur: 0.14, type: 'triangle', gain: 0.07 },
    { freq: 1046, at: 0.42, dur: 0.4, type: 'triangle', gain: 0.08 },
  ],
}

let ctx: AudioContext | null = null

function audio(): AudioContext | null {
  if (typeof window === 'undefined' || !('AudioContext' in window)) return null
  ctx ??= new AudioContext()
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

interface SoundStore {
  enabled: boolean
  toggle: () => void
}

export const useSound = create<SoundStore>((set, get) => ({
  enabled: localStorage.getItem(STORAGE_KEY) !== 'off',
  toggle: () => {
    const enabled = !get().enabled
    localStorage.setItem(STORAGE_KEY, enabled ? 'on' : 'off')
    set({ enabled })
    if (enabled) playSound('select')
  },
}))

export function playSound(name: SoundName) {
  if (!useSound.getState().enabled) return
  const ac = audio()
  if (!ac) return
  const now = ac.currentTime
  for (const note of CUES[name]) {
    const osc = ac.createOscillator()
    const gain = ac.createGain()
    osc.type = note.type ?? 'sine'
    osc.frequency.value = note.freq
    const start = now + note.at
    gain.gain.setValueAtTime(0, start)
    gain.gain.linearRampToValueAtTime(note.gain ?? 0.06, start + 0.008)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + note.dur)
    osc.connect(gain).connect(ac.destination)
    osc.start(start)
    osc.stop(start + note.dur + 0.02)
  }
}
