import Phaser, { Scene } from 'phaser';
import { GAME, SAFE_ZONE, IS_TOUCH } from '../core/Constants';
import { EventBus, Events } from '../core/EventBus';
import { GameState } from '../core/GameState';

const ARCADE_FONT = '"Courier New", Courier, monospace';

export class GameOver extends Scene {
    constructor() {
        super('GameOver');
    }

    private particleRain?: Phaser.GameObjects.Particles.ParticleEmitter;
    private rKey?: Phaser.Input.Keyboard.Key;

    create(): void {
        this.cameras.main.setBackgroundColor(0x0a0515);
        this.cameras.main.fadeIn(500, 10, 5, 21);

        const cx = GAME.WIDTH * 0.5;
        const safeTop = SAFE_ZONE.TOP;
        let y = safeTop + 30;

        // Particle rain
        this.particleRain = this.add.particles(0, 0, 'particle', {
            x: { min: 0, max: GAME.WIDTH },
            y: -10,
            lifespan: 6000,
            speedY: { min: 20, max: 50 },
            speedX: { min: -5, max: 5 },
            scale: { start: 0.3, end: 0.1 },
            alpha: { start: 0.3, end: 0.05 },
            tint: [0x4444aa, 0x6666cc, 0x333388],
            frequency: 150,
            quantity: 1,
        });
        this.particleRain.setDepth(1);

        // Game Over title
        const gameOverText = this.add.text(cx, y, 'GAME OVER', {
            fontFamily: ARCADE_FONT,
            fontSize: '44px',
            color: '#ff4444',
            stroke: '#000000',
            strokeThickness: 8,
            fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(10);

        this.tweens.add({
            targets: gameOverText,
            scaleX: 1.03,
            scaleY: 1.03,
            duration: 1500,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
        });

        y += 55;

        // Divider line
        const divider = this.add.graphics().setDepth(10);
        divider.lineStyle(1, 0x555577);
        divider.lineBetween(cx - 120, y, cx + 120, y);

        y += 20;

        // Score with count-up
        const finalScore = GameState.score;
        this.add.text(cx, y, 'SCORE', {
            fontFamily: ARCADE_FONT,
            fontSize: '13px',
            color: '#888899',
            letterSpacing: 6,
        }).setOrigin(0.5).setDepth(10);

        y += 24;

        const scoreText = this.add.text(cx, y, '0', {
            fontFamily: ARCADE_FONT,
            fontSize: '32px',
            color: '#ffd700',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 4,
        }).setOrigin(0.5).setDepth(10);

        const countDuration = Math.min(1500, Math.max(500, finalScore * 2));
        this.tweens.addCounter({
            from: 0,
            to: finalScore,
            duration: countDuration,
            ease: 'Cubic.easeOut',
            onUpdate: (tween: Phaser.Tweens.Tween) => {
                scoreText.setText(`${Math.floor(tween.getValue())}`);
            },
        });

        y += 40;

        // Stats row
        const isNewBest = GameState.score >= GameState.bestScore;

        // Best score
        this.add.text(cx - 80, y, 'BEST', {
            fontFamily: ARCADE_FONT,
            fontSize: '11px',
            color: '#888899',
        }).setOrigin(0.5).setDepth(10);

        this.add.text(cx - 80, y + 18, `${GameState.bestScore}`, {
            fontFamily: ARCADE_FONT,
            fontSize: '18px',
            color: isNewBest ? '#44ff44' : '#cccccc',
            fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(10);

        if (isNewBest && finalScore > 0) {
            this.add.text(cx - 80, y + 38, 'NEW!', {
                fontFamily: ARCADE_FONT,
                fontSize: '10px',
                color: '#44ff44',
                fontStyle: 'bold',
            }).setOrigin(0.5).setDepth(10);
        }

        // Wave reached
        this.add.text(cx + 80, y, 'WAVE', {
            fontFamily: ARCADE_FONT,
            fontSize: '11px',
            color: '#888899',
        }).setOrigin(0.5).setDepth(10);

        this.add.text(cx + 80, y + 18, `${GameState.wave}`, {
            fontFamily: ARCADE_FONT,
            fontSize: '18px',
            color: '#aaaacc',
            fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(10);

        y += 55;

        // Best combo (if earned)
        if (GameState.bestCombo > 1) {
            this.add.text(cx, y, `BEST COMBO  ${GameState.bestCombo}x`, {
                fontFamily: ARCADE_FONT,
                fontSize: '14px',
                color: '#ffaa44',
                fontStyle: 'bold',
            }).setOrigin(0.5).setDepth(10);
            y += 30;
        }

        y += 10;

        // Play Again button
        const btnW = 200;
        const btnH = 44;

        const btnBg = this.add.graphics();
        btnBg.fillStyle(0x2a2a5a);
        btnBg.fillRoundedRect(-btnW * 0.5, -btnH * 0.5, btnW, btnH, 6);
        btnBg.lineStyle(2, 0x5555aa);
        btnBg.strokeRoundedRect(-btnW * 0.5, -btnH * 0.5, btnW, btnH, 6);

        const btnText = this.add.text(0, 0, 'PLAY AGAIN', {
            fontFamily: ARCADE_FONT,
            fontSize: '18px',
            color: '#ffd700',
            fontStyle: 'bold',
        }).setOrigin(0.5);

        const btnContainer = this.add.container(cx, y, [btnBg, btnText]);
        btnContainer.setSize(btnW, btnH);
        btnContainer.setInteractive({ useHandCursor: true });
        btnContainer.setDepth(10);

        btnContainer.on('pointerover', () => {
            btnBg.clear();
            btnBg.fillStyle(0x3a3a7a);
            btnBg.fillRoundedRect(-btnW * 0.5, -btnH * 0.5, btnW, btnH, 6);
            btnBg.lineStyle(2, 0x7777cc);
            btnBg.strokeRoundedRect(-btnW * 0.5, -btnH * 0.5, btnW, btnH, 6);
        });

        btnContainer.on('pointerout', () => {
            btnBg.clear();
            btnBg.fillStyle(0x2a2a5a);
            btnBg.fillRoundedRect(-btnW * 0.5, -btnH * 0.5, btnW, btnH, 6);
            btnBg.lineStyle(2, 0x5555aa);
            btnBg.strokeRoundedRect(-btnW * 0.5, -btnH * 0.5, btnW, btnH, 6);
        });

        btnContainer.on('pointerdown', () => {
            this.restartGame();
        });

        y += 36;

        // R key hint (desktop only)
        if (!IS_TOUCH) {
            this.add.text(cx, y, 'or press R', {
                fontFamily: ARCADE_FONT,
                fontSize: '11px',
                color: '#666677',
            }).setOrigin(0.5).setDepth(10);
        }

        // R key to restart
        if (this.input.keyboard) {
            this.rKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R);
            this.rKey.on('down', () => {
                this.restartGame();
            });
        }
    }

    private restartGame(): void {
        EventBus.emit(Events.GAME_RESTART);
        this.shutdown();
        this.scene.start('Game');
    }

    shutdown(): void {
        if (this.rKey) {
            this.rKey.removeAllListeners();
        }
        if (this.particleRain) {
            this.particleRain.destroy();
            this.particleRain = undefined;
        }
    }
}
