// === Client-side type mirrors of server Schema ===
// These match server/GameState.ts fields exactly

export interface ClientPlayerState {
  playerId: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  score: number;
  lives: number;
  combo: number;
  isInvulnerable: boolean;
  isRespawning: boolean;
  flipX: boolean;
  anim: string;
}

export interface ClientEnemyState {
  id: number;
  enemyType: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  flipX: boolean;
  anim: string;
  active: boolean;
}

export interface ClientEggState {
  id: number;
  eggType: string;
  x: number;
  y: number;
  active: boolean;
}

export interface ClientGameState {
  players: Map<string, ClientPlayerState> & { forEach: (cb: (player: ClientPlayerState, sessionId: string) => void) => void; size: number };
  enemies: { forEach: (cb: (enemy: ClientEnemyState) => void) => void };
  eggs: { forEach: (cb: (egg: ClientEggState) => void) => void };
  wave: number;
  phase: string;
  countdown: number;
  code: string;
}

// === Game Events ===

export type GameEvent =
  | "joust_win"
  | "joust_bounce"
  | "enemy_killed"
  | "egg_collected"
  | "egg_hatched"
  | "player_damaged"
  | "player_eliminated"
  | "wave_complete"
  | "ptero_killed";

export interface PlayerResult {
  id: string;
  score: number;
  wave: number;
  bestCombo: number;
  enemiesDefeated: number;
  joustWins: number;
}

export function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}
