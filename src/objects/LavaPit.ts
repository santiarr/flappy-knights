import Phaser from 'phaser';
import { GAME, LAVA, COLORS } from '../core/Constants';

export class LavaPit {
    private scene: Phaser.Scene;
    private graphics: Phaser.GameObjects.Graphics;
    private glowGraphics: Phaser.GameObjects.Graphics;
    private zone: Phaser.Physics.Arcade.StaticBody;
    private splashEmitter?: Phaser.GameObjects.Particles.ParticleEmitter;
    private nextSplashTime = 0;

    constructor(scene: Phaser.Scene) {
        this.scene = scene;

        // Visual
        this.graphics = scene.add.graphics();
        this.graphics.setDepth(6);

        // Glow layer above lava
        this.glowGraphics = scene.add.graphics();
        this.glowGraphics.setDepth(5);

        // Physics zone for collision
        const zoneSprite = scene.add.zone(GAME.WIDTH * 0.5, LAVA.Y + LAVA.HEIGHT * 0.5, GAME.WIDTH, LAVA.HEIGHT);
        scene.physics.add.existing(zoneSprite, true);
        this.zone = zoneSprite.body as Phaser.Physics.Arcade.StaticBody;

        this.drawLava(0);
    }

    getBody(): Phaser.Physics.Arcade.StaticBody {
        return this.zone;
    }

    getZone(): Phaser.GameObjects.Zone {
        return this.zone.gameObject as Phaser.GameObjects.Zone;
    }

    private drawLava(time: number): void {
        this.graphics.clear();
        this.glowGraphics.clear();

        // Emissive glow above lava surface (orange gradient)
        const glowHeight = 30;
        for (let i = 0; i < glowHeight; i++) {
            const alpha = 0.15 * (1 - i / glowHeight);
            this.glowGraphics.fillStyle(0xff6600, alpha);
            this.glowGraphics.fillRect(0, LAVA.Y - glowHeight + i, GAME.WIDTH, 1);
        }

        // Lava body
        this.graphics.fillStyle(COLORS.LAVA_DARK);
        this.graphics.fillRect(0, LAVA.Y + 10, GAME.WIDTH, LAVA.HEIGHT);

        // Wavy surface
        this.graphics.fillStyle(COLORS.LAVA_BRIGHT);
        this.graphics.beginPath();
        this.graphics.moveTo(0, LAVA.Y + 10);

        for (let x = 0; x <= GAME.WIDTH; x += 4) {
            const waveY = LAVA.Y + Math.sin(x * 0.02 + time * LAVA.WAVE_SPEED) * LAVA.WAVE_AMPLITUDE
                + Math.sin(x * 0.035 + time * LAVA.WAVE_SPEED * 1.3) * (LAVA.WAVE_AMPLITUDE * 0.5);
            this.graphics.lineTo(x, waveY);
        }

        this.graphics.lineTo(GAME.WIDTH, LAVA.Y + 30);
        this.graphics.lineTo(0, LAVA.Y + 30);
        this.graphics.closePath();
        this.graphics.fillPath();

        // Dynamic bubbles — varying sizes, random pops
        for (let i = 0; i < 8; i++) {
            const bx = ((time * (0.02 + i * 0.005) + i * 80) % GAME.WIDTH);
            const by = LAVA.Y + 15 + Math.sin(time * 0.002 + i * 1.7) * 10;
            const baseSize = 2 + (i % 3) * 1.5;
            const popPhase = Math.sin(time * 0.004 + i * 3.1);
            const size = baseSize + popPhase * baseSize * 0.6;

            // Brighter bubbles
            const bubbleAlpha = 0.4 + popPhase * 0.3;
            this.graphics.fillStyle(0xffcc00, bubbleAlpha);
            if (size > 0.5) {
                this.graphics.fillCircle(bx, by, size);
            }

            // Pop effect — when bubble is at peak, draw a ring
            if (popPhase > 0.8) {
                this.graphics.lineStyle(1, 0xffee66, 0.3);
                this.graphics.strokeCircle(bx, by, size + 2);
            }
        }

        // Occasional lava splash particles
        if (time > this.nextSplashTime) {
            this.spawnLavaSplash();
            this.nextSplashTime = time + Phaser.Math.Between(800, 2500);
        }
    }

    private spawnLavaSplash(): void {
        const splashX = Phaser.Math.Between(30, GAME.WIDTH - 30);
        const emitter = this.scene.add.particles(splashX, LAVA.Y + 5, 'particle', {
            speed: { min: 40, max: 100 },
            angle: { min: 240, max: 300 },
            lifespan: 500,
            scale: { start: 0.4, end: 0.1 },
            alpha: { start: 0.8, end: 0 },
            tint: [0xff6600, 0xff4400, 0xffaa00],
            quantity: Phaser.Math.Between(2, 5),
            gravityY: 200,
            emitting: false,
        });
        emitter.setDepth(7);
        emitter.explode(Phaser.Math.Between(2, 5), splashX, LAVA.Y + 5);
        this.scene.time.delayedCall(600, () => emitter.destroy());
    }

    update(time: number): void {
        this.drawLava(time);
    }

    destroy(): void {
        this.graphics.destroy();
        this.glowGraphics.destroy();
        if (this.splashEmitter) {
            this.splashEmitter.destroy();
        }
    }
}
