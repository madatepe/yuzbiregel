import { isJoker, tileFace, type OkeyInfo, type TileColor, type TileId } from '@engine/index.ts'

export const COLOR_NAMES: Record<TileColor, string> = {
  red: 'Kırmızı',
  blue: 'Mavi',
  yellow: 'Sarı',
  black: 'Siyah',
}

export const COLOR_CLASS: Record<TileColor, string> = {
  red: 'text-tile-red',
  blue: 'text-tile-blue',
  yellow: 'text-tile-yellow',
  black: 'text-tile-black',
}

export function tileLabel(id: TileId, okey?: OkeyInfo | null): string {
  const f = tileFace(id)
  if (f.fake) return 'Sahte okey'
  const name = `${COLOR_NAMES[f.color!]} ${f.value}`
  return okey && isJoker(id, okey) ? `Okey (${name})` : name
}

const COLOR_RANK: Record<TileColor, number> = { red: 0, blue: 1, yellow: 2, black: 3 }

/** Sort by color then value, fake okeys at the end. */
export function sortBySeries(tiles: TileId[], okey: OkeyInfo): TileId[] {
  return tiles.slice().sort((a, b) => {
    const ja = isJoker(a, okey)
    const jb = isJoker(b, okey)
    if (ja !== jb) return ja ? 1 : -1
    const fa = tileFace(a)
    const fb = tileFace(b)
    const ca = fa.fake ? COLOR_RANK[okey.color] : COLOR_RANK[fa.color!]
    const cb = fb.fake ? COLOR_RANK[okey.color] : COLOR_RANK[fb.color!]
    const va = fa.fake ? okey.value : fa.value
    const vb = fb.fake ? okey.value : fb.value
    return ca - cb || va - vb || a - b
  })
}