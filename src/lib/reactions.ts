import { playSound } from '@/lib/sound'

export interface ReactionDef {
  id: string
  label: string
  emoji?: string
  text?: string
}

export const EMOJI_REACTIONS: ReactionDef[] = [
  { id: 'tea', label: 'Çay', emoji: '🍵' },
  { id: 'wave', label: 'El salla', emoji: '👋' },
  { id: 'smile', label: 'Gülücük', emoji: '😊' },
  { id: 'laugh', label: 'Kahkaha', emoji: '😂' },
  { id: 'rofl', label: 'Aşırı kahkaha', emoji: '🤣' },
  { id: 'angry', label: 'Kızgın', emoji: '😡' },
  { id: 'nah', label: 'Nah', emoji: '🖕' },
  { id: 'clap', label: 'Alkış', emoji: '👏' },
  { id: 'shock', label: 'Şok', emoji: '😮' },
]

export const PHRASE_REACTIONS: ReactionDef[] = [
  { id: 'seri', label: 'Seri oyna', text: 'Seri oyna' },
  { id: 'orti', label: 'Orti nerden', text: 'Orti nerden' },
  { id: 'ac', label: 'Aç şu eli', text: 'Aç şu eli' },
  { id: 'yavas', label: 'Yavaş', text: 'Yavaş' },
  { id: 'helal', label: 'Helal', text: 'Helal' },
  { id: 'bitti', label: 'Bitti bu', text: 'Bitti bu' },
  { id: 'cay', label: 'Çay ısmarla', text: 'Çay ısmarla' },
  { id: 'dagit', label: 'Dağıt şunu', text: 'Dağıt şunu' },
]

const BY_ID = new Map([...EMOJI_REACTIONS, ...PHRASE_REACTIONS].map((item) => [item.id, item]))

export function reactionById(id: string): ReactionDef | null {
  return BY_ID.get(id) ?? null
}

/** Ephemeral burst. Never written to the database. */
export interface ReactionBurst {
  id: string
  fromSeat: number
  toSeat: number
  kind: string
}

const COOLDOWN_MS = 700
const MAX_SEEN = 48

type Listener = (burst: ReactionBurst) => void
type Sender = (burst: ReactionBurst) => void

const listeners = new Set<Listener>()
const seen = new Set<string>()
let channelSend: Sender | null = null
let lastSent = 0

export function subscribeReactions(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Attaches the live table channel. Pass null on disconnect. Solo tables never bind. */
export function bindReactionChannel(send: Sender | null) {
  channelSend = send
}

export function unbindReactionChannel(send: Sender) {
  if (channelSend === send) channelSend = null
}

function isSeat(n: unknown): n is number {
  return typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= 3
}

export function parseReaction(payload: unknown): ReactionBurst | null {
  if (!payload || typeof payload !== 'object') return null
  const row = payload as Partial<ReactionBurst>
  if (typeof row.id !== 'string' || row.id.length < 1 || row.id.length > 80) return null
  if (!isSeat(row.fromSeat) || !isSeat(row.toSeat) || row.fromSeat === row.toSeat) return null
  if (typeof row.kind !== 'string' || !reactionById(row.kind)) return null
  return { id: row.id, fromSeat: row.fromSeat, toSeat: row.toSeat, kind: row.kind }
}

function show(burst: ReactionBurst) {
  if (seen.has(burst.id)) return
  seen.add(burst.id)
  if (seen.size > MAX_SEEN) {
    const oldest = seen.values().next().value
    if (oldest) seen.delete(oldest)
  }
  playSound('react')
  for (const listener of listeners) listener(burst)
}

/** Remote broadcast. Drops malformed or duplicate payloads. */
export function ingestReaction(payload: unknown) {
  const burst = parseReaction(payload)
  if (burst) show(burst)
}

/** Plays locally at once, then broadcasts when a table channel is joined. */
export function dispatchReaction(fromSeat: number, toSeat: number, kind: string): boolean {
  if (!isSeat(fromSeat) || !isSeat(toSeat) || fromSeat === toSeat) return false
  if (!reactionById(kind)) return false
  const now = Date.now()
  if (now - lastSent < COOLDOWN_MS) return false
  lastSent = now
  const burst: ReactionBurst = { id: crypto.randomUUID(), fromSeat, toSeat, kind }
  show(burst)
  channelSend?.(burst)
  return true
}
