import { Scene } from 'phaser';
import { GAME, SAFE_ZONE, IS_TOUCH, JOYSTICK } from '../core/Constants';
import { connection } from '../multiplayer/connection';
import type { ServerMessage, GameSnapshot } from '../multiplayer/types';
import { Platform } from '../objects/Platform';
import { LavaPit } from '../objects/LavaPit';

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

    // State interpolation
    private prevState: GameSnapshot | null = null;
    private currentState: GameSnapshot | null = null;
    private interpStart = 0;

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

    // Message handler ref for cleanup
    private messageHandler: ((msg: ServerMessage) => void) | null = null;

    constructor() {
        super('MultiplayerGame');
    }

    create(data: { localPlayerId: string; roomCode: string }): void {
        this.localPlayerId = data.localPlayerId;
        this.roomCode = data.roomCode;

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

        // Listen for server messages
        this.messageHandler = (msg: ServerMessage) => this.handleServerMessage(msg);
        connection.onMessage(this.messageHandler);

        // Tell server we're ready
        connection.send({ type: 'ready' });
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

        this.hudLocalLives = this.add.text(10, hudY + 22, '♥♥♥', {
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

        this.hudOpponentLives = this.add.text(GAME.WIDTH - 10, hudY + 22, '♥♥♥', {
            fontFamily: ARCADE_FONT, fontSize: '14px', color: '#ff4444',
            stroke: '#000000', strokeThickness: 2,
        }).setOrigin(1, 0).setDepth(100);
    }

    private handleServerMessage(msg: ServerMessage): void {
        switch (msg.type) {
            case 'state':
                this.prevState = this.currentState;
                this.currentState = msg.state;
                this.interpStart = Date.now();
                break;

            case 'countdown':
                this.showCountdown(msg.seconds);
                break;

            case 'event':
                this.handleGameEvent(msg.name, msg.data);
                break;

            case 'match_over':
                this.shutdown();
                this.scene.start('MultiplayerResults', {
                    winner: msg.winner,
                    players: msg.players,
                    localPlayerId: this.localPlayerId,
                });
                break;

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

    private handleGameEvent(name: string, data?: Record<string, unknown>): void {
        switch (name) {
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
        }
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
        if (!this.currentState) return;
        if (this.waveText) this.waveText.destroy();

        this.waveText = this.add.text(GAME.WIDTH * 0.5, GAME.HEIGHT * 0.38, `WAVE ${this.currentState.wave}`, {
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
            connection.send({ type: 'input', action: 'flap' });
        }
        if (moveDir !== this.lastSentInput) {
            connection.send({ type: 'input', action: moveDir });
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
        this.renderFromServerState();
    }

    private renderFromServerState(): void {
        if (!this.currentState) return;

        const t = this.prevState
            ? Math.min((Date.now() - this.interpStart) / 50, 1) // 50ms = 20hz
            : 1;

        // Render players
        for (const ps of this.currentState.players) {
            const sprite = ps.id === this.localPlayerId ? this.localSprite : this.opponentSprite;

            if (ps.isRespawning) {
                sprite.setVisible(false);
                continue;
            }
            sprite.setVisible(true);

            // Interpolate position
            const prev = this.prevState?.players.find(p => p.id === ps.id);
            if (prev && t < 1) {
                sprite.x = Phaser.Math.Linear(prev.x, ps.x, t);
                sprite.y = Phaser.Math.Linear(prev.y, ps.y, t);
            } else {
                sprite.x = ps.x;
                sprite.y = ps.y;
            }

            sprite.setFlipX(ps.flipX);

            // Invulnerability flash
            if (ps.isInvulnerable) {
                sprite.setAlpha(Math.sin(Date.now() * 0.01) > 0 ? 1 : 0.3);
            } else {
                sprite.setAlpha(1);
            }

            // Animation
            if (sprite.anims.currentAnim?.key !== ps.anim) {
                sprite.play(ps.anim, true);
            }
        }

        // Render enemies
        this.syncEnemySprites(this.currentState.enemies, t);

        // Render eggs
        this.syncEggSprites(this.currentState.eggs);

        // Update HUD
        this.updateHUD();
    }

    private syncEnemySprites(enemies: { id: number; type: string; x: number; y: number; flipX: boolean; anim: string; active: boolean }[], t: number): void {
        const activeIds = new Set<number>();

        for (const e of enemies) {
            if (!e.active) continue;
            activeIds.add(e.id);

            let sprite = this.enemySprites.get(e.id);
            if (!sprite) {
                // Create new enemy sprite
                const prefix = ATLAS_PREFIX[e.type] || 'bounder';
                const frames = this.textures.get(`${prefix}_idle`).getFrameNames().sort();
                sprite = this.add.sprite(e.x, e.y, `${prefix}_idle`, frames[0]);
                sprite.setScale(1.4).setDepth(9);
                this.enemySprites.set(e.id, sprite);
            }

            // Interpolate
            const prev = this.prevState?.enemies.find(pe => pe.id === e.id);
            if (prev && t < 1) {
                sprite.x = Phaser.Math.Linear(prev.x, e.x, t);
                sprite.y = Phaser.Math.Linear(prev.y, e.y, t);
            } else {
                sprite.x = e.x;
                sprite.y = e.y;
            }

            sprite.setFlipX(e.flipX);
            sprite.setVisible(true);

            if (sprite.anims.currentAnim?.key !== e.anim) {
                sprite.play(e.anim, true);
            }
        }

        // Hide sprites for enemies no longer active
        for (const [id, sprite] of this.enemySprites) {
            if (!activeIds.has(id)) {
                sprite.setVisible(false);
            }
        }
    }

    private syncEggSprites(eggs: { id: number; type: string; x: number; y: number; active: boolean }[]): void {
        const activeIds = new Set<number>();

        for (const e of eggs) {
            if (!e.active) continue;
            activeIds.add(e.id);

            let sprite = this.eggSprites.get(e.id);
            if (!sprite) {
                sprite = this.add.sprite(e.x, e.y, 'egg');
                sprite.setDepth(5);
                this.eggSprites.set(e.id, sprite);
            }

            sprite.x = e.x;
            sprite.y = e.y;
            sprite.setVisible(true);
        }

        for (const [id, sprite] of this.eggSprites) {
            if (!activeIds.has(id)) {
                sprite.setVisible(false);
            }
        }
    }

    private updateHUD(): void {
        if (!this.currentState) return;

        const local = this.currentState.players.find(p => p.id === this.localPlayerId);
        const opponent = this.currentState.players.find(p => p.id !== this.localPlayerId);

        if (local) {
            this.hudLocalScore.setText(`${local.score}`);
            this.hudLocalLives.setText('\u2665'.repeat(Math.max(0, local.lives)));
        }
        if (opponent) {
            this.hudOpponentScore.setText(`${opponent.score}`);
            this.hudOpponentLives.setText('\u2665'.repeat(Math.max(0, opponent.lives)));
        }

        this.hudWave.setText(`W${this.currentState.wave}`);
    }

    shutdown(): void {
        if (this.messageHandler) {
            connection.offMessage(this.messageHandler);
            this.messageHandler = null;
        }
        if (this.joystickGraphics) this.joystickGraphics.destroy();
        if (this.joystickKnob) this.joystickKnob.destroy();
        this.enemySprites.forEach(s => s.destroy());
        this.enemySprites.clear();
        this.eggSprites.forEach(s => s.destroy());
        this.eggSprites.clear();
    }
}
