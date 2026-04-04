export const GAME = {
    WIDTH: 540,
    HEIGHT: 960,
    GRAVITY: 600,
    BACKGROUND_COLOR: 0x1a0a2e,
    BACKGROUND_COLOR_STR: '#1a0a2e',
};

export const SAFE_ZONE = {
    TOP: Math.round(GAME.HEIGHT * 0.08),
};

export const PLAYER = {
    FLAP_FORCE: -300,
    MAX_VELOCITY_Y: 400,
    SPEED: 200,
    ACCELERATION: 600,   // horizontal acceleration (not instant)
    DRAG: 200,           // horizontal drag when no input (slide/drift)
    AIR_DRAG: 80,        // less drag in the air — momentum carries
    SIZE: 72, // 24px grid * scale 3
    INVULNERABLE_DURATION: 1500,
    START_LIVES: 3,
};

export const ENEMY = {
    BASE_SPEED: 100,
    TYPES: {
        BOUNDER: { name: 'Bounder', speedMultiplier: 1.0, color: 0xcc3333, points: 500 },
        HUNTER: { name: 'Hunter', speedMultiplier: 1.5, color: 0x888888, points: 750 },
        SHADOW_LORD: { name: 'Shadow Lord', speedMultiplier: 2.0, color: 0x3355cc, points: 1000 },
    },
    SIZE: 72,
    FLAP_FORCE: -260,
    // Per-wave speed scaling
    WAVE_SPEED_SCALE: 0.05,
    MAX_SPEED_MULTIPLIER: 2.0,
    // Two-tier intelligence system (from original Joust)
    // Enemies start "dumb" (line tracking) and graduate to "smart" over time
    SMART_PROMOTE_INTERVAL: 15000, // ms between promoting one enemy from dumb→smart (original: ~15s)
    // Three horizontal tracking lines for dumb mode (Y positions, scaled to our 960px height)
    TRACK_LINES: [160, 400, 700],
    TRACK_THRESHOLD: 60, // Y distance to trigger flap toward tracking line
    // Lava lure: enemies can be baited into lava if player is this close horizontally
    LAVA_LURE_RANGE: 120,
    LAVA_DANGER_Y: GAME.HEIGHT - 160, // below this, enemies panic-flap (unless lured)
    // Dynamic difficulty parameters (start → end over waves)
    // Format: [startValue, endValue, wavesToReach]
    DYN: {
        // Bounder: level flight time (ms) between flap decisions
        BOUNDER_LEVEL_TIME: { start: 1600, end: 200, waves: 20 },
        BOUNDER_FLAP_UP_TIME: { start: 500, end: 150, waves: 20 },
        BOUNDER_DOWN_RANGE: { start: 120, end: 50, waves: 20 },
        // Hunter: same + cliff prediction
        HUNTER_LEVEL_TIME: { start: 1400, end: 150, waves: 20 },
        HUNTER_FLAP_UP_TIME: { start: 400, end: 100, waves: 20 },
        HUNTER_MAX_VY: { start: 300, end: 500, waves: 20 },
        HUNTER_CLIFF_LOOK_AHEAD: 80, // pixels ahead to check for platforms
        // Shadow Lord: tracks player exact Y, free-falls when diving
        SHADOW_LEVEL_TIME: { start: 1200, end: 100, waves: 20 },
        SHADOW_FLAP_UP_TIME: { start: 300, end: 80, waves: 20 },
        SHADOW_MAX_VY: { start: 400, end: 600, waves: 20 },
    },
    // First 2 waves: enemies move every other tick (slower)
    SLOW_WAVE_THRESHOLD: 2,
};

export const EGG = {
    HATCH_TIME: 5000,
    POINTS: { BOUNDER: 250, HUNTER: 500, SHADOW_LORD: 750 },
    SIZE: 36, // 12px grid * scale 3
};

