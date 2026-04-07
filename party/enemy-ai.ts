// ── Server-side Enemy AI Module ──────────────────────────────────────────────
// Pure TypeScript — no Phaser imports. Ports the full AI from src/objects/Enemy.ts.

export type EnemyType = 'BOUNDER' | 'HUNTER' | 'SHADOW_LORD';

export interface AIEnemy {
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
  // Smart mode state
  aiMode: 'level' | 'up' | 'down';
  levelFlightTimer: number;
  flapUpTimer: number;
  directionCopyTimer: number;
  onPlatform: boolean;
}

export interface AIPlayer {
  x: number;
  y: number;
  isRespawning: boolean;
}

// ── Constants (ported from Constants.ts) ─────────────────────────────────────

const GAME_WIDTH = 1170;
const ENEMY_BASE_SPEED = 100;
const ENEMY_FLAP_FORCE = -260;
const TRACK_LINES = [100, 250, 380];
const TRACK_THRESHOLD = 60;
const LAVA_DANGER_Y = 540 - 160; // GAME_HEIGHT - 160
const LAVA_LURE_RANGE = 120;
const SLOW_WAVE_THRESHOLD = 2;

const ENEMY_SPEED_MULT: Record<EnemyType, number> = {
  BOUNDER: 1.0,
  HUNTER: 1.5,
  SHADOW_LORD: 2.0,
};

// Platform rects for cliff detection
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

const PLATFORM_RECTS = PLATFORMS.map(p => ({
  left: p.x,
  right: p.x + p.w,
  top: p.y,
  bottom: p.y + p.h,
}));

// Dynamic difficulty params (start → end over N waves)
interface DynParam { start: number; end: number; waves: number; }

const DYN = {
  BOUNDER_LEVEL_TIME:   { start: 1600, end: 200,  waves: 20 } as DynParam,
  BOUNDER_FLAP_UP_TIME: { start: 500,  end: 150,  waves: 20 } as DynParam,
  BOUNDER_DOWN_RANGE:   { start: 120,  end: 50,   waves: 20 } as DynParam,

  HUNTER_LEVEL_TIME:    { start: 1400, end: 150,  waves: 20 } as DynParam,
  HUNTER_FLAP_UP_TIME:  { start: 400,  end: 100,  waves: 20 } as DynParam,
  HUNTER_MAX_VY:        { start: 300,  end: 500,  waves: 20 } as DynParam,
  HUNTER_CLIFF_LOOK_AHEAD: 80,

  SHADOW_LEVEL_TIME:    { start: 1200, end: 100,  waves: 20 } as DynParam,
  SHADOW_FLAP_UP_TIME:  { start: 300,  end: 80,   waves: 20 } as DynParam,
  SHADOW_MAX_VY:        { start: 400,  end: 600,  waves: 20 } as DynParam,
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function dynParam(param: DynParam, wave: number): number {
  const t = Math.min(wave / param.waves, 1);
  return param.start + (param.end - param.start) * t;
}

function checkCliffAt(x: number, y: number): boolean {
  for (const p of PLATFORM_RECTS) {
    if (x > p.left - 20 && x < p.right + 20 && y > p.top - 15 && y < p.bottom + 15) {
      return true;
    }
  }
  return false;
}

function randomFromArray<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Create a freshly-initialized AIEnemy (call when spawning). */
export function createAIEnemy(
  id: number,
  type: EnemyType,
  x: number,
  y: number,
  facingRight: boolean,
  isSmart: boolean,
): AIEnemy {
  const speed = ENEMY_BASE_SPEED * ENEMY_SPEED_MULT[type];
  return {
    id,
    type,
    x,
    y,
    vx: facingRight ? speed : -speed,
    vy: 0,
    active: true,
    flipX: !facingRight,
    trackingLine: randomFromArray(TRACK_LINES),
    facingRight,
    nextFlapTime: 0,
    isSmart,
    aiMode: 'level',
    levelFlightTimer: 0,
    flapUpTimer: 0,
    directionCopyTimer: 0,
    onPlatform: false,
  };
}

// ── Main AI Update ───────────────────────────────────────────────────────────

/**
 * Update a single enemy's AI state. Mutates the enemy in-place.
 *
 * This does NOT apply physics (gravity, position integration, platform collisions).
 * It sets vx/vy/flipX/facingRight and the AI state machines.
 * The caller (server tick) handles physics after this returns.
 *
 * @param enemy      The enemy to update
 * @param players    All active players (for smart-mode targeting)
 * @param time       Current timestamp (ms) — used for flap cooldowns
 * @param delta      Time since last tick (ms)
 * @param waveSpeedScale  Per-wave speed multiplier (1.0 + wave * 0.05, capped)
 * @param currentWave     Current wave number
 */
export function updateEnemyAI(
  enemy: AIEnemy,
  players: AIPlayer[],
  time: number,
  delta: number,
  waveSpeedScale: number,
  currentWave: number,
): void {
  if (!enemy.active) return;

  const baseSpeed = ENEMY_BASE_SPEED * ENEMY_SPEED_MULT[enemy.type];
  const scaledSpeed = baseSpeed * waveSpeedScale;

  // Find nearest non-respawning player (used by smart modes)
  let nearestPlayer: AIPlayer | null = null;
  let nearestDist = Infinity;
  for (const p of players) {
    if (p.isRespawning) continue;
    const dist = Math.abs(p.x - enemy.x) + Math.abs(p.y - enemy.y);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearestPlayer = p;
    }
  }

  // --- Lava panic / lure check ---
  if (enemy.y > LAVA_DANGER_Y) {
    if (nearestPlayer) {
      const horizontalDistToPlayer = Math.abs(enemy.x - nearestPlayer.x);
      if (horizontalDistToPlayer >= LAVA_LURE_RANGE) {
        // Panic flap upward
        enemy.vy = ENEMY_FLAP_FORCE * 1.3;
        return;
      }
      // else: player is close — let ourselves be lured, keep pursuing
    } else {
      // No player to lure us — panic
      enemy.vy = ENEMY_FLAP_FORCE * 1.3;
      return;
    }
  }

  // --- Choose AI tier ---
  if (!enemy.isSmart) {
    updateLineTracking(enemy, time, delta, scaledSpeed);
  } else if (nearestPlayer) {
    switch (enemy.type) {
      case 'BOUNDER':
        updateBounderSmart(enemy, nearestPlayer, time, delta, scaledSpeed, currentWave);
        break;
      case 'HUNTER':
        updateHunterSmart(enemy, nearestPlayer, time, delta, scaledSpeed, currentWave);
        break;
      case 'SHADOW_LORD':
        updateShadowLordSmart(enemy, nearestPlayer, time, delta, scaledSpeed, currentWave);
        break;
    }
  } else {
    // Smart but no players alive — fall back to line tracking
    updateLineTracking(enemy, time, delta, scaledSpeed);
  }
}

