import { Room, Client } from "colyseus";
import { GameRoomState, PlayerState, EnemyState, EggState } from "./GameState";
import { updateEnemyAI, type AIEnemy, type AIPlayer } from "./enemy-ai";

// ── Game Constants ──────────────────────────────────────────────────────────
const GAME_WIDTH = 1170;
const GAME_HEIGHT = 540;
const GRAVITY = 600;

const PLAYER_FLAP_FORCE = -300;
const PLAYER_MAX_VY = 400;
const PLAYER_SPEED = 200;
const PLAYER_ACCEL = 600;
const PLAYER_DRAG = 200;
const PLAYER_AIR_DRAG = 80;
const PLAYER_INVULN_DURATION = 1500;

const ENEMY_BASE_SPEED = 100;
const ENEMY_TYPES = {
  BOUNDER: { speedMult: 1.0, points: 500 },
  HUNTER: { speedMult: 1.5, points: 750 },
  SHADOW_LORD: { speedMult: 2.0, points: 1000 },
} as const;
const EGG_POINTS: Record<EnemyType, number> = { BOUNDER: 250, HUNTER: 500, SHADOW_LORD: 750 };
const EGG_HATCH_TIME = 5000;

const PLATFORMS = [
  { x: 0, y: 480, w: 300, h: 16 },
  { x: 870, y: 480, w: 300, h: 16 },
  { x: 180, y: 390, w: 200, h: 12 },
  { x: 790, y: 390, w: 200, h: 12 },
  { x: 440, y: 320, w: 290, h: 12 },
  { x: 60, y: 230, w: 180, h: 12 },
  { x: 930, y: 230, w: 180, h: 12 },
  { x: 300, y: 150, w: 200, h: 12 },
  { x: 670, y: 150, w: 200, h: 12 },
];

const SPAWN_POINTS = [
  { x: 0, y: 80 },
  { x: GAME_WIDTH, y: 80 },
  { x: 0, y: 220 },
  { x: GAME_WIDTH, y: 220 },
];

const LAVA_Y = GAME_HEIGHT - 60;
const MATCH_WAVES = 5;
const WAVE_BASE_ENEMIES = 3;
const WAVE_MAX_ENEMIES = 8;
const SPAWN_DELAY = 800;
const WAVE_PAUSE = 2000;
const PVP_JOUST_POINTS = 1000;
const PVP_RESPAWN_TIME = 2000;
const PVP_TIE_ZONE = 5;

const PLAYER_HALF_W = 15;
const PLAYER_HALF_H = 17;
const ENEMY_HALF_W = 15;
const ENEMY_HALF_H = 17;
const EGG_HALF_W = 10;
const EGG_HALF_H = 10;

const SMART_PROMOTE_TIME = 15000;
const ENEMY_FLAP_INTERVAL_MIN = 600;
const ENEMY_FLAP_INTERVAL_MAX = 1200;
const TRACKING_LINES = [100, 180, 280, 360];

// ── Types ───────────────────────────────────────────────────────────────────

type Phase = "waiting" | "countdown" | "playing" | "wave_transition" | "finished";
type EnemyType = "BOUNDER" | "HUNTER" | "SHADOW_LORD";
type InputAction = "flap" | "left" | "right" | "stop";

interface InternalPlayerState {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  ax: number;
  score: number;
  lives: number;
  combo: number;
  bestCombo: number;
  enemiesDefeated: number;
  joustWins: number;
  isInvulnerable: boolean;
  invulnTimer: number;
  isRespawning: boolean;
  respawnTimer: number;
  flipX: boolean;
  onGround: boolean;
  currentInput: InputAction;
  ready: boolean;
}

interface InternalEnemyState {
  id: number;
  type: EnemyType;
  x: number;
  y: number;
  vx: number;
  vy: number;
  active: boolean;
  flipX: boolean;
  trackingLine: number;
  facingRight: boolean;
  nextFlapTime: number;
  isSmart: boolean;
  aiMode: "level" | "up" | "down";
  levelFlightTimer: number;
  flapUpTimer: number;
  directionCopyTimer: number;
  onPlatform: boolean;
}