export const PLATFORM = {
    COLOR: 0x8b6914,
    POSITIONS: [
        // Ground level with gaps
        { x: 0, y: 880, w: 180, h: 16 },
        { x: 360, y: 880, w: 180, h: 16 },
        // Middle platforms
        { x: 80, y: 700, w: 160, h: 12 },
        { x: 300, y: 620, w: 160, h: 12 },
        // Upper-middle platforms
        { x: 40, y: 480, w: 140, h: 12 },
        { x: 360, y: 480, w: 140, h: 12 },
        // Top platforms
        { x: 180, y: 340, w: 180, h: 12 },
        { x: 60, y: 220, w: 120, h: 12 },
        { x: 360, y: 220, w: 120, h: 12 },
    ],
};

export const LAVA = {
    HEIGHT: 60,
    COLOR: 0xff4400,
    WAVE_AMPLITUDE: 4,
    WAVE_SPEED: 0.003,
    Y: GAME.HEIGHT - 60,
};

export const WAVE = {
    // Infinite wave generation formula (inspired by original Joust)
    // Total enemies = min(3 + wave, MAX_ENEMIES)
    MAX_ENEMIES: 8,
    BASE_ENEMIES: 3,
    // Bounder→Hunter transition: Hunters start appearing at wave 2, replace Bounders by wave 6
    // Hunter→Shadow Lord transition: Shadow Lords start at wave 4, dominate by wave 10
    // Every 5th wave is a Survival Wave (lava troll active, pterodactyl appears)
    // Every 4th wave (offset) is an Egg Wave (bonus eggs, no new enemies)
    SURVIVAL_INTERVAL: 5,
    EGG_WAVE_INTERVAL: 4,  // waves 4, 8, 12... are egg bonus waves (after enemies cleared)
    SPAWN_DELAY: 800,
    WAVE_PAUSE: 2000,
    NEXT_WAVE_DISPLAY_TIME: 1500,
    BONUS_LIFE_SCORES: [20000, 50000, 100000], // extra life at these score thresholds
    EGG_WAVE_COUNT: 6, // eggs that spawn in egg bonus wave
};

export const PTERODACTYL = {
    SPEED: 220,
    SIZE: 80,
    FLAP_FORCE: -300,
    FLAP_INTERVAL: 500,
    POINTS: 2000,
    // Appears in survival waves, invulnerable except from directly below
    DURATION: 15000, // leaves after 15 seconds
};

export const LAVA_TROLL = {
    GRAB_RANGE: 80, // how close to lava before hand appears
    GRAB_SPEED: 3,
    HAND_WIDTH: 30,
    HAND_HEIGHT: 50,
};

export const SPAWN_POINTS = [
    { x: 0, y: 100 },
    { x: GAME.WIDTH, y: 100 },
    { x: 0, y: 300 },
    { x: GAME.WIDTH, y: 300 },
];

export const NEAR_MISS_DISTANCE = PLAYER.SIZE * 0.2;

export const SPECTACLE = {
    // Particles
    PARTICLE_BURST_COUNT: 15,
    PARTICLE_LIFETIME: 600,
    PARTICLE_SPEED: 150,
    // Screen shake
    SHAKE_LIGHT: 0.008,
    SHAKE_MEDIUM: 0.012,
    SHAKE_HEAVY: 0.02,
    SHAKE_DURATION: 150,
    // Floating text
    FLOAT_TEXT_SIZE: 28,
    FLOAT_TEXT_SCALE: 1.8,
    // Combo
    COMBO_BASE_SIZE: 32,
    COMBO_SIZE_PER: 4,
    // Hit freeze
    HIT_FREEZE_MS: 50,
};

export const COLORS = {
    PLAYER_BODY: 0xdaa520,
    PLAYER_RIDER: 0xffd700,
    PLATFORM: 0x8b6914,
    PLATFORM_EDGE: 0x6b4f12,
    LAVA_BRIGHT: 0xff6600,
    LAVA_DARK: 0xcc3300,
    EGG: 0xffffff,
    TEXT: '#ffffff',
    TEXT_STROKE: '#000000',
    HUD_BG: 0x000000,
};
