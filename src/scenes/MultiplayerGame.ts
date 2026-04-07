import { Scene } from 'phaser';
import { GAME, SAFE_ZONE, IS_TOUCH, JOYSTICK } from '../core/Constants';
import { connection } from '../multiplayer/connection';
import { Platform } from '../objects/Platform';
import { LavaPit } from '../objects/LavaPit';
import { capture } from '../analytics';
import { audioManager } from '../audio/AudioManager';

const ARCADE_FONT = '"Courier New", Courier, monospace';
const ATLAS_PREFIX: Record<string, string> = {
    BOUNDER: 'bounder',
    HUNTER: 'hunter',
    SHADOW_LORD: 'shadow',
};

export class MultiplayerGame extends Scene {
    // Local player info (received from lobby via scene data)
    private localPlayerId = '';
    private roomCode = '';

    // Sprites
    private localSprite!: Phaser.GameObjects.Sprite;
    private opponentSprite!: Phaser.GameObjects.Sprite;
    private enemySprites: Map<number, Phaser.GameObjects.Sprite> = new Map();
    private eggSprites: Map<number, Phaser.GameObjects.Sprite> = new Map();

    // HUD
    private hudLocalScore!: Phaser.GameObjects.Text;
    private hudOpponentScore!: Phaser.GameObjects.Text;
    private hudWave!: Phaser.GameObjects.Text;
    private hudLocalLives!: Phaser.GameObjects.Text;
    private hudOpponentLives!: Phaser.GameObjects.Text;
    private waveText?: Phaser.GameObjects.Text;
    private countdownText?: Phaser.GameObjects.Text;

    // Input
    private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
    private spaceKey!: Phaser.Input.Keyboard.Key;
    private lastSentInput: string = 'stop';

    // Touch
    private touchFlap = false;
    private joystickGraphics!: Phaser.GameObjects.Graphics;
    private joystickKnob!: Phaser.GameObjects.Graphics;
    private joystickActive = false;
    private joystickPointerId = -1;
    private joystickValue = 0;
    private joystickOriginX = 0;
    private joystickOriginY = 0;

    // Event handler ref for cleanup
    private eventHandler: ((type: string, data: any) => void) | null = null;

    constructor() {
        super('MultiplayerGame');
    }

    create(data: { localPlayerId: string; roomCode: string }): void {
        this.localPlayerId = data.localPlayerId;
        this.roomCode = data.roomCode;

        const room = connection.getRoom();
        if (!room) return;

        // Background (same cave tiles as single-player)
        this.cameras.main.setBackgroundColor(GAME.BACKGROUND_COLOR);
        this.drawCaveBackground();

        // Platforms (static, same as single-player)
        Platform.createAll(this);

        // Lava
        new LavaPit(this);

        // Create player sprites
        const frames = this.textures.get('player_idle').getFrameNames().sort();

        // Local player sprite (blue knight - default)
        this.localSprite = this.add.sprite(GAME.WIDTH * 0.3, 300, 'player_idle', frames[0]);
        this.localSprite.setScale(1.4).setDepth(10);
        this.localSprite.play('player_idle_anim');

        // Opponent sprite (tinted red to distinguish)
        this.opponentSprite = this.add.sprite(GAME.WIDTH * 0.7, 300, 'player_idle', frames[0]);
        this.opponentSprite.setScale(1.4).setDepth(10);
        this.opponentSprite.setTint(0xff6666);
        this.opponentSprite.play('player_idle_anim');

        // Input setup
        if (this.input.keyboard) {
            this.cursors = this.input.keyboard.createCursorKeys();
            this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        }
        this.setupTouchInput();

        // HUD - dual score display
        this.createHUD();

        // Listen for game events via connection
        this.eventHandler = (type: string, eventData: any) => {
            this.handleGameEvent(type, eventData);
        };
        connection.onEvent(this.eventHandler);

        // Tell server we're ready
        connection.send("ready");

        // Start music
        audioManager.startBGM();

        capture('multiplayer_game_start', { roomCode: this.roomCode });
    }

