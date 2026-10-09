export type PistiErrorCode =
  | 'NOT_YOUR_TURN'
  | 'WRONG_PHASE'
  | 'CARD_NOT_IN_HAND'
  | 'CANNOT_PLAY_CLOSED'
  | 'NOT_BLUFF_RESPONDER'
  | 'DEAL_OVER'
  | 'NO_PEEK'
  | 'UNKNOWN_ACTION'

export class PistiError extends Error {
  code: PistiErrorCode
  constructor(code: PistiErrorCode, message?: string) {
    super(message ?? code)
    this.code = code
    this.name = 'PistiError'
  }
}
