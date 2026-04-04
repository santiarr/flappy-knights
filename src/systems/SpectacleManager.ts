import Phaser from 'phaser';
import { GAME, SPECTACLE, COLORS, ENEMY, LAVA } from '../core/Constants';
import { EventBus, Events } from '../core/EventBus';

export class SpectacleManager {
    private scene: Phaser.Scene;
    private player: Phaser.Physics.Arcade.Sprite;
    private ambientEmitter?: Phaser.GameObjects.Particles.ParticleEmitter;

    // Bound listener references for cleanup
    private listeners: Array<{ event: string; fn: (...args: unknown[]) => void }> = [];

    constructor(scene: Phaser.Scene, player: Phaser.Physics.Arcade.Sprite) {
        this.scene = scene;
        this.player = player;
        this.setupListeners();
    }

    private on(event: string, fn: (...args: unknown[]) => void): void {
        EventBus.on(event, fn);
        this.listeners.push({ event, fn });
    }

    private setupListeners(): void {
        this.on(Events.SPECTACLE_ENTRANCE, () => this.onEntrance());
        this.on(Events.SPECTACLE_ACTION, () => this.onAction());
        this.on(Events.SPECTACLE_HIT, () => this.onHit());
        this.on(Events.SPECTACLE_COMBO, (data: { combo: number }) => this.onCombo(data));
        this.on(Events.SPECTACLE_STREAK, (data: { streak: number }) => this.onStreak(data));
        this.on(Events.SPECTACLE_NEAR_MISS, () => this.onNearMiss());
        this.on(Events.SCORE_CHANGED, (data: { score: number; delta?: number }) => this.onScoreChanged(data));
        this.on(Events.PLAYER_DAMAGED, () => this.onPlayerDamaged());
        this.on(Events.GAME_NEXT_WAVE, (data: { wave: number }) => this.onNextWave(data));
    }

    // --- SPECTACLE_ENTRANCE ---
    private onEntrance(): void {
        // Cave-colored flash
        this.scene.cameras.main.flash(300, 26, 10, 46);

        // Player slam-in from below
        const targetY = this.player.y;
        this.player.y = GAME.HEIGHT + 100;
        this.scene.tweens.add({
            targets: this.player,
            y: targetY,
            duration: 600,
            ease: 'Bounce.easeOut',
        });

        // Ambient cave dust particles (always active)
        this.ambientEmitter = this.scene.add.particles(0, 0, 'particle', {
            x: { min: 0, max: GAME.WIDTH },
            y: { min: 0, max: GAME.HEIGHT },
            lifespan: 4000,
            speedY: { min: -15, max: -5 },
            speedX: { min: -5, max: 5 },
            scale: { start: 0.3, end: 0.1 },
            alpha: { start: 0.2, end: 0.05 },
            tint: [0xffffff, 0xffd700],
            frequency: 300,
            quantity: 1,
        });
        this.ambientEmitter.setDepth(55);
    }

    // --- SPECTACLE_ACTION (flap) ---
    private onAction(): void {
        // Small feather burst below player
        const emitter = this.scene.add.particles(this.player.x, this.player.y + 20, 'particle', {
            speed: { min: 30, max: 80 },
            angle: { min: 60, max: 120 }, // downward spread
            lifespan: 300,
            scale: { start: 0.4, end: 0.1 },
            alpha: { start: 0.6, end: 0 },
            tint: [0xffd700, 0xdaa520],
            quantity: 8,
            emitting: false,
        });
        emitter.setDepth(55);
        emitter.explode(8, this.player.x, this.player.y + 20);
        this.scene.time.delayedCall(400, () => emitter.destroy());

        // Very subtle camera nudge
        this.scene.cameras.main.shake(80, SPECTACLE.SHAKE_LIGHT * 0.3);
    }

