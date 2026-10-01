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
}

export class AppError extends Error {
  code: string
  constructor(code: string) {
    super(code)
    this.code = code
  }
}

export function errorMessage(err: unknown): string {
  if (err instanceof AppError) return MESSAGES[err.code] ?? MESSAGES.INTERNAL
  if (typeof err === 'string') return MESSAGES[err] ?? MESSAGES.INTERNAL
  return MESSAGES.INTERNAL
}

export function errorCode(err: unknown): string {
  return err instanceof AppError ? err.code : 'INTERNAL'
}
