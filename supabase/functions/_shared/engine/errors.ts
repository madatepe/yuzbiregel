export type GameErrorCode =
  | 'NOT_YOUR_TURN'
  | 'WRONG_PHASE'
  | 'TILE_NOT_IN_HAND'
  | 'DECK_EMPTY'
  | 'NO_DISCARD'
  | 'MUST_USE_TAKEN'
  | 'NOTHING_TO_RETURN'
  | 'INVALID_MELD'
  | 'NEED_101'
  | 'NEED_5_PAIRS'
  | 'NOT_OPENED'
  | 'ALREADY_OPENED'
  | 'WRONG_OPEN_KIND'
  | 'MUST_KEEP_DISCARD'
  | 'CANNOT_ATTACH'
  | 'MELD_NOT_FOUND'
  | 'ROUND_OVER'
  | 'UNKNOWN_ACTION'

export class GameError extends Error {
  code: GameErrorCode
  constructor(code: GameErrorCode, message?: string) {
    super(message ?? code)
    this.code = code
    this.name = 'GameError'
  }
}