// ── Dumb Mode: Line Tracking ─────────────────────────────────────────────────

function updateLineTracking(
  enemy: AIEnemy,
  time: number,
  _delta: number,
  scaledSpeed: number,
): void {
  // Horizontal: fly in facing direction
  enemy.vx = enemy.facingRight ? scaledSpeed : -scaledSpeed;
  enemy.flipX = !enemy.facingRight;

  // Vertical: flap toward tracking line
  if (enemy.y > enemy.trackingLine + TRACK_THRESHOLD) {
    if (time > enemy.nextFlapTime) {
      enemy.vy = ENEMY_FLAP_FORCE;
      enemy.nextFlapTime = time + 300 + Math.random() * 300;
    }
  }

  // Occasionally switch tracking line
  if (Math.random() < 0.001) {
    enemy.trackingLine = randomFromArray(TRACK_LINES);
  }

  // Reverse at screen edges
  if ((enemy.x < 30 && !enemy.facingRight) || (enemy.x > GAME_WIDTH - 30 && enemy.facingRight)) {
    enemy.facingRight = !enemy.facingRight;
  }
}

// ── Bounder Smart AI ─────────────────────────────────────────────────────────

function updateBounderSmart(
  enemy: AIEnemy,
  player: AIPlayer,
  time: number,
  delta: number,
  scaledSpeed: number,
  wave: number,
): void {
  const levelTime = dynParam(DYN.BOUNDER_LEVEL_TIME, wave);
  const flapUpTime = dynParam(DYN.BOUNDER_FLAP_UP_TIME, wave);
  const downRange = dynParam(DYN.BOUNDER_DOWN_RANGE, wave);

  const dy = player.y - enemy.y;

  switch (enemy.aiMode) {
    case 'level': {
      enemy.levelFlightTimer += delta;

      // Copy player's horizontal direction
      const playerIsRight = player.x > enemy.x;
      enemy.vx = playerIsRight ? scaledSpeed : -scaledSpeed;
      enemy.flipX = !playerIsRight;
      enemy.directionCopyTimer += delta;

      // If copying direction too long (>3s), reverse
      if (enemy.directionCopyTimer > 3000) {
        enemy.vx = playerIsRight ? -scaledSpeed : scaledSpeed;
        enemy.flipX = playerIsRight;
        enemy.directionCopyTimer = 0;
      }

      // Decision: switch to up or down based on player altitude
      if (enemy.levelFlightTimer > levelTime) {
        if (dy > downRange) {
          enemy.aiMode = 'down';
        } else if (dy < -30) {
          enemy.aiMode = 'up';
          enemy.flapUpTimer = 0;
        }
        enemy.levelFlightTimer = 0;
      }
      break;
    }

    case 'up':
      // Flap upward toward player
      if (time > enemy.nextFlapTime) {
        enemy.vy = ENEMY_FLAP_FORCE;
        enemy.nextFlapTime = time + 200;
      }
      // Track player horizontally
      enemy.vx = player.x > enemy.x ? scaledSpeed : -scaledSpeed;
      enemy.flipX = player.x < enemy.x;

      enemy.flapUpTimer += delta;
      if (enemy.flapUpTimer > flapUpTime || enemy.y < player.y - 20) {
        enemy.aiMode = 'level';
        enemy.levelFlightTimer = 0;
        enemy.directionCopyTimer = 0;
      }
      break;

    case 'down':
      // Let gravity pull down (don't set vy, just track horizontally slower)
      enemy.vx = (player.x > enemy.x ? scaledSpeed : -scaledSpeed) * 0.67;
      enemy.flipX = player.x < enemy.x;

      // Return to level when at player's altitude or on a platform
      if (enemy.y > player.y - 10 || enemy.onPlatform) {
        enemy.aiMode = 'level';
        enemy.levelFlightTimer = 0;
        enemy.directionCopyTimer = 0;
      }
      break;
  }

  // Clamp horizontal speed
  if (Math.abs(enemy.vx) > scaledSpeed) {
    enemy.vx = Math.sign(enemy.vx) * scaledSpeed;
  }
}

