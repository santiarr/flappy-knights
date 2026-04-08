import { Scene } from 'phaser';
import { GAME, SAFE_ZONE } from '../core/Constants';
import { initPlayroom, onJoin, getIsHost, getMyId } from '../multiplayer/playroom';

const ARCADE_FONT = '"Courier New", Courier, monospace';
const TITLE_COLOR = '#ffd700';

export class MultiplayerLobby extends Scene {
    private elements: Phaser.GameObjects.GameObject[] = [];
    private playerCount = 0;

    constructor() {
        super('MultiplayerLobby');
    }

    create(): void {
        this.cameras.main.setBackgroundColor(GAME.BACKGROUND_COLOR);
        this.playerCount = 0;

        // Cave background tiles (same as TitleScreen)
        const tileSize = 48;
        for (let y = 0; y < GAME.HEIGHT; y += tileSize) {
            for (let x = 0; x < GAME.WIDTH; x += tileSize) {
                const variant = (Math.floor(x / tileSize) + Math.floor(y / tileSize)) % 3;
                this.add.image(x + tileSize * 0.5, y + tileSize * 0.5, `cave_tile_${variant}`)
                    .setDepth(-10).setAlpha(0.5);
            }
        }

        this.showMenu();
    }

    private clearAll(): void {
        for (const el of this.elements) el.destroy();
        this.elements = [];
    }

    // ========================================
    // STATE: Menu
    // ========================================
    private showMenu(): void {
        this.clearAll();

        const cx = GAME.WIDTH * 0.5;
        let y = SAFE_ZONE.TOP + 50;

        const title = this.add.text(cx, y, 'MULTIPLAYER', {
            fontFamily: ARCADE_FONT, fontSize: '36px', color: TITLE_COLOR,
            stroke: '#000000', strokeThickness: 6, fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(10);
        this.elements.push(title);

        y += 100;

        const playBtn = this.createButton(cx, y, 'PLAY ONLINE', 260, 46, async () => {
            try {
                await initPlayroom();
                this.showWaiting();
            } catch (err) {
                console.error('[LOBBY] Failed to init Playroom:', err);
            }
        });
        this.elements.push(playBtn);

        y += 70;

        const backBtn = this.createButton(cx, y, 'BACK', 160, 40, () => {
            this.scene.start('TitleScreen');
        });
        this.elements.push(backBtn);
    }

    // ========================================
    // STATE: Waiting for opponent
    // ========================================
    private showWaiting(): void {
        this.clearAll();
        this.playerCount = 0;

        const cx = GAME.WIDTH * 0.5;
        const y = SAFE_ZONE.TOP + 80;

        const title = this.add.text(cx, y, 'WAITING FOR OPPONENT...', {
            fontFamily: ARCADE_FONT, fontSize: '24px', color: TITLE_COLOR,
            stroke: '#000000', strokeThickness: 6, fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(10);
        this.elements.push(title);

        // Pulsing animation
        this.tweens.add({
            targets: title, alpha: 0.5, duration: 1000,
            yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        });

        // Track players joining
        onJoin((player) => {
            console.log('[LOBBY] Player joined:', player.id, player.isMe ? '(me)' : '');
            this.playerCount++;

            if (this.playerCount >= 2) {
                console.log('[LOBBY] 2 players joined, starting game');
                this.scene.start('MultiplayerGame', {
                    isHost: getIsHost(),
                    myId: getMyId(),
                });
            }
        });
    }

    // ========================================
    // Helpers
    // ========================================
    private createButton(
        x: number, y: number, label: string,
        w: number, h: number, onClick: () => void,
    ): Phaser.GameObjects.Container {
        const bg = this.add.graphics();
        bg.fillStyle(0x2a2a5a);
        bg.fillRoundedRect(-w * 0.5, -h * 0.5, w, h, 6);
        bg.lineStyle(2, 0x5555aa);
        bg.strokeRoundedRect(-w * 0.5, -h * 0.5, w, h, 6);

        const text = this.add.text(0, 0, label, {
            fontFamily: ARCADE_FONT, fontSize: `${Math.min(18, h * 0.4)}px`,
            color: TITLE_COLOR, fontStyle: 'bold',
        }).setOrigin(0.5);

        const container = this.add.container(x, y, [bg, text]);
        container.setSize(w, h);
        container.setInteractive({ useHandCursor: true }).setDepth(10);

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
        this.clearAll();
    }
}