    private drawCaveBackground(): void {
        // Tile cave wall pixel art across the screen (same as Game.ts)
        const tileSize = 48;
        const numTileVariants = 3;

        for (let y = 0; y < GAME.HEIGHT; y += tileSize) {
            for (let x = 0; x < GAME.WIDTH; x += tileSize) {
                const variant = (Math.floor(x / tileSize) + Math.floor(y / tileSize)) % numTileVariants;
                const tile = this.add.image(x + tileSize * 0.5, y + tileSize * 0.5, `cave_tile_${variant}`);
                tile.setDepth(-10);
            }
        }

        // Scatter decorative stalactite-like rocks at low alpha
        for (let i = 0; i < 12; i++) {
            const rx = Phaser.Math.Between(0, GAME.WIDTH);
            const ry = Phaser.Math.Between(0, GAME.HEIGHT - 120);
            const variant = Phaser.Math.Between(0, 2);
            const rock = this.add.image(rx, ry, `cave_tile_${variant}`);
            rock.setDepth(-9);
            rock.setAlpha(0.15 + Math.random() * 0.15);
            rock.setScale(0.6 + Math.random() * 0.8);
        }
    }

    private createHUD(): void {
        const hudY = SAFE_ZONE.TOP + 4;

        // Left: local player score (gold)
        this.hudLocalScore = this.add.text(10, hudY, '0', {
            fontFamily: ARCADE_FONT, fontSize: '18px', color: '#ffd700',
            fontStyle: 'bold', stroke: '#000000', strokeThickness: 3,
        }).setDepth(100);

        this.hudLocalLives = this.add.text(10, hudY + 22, '\u2665\u2665\u2665', {
            fontFamily: ARCADE_FONT, fontSize: '14px', color: '#ff4444',
            stroke: '#000000', strokeThickness: 2,
        }).setDepth(100);

        // Center: wave
        this.hudWave = this.add.text(GAME.WIDTH * 0.5, hudY, 'W1', {
            fontFamily: ARCADE_FONT, fontSize: '18px', color: '#aaaacc',
            fontStyle: 'bold', stroke: '#000000', strokeThickness: 3,
        }).setOrigin(0.5, 0).setDepth(100);

        // Right: opponent score (red)
        this.hudOpponentScore = this.add.text(GAME.WIDTH - 10, hudY, '0', {
            fontFamily: ARCADE_FONT, fontSize: '18px', color: '#ff6666',
            fontStyle: 'bold', stroke: '#000000', strokeThickness: 3,
        }).setOrigin(1, 0).setDepth(100);

        this.hudOpponentLives = this.add.text(GAME.WIDTH - 10, hudY + 22, '\u2665\u2665\u2665', {
            fontFamily: ARCADE_FONT, fontSize: '14px', color: '#ff4444',
            stroke: '#000000', strokeThickness: 2,
        }).setOrigin(1, 0).setDepth(100);
    }

    private handleGameEvent(type: string, data?: any): void {
        switch (type) {
            case 'countdown':
                this.showCountdown(data?.seconds ?? data);
                break;

            case 'joust_win': {
                const winnerId = data?.winner as string;
                const isLocal = winnerId === this.localPlayerId;
                this.showFloatingText(
                    isLocal ? '+1000 JOUST!' : 'JOUSTED!',
                    isLocal ? '#44ff44' : '#ff4444'
                );
                break;
            }
            case 'joust_bounce':
                this.showFloatingText('CLASH!', '#ffdd44');
                break;
            case 'wave_complete':
                this.showWaveText();
                break;

            case 'match_over': {
                const localPlayer = data.players?.find((p: any) => p.id === this.localPlayerId);
                capture('multiplayer_game_over', {
                    roomCode: this.roomCode,
                    isWinner: data.winner === this.localPlayerId,
                    score: localPlayer?.score ?? 0,
                    wave: localPlayer?.wave ?? 0,
                });
                this.shutdown();
                this.scene.start('MultiplayerResults', {
                    winner: data.winner,
                    players: data.players,
                    localPlayerId: this.localPlayerId,
                });
                break;
            }

            case 'player_left':
                // Opponent disconnected - show message, return to lobby
                this.showDisconnectMessage();
                break;
        }
    }