// ── Hunter Smart AI ──────────────────────────────────────────────────────────

function updateHunterSmart(
  enemy: AIEnemy,
  player: AIPlayer,
  time: number,
  delta: number,
  scaledSpeed: number,
  wave: number,
): void {
  const levelTime = dynParam(DYN.HUNTER_LEVEL_TIME, wave);
  const flapUpTime = dynParam(DYN.HUNTER_FLAP_UP_TIME, wave);
  const maxVY = dynParam(DYN.HUNTER_MAX_VY, wave);

  const dy = player.y - enemy.y;

  // Cliff prediction: look ahead and reverse if platform detected
  const lookAhead = DYN.HUNTER_CLIFF_LOOK_AHEAD;
  const futureX = enemy.x + Math.sign(enemy.vx) * lookAhead;
  const futureY = enemy.y + enemy.vy * 0.15;
  if (checkCliffAt(futureX, futureY)) {
    enemy.vx = -enemy.vx * 0.5;
  }

  switch (enemy.aiMode) {
    case 'level': {
      enemy.levelFlightTimer += delta;

      // Pursue player directly (more aggressive than Bounder)
      enemy.vx = player.x > enemy.x ? scaledSpeed * 1.2 : -scaledSpeed * 1.2;
      enemy.flipX = player.x < enemy.x;

      if (enemy.levelFlightTimer > levelTime) {
        if (dy > 60) {
          enemy.aiMode = 'down';
        } else if (dy < -30) {
          enemy.aiMode = 'up';
          enemy.flapUpTimer = 0;
        }
        enemy.levelFlightTimer = 0;
      }
      break;
    }

    case 'up':
      if (time > enemy.nextFlapTime) {
        enemy.vy = ENEMY_FLAP_FORCE;
        enemy.nextFlapTime = time + 150; // faster flap cadence than Bounder
      }
      enemy.vx = player.x > enemy.x ? scaledSpeed * 1.2 : -scaledSpeed * 1.2;
      enemy.flipX = player.x < enemy.x;

      enemy.flapUpTimer += delta;
      if (enemy.flapUpTimer > flapUpTime || enemy.y < player.y - 30) {
        enemy.aiMode = 'level';
        enemy.levelFlightTimer = 0;
      }
      break;

    case 'down':
      // Fall toward player, slight horizontal tracking
      enemy.vx = player.x > enemy.x ? scaledSpeed : -scaledSpeed;
      enemy.flipX = player.x < enemy.x;

      if (enemy.y > player.y - 10 || enemy.onPlatform) {
        enemy.aiMode = 'level';
        enemy.levelFlightTimer = 0;
      }
      break;
  }

  // Clamp speeds — Hunter is faster
  const maxHSpeed = scaledSpeed * 1.2;
  if (Math.abs(enemy.vx) > maxHSpeed) {
    enemy.vx = Math.sign(enemy.vx) * maxHSpeed;
  }
  // Clamp vertical to dynamic max
  if (Math.abs(enemy.vy) > maxVY) {
    enemy.vy = Math.sign(enemy.vy) * maxVY;
  }
}