interface InternalEggState {
  id: number;
  type: EnemyType;
  x: number;
  y: number;
  vy: number;
  active: boolean;
  hatchTimer: number;
}

interface PlayerResult {
  id: string;
  score: number;
  wave: number;
  bestCombo: number;
  enemiesDefeated: number;
  joustWins: number;
}

// ── Helper functions ────────────────────────────────────────────────────────

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function resolvePlatformCollisions(
  entity: { x: number; y: number; vy: number; onGround?: boolean; onPlatform?: boolean },
  halfW: number,
  halfH: number,
): void {
  if ("onGround" in entity) entity.onGround = false;
  if ("onPlatform" in entity) entity.onPlatform = false;
  for (const p of PLATFORMS) {
    const eLeft = entity.x - halfW;
    const eRight = entity.x + halfW;
    const eBottom = entity.y + halfH;
    const ePrevBottom = eBottom - entity.vy * (1 / 60);

    if (eRight > p.x && eLeft < p.x + p.w) {
      if (eBottom >= p.y && ePrevBottom <= p.y + 4 && entity.vy >= 0) {
        entity.y = p.y - halfH;
        entity.vy = 0;
        if ("onGround" in entity) entity.onGround = true;
        if ("onPlatform" in entity) entity.onPlatform = true;
      }
    }
  }
}

function screenWrap(entity: { x: number }): void {
  if (entity.x < -32) entity.x = GAME_WIDTH + 32;
  else if (entity.x > GAME_WIDTH + 32) entity.x = -32;
}

function generateWaveEnemies(wave: number): EnemyType[] {
  const total = Math.min(WAVE_BASE_ENEMIES + wave - 1, WAVE_MAX_ENEMIES);
  const enemies: EnemyType[] = [];
  for (let i = 0; i < total; i++) {
    const roll = Math.random();
    if (wave <= 2) {
      enemies.push(roll < 0.85 ? "BOUNDER" : "HUNTER");
    } else if (wave <= 5) {
      const hc = 0.2 + (wave - 3) * 0.15;
      const sc = wave >= 4 ? 0.1 : 0;
      if (roll < sc) enemies.push("SHADOW_LORD");
      else if (roll < sc + hc) enemies.push("HUNTER");
      else enemies.push("BOUNDER");
    } else {
      enemies.push("SHADOW_LORD");
    }
  }
  return enemies;
}

function getPlayerAnim(p: InternalPlayerState): string {
  if (p.isRespawning) return "player_idle_anim";
  if (!p.onGround) return "player_charge_anim";
  if (Math.abs(p.vx) > 10) return "player_run_anim";
  return "player_idle_anim";
}

const ENEMY_ATLAS: Record<string, string> = {
  BOUNDER: "bounder",
  HUNTER: "hunter",
  SHADOW_LORD: "shadow",
};

function getEnemyAnim(e: InternalEnemyState): string {
  const prefix = ENEMY_ATLAS[e.type] || "bounder";
  if (!e.active) return `${prefix}_idle_anim`;
  if (e.vy < -30) return `${prefix}_run_anim`;
  return `${prefix}_idle_anim`;
}

function randomFlapTime(): number {
  return Date.now() + ENEMY_FLAP_INTERVAL_MIN + Math.random() * (ENEMY_FLAP_INTERVAL_MAX - ENEMY_FLAP_INTERVAL_MIN);
}

function pickTrackingLine(): number {
  return TRACKING_LINES[Math.floor(Math.random() * TRACKING_LINES.length)];
}

// ── Game Room ───────────────────────────────────────────────────────────────

export class GameRoom extends Room<{ state: GameRoomState }> {
  maxClients = 2;

  // Internal state (not synced to clients)
  private internalPlayers = new Map<string, InternalPlayerState>();
  private internalEnemies: InternalEnemyState[] = [];
  private internalEggs: InternalEggState[] = [];

  private spawnQueue: EnemyType[] = [];
  private spawnTimer = 0;
  private waveTransitionTimer = 0;
  private countdownTimer = 0;
  private lastCountdownSecond = 0;
  private smartPromoteTimer = 0;
  private nextEnemyId = 0;
  private nextEggId = 0;