    // --- SPECTACLE_HIT (enemy defeated) ---
    private onHit(): void {
        // Particle burst at a reasonable position (near player since we don't have enemy ref)
        // The hit event doesn't carry position, so we burst near the player's attack zone
        const burstX = this.player.x;
        const burstY = this.player.y - 30;

        const emitter = this.scene.add.particles(burstX, burstY, 'particle', {
            speed: { min: 60, max: SPECTACLE.PARTICLE_SPEED },
            lifespan: SPECTACLE.PARTICLE_LIFETIME,
            scale: { start: 0.6, end: 0.1 },
            alpha: { start: 0.9, end: 0 },
            tint: [0xff4444, 0xff8800, 0xffcc00],
            quantity: SPECTACLE.PARTICLE_BURST_COUNT,
            emitting: false,
        });
        emitter.setDepth(55);
        emitter.explode(SPECTACLE.PARTICLE_BURST_COUNT, burstX, burstY);
        this.scene.time.delayedCall(SPECTACLE.PARTICLE_LIFETIME + 100, () => emitter.destroy());

        // Screen shake
        this.scene.cameras.main.shake(SPECTACLE.SHAKE_DURATION, SPECTACLE.SHAKE_MEDIUM);

        // Camera flash
        this.scene.cameras.main.flash(100, 255, 255, 255, false, undefined, undefined);
        // Reduce flash alpha by setting it subtle — Phaser flash doesn't have alpha param,
        // so we use a brief overlay instead
        this.flashOverlay(0xffffff, 0.15, 100);

        // Hit freeze
        this.scene.physics.world.pause();
        this.scene.time.delayedCall(SPECTACLE.HIT_FREEZE_MS, () => {
            this.scene.physics.world.resume();
        });
    }

    // --- SPECTACLE_COMBO ---
    private onCombo(data: { combo: number }): void {
        const { combo } = data;
        const fontSize = SPECTACLE.COMBO_BASE_SIZE + combo * SPECTACLE.COMBO_SIZE_PER;

        const text = this.scene.add.text(
            GAME.WIDTH * 0.5,
            GAME.HEIGHT * 0.35,
            `${combo}x COMBO!`,
            {
                fontFamily: 'Arial Black',
                fontSize: `${fontSize}px`,
                color: '#ffdd44',
                stroke: '#000000',
                strokeThickness: 4,
            }
        ).setOrigin(0.5).setDepth(60).setScale(SPECTACLE.FLOAT_TEXT_SCALE);

        this.scene.tweens.add({
            targets: text,
            scaleX: 1.0,
            scaleY: 1.0,
            duration: 500,
            ease: 'Elastic.easeOut',
            onComplete: () => {
                this.scene.tweens.add({
                    targets: text,
                    alpha: 0,
                    y: text.y - 30,
                    duration: 400,
                    onComplete: () => text.destroy(),
                });
            },
        });

        // Shake scales with combo
        const shakeIntensity = Math.min(
            SPECTACLE.SHAKE_LIGHT + combo * 0.002,
            SPECTACLE.SHAKE_HEAVY
        );
        this.scene.cameras.main.shake(SPECTACLE.SHAKE_DURATION, shakeIntensity);
    }

    // --- SPECTACLE_STREAK ---
    private onStreak(data: { streak: number }): void {
        const { streak } = data;

        // Full-screen announcement
        const text = this.scene.add.text(
            GAME.WIDTH * 0.5,
            GAME.HEIGHT * 0.3,
            `${streak}x STREAK!`,
            {
                fontFamily: 'Arial Black',
                fontSize: '48px',
                color: '#ff4444',
                stroke: '#000000',
                strokeThickness: 6,
            }
        ).setOrigin(0.5).setDepth(60).setScale(3.0);

        this.scene.tweens.add({
            targets: text,
            scaleX: 1.0,
            scaleY: 1.0,
            duration: 400,
            ease: 'Back.easeOut',
            onComplete: () => {
                this.scene.tweens.add({
                    targets: text,
                    alpha: 0,
                    y: text.y - 40,
                    duration: 600,
                    onComplete: () => text.destroy(),
                });
            },
        });

        // 30-particle burst
        const emitter = this.scene.add.particles(GAME.WIDTH * 0.5, GAME.HEIGHT * 0.3, 'particle', {
            speed: { min: 80, max: 200 },
            lifespan: 800,
            scale: { start: 0.6, end: 0.1 },
            alpha: { start: 1, end: 0 },
            tint: [0xff4444, 0xffaa00, 0xffff00],
            quantity: 30,
            emitting: false,
        });
        emitter.setDepth(55);
        emitter.explode(30, GAME.WIDTH * 0.5, GAME.HEIGHT * 0.3);
        this.scene.time.delayedCall(900, () => emitter.destroy());

        // Heavy shake
        this.scene.cameras.main.shake(SPECTACLE.SHAKE_DURATION * 1.5, SPECTACLE.SHAKE_HEAVY);

        // Background flash overlay (additive blend)
        this.flashOverlay(0xff4400, 0.3, 300);
    }