// ── Shadow Lord Smart AI ─────────────────────────────────────────────────────

function updateShadowLordSmart(
  enemy: AIEnemy,
  player: AIPlayer,
  time: number,
  delta: number,
  scaledSpeed: number,
  wave: number,
): void {
  const levelTime = dynParam(DYN.SHADOW_LEVEL_TIME, wave);
  const flapUpTime = dynParam(DYN.SHADOW_FLAP_UP_TIME, wave);
  const maxVY = dynParam(DYN.SHADOW_MAX_VY, wave);

  const dy = player.y - enemy.y;

  // Cliff-climbing: if on a platform with a cliff above, flap over it
  if (enemy.onPlatform && checkCliffAt(enemy.x, enemy.y - 60)) {
    enemy.vy = ENEMY_FLAP_FORCE * 1.2;
  }

  // Cliff avoidance similar to Hunter
  const futureX = enemy.x + Math.sign(enemy.vx) * 60;
  const futureY = enemy.y + enemy.vy * 0.12;
  if (checkCliffAt(futureX, futureY)) {
    enemy.vx = -enemy.vx * 0.6;
  }

  switch (enemy.aiMode) {
    case 'level': {
      enemy.levelFlightTimer += delta;

      // Track player's exact Y — try to match altitude precisely
      if (Math.abs(dy) > 20) {
        if (dy < 0) {
          // Player is above — flap up aggressively
          enemy.aiMode = 'up';
          enemy.flapUpTimer = 0;
        } else {
          // Player is below — free-fall
          enemy.aiMode = 'down';
        }
        enemy.levelFlightTimer = 0;
      } else if (enemy.levelFlightTimer > levelTime) {
        enemy.levelFlightTimer = 0;
      }

      // Aggressive horizontal pursuit with prediction
      const predictedX = player.x + (player.x - enemy.x) * 0.3;
      enemy.vx = predictedX > enemy.x ? scaledSpeed * 1.5 : -scaledSpeed * 1.5;
      enemy.flipX = predictedX < enemy.x;
      break;
    }

    case 'up':
      // Aggressive flap upward
      if (time > enemy.nextFlapTime) {
        enemy.vy = ENEMY_FLAP_FORCE * 1.1;
        enemy.nextFlapTime = time + 120; // very fast flap cadence
      }
      // Track player horizontally with prediction
      {
        const predX = player.x + (player.x - enemy.x) * 0.25;
        enemy.vx = predX > enemy.x ? scaledSpeed * 1.5 : -scaledSpeed * 1.5;
        enemy.flipX = predX < enemy.x;
      }

      enemy.flapUpTimer += delta;
      if (enemy.flapUpTimer > flapUpTime || enemy.y < player.y - 10) {
        enemy.aiMode = 'level';
        enemy.levelFlightTimer = 0;
      }
      break;

    case 'down':
      // FREE-FALL: do NOT flap (original Shadow Lord behavior)
      enemy.vx = player.x > enemy.x ? scaledSpeed * 1.2 : -scaledSpeed * 1.2;
      enemy.flipX = player.x < enemy.x;

      if (enemy.y > player.y - 5 || enemy.onPlatform) {
        enemy.aiMode = 'level';
        enemy.levelFlightTimer = 0;
      }
      break;
  }

  // Shadow Lords can move faster
  const maxHSpeed = scaledSpeed * 1.5;
  if (Math.abs(enemy.vx) > maxHSpeed) {
    enemy.vx = Math.sign(enemy.vx) * maxHSpeed;
  }
  if (Math.abs(enemy.vy) > maxVY) {
    enemy.vy = Math.sign(enemy.vy) * maxVY;
  }
}