  // Message handlers
  messages = {
    "input": (client: Client, data: { action: string }) => {
      const internal = this.internalPlayers.get(client.sessionId);
      if (!internal) return;
      const action = data.action as InputAction;
      if (action === "flap") {
        if (!internal.isRespawning) {
          internal.vy = Math.max(internal.vy + PLAYER_FLAP_FORCE, -PLAYER_MAX_VY);
        }
      } else if (action === "left" || action === "right" || action === "stop") {
        internal.currentInput = action;
      }
    },

    "ready": (client: Client) => {
      const internal = this.internalPlayers.get(client.sessionId);
      if (internal) {
        internal.ready = true;
        this.checkStart();
      }
    },

    "rematch": (client: Client) => {
      this.handleRematch(client.sessionId);
    },
  };

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  // Presence channel for tracking active room IDs
  private LOBBY_CHANNEL = "$flappy_rooms";

  private generateCodeSingle(): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    let result = "";
    for (let i = 0; i < 4; i++) {
      result += chars[Math.floor(Math.random() * chars.length)];
    }
    return result;
  }

  private async generateUniqueCode(): Promise<string> {
    const currentIds = await this.presence.smembers(this.LOBBY_CHANNEL);
    let id: string;
    do {
      id = this.generateCodeSingle();
    } while (currentIds.includes(id));
    await this.presence.sadd(this.LOBBY_CHANNEL, id);
    return id;
  }

  async onCreate(options: { code?: string } = {}) {
    this.state = new GameRoomState();

    // Set custom 4-letter room ID (official Colyseus pattern)
    const code = options.code || await this.generateUniqueCode();
    this.roomId = code;
    this.state.code = code;
    console.log("GameRoom created with code:", code);
  }

  async onDispose() {
    // Free up the room code
    this.presence.srem(this.LOBBY_CHANNEL, this.roomId);
    console.log("GameRoom disposed, freed code:", this.roomId);
  }

  onJoin(client: Client) {
    const playerIndex = this.internalPlayers.size;
    const spawnPoint = playerIndex === 0
      ? { x: 150, y: 440 }
      : { x: GAME_WIDTH - 150, y: 440 };

    // Schema state (synced to clients)
    const playerState = new PlayerState();
    playerState.playerId = client.sessionId;
    playerState.x = spawnPoint.x;
    playerState.y = spawnPoint.y;
    playerState.lives = 3;
    this.state.players.set(client.sessionId, playerState);

    // Internal state (server-only)
    const internal: InternalPlayerState = {
      id: client.sessionId,
      x: spawnPoint.x,
      y: spawnPoint.y,
      vx: 0,
      vy: 0,
      ax: 0,
      score: 0,
      lives: 3,
      combo: 0,
      bestCombo: 0,
      enemiesDefeated: 0,
      joustWins: 0,
      isInvulnerable: false,
      invulnTimer: 0,
      isRespawning: false,
      respawnTimer: 0,
      flipX: playerIndex === 1,
      onGround: false,
      currentInput: "stop",
      ready: false,
    };
    this.internalPlayers.set(client.sessionId, internal);

    client.send("connected", { id: client.sessionId });
    this.broadcast("player_joined", { playerCount: this.internalPlayers.size });
  }

  onLeave(client: Client) {
    this.state.players.delete(client.sessionId);
    this.internalPlayers.delete(client.sessionId);

    this.broadcast("player_left", { playerCount: this.internalPlayers.size });

    // If match was in progress and only one player remains, they win
    if (
      (this.state.phase === "playing" || this.state.phase === "wave_transition") &&
      this.internalPlayers.size === 1
    ) {
      const winner = [...this.internalPlayers.values()][0];
      this.endMatch(winner.id);
    }

    // If no players left, reset
    if (this.internalPlayers.size === 0) {
      this.resetMatch();
    }
  }

  // ── Match flow ────────────────────────────────────────────────────────────

  private checkStart() {
    if (this.state.phase !== "waiting") return;
    if (this.internalPlayers.size < 2) return;

    const allReady = [...this.internalPlayers.values()].every((p) => p.ready);
    if (!allReady) return;

    this.startCountdown();
  }

  private startCountdown() {
    this.state.phase = "countdown";
    this.countdownTimer = 3000;
    this.lastCountdownSecond = 4;

    // Start the simulation interval (60 fps tick)
    this.setSimulationInterval((delta) => this.update(delta), 1000 / 60);
  }

  private startWave() {
    this.state.wave++;
    if (this.state.wave > MATCH_WAVES) {
      const players = [...this.internalPlayers.values()];
      const winner = players.reduce((a, b) => (a.score >= b.score ? a : b));
      this.endMatch(winner.id);
      return;
    }

    this.state.phase = "playing";
    this.spawnQueue = generateWaveEnemies(this.state.wave);
    this.spawnTimer = SPAWN_DELAY;
    this.smartPromoteTimer = SMART_PROMOTE_TIME;
  }

  private endMatch(winnerId: string) {
    this.state.phase = "finished";

    const results: PlayerResult[] = [...this.internalPlayers.values()].map((p) => ({
      id: p.id,
      score: p.score,
      wave: this.state.wave,
      bestCombo: p.bestCombo,
      enemiesDefeated: p.enemiesDefeated,
      joustWins: p.joustWins,
    }));

    this.broadcast("match_over", { winner: winnerId, players: results });
  }

  private resetMatch() {
    this.state.phase = "waiting";
    this.state.wave = 0;
    this.state.countdown = 0;
    this.internalEnemies = [];
    this.internalEggs = [];
    this.spawnQueue = [];
    this.spawnTimer = 0;
    this.waveTransitionTimer = 0;
    this.countdownTimer = 0;
    this.lastCountdownSecond = 0;
    this.nextEnemyId = 0;
    this.nextEggId = 0;

    // Clear schema arrays
    this.state.enemies.clear();
    this.state.eggs.clear();

    for (const p of this.internalPlayers.values()) {
      p.score = 0;
      p.lives = 3;
      p.combo = 0;
      p.bestCombo = 0;
      p.enemiesDefeated = 0;
      p.joustWins = 0;
      p.isInvulnerable = false;
      p.invulnTimer = 0;
      p.isRespawning = false;
      p.respawnTimer = 0;
      p.vx = 0;
      p.vy = 0;
      p.ax = 0;
      p.currentInput = "stop";
      p.ready = false;
    }
  }

  private handleRematch(playerId: string) {
    if (this.state.phase !== "finished") return;

    const player = this.internalPlayers.get(playerId);
    if (player) player.ready = true;

    this.broadcast("rematch_request", { playerId });

    const allReady = [...this.internalPlayers.values()].every((p) => p.ready);
    if (allReady && this.internalPlayers.size >= 2) {
      this.resetMatch();
      for (const p of this.internalPlayers.values()) {
        p.ready = true;
      }
      this.startCountdown();
    }
  }

  // ── Game tick ─────────────────────────────────────────────────────────────

  update(deltaMs: number) {
    // Clamp delta for stability (16-33ms)
    const delta = clamp(deltaMs, 16, 33);
    const dt = delta / 1000;

    // -- Countdown phase --
    if (this.state.phase === "countdown") {
      this.countdownTimer -= delta;
      const currentSecond = Math.ceil(this.countdownTimer / 1000);
      if (currentSecond !== this.lastCountdownSecond && currentSecond > 0) {
        this.lastCountdownSecond = currentSecond;
        this.state.countdown = currentSecond;
        this.broadcast("countdown", { seconds: currentSecond });
      }
      if (this.countdownTimer <= 0) {
        this.startWave();
      }
      this.syncState();
      return;
    }

    // -- Wave transition phase --
    if (this.state.phase === "wave_transition") {
      this.waveTransitionTimer -= delta;
      if (this.waveTransitionTimer <= 0) {
        this.startWave();
      }
      this.syncState();
      return;
    }

    if (this.state.phase !== "playing") return;

    const now = Date.now();

    // -- Update players --
    for (const player of this.internalPlayers.values()) {
      this.updatePlayer(player, dt, delta);
    }

    // -- Update enemies --
    for (const enemy of this.internalEnemies) {
      if (!enemy.active) continue;
      this.updateEnemy(enemy, dt, now, delta);
    }

    // -- Update eggs --
    for (const egg of this.internalEggs) {
      if (!egg.active) continue;
      this.updateEgg(egg, dt, delta);
    }

    // -- Collisions --
    this.checkPlayerVsEnemy();
    this.checkPlayerVsPlayer();
    this.checkPlayerVsEgg();

    // -- Smart promote timer --
    this.smartPromoteTimer -= delta;
    if (this.smartPromoteTimer <= 0) {
      for (const e of this.internalEnemies) {
        if (e.active) e.isSmart = true;
      }
    }

    // -- Spawn queue --
    if (this.spawnQueue.length > 0) {
      this.spawnTimer -= delta;
      if (this.spawnTimer <= 0) {
        this.spawnNextEnemy();
        this.spawnTimer = SPAWN_DELAY;
      }
    }

    // -- Wave complete check --
    const activeEnemies = this.internalEnemies.filter((e) => e.active).length;
    const activeEggs = this.internalEggs.filter((e) => e.active).length;
    if (
      activeEnemies === 0 &&
      activeEggs === 0 &&
      this.spawnQueue.length === 0 &&
      this.state.wave > 0
    ) {
      this.broadcast("wave_complete", { wave: this.state.wave });
      this.state.phase = "wave_transition";
      this.waveTransitionTimer = WAVE_PAUSE;
    }

    // -- Sync internal state to schema --
    this.syncState();
  }

  // ── Sync internal state to Schema (auto-synced to clients) ────────────────

  private syncState() {
    // Sync players
    for (const [id, internal] of this.internalPlayers) {
      const ps = this.state.players.get(id);
      if (!ps) continue;
      ps.x = internal.x;
      ps.y = internal.y;
      ps.vx = internal.vx;
      ps.vy = internal.vy;
      ps.score = internal.score;
      ps.lives = internal.lives;
      ps.combo = internal.combo;
      ps.isInvulnerable = internal.isInvulnerable;
      ps.isRespawning = internal.isRespawning;
      ps.flipX = internal.flipX;
      ps.anim = getPlayerAnim(internal);
    }

    // Sync enemies — update in place, add new ones, remove dead ones
    const activeEnemyIds = new Set(this.internalEnemies.filter(e => e.active).map(e => e.id));

    // Remove schema entries for dead enemies (iterate backwards)
    for (let i = this.state.enemies.length - 1; i >= 0; i--) {
      if (!activeEnemyIds.has(this.state.enemies[i].id)) {
        this.state.enemies.splice(i, 1);
      }
    }

    // Update existing or add new
    for (const e of this.internalEnemies) {
      if (!e.active) continue;
      let es: EnemyState | undefined;
      this.state.enemies.forEach((s: EnemyState) => { if (s.id === e.id) es = s; });
      if (!es) {
        es = new EnemyState();
        es.id = e.id;
        this.state.enemies.push(es);
      }
      es.enemyType = e.type;
      es.x = e.x;
      es.y = e.y;
      es.vx = e.vx;
      es.vy = e.vy;
      es.flipX = e.flipX;
      es.anim = getEnemyAnim(e);
      es.active = true;
    }

    // Sync eggs — same pattern
    const activeEggIds = new Set(this.internalEggs.filter(e => e.active).map(e => e.id));

    for (let i = this.state.eggs.length - 1; i >= 0; i--) {
      if (!activeEggIds.has(this.state.eggs[i].id)) {
        this.state.eggs.splice(i, 1);
      }
    }

    for (const egg of this.internalEggs) {
      if (!egg.active) continue;
      let eggS: EggState | undefined;
      this.state.eggs.forEach((s: EggState) => { if (s.id === egg.id) eggS = s; });
      if (!eggS) {
        eggS = new EggState();
        eggS.id = egg.id;
        this.state.eggs.push(eggS);
      }
      eggS.eggType = egg.type;
      eggS.x = egg.x;
      eggS.y = egg.y;
      eggS.active = true;
    }
  }

  // ── Player update ─────────────────────────────────────────────────────────

  private updatePlayer(player: InternalPlayerState, dt: number, delta: number) {
    // Respawn timer
    if (player.isRespawning) {
      player.respawnTimer -= delta;
      if (player.respawnTimer <= 0) {
        player.isRespawning = false;
        player.isInvulnerable = true;
        player.invulnTimer = PLAYER_INVULN_DURATION;
        const spawnPlatform = PLATFORMS[Math.floor(Math.random() * PLATFORMS.length)];
        player.x = spawnPlatform.x + spawnPlatform.w / 2;
        player.y = spawnPlatform.y - PLAYER_HALF_H - 5;
        player.vx = 0;
        player.vy = 0;
      }
      return;
    }

    // Invulnerability timer
    if (player.isInvulnerable) {
      player.invulnTimer -= delta;
      if (player.invulnTimer <= 0) {
        player.isInvulnerable = false;
      }
    }

    // Acceleration from input
    switch (player.currentInput) {
      case "left":
        player.ax = -PLAYER_ACCEL;
        player.flipX = true;
        break;
      case "right":
        player.ax = PLAYER_ACCEL;
        player.flipX = false;
        break;
      case "stop":
        player.ax = 0;
        break;
    }

    // Apply gravity
    player.vy += GRAVITY * dt;

    // Apply horizontal acceleration
    player.vx += player.ax * dt;

    // Apply drag
    if (player.currentInput === "stop" || player.ax === 0) {
      const drag = player.onGround ? PLAYER_DRAG : PLAYER_AIR_DRAG;
      if (player.vx > 0) {
        player.vx = Math.max(0, player.vx - drag * dt);
      } else if (player.vx < 0) {
        player.vx = Math.min(0, player.vx + drag * dt);
      }
    }

    // Clamp velocities
    player.vy = clamp(player.vy, -PLAYER_MAX_VY, PLAYER_MAX_VY);
    player.vx = clamp(player.vx, -PLAYER_SPEED, PLAYER_SPEED);

    // Move
    player.x += player.vx * dt;
    player.y += player.vy * dt;

    // Platform collisions
    resolvePlatformCollisions(player, PLAYER_HALF_W, PLAYER_HALF_H);

    // Screen wrap
    screenWrap(player);

    // Ceiling bounce
    if (player.y < 0) {
      player.y = 0;
      player.vy = 50;
    }

    // Lava check
    if (player.y > LAVA_Y) {
      this.loseLife(player);
    }
  }

  // ── Enemy update ──────────────────────────────────────────────────────────

  private updateEnemy(enemy: InternalEnemyState, dt: number, now: number, delta: number) {
    const waveSpeedScale = Math.min(1.0 + this.state.wave * 0.05, 2.0);

    const aiPlayers: AIPlayer[] = [...this.internalPlayers.values()].map((p) => ({
      x: p.x,
      y: p.y,
      isRespawning: p.isRespawning,
    }));

    updateEnemyAI(
      enemy as AIEnemy,
      aiPlayers,
      now,
      delta,
      waveSpeedScale,
      this.state.wave,
    );

    // Physics
    enemy.vy += GRAVITY * dt;
    enemy.vy = clamp(enemy.vy, -PLAYER_MAX_VY, PLAYER_MAX_VY);
    enemy.x += enemy.vx * dt;
    enemy.y += enemy.vy * dt;

    // Platform collisions
    resolvePlatformCollisions(enemy, ENEMY_HALF_W, ENEMY_HALF_H);

    // Screen wrap
    if (enemy.x < -32) {
      enemy.x = GAME_WIDTH + 32;
      if (!enemy.isSmart) enemy.facingRight = false;
    } else if (enemy.x > GAME_WIDTH + 32) {
      enemy.x = -32;
      if (!enemy.isSmart) enemy.facingRight = true;
    }

    // Ceiling bounce
    if (enemy.y < 0) {
      enemy.y = 0;
      enemy.vy = 50;
    }

    // Lava — deactivate
    if (enemy.y > LAVA_Y) {
      enemy.active = false;
    }
  }

  // ── Egg update ────────────────────────────────────────────────────────────

  private updateEgg(egg: InternalEggState, dt: number, delta: number) {
    egg.vy += GRAVITY * dt;
    egg.y += egg.vy * dt;

    resolvePlatformCollisions(egg, EGG_HALF_W, EGG_HALF_H);

    // Hatch timer
    egg.hatchTimer -= delta;
    if (egg.hatchTimer <= 0) {
      egg.active = false;
      const hatchType: EnemyType =
        egg.type === "BOUNDER"
          ? "HUNTER"
          : egg.type === "HUNTER"
            ? "SHADOW_LORD"
            : "SHADOW_LORD";
      this.spawnEnemyAt(hatchType, egg.x, egg.y, true);
      this.broadcast("egg_hatched", { type: hatchType, x: egg.x, y: egg.y });
    }

    // Lava
    if (egg.y > LAVA_Y) {
      egg.active = false;
    }
  }

  // ── Collisions ────────────────────────────────────────────────────────────

  private checkPlayerVsEnemy() {
    for (const player of this.internalPlayers.values()) {
      if (player.isInvulnerable || player.isRespawning) continue;
      for (const enemy of this.internalEnemies) {
        if (!enemy.active) continue;
        if (Math.abs(player.x - enemy.x) > 35 || Math.abs(player.y - enemy.y) > 35)
          continue;

        const playerBottom = player.y + PLAYER_HALF_H * 0.3;
        const enemyBottom = enemy.y + ENEMY_HALF_H * 0.3;

        if (playerBottom < enemy.y) {
          // Player wins — stomp
          this.defeatEnemy(player, enemy);
        } else if (enemyBottom < player.y) {
          // Enemy wins — damage player
          this.damagePlayer(player);
        } else {
          // Bounce apart
          player.vy = -150;
          enemy.vy = -150;
          player.vx = player.x < enemy.x ? -150 : 150;
          enemy.vx = enemy.x < player.x ? -150 : 150;
        }
      }
    }
  }

  private checkPlayerVsPlayer() {
    const playerList = [...this.internalPlayers.values()];
    if (playerList.length < 2) return;
    const [p1, p2] = playerList;
    if (p1.isRespawning || p2.isRespawning) return;
    if (p1.isInvulnerable || p2.isInvulnerable) return;
    if (Math.abs(p1.x - p2.x) > 35 || Math.abs(p1.y - p2.y) > 35) return;

    const diff = p1.y - p2.y;

    if (Math.abs(diff) < PVP_TIE_ZONE) {
      // Bounce apart
      p1.vy = -150;
      p2.vy = -150;
      p1.vx = p1.x < p2.x ? -150 : 150;
      p2.vx = p2.x < p1.x ? -150 : 150;
      this.broadcast("joust_bounce", {});
    } else if (diff < 0) {
      // p1 is higher — p1 wins
      p1.score += PVP_JOUST_POINTS;
      p1.joustWins++;
      this.startRespawn(p2);
      this.broadcast("joust_win", { winner: p1.id, loser: p2.id });
    } else {
      // p2 is higher — p2 wins
      p2.score += PVP_JOUST_POINTS;
      p2.joustWins++;
      this.startRespawn(p1);
      this.broadcast("joust_win", { winner: p2.id, loser: p1.id });
    }
  }

  private checkPlayerVsEgg() {
    for (const player of this.internalPlayers.values()) {
      if (player.isRespawning) continue;
      for (const egg of this.internalEggs) {
        if (!egg.active) continue;
        if (Math.abs(player.x - egg.x) > 25 || Math.abs(player.y - egg.y) > 25)
          continue;

        // Collect the egg
        egg.active = false;
        player.score += EGG_POINTS[egg.type];
        player.combo++;
        if (player.combo > player.bestCombo) player.bestCombo = player.combo;
        this.broadcast("egg_collected", {
          playerId: player.id,
          type: egg.type,
          points: EGG_POINTS[egg.type],
        });
      }
    }
  }

  // ── Combat helpers ────────────────────────────────────────────────────────

  private defeatEnemy(player: InternalPlayerState, enemy: InternalEnemyState) {
    enemy.active = false;
    player.vy = PLAYER_FLAP_FORCE * 0.6;
    player.combo++;
    if (player.combo > player.bestCombo) player.bestCombo = player.combo;
    player.enemiesDefeated++;

    const comboMult = Math.min(player.combo, 5);
    const points = ENEMY_TYPES[enemy.type].points * comboMult;
    player.score += points;

    // Spawn egg
    this.spawnEgg(enemy.type, enemy.x, enemy.y);

    this.broadcast("enemy_killed", {
      playerId: player.id,
      enemyId: enemy.id,
      type: enemy.type,
      points,
      combo: player.combo,
    });
  }

  private damagePlayer(player: InternalPlayerState) {
    player.combo = 0;
    player.vy = -200;
    this.loseLife(player);
  }

  private loseLife(player: InternalPlayerState) {
    if (player.isInvulnerable || player.isRespawning) return;

    player.lives--;
    player.combo = 0;

    if (player.lives <= 0) {
      this.broadcast("player_eliminated", { playerId: player.id });
      const remaining = [...this.internalPlayers.values()].find((p) => p.id !== player.id);
      if (remaining) {
        this.endMatch(remaining.id);
      }
    } else {
      this.broadcast("player_damaged", { playerId: player.id, lives: player.lives });
      this.startRespawn(player);
    }
  }

  private startRespawn(player: InternalPlayerState) {
    player.isRespawning = true;
    player.respawnTimer = PVP_RESPAWN_TIME;
    player.vx = 0;
    player.vy = 0;
    player.ax = 0;
    player.currentInput = "stop";
    player.x = -100;
    player.y = -100;
  }

  // ── Spawning ──────────────────────────────────────────────────────────────

  private spawnNextEnemy() {
    if (this.spawnQueue.length === 0) return;
    const type = this.spawnQueue.shift()!;

    const spawnPoint = SPAWN_POINTS[Math.floor(Math.random() * SPAWN_POINTS.length)];
    const facingRight = spawnPoint.x === 0;

    const enemy: InternalEnemyState = {
      id: this.nextEnemyId++,
      type,
      x: spawnPoint.x,
      y: spawnPoint.y,
      vx: facingRight ? ENEMY_BASE_SPEED * ENEMY_TYPES[type].speedMult : -ENEMY_BASE_SPEED * ENEMY_TYPES[type].speedMult,
      vy: 0,
      active: true,
      flipX: !facingRight,
      trackingLine: pickTrackingLine(),
      facingRight,
      nextFlapTime: randomFlapTime(),
      isSmart: false,
      aiMode: "level",
      levelFlightTimer: 0,
      flapUpTimer: 0,
      directionCopyTimer: 0,
      onPlatform: false,
    };

    this.internalEnemies.push(enemy);
  }

  private spawnEnemyAt(type: EnemyType, x: number, y: number, smart: boolean) {
    const facingRight = Math.random() > 0.5;
    const enemy: InternalEnemyState = {
      id: this.nextEnemyId++,
      type,
      x,
      y,
      vx: facingRight ? ENEMY_BASE_SPEED * ENEMY_TYPES[type].speedMult : -ENEMY_BASE_SPEED * ENEMY_TYPES[type].speedMult,
      vy: -100,
      active: true,
      flipX: !facingRight,
      trackingLine: pickTrackingLine(),
      facingRight,
      nextFlapTime: randomFlapTime(),
      isSmart: smart,
      aiMode: "level",
      levelFlightTimer: 0,
      flapUpTimer: 0,
      directionCopyTimer: 0,
      onPlatform: false,
    };
    this.internalEnemies.push(enemy);
  }

  private spawnEgg(type: EnemyType, x: number, y: number) {
    const egg: InternalEggState = {
      id: this.nextEggId++,
      type,
      x,
      y,
      vy: -80,
      active: true,
      hatchTimer: EGG_HATCH_TIME,
    };
    this.internalEggs.push(egg);
  }
}
