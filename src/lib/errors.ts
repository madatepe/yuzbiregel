const MESSAGES: Record<string, string> = {
  // Table / API
  UNAUTHORIZED: 'Oturumun sona ermiş. Sayfayı yenileyip tekrar dene.',
  BAD_REQUEST: 'Bu işlem şu anda yapılamıyor.',
  TABLE_NOT_FOUND: 'Bu masa artık mevcut değil.',
  TABLE_CLOSED: 'Bu masa kapatıldı.',
  TABLE_FULL: 'Masa dolu.',
  SEAT_TAKEN: 'Bu koltuk az önce doldu. Başka bir koltuk seç.',
  NOT_SEATED: 'Bu masada oturmuyorsun.',
  NOT_OWNER: 'Bunu yalnızca masa sahibi yapabilir.',
  NEED_4_PLAYERS: 'Oyunu başlatmak için 4 oyuncu gerekiyor.',
  BAD_STATE: 'Bu hamleyi şu anda yapamazsın.',
  CONFLICT: 'Masa güncellendi, tekrar dene.',
  INTERNAL: 'Bir şeyler ters gitti. Tekrar dene.',
  SCHEMA_REQUIRED: 'Sunucu şeması güncel değil. Terminalde npm run db:push ve npm run functions:deploy çalıştır.',
  NETWORK: 'Bağlantı yeniden kuruluyor.',
  // Game engine
  NOT_YOUR_TURN: 'Sıra sende değil.',
  WRONG_PHASE: 'Bu hamleyi şu anda yapamazsın.',
  TILE_NOT_IN_HAND: 'Bu taş elinde değil.',
  DECK_EMPTY: 'Destede taş kalmadı.',
  NO_DISCARD: 'Alınacak taş yok.',
  MUST_USE_TAKEN: 'Aldığın taşı bu el kullanmalısın.',
  NOTHING_TO_RETURN: 'Geri bırakılacak taş yok.',
  INVALID_MELD: 'Seçtiğin taşlar geçerli per oluşturmuyor.',
  NEED_101: 'Açmak için en az 101 puan gerekiyor.',
  NEED_5_PAIRS: 'Çift açmak için en az 5 çift gerekiyor.',
  NOT_OPENED: 'Önce elini açmalısın.',
  ALREADY_OPENED: 'Elini zaten açtın.',
  WRONG_OPEN_KIND: 'Bu açılış türüyle bu hamle yapılamaz.',
  MUST_KEEP_DISCARD: 'Atmak için elinde en az bir taş kalmalı.',
  CANNOT_ATTACH: 'Bu taş bu pere işlenemez.',
  MELD_NOT_FOUND: 'Per bulunamadı.',
  ROUND_OVER: 'El bitti.',
  UNKNOWN_ACTION: 'Bu hamleyi şu anda yapamazsın.',
  CARD_NOT_IN_HAND: 'Bu kart elinde değil.',
  CANNOT_PLAY_CLOSED: 'Kapalı kart yalnızca yerde tek kart varken atılır.',
  NOT_BLUFF_RESPONDER: 'Blöf kararı sıradaki rakibe ait.',
  DEAL_OVER: 'El bitti.',
  NO_PEEK: 'Görecek kapalı kart kalmadı.',
}

export class AppError extends Error {
  code: string
  constructor(code: string) {
    super(code)
    this.code = code
  }
}

function codeOf(err: unknown): string | null {
  if (err instanceof AppError) return err.code
  if (typeof err === 'string') return err
  if (err && typeof err === 'object' && 'code' in err && typeof (err as { code: unknown }).code === 'string') {
    return (err as { code: string }).code
  }
  return null
}

export function errorMessage(err: unknown): string {
  const code = codeOf(err)
  if (code) return MESSAGES[code] ?? MESSAGES.INTERNAL
  return MESSAGES.INTERNAL
}

export function errorCode(err: unknown): string {
  return codeOf(err) ?? 'INTERNAL'
}
