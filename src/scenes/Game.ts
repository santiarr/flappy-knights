import { Scene } from 'phaser';
import { GAME, PLAYER, WAVE, SPAWN_POINTS, NEAR_MISS_DISTANCE, SAFE_ZONE, COLORS, ENEMY, PTERODACTYL, JOYSTICK, IS_TOUCH, PLATFORM } from '../core/Constants';
import { EventBus, Events } from '../core/EventBus';
import { GameState } from '../core/GameState';
import { Player } from '../objects/Player';
import { Enemy, EnemyType } from '../objects/Enemy';
import { Egg } from '../objects/Egg';
import { Platform } from '../objects/Platform';
import { LavaPit } from '../objects/LavaPit';
import { Pterodactyl } from '../objects/Pterodactyl';
import { LavaTroll } from '../objects/LavaTroll';
import { SpectacleManager } from '../systems/SpectacleManager';
import { PowerUp } from '../objects/PowerUp';
import { audioManager } from '../audio/AudioManager';

export class Game extends Scene {
    private player!: Player;
    private enemies: Enemy[] = [];
    private eggs: Egg[] = [];
    private platforms!: Phaser.Physics.Arcade.StaticGroup;
    private bgImage!: Phaser.GameObjects.Image;
    private lavaPit!: LavaPit;
    private pterodactyl!: Pterodactyl;
    private lavaTroll!: LavaTroll;
    private spectacle!: SpectacleManager;
    private powerUp!: PowerUp;
    private powerUpSpawnTimer = 0;
    private readonly POWER_UP_SPAWN_INTERVAL = 10000; // every 10 seconds

    private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
    private spaceKey!: Phaser.Input.Keyboard.Key;
    private muteKey!: Phaser.Input.Keyboard.Key;
    private muteIcon!: Phaser.GameObjects.Graphics;

    private hudScore!: Phaser.GameObjects.Text;
    private hudLives!: Phaser.GameObjects.Text;
    private hudWave!: Phaser.GameObjects.Text;
    private hudPowerUp!: Phaser.GameObjects.Text;
    private waveText!: Phaser.GameObjects.Text;

    private spawnQueue: EnemyType[] = [];
    private spawnTimer = 0;
    private waveTransition = false;
    private waveTransitionTimer = 0;
    private isGameOver = false;
    private isSurvivalWave = false;
    private isEggWave = false;
    private smartPromoteTimer = 0; // timer to promote dumb enemies to smart
    private isPaused = false;
    private pauseOverlay?: Phaser.GameObjects.Container;
    private pauseButton?: Phaser.GameObjects.Container;
    private escKey!: Phaser.Input.Keyboard.Key;

    // Touch state
    private touchFlap = false;

    // Floating joystick state — spawns where you first touch
    private joystickGraphics!: Phaser.GameObjects.Graphics;
    private joystickKnob!: Phaser.GameObjects.Graphics;
    private joystickActive = false;
    private joystickPointerId = -1;
    private joystickValue = 0; // -1 to 1
    private joystickOriginX = 0; // where the thumb first touched
    private joystickOriginY = 0;

    constructor() {
        super('Game');
    }

    create(): void {
        this.isGameOver = false;
        GameState.reset();

        // Background - dark cave
        this.cameras.main.setBackgroundColor(GAME.BACKGROUND_COLOR);
        this.drawCaveBackground();

        // Physics
        this.physics.world.gravity.y = GAME.GRAVITY;
        this.physics.world.setBounds(0, 0, GAME.WIDTH, GAME.HEIGHT + 100);

        // Platforms
        this.platforms = Platform.createAll(this);

        // Lava
        this.lavaPit = new LavaPit(this);

        // Pterodactyl (reused across waves)
        this.pterodactyl = new Pterodactyl(this);

        // Lava troll (active during survival waves)
        this.lavaTroll = new LavaTroll(this);

        // Player — spawn on middle platform
        this.player = new Player(this, GAME.WIDTH * 0.5, 320 - PLAYER.SIZE * 0.5);
        this.physics.add.collider(this.player, this.platforms);

        // Power-ups
        this.powerUp = new PowerUp(this);
        this.powerUpSpawnTimer = this.POWER_UP_SPAWN_INTERVAL;

        // Object pools
        this.enemies = [];
        this.eggs = [];
        this.createEnemyPool(12);
        this.createEggPool(12);

        // Collisions
        this.setupCollisions();

        // Input
        if (this.input.keyboard) {
            this.cursors = this.input.keyboard.createCursorKeys();
            this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
            this.muteKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.M);
            this.muteKey.on('down', () => this.toggleMute());
            this.escKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
            this.escKey.on('down', () => this.togglePause());
        }
        this.setupTouchInput();

        // HUD
        this.createHUD();

        // Event listeners
        this.setupEventListeners();

        // Spectacle system
        this.spectacle = new SpectacleManager(this, this.player);

        // Mute icon + pause button
        this.createMuteIcon();
        this.createPauseButton();

        // Start BGM
        audioManager.startBGM();
        EventBus.emit(Events.GAME_START);