    private showCountdown(seconds: number): void {
        if (this.countdownText) this.countdownText.destroy();
        if (seconds <= 0) return;

        this.countdownText = this.add.text(GAME.WIDTH * 0.5, GAME.HEIGHT * 0.4, `${seconds}`, {
            fontFamily: ARCADE_FONT, fontSize: '72px', color: '#ffd700',
            stroke: '#000000', strokeThickness: 10, fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(50);

        this.tweens.add({
            targets: this.countdownText,
            scaleX: 1.5, scaleY: 1.5, alpha: 0,
            duration: 900, ease: 'Power2',
            onComplete: () => { if (this.countdownText) this.countdownText.destroy(); },
        });
    }

    private showFloatingText(text: string, color: string): void {
        const t = this.add.text(GAME.WIDTH * 0.5, GAME.HEIGHT * 0.35, text, {
            fontFamily: ARCADE_FONT, fontSize: '28px', color,
            stroke: '#000000', strokeThickness: 5, fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(50);

        this.tweens.add({
            targets: t, alpha: 0, y: t.y - 50,
            duration: 1200, ease: 'Power2',
            onComplete: () => t.destroy(),
        });
    }

    private showWaveText(): void {
        const room = connection.getRoom();
        if (!room?.state) return;
        if (this.waveText) this.waveText.destroy();

        const wave = room.state.wave ?? 1;
        this.waveText = this.add.text(GAME.WIDTH * 0.5, GAME.HEIGHT * 0.38, `WAVE ${wave}`, {
            fontFamily: ARCADE_FONT, fontSize: '52px', color: '#ffd700',
            stroke: '#000000', strokeThickness: 8, fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(20);

        this.tweens.add({
            targets: this.waveText,
            alpha: 0, y: GAME.HEIGHT * 0.33,
            duration: 1500, ease: 'Power2',
            onComplete: () => { if (this.waveText) this.waveText.destroy(); },
        });
    }

    private showDisconnectMessage(): void {
        this.add.text(GAME.WIDTH * 0.5, GAME.HEIGHT * 0.4, 'OPPONENT DISCONNECTED', {
            fontFamily: ARCADE_FONT, fontSize: '32px', color: '#ff4444',
            stroke: '#000000', strokeThickness: 6, fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(50);

        this.time.delayedCall(2000, () => {
            this.shutdown();
            connection.disconnect();
            this.scene.start('TitleScreen');
        });
    }

    // === INPUT ===

    private handleInput(): void {
        let moveDir: 'left' | 'right' | 'stop' = 'stop';
        let doFlap = false;

        // Keyboard
        if (this.cursors) {
            if (this.cursors.left.isDown) moveDir = 'left';
            else if (this.cursors.right.isDown) moveDir = 'right';
        }
        if (this.spaceKey && Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
            doFlap = true;
        }

        // Touch joystick
        if (IS_TOUCH) {
            if (this.joystickValue < -JOYSTICK.DEAD_ZONE) moveDir = 'left';
            else if (this.joystickValue > JOYSTICK.DEAD_ZONE) moveDir = 'right';
        }
        if (this.touchFlap) {
            doFlap = true;
            this.touchFlap = false;
        }

        // Send input to server (only send changes to reduce traffic)
        if (doFlap) {
            connection.send("input", { action: "flap" });
        }
        if (moveDir !== this.lastSentInput) {
            connection.send("input", { action: moveDir });
            this.lastSentInput = moveDir;
        }
    }

    private setupTouchInput(): void {
        if (!IS_TOUCH) return;
        this.joystickGraphics = this.add.graphics().setDepth(200);
        this.joystickKnob = this.add.graphics().setDepth(201);
        this.input.addPointer(1);

        this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            if (!this.joystickActive && pointer.x < GAME.WIDTH * 0.5) {
                this.joystickActive = true;
                this.joystickPointerId = pointer.id;
                this.joystickOriginX = pointer.x;
                this.joystickOriginY = pointer.y;
                this.joystickGraphics.clear();
                this.joystickGraphics.lineStyle(3, 0xffffff, JOYSTICK.ALPHA_ACTIVE);
                this.joystickGraphics.strokeCircle(this.joystickOriginX, this.joystickOriginY, JOYSTICK.RADIUS);
                this.drawKnob(this.joystickOriginX, this.joystickOriginY, JOYSTICK.ALPHA_ACTIVE);
            } else {
                this.touchFlap = true;
            }
        });

        this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
            if (pointer.id === this.joystickPointerId && this.joystickActive) {
                const dx = pointer.x - this.joystickOriginX;
                const clampedX = Phaser.Math.Clamp(dx, -JOYSTICK.RADIUS, JOYSTICK.RADIUS);
                this.joystickValue = clampedX / JOYSTICK.RADIUS;
                if (Math.abs(this.joystickValue) < JOYSTICK.DEAD_ZONE) this.joystickValue = 0;
                this.drawKnob(this.joystickOriginX + clampedX, this.joystickOriginY, JOYSTICK.ALPHA_ACTIVE);
            }
        });

        this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
            if (pointer.id === this.joystickPointerId) {
                this.joystickActive = false;
                this.joystickPointerId = -1;
                this.joystickValue = 0;
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

    // === RENDERING ===

    update(_time: number, _delta: number): void {
        this.handleInput();
        this.renderFromState();
    }

    private renderFromState(): void {
        const room = connection.getRoom();
        if (!room?.state) return;
        const state = room.state;

        // Render players
        if (state.players) {
            state.players.forEach((player: any, sessionId: string) => {
                const sprite = sessionId === this.localPlayerId ? this.localSprite : this.opponentSprite;

                if (player.isRespawning) {
                    sprite.setVisible(false);
                    return;
                }
                sprite.setVisible(true);

                sprite.x = player.x;
                sprite.y = player.y;
                sprite.setFlipX(player.flipX);

                // Invulnerability flash
                if (player.isInvulnerable) {
                    sprite.setAlpha(Math.sin(Date.now() * 0.01) > 0 ? 1 : 0.3);
                } else {
                    sprite.setAlpha(1);
                }

                // Animation
                const anim = player.anim;
                if (anim && sprite.anims.currentAnim?.key !== anim) {
                    sprite.play(anim, true);
                }
            });
        }

        // Render enemies
        if (state.enemies) {
            this.syncEnemySprites(state.enemies);
        }

        // Render eggs
        if (state.eggs) {
            this.syncEggSprites(state.eggs);
        }

        // Update HUD
        this.updateHUD();
    }

    private syncEnemySprites(enemies: any): void {
        const activeIds = new Set<number>();

        enemies.forEach((e: any) => {
            if (!e.active) return;
            const id = e.id;
            activeIds.add(id);

            let sprite = this.enemySprites.get(id);
            if (!sprite) {
                // Create new enemy sprite
                const prefix = ATLAS_PREFIX[e.enemyType] || 'bounder';
                const frames = this.textures.get(`${prefix}_idle`).getFrameNames().sort();
                sprite = this.add.sprite(e.x, e.y, `${prefix}_idle`, frames[0]);
                sprite.setScale(1.4).setDepth(9);
                this.enemySprites.set(id, sprite);
            }

            sprite.x = e.x;
            sprite.y = e.y;
            sprite.setFlipX(e.flipX);
            sprite.setVisible(true);

            if (e.anim && sprite.anims.currentAnim?.key !== e.anim) {
                sprite.play(e.anim, true);
            }
        });

        // Hide sprites for enemies no longer active
        for (const [id, sprite] of this.enemySprites) {
            if (!activeIds.has(id)) {
                sprite.setVisible(false);
            }
        }
    }

    private syncEggSprites(eggs: any): void {
        const activeIds = new Set<number>();

        eggs.forEach((e: any) => {
            if (!e.active) return;
            const id = e.id;
            activeIds.add(id);

            let sprite = this.eggSprites.get(id);
            if (!sprite) {
                sprite = this.add.sprite(e.x, e.y, 'egg');
                sprite.setDepth(5);
                this.eggSprites.set(id, sprite);
            }

            sprite.x = e.x;
            sprite.y = e.y;
            sprite.setVisible(true);
        });

        for (const [id, sprite] of this.eggSprites) {
            if (!activeIds.has(id)) {
                sprite.setVisible(false);
            }
        }
    }

    private updateHUD(): void {
        const room = connection.getRoom();
        if (!room?.state) return;
        const state = room.state;

        if (state.players) {
            state.players.forEach((player: any, sessionId: string) => {
                if (sessionId === this.localPlayerId) {
                    this.hudLocalScore.setText(`${player.score}`);
                    this.hudLocalLives.setText('\u2665'.repeat(Math.max(0, player.lives)));
                } else {
                    this.hudOpponentScore.setText(`${player.score}`);
                    this.hudOpponentLives.setText('\u2665'.repeat(Math.max(0, player.lives)));
                }
            });
        }

        this.hudWave.setText(`W${state.wave ?? 1}`);
    }

    shutdown(): void {
        audioManager.stopBGM();
        if (this.eventHandler) {
            connection.offEvent(this.eventHandler);
            this.eventHandler = null;
        }
        if (this.joystickGraphics) this.joystickGraphics.destroy();
        if (this.joystickKnob) this.joystickKnob.destroy();
        this.enemySprites.forEach(s => s.destroy());
        this.enemySprites.clear();
        this.eggSprites.forEach(s => s.destroy());
        this.eggSprites.clear();
    }
}