    // --- SPECTACLE_NEAR_MISS ---
    private onNearMiss(): void {
        // Red border flash
        this.borderFlash(0xff0000, 0.4, 200);

        // "CLOSE!" floating text
        const text = this.scene.add.text(
            this.player.x,
            this.player.y - 50,
            'CLOSE!',
            {
                fontFamily: 'Arial Black',
                fontSize: '20px',
                color: '#ff6666',
                stroke: '#000000',
                strokeThickness: 3,
            }
        ).setOrigin(0.5).setDepth(60);

        this.scene.tweens.add({
            targets: text,
            alpha: 0,
            y: text.y - 40,
            duration: 600,
            onComplete: () => text.destroy(),
        });
    }

    // --- SCORE_CHANGED ---
    private onScoreChanged(_data: { score: number; delta?: number }): void {
        // Floating score text at player position
        // We show a generic "+pts" — calculate from combo context
        // Since we don't get delta directly, show near player
        const text = this.scene.add.text(
            this.player.x + Phaser.Math.Between(-20, 20),
            this.player.y - 40,
            '+',
            {
                fontFamily: 'Arial Black',
                fontSize: '22px',
                color: '#ffd700',
                stroke: '#000000',
                strokeThickness: 3,
            }
        ).setOrigin(0.5).setDepth(60);

        // We don't have the delta in the event payload consistently,
        // so just show a gold sparkle effect instead of text
        text.destroy();

        // Gold sparkle particles
        const emitter = this.scene.add.particles(this.player.x, this.player.y - 30, 'particle', {
            speed: { min: 20, max: 60 },
            angle: { min: 230, max: 310 },
            lifespan: 500,
            scale: { start: 0.4, end: 0.1 },
            alpha: { start: 0.8, end: 0 },
            tint: [0xffd700, 0xffaa00],
            quantity: 5,
            emitting: false,
        });
        emitter.setDepth(55);
        emitter.explode(5, this.player.x, this.player.y - 30);
        this.scene.time.delayedCall(600, () => emitter.destroy());
    }

    // --- PLAYER_DAMAGED ---
    private onPlayerDamaged(): void {
        // Heavy screen shake
        this.scene.cameras.main.shake(SPECTACLE.SHAKE_DURATION * 2, SPECTACLE.SHAKE_HEAVY);

        // Red flash overlay
        this.flashOverlay(0xff0000, 0.3, 300);

        // Camera zoom punch
        this.scene.cameras.main.setZoom(1.05);
        this.scene.tweens.add({
            targets: this.scene.cameras.main,
            zoom: 1.0,
            duration: 200,
            ease: 'Cubic.easeOut',
        });
    }

    // --- GAME_NEXT_WAVE ---
    private onNextWave(data: { wave: number }): void {
        const { wave } = data;

        // Survival waves get red border pulse
        if (wave % 5 === 0) {
            this.borderFlash(0xff0000, 0.3, 400);
        }

        // Dramatic camera zoom
        this.scene.cameras.main.setZoom(0.98);
        this.scene.tweens.add({
            targets: this.scene.cameras.main,
            zoom: 1.0,
            duration: 500,
            ease: 'Cubic.easeOut',
        });
    }

    // --- Helpers ---

    private flashOverlay(color: number, alpha: number, duration: number): void {
        const overlay = this.scene.add.graphics();
        overlay.fillStyle(color, alpha);
        overlay.fillRect(0, 0, GAME.WIDTH, GAME.HEIGHT);
        overlay.setDepth(90);
        // Don't use Phaser's additive blend enum — use blendMode number 1 (ADD)
        overlay.setBlendMode(1);

        this.scene.tweens.add({
            targets: overlay,
            alpha: 0,
            duration: duration,
            onComplete: () => overlay.destroy(),
        });
    }

    private borderFlash(color: number, alpha: number, duration: number): void {
        const border = this.scene.add.graphics();
        const thickness = 8;
        border.fillStyle(color, alpha);
        // Top
        border.fillRect(0, 0, GAME.WIDTH, thickness);
        // Bottom
        border.fillRect(0, GAME.HEIGHT - thickness, GAME.WIDTH, thickness);
        // Left
        border.fillRect(0, 0, thickness, GAME.HEIGHT);
        // Right
        border.fillRect(GAME.WIDTH - thickness, 0, thickness, GAME.HEIGHT);
        border.setDepth(90);

        this.scene.tweens.add({
            targets: border,
            alpha: 0,
            duration: duration,
            onComplete: () => border.destroy(),
        });
    }

    shutdown(): void {
        // Remove all EventBus listeners
        for (const { event, fn } of this.listeners) {
            EventBus.off(event, fn);
        }
        this.listeners = [];

        // Destroy ambient emitter
        if (this.ambientEmitter) {
            this.ambientEmitter.destroy();
            this.ambientEmitter = undefined;
        }
    }
}