        // Start wave 1
        this.startWave(1);
        EventBus.emit(Events.SPECTACLE_ENTRANCE);
    }

    private drawCaveBackground(): void {
        // Castle background — dimmed and scaled up for parallax room
        this.bgImage = this.add.image(GAME.WIDTH * 0.5, GAME.HEIGHT * 0.5, 'bg_castle');
        const scaleY = GAME.HEIGHT / this.bgImage.height;
        const scaleX = (GAME.WIDTH + 200) / this.bgImage.width;
        const scale = Math.max(scaleX, scaleY) * 1.15; // extra 15% for parallax room
        this.bgImage.setScale(scale);
        this.bgImage.setDepth(-10);
        this.bgImage.setAlpha(0.4); // dim it — looks farther away
    }

    private createEnemyPool(count: number): void {
        for (let i = 0; i < count; i++) {
            const enemy = new Enemy(this, -100, -100);
            this.physics.add.collider(enemy, this.platforms);
            this.enemies.push(enemy);
        }
    }

    private createEggPool(count: number): void {
        for (let i = 0; i < count; i++) {
            const egg = new Egg(this, -100, -100);
            this.physics.add.collider(egg, this.platforms);
            this.eggs.push(egg);
        }
    }

    private getInactiveEnemy(): Enemy | null {
        return this.enemies.find(e => !e.getIsActive()) ?? null;
    }

    private getInactiveEgg(): Egg | null {
        return this.eggs.find(e => !e.getIsActive()) ?? null;
    }

    private setupCollisions(): void {
        // Player vs enemies
        for (const enemy of this.enemies) {
            this.physics.add.overlap(this.player, enemy, () => {
                this.handleCombat(enemy);
            });
        }

        // Player vs eggs
        for (const egg of this.eggs) {
            this.physics.add.overlap(this.player, egg, () => {
                if (egg.getIsActive()) {
                    egg.collect();
                }
            });
        }

        // Player vs lava
        this.physics.add.overlap(this.player, this.lavaPit.getZone(), () => {
            this.handlePlayerLava();
        });

        // Enemies vs lava — destroyed, no egg drop, no points
        for (const enemy of this.enemies) {
            this.physics.add.overlap(enemy, this.lavaPit.getZone(), () => {
                if (enemy.getIsActive()) {
                    enemy.deactivate();
                    this.checkWaveComplete();
                }
            });
        }

        // Eggs vs lava — eggs that fall in lava are destroyed (lost points, no penalty)
        for (const egg of this.eggs) {
            this.physics.add.overlap(egg, this.lavaPit.getZone(), () => {
                if (egg.getIsActive()) {
                    egg.deactivate();
                    this.checkWaveComplete(); // needed for egg waves
                }
            });
        }

        // Player vs pterodactyl
        this.physics.add.overlap(this.player, this.pterodactyl, () => {
            this.handlePterodactylCombat();
        });
    }

    private handleCombat(enemy: Enemy): void {
        if (!enemy.getIsActive() || this.player.getIsInvulnerable() || this.isGameOver) return;

        const playerBottom = this.player.y + this.player.height * 0.3;
        const enemyBottom = enemy.y + enemy.height * 0.3;

        // Player higher (lower Y) wins
        if (playerBottom < enemy.y) {
            this.defeatEnemy(enemy);
        } else if (enemyBottom < this.player.y) {
            // Enemy wins
            this.playerHit();
        } else {
            // Equal height - bounce off
            const body = this.player.body as Phaser.Physics.Arcade.Body;
            const eBody = enemy.body as Phaser.Physics.Arcade.Body;
            body.setVelocityY(-150);
            body.setVelocityX(this.player.x < enemy.x ? -150 : 150);
            eBody.setVelocityY(-150);
            eBody.setVelocityX(enemy.x < this.player.x ? -150 : 150);
        }
    }

    private defeatEnemy(enemy: Enemy): void {
        const points = enemy.getPoints();
        const type = enemy.getEnemyType();

        // Drop egg
        const egg = this.getInactiveEgg();
        if (egg) {
            egg.activate(enemy.x, enemy.y, type);
        }

        enemy.deactivate();
        GameState.enemiesRemaining--;
        GameState.addScore(points);
        GameState.incrementCombo();

        EventBus.emit(Events.ENEMY_DEFEATED, { type, points });
        EventBus.emit(Events.SCORE_CHANGED, { score: GameState.score, delta: points });
        EventBus.emit(Events.SPECTACLE_HIT);

        if (GameState.combo > 1) {
            EventBus.emit(Events.SPECTACLE_COMBO, { combo: GameState.combo });
        }
        if (GameState.combo === 3 || GameState.combo === 5 || GameState.combo === 10) {
            EventBus.emit(Events.SPECTACLE_STREAK, { streak: GameState.combo });
        }

        this.updateHUD();
        this.checkWaveComplete();
    }

    private playerHit(): void {
        if (this.player.getIsInvulnerable() || this.isGameOver) return;

        GameState.lives--;
        GameState.resetCombo();
        this.player.damage();
        EventBus.emit(Events.PLAYER_DAMAGED);

        // Bounce player
        const body = this.player.body as Phaser.Physics.Arcade.Body;
        body.setVelocityY(-200);

        this.updateHUD();

        if (GameState.lives <= 0) {
            this.gameOver();
        }
    }

    private handlePlayerLava(): void {
        if (this.isGameOver || this.player.getIsInvulnerable()) return;

        GameState.lives--;
        this.updateHUD();

        if (GameState.lives <= 0) {
            this.gameOver();
        } else {
            // Respawn player above
            this.player.setPosition(GAME.WIDTH * 0.5, GAME.HEIGHT * 0.3);
            (this.player.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
            this.player.damage();
        }
    }

    private gameOver(): void {
        this.isGameOver = true;
        EventBus.emit(Events.GAME_OVER, { score: GameState.score, wave: GameState.wave });
        this.time.delayedCall(1000, () => {
            this.shutdown();
            this.scene.start('GameOver');
        });
    }

    private generateWaveEnemies(wave: number): EnemyType[] {
        const totalEnemies = Math.min(WAVE.BASE_ENEMIES + wave - 1, WAVE.MAX_ENEMIES);
        const enemies: EnemyType[] = [];

        // Progressive type distribution (inspired by original Joust)
        // Waves 1-2: mostly Bounders
        // Waves 3-5: Bounders + Hunters
        // Waves 6-8: Hunters + Shadow Lords
        // Waves 9+: mostly Shadow Lords
        for (let i = 0; i < totalEnemies; i++) {
            const roll = Math.random();
            if (wave <= 2) {
                // Early: all Bounders, maybe 1 Hunter
                enemies.push(roll < 0.85 ? 'BOUNDER' : 'HUNTER');
            } else if (wave <= 5) {
                // Mid-early: mix of Bounders and Hunters
                const hunterChance = 0.2 + (wave - 3) * 0.15;
                const shadowChance = wave >= 4 ? 0.1 : 0;
                if (roll < shadowChance) enemies.push('SHADOW_LORD');
                else if (roll < shadowChance + hunterChance) enemies.push('HUNTER');
                else enemies.push('BOUNDER');
            } else if (wave <= 9) {
                // Mid-late: Hunters dominate, Shadow Lords rising
                const shadowChance = 0.15 + (wave - 6) * 0.1;
                const bounderChance = Math.max(0.1, 0.3 - (wave - 6) * 0.1);
                if (roll < shadowChance) enemies.push('SHADOW_LORD');
                else if (roll < shadowChance + bounderChance) enemies.push('BOUNDER');
                else enemies.push('HUNTER');
            } else {
                // Late: Shadow Lords dominate
                const shadowChance = Math.min(0.6, 0.4 + (wave - 10) * 0.05);
                const hunterChance = Math.max(0.2, 0.4 - (wave - 10) * 0.05);
                if (roll < shadowChance) enemies.push('SHADOW_LORD');
                else if (roll < shadowChance + hunterChance) enemies.push('HUNTER');
                else enemies.push('BOUNDER');
            }
        }

        return enemies;
    }

    private startWave(wave: number): void {
        GameState.wave = wave;
        this.isSurvivalWave = wave % WAVE.SURVIVAL_INTERVAL === 0;
        this.isEggWave = wave > 1 && wave % WAVE.EGG_WAVE_INTERVAL === 0 && !this.isSurvivalWave;

        if (this.isEggWave) {
            // Egg bonus wave — spawn collectible eggs, no enemies
            this.spawnQueue = [];
            GameState.enemiesRemaining = 0;
            this.spawnBonusEggs();
            this.showWaveText(wave, 'EGG WAVE');
        } else {
            // Normal or survival wave
            this.spawnQueue = this.generateWaveEnemies(wave);
            Phaser.Utils.Array.Shuffle(this.spawnQueue);
            GameState.enemiesRemaining = this.spawnQueue.length;
            this.spawnTimer = 0;
            this.smartPromoteTimer = 0;

            if (this.isSurvivalWave) {
                this.showWaveText(wave, 'SURVIVAL WAVE');
                // Activate lava troll and pterodactyl
                this.lavaTroll.setActive(true);
                this.time.delayedCall(2000, () => {
                    if (!this.isGameOver && !this.pterodactyl.getIsActive()) {
                        this.pterodactyl.activate();
                    }
                });
            } else {
                this.showWaveText(wave);
                this.lavaTroll.setActive(false);
            }
        }

        // After wave 5: drop the ground platforms into the lava
        if (wave === 6) {
            this.dropGroundPlatforms();
        }

        this.updateHUD();
        EventBus.emit(Events.GAME_NEXT_WAVE, { wave });
    }

    private groundDropped = false;

    private dropGroundPlatforms(): void {
        if (this.groundDropped) return;
        this.groundDropped = true;

        this.showWaveText(GameState.wave, 'THE FLOOR CRUMBLES!');

        // Shake the screen
        this.cameras.main.shake(500, 0.015);

        // Get the first two platforms (ground level at y:480)
        const children = this.platforms.getChildren() as Phaser.Physics.Arcade.Sprite[];
        const groundPlatforms = children.filter(p => p.y >= 480);

        for (const plat of groundPlatforms) {
            // Disable physics immediately so players fall through
            (plat.body as Phaser.Physics.Arcade.StaticBody).enable = false;

            // Tween the visual down into lava and fade out
            this.tweens.add({
                targets: plat,
                y: plat.y + 80,
                alpha: 0,
                duration: 1200,
                ease: 'Power2',
                onComplete: () => {
                    plat.setVisible(false);
                },
            });
        }
    }

    private spawnBonusEggs(): void {
        const platforms = PLATFORM.POSITIONS;
        for (let i = 0; i < WAVE.EGG_WAVE_COUNT; i++) {
            const egg = this.getInactiveEgg();
            if (egg) {
                const types: EnemyType[] = ['BOUNDER', 'HUNTER', 'SHADOW_LORD'];
                // Spawn on a random platform surface
                const plat = Phaser.Utils.Array.GetRandom(platforms);
                const x = plat.x + Phaser.Math.Between(20, plat.w - 20);
                const y = plat.y - 20; // just above the platform
                egg.activate(x, y, Phaser.Utils.Array.GetRandom(types));
            }
        }
    }

    private handlePterodactylCombat(): void {
        if (!this.pterodactyl.getIsActive() || this.player.getIsInvulnerable() || this.isGameOver) return;

        // Player can only defeat pterodactyl by hitting it from directly below
        const playerTop = this.player.y - this.player.height * 0.3;
        const pteroBottom = this.pterodactyl.y + this.pterodactyl.height * 0.3;

        if (playerTop < pteroBottom && this.player.y > this.pterodactyl.y) {
            // Player hit from below — defeat pterodactyl
            this.pterodactyl.deactivate();
            GameState.addScore(PTERODACTYL.POINTS);
            EventBus.emit(Events.PTERODACTYL_DEFEATED);
            EventBus.emit(Events.SCORE_CHANGED, { score: GameState.score, delta: PTERODACTYL.POINTS });
            EventBus.emit(Events.SPECTACLE_HIT);
            this.updateHUD();
        } else {
            // Pterodactyl hits player
            this.playerHit();
        }
    }

    private checkBonusLife(): void {
        for (let i = GameState.bonusLivesAwarded; i < WAVE.BONUS_LIFE_SCORES.length; i++) {
            if (GameState.score >= WAVE.BONUS_LIFE_SCORES[i]) {
                GameState.lives++;
                GameState.bonusLivesAwarded = i + 1;
                this.updateHUD();
                // Flash the lives counter
                this.tweens.add({
                    targets: this.hudLives,
                    scaleX: 1.5,
                    scaleY: 1.5,
                    duration: 200,
                    yoyo: true,
                    ease: 'Bounce.easeOut',
                });
            }
        }
    }

    private waveSubText?: Phaser.GameObjects.Text;

    private showWaveText(wave: number, subtitle?: string): void {
        if (this.waveText) this.waveText.destroy();
        if (this.waveSubText) this.waveSubText.destroy();

        const arcadeFont = '"Courier New", Courier, monospace';

        this.waveText = this.add.text(GAME.WIDTH * 0.5, GAME.HEIGHT * 0.38, `WAVE ${wave}`, {
            fontFamily: arcadeFont,
            fontSize: '52px',
            color: '#ffd700',
            stroke: '#000000',
            strokeThickness: 8,
            fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(20);

        if (subtitle) {
            const subColor = subtitle.includes('SURVIVAL') ? '#ff4444' : '#ffdd44';
            this.waveSubText = this.add.text(GAME.WIDTH * 0.5, GAME.HEIGHT * 0.44, subtitle, {
                fontFamily: arcadeFont,
                fontSize: '24px',
                color: subColor,
                stroke: '#000000',
                strokeThickness: 5,
                fontStyle: 'bold',
                letterSpacing: 4,
            }).setOrigin(0.5).setDepth(20);

            this.tweens.add({
                targets: this.waveSubText,
                alpha: 0,
                y: GAME.HEIGHT * 0.42,
                duration: WAVE.NEXT_WAVE_DISPLAY_TIME,
                ease: 'Power2',
                onComplete: () => {
                    if (this.waveSubText) this.waveSubText.destroy();
                },
            });
        }

        this.tweens.add({
            targets: this.waveText,
            alpha: 0,
            y: GAME.HEIGHT * 0.33,
            duration: WAVE.NEXT_WAVE_DISPLAY_TIME,
            ease: 'Power2',
            onComplete: () => {
                if (this.waveText) this.waveText.destroy();
            },
        });
    }

    private checkWaveComplete(): void {
        if (this.waveTransition) return; // already transitioning

        const activeEnemies = this.enemies.filter(e => e.getIsActive()).length;
        const allEnemiesGone = activeEnemies === 0 && this.spawnQueue.length === 0;

        if (this.isEggWave) {
            const activeEggs = this.eggs.filter(e => e.getIsActive()).length;
            if (activeEggs === 0 && allEnemiesGone) {
                this.endWave();
            }
        } else {
            // Wave ends when all enemies are gone — killed, fell in lava, whatever
            if (allEnemiesGone) {
                this.endWave();
            }
        }
    }

    private endWave(): void {
        EventBus.emit(Events.GAME_WAVE_COMPLETE, { wave: GameState.wave });
        // Clean up survival wave elements
        if (this.isSurvivalWave) {
            this.lavaTroll.setActive(false);
            if (this.pterodactyl.getIsActive()) {
                this.pterodactyl.deactivate();
            }
        }
        this.waveTransition = true;
        this.waveTransitionTimer = WAVE.WAVE_PAUSE;
    }

    private spawnNextEnemy(): void {
        if (this.spawnQueue.length === 0) return;

        const type = this.spawnQueue.shift()!;
        const enemy = this.getInactiveEnemy();
        if (!enemy) return;

        const spawnPoint = Phaser.Utils.Array.GetRandom(SPAWN_POINTS);
        enemy.activate(type, spawnPoint.x, spawnPoint.y);
    }

    private createHUD(): void {
        const hudY = SAFE_ZONE.TOP + 4;
        const arcadeFont = '"Courier New", Courier, monospace';

        this.hudScore = this.add.text(10, hudY, '0', {
            fontFamily: arcadeFont,
            fontSize: '28px',
            color: '#ffd700',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 4,
        }).setDepth(100);

        this.hudLives = this.add.text(GAME.WIDTH * 0.5, hudY, `♥ ${GameState.lives}`, {
            fontFamily: arcadeFont,
            fontSize: '28px',
            color: '#ff4444',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 4,
        }).setOrigin(0.5, 0).setDepth(100);

        this.hudWave = this.add.text(GAME.WIDTH - 10, hudY, `W${GameState.wave}`, {
            fontFamily: arcadeFont,
            fontSize: '28px',
            color: '#aaaacc',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 4,
        }).setOrigin(1, 0).setDepth(100);

        this.hudPowerUp = this.add.text(GAME.WIDTH * 0.5, hudY + 30, '', {
            fontFamily: arcadeFont,
            fontSize: '16px',
            color: '#44ddff',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 3,
        }).setOrigin(0.5, 0).setDepth(100);
    }

    private updateHUD(): void {
        this.hudScore.setText(`${GameState.score}`);
        this.hudLives.setText(`♥ ${GameState.lives}`);
        this.hudWave.setText(`W${GameState.wave}`);

        const powerUp = this.player.getActivePowerUp();
        if (powerUp) {
            const labels: Record<string, string> = { speed: '⚡ SPEED', flap: '🔥 FLAP', shield: '🛡 SHIELD' };
            const colors: Record<string, string> = { speed: '#44ddff', flap: '#ffaa00', shield: '#44ff44' };
            this.hudPowerUp.setText(labels[powerUp] || '');
            this.hudPowerUp.setColor(colors[powerUp] || '#ffffff');
        } else {
            this.hudPowerUp.setText('');
        }
    }

    private setupTouchInput(): void {
        if (!IS_TOUCH) return;

        // Floating joystick — appears wherever you first touch the left half
        // Second finger tap anywhere = flap
        this.joystickGraphics = this.add.graphics().setDepth(200);
        this.joystickKnob = this.add.graphics().setDepth(201);

        // Multi-touch: support 2 simultaneous pointers
        this.input.addPointer(1);

        this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            // Left half of screen = joystick (hold + drag to move)
            // Right half or second finger = flap
            if (!this.joystickActive && pointer.x < GAME.WIDTH * 0.5) {
                // Spawn joystick at touch point
                this.joystickActive = true;
                this.joystickPointerId = pointer.id;
                this.joystickOriginX = pointer.x;
                this.joystickOriginY = pointer.y;

                // Draw ring at touch origin
                this.joystickGraphics.clear();
                this.joystickGraphics.lineStyle(3, 0xffffff, JOYSTICK.ALPHA_ACTIVE);
                this.joystickGraphics.strokeCircle(this.joystickOriginX, this.joystickOriginY, JOYSTICK.RADIUS);
                this.drawKnob(this.joystickOriginX, this.joystickOriginY, JOYSTICK.ALPHA_ACTIVE);
            } else {
                // Any other touch = flap
                this.touchFlap = true;
            }
        });

        this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
            if (pointer.id === this.joystickPointerId && this.joystickActive) {
                const dx = pointer.x - this.joystickOriginX;
                const clampedX = Phaser.Math.Clamp(dx, -JOYSTICK.RADIUS, JOYSTICK.RADIUS);
                this.joystickValue = clampedX / JOYSTICK.RADIUS;

                if (Math.abs(this.joystickValue) < JOYSTICK.DEAD_ZONE) {
                    this.joystickValue = 0;
                }

                // Update knob to follow thumb (clamped to radius)
                this.drawKnob(
                    this.joystickOriginX + clampedX,
                    this.joystickOriginY,
                    JOYSTICK.ALPHA_ACTIVE
                );
            }
        });

        this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
            if (pointer.id === this.joystickPointerId) {
                this.joystickActive = false;
                this.joystickPointerId = -1;
                this.joystickValue = 0;

                // Hide joystick completely when not touching
                this.joystickGraphics.clear();
                this.joystickKnob.clear();
            }
        });
    }

    private drawKnob(x: number, y: number, alpha: number): void {
        this.joystickKnob.clear();
        this.joystickKnob.fillStyle(0xffffff, alpha);
        this.joystickKnob.fillCircle(x, y, JOYSTICK.KNOB_RADIUS);
    }

    private setupEventListeners(): void {
        EventBus.on(Events.EGG_COLLECTED, (data: { points: number }) => {
            GameState.addScore(data.points);
            EventBus.emit(Events.SCORE_CHANGED, { score: GameState.score, delta: data.points });
            this.updateHUD();
            // Delay check slightly so all egg states settle
            this.time.delayedCall(50, () => this.checkWaveComplete());
        });

        EventBus.on(Events.EGG_HATCHED, (data: { x: number; y: number; sourceType: EnemyType }) => {
            // Hatch into tougher enemy
            const enemy = this.getInactiveEnemy();
            if (enemy) {
                const tougherType = this.getTougherType(data.sourceType);
                enemy.activate(tougherType, data.x, data.y);
                GameState.enemiesRemaining++;
                EventBus.emit(Events.ENEMY_HATCHED, { type: tougherType });
            }
            // Check if egg wave is now complete (all eggs hatched/collected)
            this.time.delayedCall(50, () => this.checkWaveComplete());
        });
    }

    private getTougherType(current: EnemyType): EnemyType {
        if (current === 'BOUNDER') return 'HUNTER';
        if (current === 'HUNTER') return 'SHADOW_LORD';
        return 'SHADOW_LORD';
    }

    private checkNearMisses(): void {
        for (const enemy of this.enemies) {
            if (!enemy.getIsActive()) continue;
            const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.x, enemy.y);
            const collisionDist = PLAYER.SIZE * 0.5 + (enemy.width * 0.5);
            if (dist > collisionDist && dist < collisionDist + NEAR_MISS_DISTANCE) {
                EventBus.emit(Events.SPECTACLE_NEAR_MISS);
            }
        }
    }

    private handleInput(delta: number): void {
        if (this.isGameOver) return;

        let moveLeft = false;
        let moveRight = false;
        let doFlap = false;

        // Keyboard
        if (this.cursors) {
            moveLeft = this.cursors.left.isDown;
            moveRight = this.cursors.right.isDown;
        }
        if (this.spaceKey && Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
            doFlap = true;
        }

        // Touch (joystick + tap-to-flap)
        if (IS_TOUCH) {
            if (this.joystickValue < -JOYSTICK.DEAD_ZONE) moveLeft = true;
            if (this.joystickValue > JOYSTICK.DEAD_ZONE) moveRight = true;
        }
        if (this.touchFlap) {
            doFlap = true;
            this.touchFlap = false; // one flap per tap
        }

        if (moveLeft) {
            this.player.moveLeft(delta);
        } else if (moveRight) {
            this.player.moveRight(delta);
        } else {
            this.player.stopHorizontal();
        }

        if (doFlap) {
            this.player.flap();
            EventBus.emit(Events.PLAYER_FLAP);
        }
    }

    update(time: number, delta: number): void {
        if (this.isGameOver || this.isPaused) return;

        // Parallax background — shift based on player position
        if (this.bgImage) {
            const offsetX = (this.player.x - GAME.WIDTH * 0.5) / GAME.WIDTH;
            const offsetY = (this.player.y - GAME.HEIGHT * 0.5) / GAME.HEIGHT;
            this.bgImage.x = GAME.WIDTH * 0.5 - offsetX * 60;
            this.bgImage.y = GAME.HEIGHT * 0.5 - offsetY * 30;
        }

        this.handleInput(delta);
        this.player.update(time, delta);

        // Update enemies with wave-scaled speed
        const waveSpeedScale = Math.min(
            1 + (GameState.wave - 1) * ENEMY.WAVE_SPEED_SCALE,
            ENEMY.MAX_SPEED_MULTIPLIER
        );
        for (const enemy of this.enemies) {
            if (enemy.getIsActive()) {
                enemy.update(time, delta, this.player.x, this.player.y, waveSpeedScale, GameState.wave);
            }
        }

        // Smart promotion: every SMART_PROMOTE_INTERVAL, promote one dumb enemy to smart
        this.smartPromoteTimer += delta;
        if (this.smartPromoteTimer >= ENEMY.SMART_PROMOTE_INTERVAL) {
            this.smartPromoteTimer = 0;
            const dumbEnemy = this.enemies.find(e => e.getIsActive() && !e.getIsSmart());
            if (dumbEnemy) {
                dumbEnemy.promoteToSmart();
            }
        }

        // Update pterodactyl
        if (this.pterodactyl.getIsActive()) {
            this.pterodactyl.update(time, delta, this.player.x, this.player.y);
        }

        // Update lava troll
        this.lavaTroll.update(time, delta);
        if (this.lavaTroll.getIsActive() && this.lavaTroll.checkGrab(this.player.x, this.player.y)) {
            this.handlePlayerLava();
        }

        // Update eggs
        for (const egg of this.eggs) {
            if (egg.getIsActive()) {
                egg.update(time, delta);
            }
        }

        // Update lava
        this.lavaPit.update(time);

        // Spawn enemies from queue
        if (this.spawnQueue.length > 0) {
            this.spawnTimer -= delta;
            if (this.spawnTimer <= 0) {
                this.spawnNextEnemy();
                this.spawnTimer = WAVE.SPAWN_DELAY;
            }
        }

        // Wave transition
        if (this.waveTransition) {
            this.waveTransitionTimer -= delta;
            if (this.waveTransitionTimer <= 0) {
                this.waveTransition = false;
                this.startWave(GameState.wave + 1);
            }
        }

        // Periodic wave completion check — catches edge cases (egg waves, lava kills)
        this.checkWaveComplete();

        // Power-up spawning
        if (!this.powerUp.getIsActive() && GameState.wave >= 2) {
            this.powerUpSpawnTimer -= delta;
            if (this.powerUpSpawnTimer <= 0) {
                this.powerUp.spawn();
                this.powerUpSpawnTimer = this.POWER_UP_SPAWN_INTERVAL;
            }
        }

        // Power-up collection
        if (this.powerUp.getIsActive() && this.powerUp.checkOverlap(this.player.x, this.player.y)) {
            const type = this.powerUp.getPowerUpType();
            this.player.applyPowerUp(type);
            this.powerUp.deactivate();

            // Show floating text
            const labels: Record<string, string> = { speed: 'SPEED BOOST!', flap: 'FLAP POWER!', shield: 'SHIELD!' };
            const colors: Record<string, string> = { speed: '#44ddff', flap: '#ffaa00', shield: '#44ff44' };
            const text = this.add.text(this.player.x, this.player.y - 50, labels[type], {
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: '22px',
                color: colors[type],
                fontStyle: 'bold',
                stroke: '#000000',
                strokeThickness: 3,
            }).setOrigin(0.5).setDepth(60);
            this.tweens.add({
                targets: text, alpha: 0, y: text.y - 40,
                duration: 800, onComplete: () => text.destroy(),
            });

            this.updateHUD();
        }

        // Update power-up
        this.powerUp.update(time, delta);

        // Bonus life check
        this.checkBonusLife();

        // Near miss detection
        this.checkNearMisses();
    }

    private createMuteIcon(): void {
        this.muteIcon = this.add.graphics();
        this.muteIcon.setDepth(100);
        this.drawMuteIcon();

        // Make interactive
        const hitArea = new Phaser.Geom.Rectangle(GAME.WIDTH - 40, SAFE_ZONE.TOP, 36, 28);
        this.muteIcon.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains);
        this.muteIcon.on('pointerdown', () => this.toggleMute());
    }

    private toggleMute(): void {
        audioManager.toggleMute();
        EventBus.emit(Events.AUDIO_TOGGLE_MUTE, { muted: GameState.isMuted });
        this.drawMuteIcon();
    }

    private drawMuteIcon(): void {
        this.muteIcon.clear();
        const x = GAME.WIDTH - 32;
        const y = SAFE_ZONE.TOP + 6;
        const color = GameState.isMuted ? 0x666666 : 0xffd700;

        // Speaker body
        this.muteIcon.fillStyle(color, 1);
        this.muteIcon.fillRect(x, y + 4, 6, 10);
        // Speaker cone
        this.muteIcon.fillTriangle(x + 6, y + 4, x + 6, y + 14, x + 14, y);
        this.muteIcon.fillTriangle(x + 6, y + 4, x + 6, y + 14, x + 14, y + 18);

        if (GameState.isMuted) {
            // X mark
            this.muteIcon.lineStyle(2, 0xff4444);
            this.muteIcon.lineBetween(x + 16, y + 3, x + 24, y + 15);
            this.muteIcon.lineBetween(x + 24, y + 3, x + 16, y + 15);
        } else {
            // Sound waves
            this.muteIcon.lineStyle(2, color);
            this.muteIcon.beginPath();
            this.muteIcon.arc(x + 14, y + 9, 6, -0.6, 0.6);
            this.muteIcon.strokePath();
            this.muteIcon.beginPath();
            this.muteIcon.arc(x + 14, y + 9, 10, -0.5, 0.5);
            this.muteIcon.strokePath();
        }
    }

    private createPauseButton(): void {
        // Pause button — top left area, visible on all devices
        const btnSize = 32;
        const bx = SAFE_ZONE.TOP + btnSize * 0.5 + 4;
        const by = SAFE_ZONE.TOP + btnSize * 0.5 + 4;

        const bg = this.add.graphics();
        bg.fillStyle(0x000000, 0.4);
        bg.fillRoundedRect(-btnSize * 0.5, -btnSize * 0.5, btnSize, btnSize, 4);
        // Two vertical bars (pause icon)
        bg.fillStyle(0xffffff, 0.8);
        bg.fillRect(-6, -8, 4, 16);
        bg.fillRect(2, -8, 4, 16);

        this.pauseButton = this.add.container(bx, by, [bg]);
        this.pauseButton.setSize(btnSize, btnSize);
        this.pauseButton.setInteractive({ useHandCursor: true }).setDepth(200);
        this.pauseButton.on('pointerdown', (p: Phaser.Input.Pointer) => {
            p.event.stopPropagation();
            this.togglePause();
        });
    }

    private togglePause(): void {
        if (this.isGameOver) return;
        if (this.isPaused) {
            this.resumeGame();
        } else {
            this.pauseGame();
        }
    }

    private pauseGame(): void {
        this.isPaused = true;
        this.physics.pause();
        this.time.paused = true;

        const cx = GAME.WIDTH * 0.5;
        const cy = GAME.HEIGHT * 0.5;
        const FONT = '"Courier New", Courier, monospace';

        // Dim overlay
        const dim = this.add.graphics().setDepth(300);
        dim.fillStyle(0x000000, 0.6);
        dim.fillRect(0, 0, GAME.WIDTH, GAME.HEIGHT);

        // PAUSED title
        const title = this.add.text(cx, cy - 60, 'PAUSED', {
            fontFamily: FONT, fontSize: '40px', color: '#ffd700',
            stroke: '#000000', strokeThickness: 6, fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(301);

        // Resume button
        const resumeBtn = this.createPauseMenuButton(cx, cy + 10, 'RESUME', 200, 44, () => this.resumeGame());

        // Main Menu button
        const menuBtn = this.createPauseMenuButton(cx, cy + 65, 'MAIN MENU', 200, 44, () => {
            this.resumeGame();
            this.shutdown();
            this.scene.start('TitleScreen');
        });

        // ESC hint (desktop only)
        let hint: Phaser.GameObjects.Text | null = null;
        if (!IS_TOUCH) {
            hint = this.add.text(cx, cy + 115, 'ESC to resume', {
                fontFamily: FONT, fontSize: '12px', color: '#666677',
            }).setOrigin(0.5).setDepth(301);
        }

        this.pauseOverlay = this.add.container(0, 0,
            [dim, title, resumeBtn, menuBtn, ...(hint ? [hint] : [])]
        ).setDepth(300);
    }

    private resumeGame(): void {
        this.isPaused = false;
        this.physics.resume();
        this.time.paused = false;
        if (this.pauseOverlay) {
            this.pauseOverlay.destroy();
            this.pauseOverlay = undefined;
        }
    }

    private createPauseMenuButton(x: number, y: number, label: string, w: number, h: number, onClick: () => void): Phaser.GameObjects.Container {
        const FONT = '"Courier New", Courier, monospace';
        const bg = this.add.graphics();
        bg.fillStyle(0x2a2a5a);
        bg.fillRoundedRect(-w * 0.5, -h * 0.5, w, h, 6);
        bg.lineStyle(2, 0x5555aa);
        bg.strokeRoundedRect(-w * 0.5, -h * 0.5, w, h, 6);

        const text = this.add.text(0, 0, label, {
            fontFamily: FONT, fontSize: '18px', color: '#ffd700', fontStyle: 'bold',
        }).setOrigin(0.5);

        const container = this.add.container(x, y, [bg, text]);
        container.setSize(w, h);
        container.setInteractive({ useHandCursor: true }).setDepth(301);

        container.on('pointerover', () => {
            bg.clear();
            bg.fillStyle(0x3a3a7a);
            bg.fillRoundedRect(-w * 0.5, -h * 0.5, w, h, 6);
            bg.lineStyle(2, 0x7777cc);
            bg.strokeRoundedRect(-w * 0.5, -h * 0.5, w, h, 6);
        });
        container.on('pointerout', () => {
            bg.clear();
            bg.fillStyle(0x2a2a5a);
            bg.fillRoundedRect(-w * 0.5, -h * 0.5, w, h, 6);
            bg.lineStyle(2, 0x5555aa);
            bg.strokeRoundedRect(-w * 0.5, -h * 0.5, w, h, 6);
        });
        container.on('pointerdown', onClick);
        return container;
    }

    shutdown(): void {
        this.isPaused = false;
        audioManager.stopBGM();
        EventBus.off(Events.EGG_COLLECTED);
        EventBus.off(Events.EGG_HATCHED);
        if (this.spectacle) this.spectacle.shutdown();
        if (this.pterodactyl) this.pterodactyl.deactivate();
        if (this.lavaTroll) this.lavaTroll.setActive(false);
        if (this.powerUp) this.powerUp.deactivate();
        if (this.joystickGraphics) this.joystickGraphics.destroy();
        if (this.joystickKnob) this.joystickKnob.destroy();
        if (this.pauseOverlay) this.pauseOverlay.destroy();
        if (this.escKey) this.escKey.removeAllListeners();
    }
}
