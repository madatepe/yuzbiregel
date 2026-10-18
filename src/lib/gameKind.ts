export type GameKind = 'okey101' | 'pisti'

export function homePath(kind?: GameKind | string | null) {
  return kind === 'pisti' ? '/pisti' : '/'
}

export function tablePath(code: string, kind: GameKind = 'okey101') {
  return kind === 'pisti' ? `/pisti/${code}` : `/masa/${code}`
}

export function gameTitle(kind?: GameKind | string | null) {
  return kind === 'pisti' ? 'Blöflü Pişti' : '101 Okey'
}

export function asGameKind(kind?: string | null): GameKind | null {
  return kind === 'pisti' || kind === 'okey101' ? kind : null
}
