import { Scene } from 'phaser';
import { GAME, SAFE_ZONE } from '../core/Constants';
import { connection } from '../multiplayer/connection';
import { generateRoomCode } from '../multiplayer/types';
import type { ServerMessage } from '../multiplayer/types';

const ARCADE_FONT = '"Courier New", Courier, monospace';
const TITLE_COLOR = '#ffd700';
const SUB_COLOR = '#daa520';
const BODY_COLOR = '#cccccc';
const MUTED_COLOR = '#888888';

export class MultiplayerLobby extends Scene {
    private elements: Phaser.GameObjects.GameObject[] = [];
    private localPlayerId = '';
    private roomCode = '';
    private codeInput = '';
    private messageHandler: ((msg: ServerMessage) => void) | null = null;
    private dotTimer?: Phaser.Time.TimerEvent;

    constructor() {
        super('MultiplayerLobby');
    }

    create(): void {
        this.cameras.main.setBackgroundColor(GAME.BACKGROUND_COLOR);

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
        if (this.input.keyboard) this.input.keyboard.removeAllListeners();
        if (this.messageHandler) {
            connection.offMessage(this.messageHandler);
            this.messageHandler = null;
        }
        if (this.dotTimer) {
            this.dotTimer.destroy();
            this.dotTimer = undefined;
        }
    }

