import type * as Party from "partykit/server";

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
const ENEMY_FLAP_FORCE = -260;
const ENEMY_TYPES = {
  BOUNDER: { speedMult: 1.0, points: 500 },
  HUNTER: { speedMult: 1.5, points: 750 },
  SHADOW_LORD: { speedMult: 2.0, points: 1000 },
};
const EGG_POINTS = { BOUNDER: 250, HUNTER: 500, SHADOW_LORD: 750 };
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
// PTERO_POINTS = 2000 — reserved for future pterodactyl feature

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

type GameEvent =
  | "joust_win"
  | "joust_bounce"
  | "enemy_killed"
  | "egg_collected"
  | "egg_hatched"
  | "player_damaged"
  | "player_eliminated"
  | "wave_complete"
  | "ptero_killed";

interface ServerPlayer {
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

interface ServerEnemy {
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
}

interface ServerEgg {
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
  entity: { x: number; y: number; vy: number; onGround?: boolean },
  halfW: number,
  halfH: number,
): void {
  if ("onGround" in entity) entity.onGround = false;
  for (const p of PLATFORMS) {
    const eLeft = entity.x - halfW;
    const eRight = entity.x + halfW;
    const eBottom = entity.y + halfH;
    // Approximate previous bottom position
    const ePrevBottom = eBottom - entity.vy * (1 / 60);

    if (eRight > p.x && eLeft < p.x + p.w) {
      if (eBottom >= p.y && ePrevBottom <= p.y + 4 && entity.vy >= 0) {
        entity.y = p.y - halfH;
        entity.vy = 0;
        if ("onGround" in entity) entity.onGround = true;
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

function getPlayerAnim(p: ServerPlayer): string {
  if (p.isRespawning) return "idle";
  if (!p.onGround) return p.vy < 0 ? "flap" : "fall";
  if (Math.abs(p.vx) > 10) return "run";
  return "idle";
}

function getEnemyAnim(e: ServerEnemy): string {
  if (!e.active) return "idle";
  if (e.vy < -30) return "flap";
  if (e.vy > 30) return "fall";
  return "idle";
}

function randomFlapTime(): number {
  return Date.now() + ENEMY_FLAP_INTERVAL_MIN + Math.random() * (ENEMY_FLAP_INTERVAL_MAX - ENEMY_FLAP_INTERVAL_MIN);
}

function pickTrackingLine(): number {
  return TRACKING_LINES[Math.floor(Math.random() * TRACKING_LINES.length)];
}

// ── Game Server ─────────────────────────────────────────────────────────────

export default class GameServer implements Party.Server {
  players = new Map<string, ServerPlayer>();
  enemies: ServerEnemy[] = [];
  eggs: ServerEgg[] = [];

  phase: Phase = "waiting";
  wave = 0;
  spawnQueue: EnemyType[] = [];
  spawnTimer = 0;
  waveTransitionTimer = 0;
  countdownTimer = 0;
  smartPromoteTimer = 0;

  tickInterval: ReturnType<typeof setInterval> | null = null;
  tickCount = 0;
  lastTickTime = 0;
  nextEnemyId = 0;
  nextEggId = 0;

  constructor(readonly room: Party.Room) {}

  // ── Connection lifecycle ────────────────────────────────────────────────

  onConnect(conn: Party.Connection) {
    const playerIndex = this.players.size;
    const spawnPoint = playerIndex === 0
      ? { x: 150, y: 440 }
      : { x: GAME_WIDTH - 150, y: 440 };

    const player: ServerPlayer = {
      id: conn.id,
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

    this.players.set(conn.id, player);

    conn.send(JSON.stringify({ type: "connected", id: conn.id }));
    this.room.broadcast(
      JSON.stringify({
        type: "player_joined",
        playerCount: this.players.size,
      }),
    );
  }

  onClose(conn: Party.Connection) {
    this.players.delete(conn.id);

    this.room.broadcast(
      JSON.stringify({
        type: "player_left",
        playerCount: this.players.size,
      }),
    );

    // If match was in progress and only one player remains, they win
    if (
      (this.phase === "playing" || this.phase === "wave_transition") &&
      this.players.size === 1
    ) {
      const winner = [...this.players.values()][0];
      this.endMatch(winner.id);
    }

    // If no players left, reset
    if (this.players.size === 0) {
      this.resetMatch();
    }
  }

  onMessage(message: string, sender: Party.Connection) {
    let msg: { type: string; action?: string };
    try {
      msg = JSON.parse(message as string);
    } catch {
      return;
    }

    const player = this.players.get(sender.id);
    if (!player) return;

    if (msg.type === "input") {
      const action = msg.action as InputAction;
      if (action === "flap") {
        // Immediate flap — not a held state
        if (!player.isRespawning) {
          player.vy = Math.max(player.vy + PLAYER_FLAP_FORCE, -PLAYER_MAX_VY);
        }
      } else if (action === "left" || action === "right" || action === "stop") {
        player.currentInput = action;
      }
    } else if (msg.type === "ready") {
      player.ready = true;
      this.checkStart();
    } else if (msg.type === "rematch") {
      this.handleRematch(sender.id);
    }
  }

  // ── Match flow ──────────────────────────────────────────────────────────

  checkStart() {
    if (this.phase !== "waiting") return;
    if (this.players.size < 2) return;

    const allReady = [...this.players.values()].every((p) => p.ready);
    if (!allReady) return;

    this.startCountdown();
  }

  startCountdown() {
    this.phase = "countdown";
    this.countdownTimer = 3000;

    this.room.broadcast(JSON.stringify({ type: "countdown", seconds: 3 }));

    // Use tick loop to handle countdown
    this.lastTickTime = Date.now();
    this.tickInterval = setInterval(() => this.tick(), 1000 / 60);
  }

  startWave() {
    this.wave++;
    if (this.wave > MATCH_WAVES) {
      // All waves complete — determine winner
      const players = [...this.players.values()];
      const winner = players.reduce((a, b) => (a.score >= b.score ? a : b));
      this.endMatch(winner.id);
      return;
    }

    this.phase = "playing";
    this.spawnQueue = generateWaveEnemies(this.wave);
    this.spawnTimer = SPAWN_DELAY;
    this.smartPromoteTimer = SMART_PROMOTE_TIME;
  }

  endMatch(winnerId: string) {
    this.phase = "finished";
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }

    const results: PlayerResult[] = [...this.players.values()].map((p) => ({
      id: p.id,
      score: p.score,
      wave: this.wave,
      bestCombo: p.bestCombo,
      enemiesDefeated: p.enemiesDefeated,
      joustWins: p.joustWins,
    }));

    this.room.broadcast(
      JSON.stringify({
        type: "match_over",
        winner: winnerId,
        players: results,
      }),
    );
  }

  resetMatch() {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
    this.phase = "waiting";
    this.wave = 0;
    this.enemies = [];
    this.eggs = [];
    this.spawnQueue = [];
    this.spawnTimer = 0;
    this.waveTransitionTimer = 0;
    this.countdownTimer = 0;
    this.tickCount = 0;
    this.nextEnemyId = 0;
    this.nextEggId = 0;

    for (const p of this.players.values()) {
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

  handleRematch(playerId: string) {
    if (this.phase !== "finished") return;
    // Mark as ready for rematch
    const player = this.players.get(playerId);
    if (player) player.ready = true;

    const allReady = [...this.players.values()].every((p) => p.ready);
    if (allReady && this.players.size >= 2) {
      this.resetMatch();
      // Re-mark everyone as ready and start
      for (const p of this.players.values()) {
        p.ready = true;
      }
      this.startCountdown();
    }
  }

  // ── Tick loop ───────────────────────────────────────────────────────────

  tick() {
    const now = Date.now();
    const rawDelta = now - this.lastTickTime;
    // Clamp delta for stability (16-33ms)
    const delta = clamp(rawDelta, 16, 33);
    const dt = delta / 1000;
    this.lastTickTime = now;

    // -- Countdown phase --
    if (this.phase === "countdown") {
      this.countdownTimer -= delta;
      if (this.countdownTimer <= 0) {
        this.startWave();
      }
      // Still broadcast state during countdown
      this.tickCount++;
      if (this.tickCount % 3 === 0) this.broadcastState();
      return;
    }

    // -- Wave transition phase --
    if (this.phase === "wave_transition") {
      this.waveTransitionTimer -= delta;
      if (this.waveTransitionTimer <= 0) {
        this.startWave();
      }
      this.tickCount++;
      if (this.tickCount % 3 === 0) this.broadcastState();
      return;
    }

    if (this.phase !== "playing") return;

    // -- Update players --
    for (const player of this.players.values()) {
      this.updatePlayer(player, dt, delta);
    }

    // -- Update enemies --
    for (const enemy of this.enemies) {
      if (!enemy.active) continue;
      this.updateEnemy(enemy, dt, now);
    }

    // -- Update eggs --
    for (const egg of this.eggs) {
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
      // Promote all dumb enemies to smart
      for (const e of this.enemies) {
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
    const activeEnemies = this.enemies.filter((e) => e.active).length;
    const activeEggs = this.eggs.filter((e) => e.active).length;
    if (
      activeEnemies === 0 &&
      activeEggs === 0 &&
      this.spawnQueue.length === 0 &&
      this.wave > 0
    ) {
      this.broadcastEvent("wave_complete", { wave: this.wave });
      this.phase = "wave_transition";
      this.waveTransitionTimer = WAVE_PAUSE;
    }

    // -- Broadcast state (every 3rd tick ≈ 20hz) --
    this.tickCount++;
    if (this.tickCount % 3 === 0) {
      this.broadcastState();
    }
  }

  // ── Player update ───────────────────────────────────────────────────────

  updatePlayer(player: ServerPlayer, dt: number, delta: number) {
    // Respawn timer
    if (player.isRespawning) {
      player.respawnTimer -= delta;
      if (player.respawnTimer <= 0) {
        player.isRespawning = false;
        player.isInvulnerable = true;
        player.invulnTimer = PLAYER_INVULN_DURATION;
        // Place at a platform spawn
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

  // ── Enemy update ────────────────────────────────────────────────────────

  updateEnemy(enemy: ServerEnemy, dt: number, now: number) {
    const speedMult = ENEMY_TYPES[enemy.type].speedMult;
    const speed = ENEMY_BASE_SPEED * speedMult;

    if (enemy.isSmart) {
      // Smart mode: pursue nearest player
      let nearest: ServerPlayer | null = null;
      let nearestDist = Infinity;
      for (const p of this.players.values()) {
        if (p.isRespawning) continue;
        const dist = Math.abs(p.x - enemy.x) + Math.abs(p.y - enemy.y);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearest = p;
        }
      }

      if (nearest) {
        // Horizontal pursuit
        if (nearest.x < enemy.x - 20) {
          enemy.vx = -speed;
          enemy.facingRight = false;
          enemy.flipX = true;
        } else if (nearest.x > enemy.x + 20) {
          enemy.vx = speed;
          enemy.facingRight = true;
          enemy.flipX = false;
        }

        // Flap up to reach player
        if (nearest.y < enemy.y - 30 && now >= enemy.nextFlapTime) {
          enemy.vy = Math.max(enemy.vy + ENEMY_FLAP_FORCE, -PLAYER_MAX_VY);
          enemy.nextFlapTime = randomFlapTime();
        }
      }
    } else {
      // Dumb mode: line tracking
      enemy.vx = enemy.facingRight ? speed : -speed;
      enemy.flipX = !enemy.facingRight;

      // Flap to reach tracking line
      if (enemy.y > enemy.trackingLine + 20 && now >= enemy.nextFlapTime) {
        enemy.vy = Math.max(enemy.vy + ENEMY_FLAP_FORCE, -PLAYER_MAX_VY);
        enemy.nextFlapTime = randomFlapTime();
      }

      // Occasionally change tracking line
      if (Math.random() < 0.002) {
        enemy.trackingLine = pickTrackingLine();
      }
    }

    // Physics
    enemy.vy += GRAVITY * dt;
    enemy.vy = clamp(enemy.vy, -PLAYER_MAX_VY, PLAYER_MAX_VY);
    enemy.x += enemy.vx * dt;
    enemy.y += enemy.vy * dt;

    // Platform collisions
    resolvePlatformCollisions(enemy, ENEMY_HALF_W, ENEMY_HALF_H);

    // Screen wrap (reverse direction for dumb enemies)
    if (enemy.x < -32) {
      enemy.x = GAME_WIDTH + 32;
      if (!enemy.isSmart) enemy.facingRight = false;
    } else if (enemy.x > GAME_WIDTH + 32) {
      enemy.x = -32;
      if (!enemy.isSmart) enemy.facingRight = true;
    }

    // Lava — deactivate
    if (enemy.y > LAVA_Y) {
      enemy.active = false;
    }
  }

  // ── Egg update ──────────────────────────────────────────────────────────

  updateEgg(egg: ServerEgg, dt: number, delta: number) {
    egg.vy += GRAVITY * dt;
    egg.y += egg.vy * dt;

    resolvePlatformCollisions(egg, EGG_HALF_W, EGG_HALF_H);

    // Hatch timer
    egg.hatchTimer -= delta;
    if (egg.hatchTimer <= 0) {
      egg.active = false;
      // Hatch into a tougher enemy
      const hatchType: EnemyType =
        egg.type === "BOUNDER"
          ? "HUNTER"
          : egg.type === "HUNTER"
            ? "SHADOW_LORD"
            : "SHADOW_LORD";
      this.spawnEnemyAt(hatchType, egg.x, egg.y, true);
      this.broadcastEvent("egg_hatched", { type: hatchType, x: egg.x, y: egg.y });
    }

    // Lava
    if (egg.y > LAVA_Y) {
      egg.active = false;
    }
  }

  // ── Collisions ──────────────────────────────────────────────────────────

  checkPlayerVsEnemy() {
    for (const player of this.players.values()) {
      if (player.isInvulnerable || player.isRespawning) continue;
      for (const enemy of this.enemies) {
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

  checkPlayerVsPlayer() {
    const playerList = [...this.players.values()];
    if (playerList.length < 2) return;
    const [p1, p2] = playerList;
    if (p1.isRespawning || p2.isRespawning) return;
    if (p1.isInvulnerable || p2.isInvulnerable) return;
    if (Math.abs(p1.x - p2.x) > 35 || Math.abs(p1.y - p2.y) > 35) return;

    const diff = p1.y - p2.y; // negative = p1 is higher

    if (Math.abs(diff) < PVP_TIE_ZONE) {
      // Bounce apart
      p1.vy = -150;
      p2.vy = -150;
      p1.vx = p1.x < p2.x ? -150 : 150;
      p2.vx = p2.x < p1.x ? -150 : 150;
      this.broadcastEvent("joust_bounce", {});
    } else if (diff < 0) {
      // p1 is higher — p1 wins
      p1.score += PVP_JOUST_POINTS;
      p1.joustWins++;
      this.startRespawn(p2);
      this.broadcastEvent("joust_win", { winner: p1.id, loser: p2.id });
    } else {
      // p2 is higher — p2 wins
      p2.score += PVP_JOUST_POINTS;
      p2.joustWins++;
      this.startRespawn(p1);
      this.broadcastEvent("joust_win", { winner: p2.id, loser: p1.id });
    }
  }

  checkPlayerVsEgg() {
    for (const player of this.players.values()) {
      if (player.isRespawning) continue;
      for (const egg of this.eggs) {
        if (!egg.active) continue;
        if (
          Math.abs(player.x - egg.x) > 25 ||
          Math.abs(player.y - egg.y) > 25
        )
          continue;

        // Collect the egg
        egg.active = false;
        player.score += EGG_POINTS[egg.type];
        player.combo++;
        if (player.combo > player.bestCombo) player.bestCombo = player.combo;
        this.broadcastEvent("egg_collected", {
          playerId: player.id,
          type: egg.type,
          points: EGG_POINTS[egg.type],
        });
      }
    }
  }

  // ── Combat helpers ──────────────────────────────────────────────────────

  defeatEnemy(player: ServerPlayer, enemy: ServerEnemy) {
    enemy.active = false;
    player.vy = PLAYER_FLAP_FORCE * 0.6; // bounce up after stomp
    player.combo++;
    if (player.combo > player.bestCombo) player.bestCombo = player.combo;
    player.enemiesDefeated++;

    const comboMult = Math.min(player.combo, 5);
    const points = ENEMY_TYPES[enemy.type].points * comboMult;
    player.score += points;

    // Spawn egg
    this.spawnEgg(enemy.type, enemy.x, enemy.y);

    this.broadcastEvent("enemy_killed", {
      playerId: player.id,
      enemyId: enemy.id,
      type: enemy.type,
      points,
      combo: player.combo,
    });
  }

  damagePlayer(player: ServerPlayer) {
    player.combo = 0;
    player.vy = -200; // knockback up
    this.loseLife(player);
  }

  loseLife(player: ServerPlayer) {
    if (player.isInvulnerable || player.isRespawning) return;

    player.lives--;
    player.combo = 0;

    if (player.lives <= 0) {
      // Eliminated
      this.broadcastEvent("player_eliminated", { playerId: player.id });
      // In 2-player, the other player wins
      const remaining = [...this.players.values()].find((p) => p.id !== player.id);
      if (remaining) {
        this.endMatch(remaining.id);
      }
    } else {
      this.broadcastEvent("player_damaged", { playerId: player.id, lives: player.lives });
      this.startRespawn(player);
    }
  }

  startRespawn(player: ServerPlayer) {
    player.isRespawning = true;
    player.respawnTimer = PVP_RESPAWN_TIME;
    player.vx = 0;
    player.vy = 0;
    player.ax = 0;
    player.currentInput = "stop";
    // Move off-screen during respawn
    player.x = -100;
    player.y = -100;
  }

  // ── Spawning ────────────────────────────────────────────────────────────

  spawnNextEnemy() {
    if (this.spawnQueue.length === 0) return;
    const type = this.spawnQueue.shift()!;

    const spawnPoint = SPAWN_POINTS[Math.floor(Math.random() * SPAWN_POINTS.length)];
    const facingRight = spawnPoint.x === 0;

    const enemy: ServerEnemy = {
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
    };

    this.enemies.push(enemy);
  }

  spawnEnemyAt(type: EnemyType, x: number, y: number, smart: boolean) {
    const facingRight = Math.random() > 0.5;
    const enemy: ServerEnemy = {
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
    };
    this.enemies.push(enemy);
  }

  spawnEgg(type: EnemyType, x: number, y: number) {
    const egg: ServerEgg = {
      id: this.nextEggId++,
      type,
      x,
      y,
      vy: -80,
      active: true,
      hatchTimer: EGG_HATCH_TIME,
    };
    this.eggs.push(egg);
  }

  // ── Broadcasting ────────────────────────────────────────────────────────

  broadcastState() {
    const state = {
      players: [...this.players.values()].map((p) => ({
        id: p.id,
        x: p.x,
        y: p.y,
        vx: p.vx,
        vy: p.vy,
        score: p.score,
        lives: p.lives,
        combo: p.combo,
        isInvulnerable: p.isInvulnerable,
        isRespawning: p.isRespawning,
        flipX: p.flipX,
        anim: getPlayerAnim(p),
      })),
      enemies: this.enemies
        .filter((e) => e.active)
        .map((e) => ({
          id: e.id,
          type: e.type,
          x: e.x,
          y: e.y,
          vx: e.vx,
          vy: e.vy,
          flipX: e.flipX,
          anim: getEnemyAnim(e),
          active: true,
        })),
      eggs: this.eggs
        .filter((e) => e.active)
        .map((e) => ({
          id: e.id,
          type: e.type,
          x: e.x,
          y: e.y,
          active: true,
        })),
      wave: this.wave,
      phase: this.phase,
      timestamp: Date.now(),
    };

    this.room.broadcast(JSON.stringify({ type: "state", state }));
  }

  broadcastEvent(name: GameEvent, data: Record<string, unknown>) {
    this.room.broadcast(JSON.stringify({ type: "event", name, data }));
  }
}
