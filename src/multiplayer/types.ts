// === Message Protocol ===

// Client -> Server
export type ClientMessage =
  | { type: "input"; action: "flap" | "left" | "right" | "stop" }
  | { type: "ready" }
  | { type: "rematch" };

// Server -> Client
export type ServerMessage =
  | { type: "connected"; id: string }
  | { type: "waiting"; roomCode: string }
  | { type: "countdown"; seconds: number }
  | { type: "state"; state: GameSnapshot }
  | { type: "event"; name: GameEvent; data?: Record<string, unknown> }
  | { type: "match_over"; winner: string; players: PlayerResult[] }
  | { type: "player_joined"; playerCount: number }
  | { type: "player_left"; playerCount: number }
  | { type: "matched"; roomCode: string }
  | { type: "queued"; position?: number }
  | { type: "rematch"; playerId: string };

// === Game State ===

export interface PlayerState {
  id: string;
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

export interface EnemyState {
  id: number;
  type: "BOUNDER" | "HUNTER" | "SHADOW_LORD";
  x: number;
  y: number;
  vx: number;
  vy: number;
  flipX: boolean;
  anim: string;
  active: boolean;
}

export interface EggState {
  id: number;
  type: "BOUNDER" | "HUNTER" | "SHADOW_LORD";
  x: number;
  y: number;
  active: boolean;
}

export interface GameSnapshot {
  players: PlayerState[];
  enemies: EnemyState[];
  eggs: EggState[];
  wave: number;
  phase: "waiting" | "countdown" | "playing" | "wave_transition" | "finished";
  timestamp: number;
}

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
