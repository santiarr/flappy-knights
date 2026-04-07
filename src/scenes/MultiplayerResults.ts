import Phaser, { Scene } from 'phaser';
import { GAME, SAFE_ZONE } from '../core/Constants';
import { connection } from '../multiplayer/connection';
import type { PlayerResult } from '../multiplayer/types';

const ARCADE_FONT = '"Courier New", Courier, monospace';

export class MultiplayerResults extends Scene {
    private particleRain?: Phaser.GameObjects.Particles.ParticleEmitter;
    private eventHandler?: (type: string, data: any) => void;
    private rematchPending = false;
    private opponentRematchPending = false;
    private rematchStatusText?: Phaser.GameObjects.Text;

    constructor() {
        super('MultiplayerResults');
    }

    create(data: { winner: string; players: PlayerResult[]; localPlayerId: string }): void {
        this.rematchPending = false;
        this.opponentRematchPending = false;

        this.cameras.main.setBackgroundColor(0x0a0515);
        this.cameras.main.fadeIn(500, 10, 5, 21);

        const cx = GAME.WIDTH * 0.5;
        const isWinner = data.winner === data.localPlayerId;
        const localPlayer = data.players.find(p => p.id === data.localPlayerId);
        const opponent = data.players.find(p => p.id !== data.localPlayerId);

        if (!localPlayer || !opponent) return;

        // Particle rain
        this.particleRain = this.add.particles(0, 0, 'particle', {
            x: { min: 0, max: GAME.WIDTH },
            y: -10,
            lifespan: 6000,
            speedY: { min: 20, max: 50 },
            speedX: { min: -5, max: 5 },
            scale: { start: 0.3, end: 0.1 },
            alpha: { start: 0.3, end: 0.05 },
            tint: isWinner ? [0xaaaa44, 0xcccc66, 0x888833] : [0x4444aa, 0x6666cc, 0x333388],
            frequency: 150,
            quantity: 1,
        });
        this.particleRain.setDepth(1);

        let y = SAFE_ZONE.TOP + 20;

        // VICTORY / DEFEAT banner
        const bannerText = isWinner ? 'VICTORY!' : 'DEFEAT';
        const bannerColor = isWinner ? '#ffd700' : '#ff4444';
        const banner = this.add.text(cx, y, bannerText, {
            fontFamily: ARCADE_FONT,
            fontSize: '44px',
            color: bannerColor,
            stroke: '#000000',
            strokeThickness: 8,
            fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(10);

        this.tweens.add({
            targets: banner,
            scaleX: 1.03,
            scaleY: 1.03,
            duration: 1500,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
        });

        y += 50;

        // Divider
        const divider = this.add.graphics().setDepth(10);
        divider.lineStyle(1, 0x555577);
        divider.lineBetween(cx - 200, y, cx + 200, y);

        y += 20;

        // Two-column stats
        const leftX = cx - 140;
        const rightX = cx + 140;

        this.buildPlayerColumn(leftX, y, 'YOU', '#4488ff', localPlayer);
        this.buildPlayerColumn(rightX, y, 'OPPONENT', '#ff4444', opponent);

        // VS divider between columns
        this.add.text(cx, y + 60, 'VS', {
            fontFamily: ARCADE_FONT,
            fontSize: '18px',
            color: '#555577',
            fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(10);

        y += 190;

        // REMATCH button
        this.createButton(cx - 110, y, 180, 44, 'REMATCH', '#ffd700', () => {
            this.handleRematch();
        });

        // Rematch status text (hidden initially)
        this.rematchStatusText = this.add.text(cx, y + 50, '', {
            fontFamily: ARCADE_FONT,
            fontSize: '11px',
            color: '#888888',
        }).setOrigin(0.5).setDepth(10);

        // MAIN MENU button
        this.createButton(cx + 110, y, 180, 44, 'MAIN MENU', '#cccccc', () => {
            this.handleMainMenu();
        });

        // Listen for rematch messages from opponent
        this.eventHandler = (type: string, _eventData: any) => {
            if (type === 'rematch') {
                this.opponentRematchPending = true;
                if (this.rematchPending) {
                    // Both players want rematch — server will start a new match
                    // The server should send a countdown or state message
                } else if (this.rematchStatusText) {
                    this.rematchStatusText.setText('Opponent wants a rematch!');
                    this.rematchStatusText.setColor('#44ff44');
                }
            }
        };
        connection.onEvent(this.eventHandler);
    }

    private buildPlayerColumn(x: number, startY: number, label: string, labelColor: string, player: PlayerResult): void {
        let y = startY;

        // Player label
        this.add.text(x, y, label, {
            fontFamily: ARCADE_FONT,
            fontSize: '16px',
            color: labelColor,
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 3,
        }).setOrigin(0.5).setDepth(10);

        y += 25;

        // Score label
        this.add.text(x, y, 'SCORE', {
            fontFamily: ARCADE_FONT,
            fontSize: '11px',
            color: '#888899',
            letterSpacing: 4,
        }).setOrigin(0.5).setDepth(10);

        y += 20;

        // Score count-up
        const scoreText = this.add.text(x, y, '0', {
            fontFamily: ARCADE_FONT,
            fontSize: '28px',
            color: '#ffd700',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 4,
        }).setOrigin(0.5).setDepth(10);

        const countDuration = Math.min(1500, Math.max(500, player.score * 2));
        this.tweens.addCounter({
            from: 0,
            to: player.score,
            duration: countDuration,
            ease: 'Cubic.easeOut',
            onUpdate: (tween: Phaser.Tweens.Tween) => {
                scoreText.setText(`${Math.floor(tween.getValue())}`);
            },
        });

        y += 35;

        // Stat rows
        const stats = [
            { label: 'Enemies Defeated', value: `${player.enemiesDefeated}` },
            { label: 'Best Combo', value: `${player.bestCombo}x` },
            { label: 'Joust Wins', value: `${player.joustWins}` },
        ];

        for (const stat of stats) {
            this.add.text(x, y, stat.label, {
                fontFamily: ARCADE_FONT,
                fontSize: '10px',
                color: '#888888',
            }).setOrigin(0.5).setDepth(10);

            y += 15;

            this.add.text(x, y, stat.value, {
                fontFamily: ARCADE_FONT,
                fontSize: '16px',
                color: '#cccccc',
                fontStyle: 'bold',
            }).setOrigin(0.5).setDepth(10);

            y += 22;
        }
    }

    private createButton(
        x: number,
        y: number,
        w: number,
        h: number,
        label: string,
        color: string,
        onClick: () => void,
    ): Phaser.GameObjects.Container {
        const btnBg = this.add.graphics();
        btnBg.fillStyle(0x2a2a5a);
        btnBg.fillRoundedRect(-w * 0.5, -h * 0.5, w, h, 6);
        btnBg.lineStyle(2, 0x5555aa);
        btnBg.strokeRoundedRect(-w * 0.5, -h * 0.5, w, h, 6);

        const btnText = this.add.text(0, 0, label, {
            fontFamily: ARCADE_FONT,
            fontSize: '16px',
            color,
            fontStyle: 'bold',
        }).setOrigin(0.5);

        const container = this.add.container(x, y, [btnBg, btnText]);
        container.setSize(w, h);
        container.setInteractive({ useHandCursor: true });
        container.setDepth(10);

        container.on('pointerover', () => {
            btnBg.clear();
            btnBg.fillStyle(0x3a3a7a);
            btnBg.fillRoundedRect(-w * 0.5, -h * 0.5, w, h, 6);
            btnBg.lineStyle(2, 0x7777cc);
            btnBg.strokeRoundedRect(-w * 0.5, -h * 0.5, w, h, 6);
        });

        container.on('pointerout', () => {
            btnBg.clear();
            btnBg.fillStyle(0x2a2a5a);
            btnBg.fillRoundedRect(-w * 0.5, -h * 0.5, w, h, 6);
            btnBg.lineStyle(2, 0x5555aa);
            btnBg.strokeRoundedRect(-w * 0.5, -h * 0.5, w, h, 6);
        });

        container.on('pointerdown', onClick);

        return container;
    }

    private handleRematch(): void {
        if (this.rematchPending) return;
        this.rematchPending = true;
        connection.send("rematch");

        if (this.rematchStatusText) {
            if (this.opponentRematchPending) {
                this.rematchStatusText.setText('Starting rematch...');
                this.rematchStatusText.setColor('#44ff44');
            } else {
                this.rematchStatusText.setText('Waiting for opponent...');
                this.rematchStatusText.setColor('#888888');
            }
        }
    }

    private handleMainMenu(): void {
        this.shutdown();
        connection.disconnect();
        this.scene.start('TitleScreen');
    }

    shutdown(): void {
        if (this.eventHandler) {
            connection.offEvent(this.eventHandler);
            this.eventHandler = undefined;
        }
        if (this.particleRain) {
            this.particleRain.destroy();
            this.particleRain = undefined;
        }
    }
}
