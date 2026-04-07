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