    // ========================================
    // STATE: Menu
    // ========================================
    private showMenu(): void {
        this.clearAll();
        this.codeInput = '';

        const cx = GAME.WIDTH * 0.5;
        let y = SAFE_ZONE.TOP + 50;

        const title = this.add.text(cx, y, 'MULTIPLAYER', {
            fontFamily: ARCADE_FONT, fontSize: '36px', color: TITLE_COLOR,
            stroke: '#000000', strokeThickness: 6, fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(10);
        this.elements.push(title);

        y += 80;

        const createBtn = this.createButton(cx, y, 'CREATE ROOM', 260, 46, () => {
            this.roomCode = generateRoomCode();
            connection.connect(this.roomCode);
            this.showWaiting();
        });
        this.elements.push(createBtn);

        y += 60;

        const joinBtn = this.createButton(cx, y, 'JOIN ROOM', 260, 46, () => {
            this.showJoining();
        });
        this.elements.push(joinBtn);

        y += 60;

        const quickBtn = this.createButton(cx, y, 'QUICK MATCH', 260, 46, () => {
            connection.connectMatchmaking();
            this.showSearching();
        });
        this.elements.push(quickBtn);

        y += 80;

        const backBtn = this.createButton(cx, y, 'BACK', 160, 40, () => {
            connection.disconnect();
            this.scene.start('TitleScreen');
        });
        this.elements.push(backBtn);
    }

    // ========================================
    // STATE: Waiting (created room)
    // ========================================
    private showWaiting(): void {
        this.clearAll();

        const cx = GAME.WIDTH * 0.5;
        let y = SAFE_ZONE.TOP + 50;

        const title = this.add.text(cx, y, 'WAITING FOR OPPONENT', {
            fontFamily: ARCADE_FONT, fontSize: '28px', color: TITLE_COLOR,
            stroke: '#000000', strokeThickness: 6, fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(10);
        this.elements.push(title);

        // Pulsing title
        this.tweens.add({
            targets: title, alpha: 0.5, duration: 1000,
            yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        });

        y += 80;

        // Room code display — large spaced letters
        const codeText = this.add.text(cx, y, this.roomCode.split('').join('  '), {
            fontFamily: ARCADE_FONT, fontSize: '56px', color: TITLE_COLOR,
            stroke: '#000000', strokeThickness: 8, fontStyle: 'bold',
            letterSpacing: 12,
        }).setOrigin(0.5).setDepth(10);
        this.elements.push(codeText);

        y += 50;

        const sub = this.add.text(cx, y, 'Share this code with your friend', {
            fontFamily: ARCADE_FONT, fontSize: '14px', color: SUB_COLOR,
        }).setOrigin(0.5).setDepth(10);
        this.elements.push(sub);

        y += 80;

        const cancelBtn = this.createButton(cx, y, 'CANCEL', 180, 42, () => {
            connection.disconnect();
            this.showMenu();
        });
        this.elements.push(cancelBtn);

        // Listen for server messages
        this.messageHandler = (msg: ServerMessage) => {
            if (msg.type === 'connected') {
                this.localPlayerId = msg.id;
            } else if (msg.type === 'player_joined' && msg.playerCount >= 2) {
                this.scene.start('MultiplayerGame', {
                    roomCode: this.roomCode,
                    playerId: this.localPlayerId,
                });
            }
        };
        connection.onMessage(this.messageHandler);
    }

    // ========================================
    // STATE: Joining (enter room code)
    // ========================================
    private showJoining(): void {
        this.clearAll();
        this.codeInput = '';

        const cx = GAME.WIDTH * 0.5;
        let y = SAFE_ZONE.TOP + 50;

        const title = this.add.text(cx, y, 'ENTER ROOM CODE', {
            fontFamily: ARCADE_FONT, fontSize: '28px', color: TITLE_COLOR,
            stroke: '#000000', strokeThickness: 6, fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(10);
        this.elements.push(title);

        y += 80;

        // 4 input boxes
        const boxSize = 60;
        const gap = 20;
        const totalWidth = boxSize * 4 + gap * 3;
        const startX = cx - totalWidth * 0.5 + boxSize * 0.5;

        const boxGraphics: Phaser.GameObjects.Graphics[] = [];
        const boxTexts: Phaser.GameObjects.Text[] = [];

        for (let i = 0; i < 4; i++) {
            const bx = startX + i * (boxSize + gap);

            const box = this.add.graphics();
            box.fillStyle(0x1a1a3a);
            box.fillRoundedRect(bx - boxSize * 0.5, y - boxSize * 0.5, boxSize, boxSize, 6);
            box.lineStyle(2, 0x5555aa);
            box.strokeRoundedRect(bx - boxSize * 0.5, y - boxSize * 0.5, boxSize, boxSize, 6);
            this.elements.push(box);
            boxGraphics.push(box);

            const charText = this.add.text(bx, y, '', {
                fontFamily: ARCADE_FONT, fontSize: '36px', color: TITLE_COLOR,
                fontStyle: 'bold',
            }).setOrigin(0.5).setDepth(10);
            this.elements.push(charText);
            boxTexts.push(charText);
        }

        y += boxSize * 0.5 + 30;

        const hint = this.add.text(cx, y, 'Type A-Z to enter code', {
            fontFamily: ARCADE_FONT, fontSize: '12px', color: MUTED_COLOR,
        }).setOrigin(0.5).setDepth(10);
        this.elements.push(hint);

        y += 60;

        const cancelBtn = this.createButton(cx, y, 'CANCEL', 180, 42, () => {
            connection.disconnect();
            this.showMenu();
        });
        this.elements.push(cancelBtn);

        // Keyboard input
        if (this.input.keyboard) {
            this.input.keyboard.on('keydown', (event: KeyboardEvent) => {
                const key = event.key.toUpperCase();

                if (event.key === 'Backspace' && this.codeInput.length > 0) {
                    this.codeInput = this.codeInput.slice(0, -1);
                    this.updateBoxes(boxTexts, boxGraphics, boxSize, startX, y - 90 - boxSize * 0.5, gap);
                    return;
                }

                if (this.codeInput.length >= 4) return;
                if (key.length !== 1 || key < 'A' || key > 'Z') return;

                this.codeInput += key;
                this.updateBoxes(boxTexts, boxGraphics, boxSize, startX, y - 90 - boxSize * 0.5, gap);

                // Auto-submit when 4 chars entered
                if (this.codeInput.length === 4) {
                    this.roomCode = this.codeInput;
                    connection.connect(this.roomCode);
                    this.showWaiting();
                }
            });
        }
    }

    private updateBoxes(
        texts: Phaser.GameObjects.Text[],
        graphics: Phaser.GameObjects.Graphics[],
        boxSize: number,
        startX: number,
        boxY: number,
        gap: number,
    ): void {
        for (let i = 0; i < 4; i++) {
            const bx = startX + i * (boxSize + gap);
            texts[i].setText(this.codeInput[i] ?? '');

            const filled = i < this.codeInput.length;
            const active = i === this.codeInput.length;
            graphics[i].clear();
            graphics[i].fillStyle(filled ? 0x2a2a5a : 0x1a1a3a);
            graphics[i].fillRoundedRect(bx - boxSize * 0.5, boxY, boxSize, boxSize, 6);
            graphics[i].lineStyle(2, active ? 0x7777cc : 0x5555aa);
            graphics[i].strokeRoundedRect(bx - boxSize * 0.5, boxY, boxSize, boxSize, 6);
        }
    }

    // ========================================
    // STATE: Searching (quick match)
    // ========================================
    private showSearching(): void {
        this.clearAll();

        const cx = GAME.WIDTH * 0.5;
        let y = SAFE_ZONE.TOP + 80;

        const title = this.add.text(cx, y, 'SEARCHING', {
            fontFamily: ARCADE_FONT, fontSize: '32px', color: TITLE_COLOR,
            stroke: '#000000', strokeThickness: 6, fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(10);
        this.elements.push(title);

        // Animated dots
        let dots = 0;
        this.dotTimer = this.time.addEvent({
            delay: 500,
            loop: true,
            callback: () => {
                dots = (dots + 1) % 4;
                title.setText('SEARCHING' + '.'.repeat(dots));
            },
        });

        y += 50;

        const sub = this.add.text(cx, y, 'Looking for an opponent...', {
            fontFamily: ARCADE_FONT, fontSize: '14px', color: SUB_COLOR,
        }).setOrigin(0.5).setDepth(10);
        this.elements.push(sub);

        y += 80;

        const cancelBtn = this.createButton(cx, y, 'CANCEL', 180, 42, () => {
            connection.disconnect();
            this.showMenu();
        });
        this.elements.push(cancelBtn);

        // Listen for matchmaking result
        this.messageHandler = (msg: ServerMessage) => {
            if (msg.type === 'matched') {
                this.roomCode = msg.roomCode;
                connection.disconnect();
                connection.connect(this.roomCode);
                this.showWaiting();
            } else if (msg.type === 'connected') {
                this.localPlayerId = msg.id;
            }
        };
        connection.onMessage(this.messageHandler);
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
        connection.disconnect();
    }
}
