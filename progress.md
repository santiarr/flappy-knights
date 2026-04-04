# Progress

## Game Concept
- **Name**: joust-clone
- **Engine**: Phaser 3 (TypeScript)
- **Description**: Classic 1982 Joust arcade game — fly an ostrich, defeat enemy knights by being higher in collisions, collect eggs, survive waves.

## Step 1: Scaffold
- **Entities**: Player (ostrich rider), Enemy (3 types: Bounder/Hunter/Shadow Lord), Egg, Platform, LavaPit
- **Events**: player:flap, player:died, player:damaged, enemy:defeated, enemy:hatched, egg:collected, egg:hatched, score:changed, game:start, game:over, game:restart, game:wave_complete, game:next_wave, spectacle:entrance/action/hit/combo/streak/near_miss
- **Constants keys**: GAME, SAFE_ZONE, PLAYER, ENEMY, EGG, PLATFORM, LAVA, WAVE, SPAWN_POINTS, NEAR_MISS_DISTANCE, COLORS
- **Scoring system**: Defeat enemies for 500/750/1000 points (Bounder/Hunter/Shadow Lord), collect eggs for 250/500/750 bonus points
- **Fail condition**: Lose all 3 lives (enemy collision from below, lava contact)
- **Input scheme**: Arrow keys + Space (keyboard), tap thirds of screen (touch)

## Step 1.5: Assets
- **Palette**: 27-color palette (index 0 = transparent) in `src/sprites/palette.ts` covering outline, body colors, rider colors, highlights, cave tones
- **Player sprite**: 24x24 grid, 2 frames (wings down / wings up), scale 3 = 72x72 rendered (`src/sprites/player.ts`)
- **Enemy sprites**: 24x24 grid, 2 frames each for Bounder (red/3,15), Hunter (gray/6,16), Shadow Lord (blue/7,17), scale 3 = 72x72 (`src/sprites/enemies.ts`)
- **Egg sprite**: 12x14 grid, single frame, white with spots, scale 3 = 36x42 (`src/sprites/items.ts`)
- **Platform tile**: 16x8 grid, stone look, tiled horizontally, scale 3 = 48x24 (`src/sprites/tiles.ts`)
- **Cave wall tiles**: 16x16 grid, 3 variants, scale 3 = 48x48, tiled as background at depth -10 (`src/sprites/tiles.ts`)
- **PixelRenderer**: `src/core/PixelRenderer.ts` — `renderPixelArt()` and `renderSpriteSheet()` functions
- **Dimension changes**: PLAYER.SIZE = 72, ENEMY.SIZE = 72, EGG.SIZE = 36 (previously proportional to GAME.WIDTH)
- **Removed**: `Player.generateTexture()`, `Enemy.generateTextures()`, `Egg.generateTexture()` static methods
- **Animations**: player_flap, enemy_bounder_flap, enemy_hunter_flap, enemy_shadow_lord_flap registered in Preloader

## Step 2: Design
- **SpectacleManager** (`src/systems/SpectacleManager.ts`): Centralized VFX system listening to EventBus spectacle events
- **SPECTACLE constants** added to `Constants.ts`: particle counts, shake intensities, text sizes, hit freeze timing
- **Particle texture**: Generated 8x8 white circle in Preloader for all particle effects
- **Effects implemented**:
  - SPECTACLE_ENTRANCE: cave flash, player bounce-in from below, ambient cave dust particles
  - SPECTACLE_ACTION (flap): feather burst below player, subtle camera nudge
  - SPECTACLE_HIT (enemy defeated): 15-particle burst, screen shake, white flash overlay, physics hit-freeze (50ms)
  - SPECTACLE_COMBO: floating "Nx COMBO!" text with elastic scale animation, shake scales with combo count
  - SPECTACLE_STREAK: full-screen "Nx STREAK!" slam-in, 30-particle burst, heavy shake, additive flash overlay
  - SPECTACLE_NEAR_MISS: red screen border flash, "CLOSE!" floating text
  - SCORE_CHANGED: gold sparkle particles at player position
  - PLAYER_DAMAGED: heavy shake, red flash overlay, camera zoom punch (1.05x snap back)
  - GAME_NEXT_WAVE: dramatic camera zoom (0.98 to 1.0), red border pulse on survival waves
- **GameOver polish**: particle rain, score count-up animation, camera fade-in, pulsing GAME OVER text
- **LavaPit improvements**: emissive orange glow gradient above surface, 8 dynamic bubbles with pop effects, random lava splash particles shooting upward
- All VFX use `setDepth()` (effects at 55-60, overlays at 90, below UI at 100)
- All listeners cleaned up in `shutdown()` methods

## Step 3: Audio
- **AudioManager** (`src/audio/AudioManager.ts`): Singleton managing Web Audio API AudioContext, master gain node, BGM step sequencer, mute toggle. Initializes on first user interaction (pointerdown/keydown).
- **Music patterns** (`src/audio/music.ts`): Chiptune medieval/cave theme in Am at ~130 BPM using square+triangle waves. Includes main gameplay loop, game-over jingle (descending minor), and wave-complete fanfare (ascending).
- **SFX** (`src/audio/sfx.ts`): 12 procedural sound effects using OscillatorNode+GainNode — sfxFlap (rising chirp 50ms), sfxHit (noise+thud 80ms), sfxEnemyDefeat (falling pitch 150ms), sfxEggCollect (two-note ding 120ms), sfxEggHatch (crack+rumble 200ms), sfxPlayerDamage (harsh buzz 300ms), sfxPterodactylScreech (sawtooth sweep 400ms), sfxLavaPlop (sine+vibrato 150ms), sfxWaveComplete (ascending arpeggio), sfxGameOver (descending sequence), sfxCombo (pitch-scaled arpeggio), sfxBonusLife (triumphant 1-up).
- **AudioBridge** (`src/audio/AudioBridge.ts`): Wires EventBus events to audio functions — PLAYER_FLAP, ENEMY_DEFEATED, PLAYER_DAMAGED, EGG_COLLECTED, EGG_HATCHED, PTERODACTYL_SPAWN, GAME_OVER (stops BGM + plays jingle), GAME_WAVE_COMPLETE, GAME_START/RESTART (starts BGM), SPECTACLE_COMBO (combo-count-scaled arpeggio).
- **Mute toggle**: `AUDIO_TOGGLE_MUTE` event added to EventBus. M key shortcut and clickable speaker icon (top-right, drawn with Graphics) in Game scene. Persists via `GameState.isMuted`.
- **Integration**: `initAudioBridge()` called in `main.ts` on DOMContentLoaded. AudioContext initialized on first user interaction. BGM starts on Game scene create, stops on game over / scene shutdown. Restarts on GAME_RESTART from GameOver scene.
- **Zero dependencies**: All audio uses Web Audio API only — no Phaser.Sound, no audio files, no npm packages.

## Decisions / Known Issues
- Portrait mode (540x960) for mobile-first design
- No title screen — boots directly into Wave 1
- HUD positioned below safe zone (score, lives, wave)
- Object pooling for enemies (12) and eggs (12)
- Screen wrapping enabled horizontally
