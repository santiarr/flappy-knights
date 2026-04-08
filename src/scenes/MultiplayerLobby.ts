import { Scene } from 'phaser';
import { GAME, SAFE_ZONE } from '../core/Constants';
import { createRoom, joinRoom, quickMatch, onJoin, getIsHost, getMyId } from '../multiplayer/playroom';

const ARCADE_FONT = '"Courier New", Courier, monospace';
const TITLE_COLOR = '#ffd700';
const SUB_COLOR = '#daa520';
const MUTED_COLOR = '#888888';

export class MultiplayerLobby extends Scene {
    private elements: Phaser.GameObjects.GameObject[] = [];
    private playerCount = 0;
    private roomCode = '';
    private codeInput = '';
    private transitioned = false;

    constructor() {
        super('MultiplayerLobby');
    }

    create(): void {
        this.cameras.main.setBackgroundColor(GAME.BACKGROUND_COLOR);
        this.playerCount = 0;
        this.transitioned = false;
        this.roomCode = '';
        this.codeInput = '';

        // Cave background
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
    }

    // ========================================
    // MENU
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

        y += 80;

        const createBtn = this.createButton(cx, y, 'CREATE ROOM', 260, 46, async () => {
            try {
                this.showConnecting();
                this.roomCode = await createRoom();
                this.showWaiting();
            } catch (err) {
                console.error('Failed to create room:', err);
                this.showMenu();
            }
        });
        this.elements.push(createBtn);

        y += 60;

        const joinBtn = this.createButton(cx, y, 'JOIN ROOM', 260, 46, () => {
            this.showJoining();
        });
        this.elements.push(joinBtn);

        y += 60;

        const quickBtn = this.createButton(cx, y, 'QUICK MATCH', 260, 46, async () => {
            try {
                this.showConnecting();
                this.roomCode = await quickMatch();
                this.showWaiting();
            } catch (err) {
                console.error('Failed to quick match:', err);
                this.showMenu();
            }
        });
        this.elements.push(quickBtn);

        y += 80;

        const backBtn = this.createButton(cx, y, 'BACK', 160, 40, () => {
            this.scene.start('TitleScreen');
        });
        this.elements.push(backBtn);
    }

    // ========================================
    // CONNECTING (brief loading state)
    // ========================================
    private showConnecting(): void {
        this.clearAll();

        const cx = GAME.WIDTH * 0.5;
        const title = this.add.text(cx, GAME.HEIGHT * 0.45, 'CONNECTING...', {
            fontFamily: ARCADE_FONT, fontSize: '28px', color: TITLE_COLOR,
            stroke: '#000000', strokeThickness: 6, fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(10);
        this.elements.push(title);

        this.tweens.add({
            targets: title, alpha: 0.5, duration: 800,
            yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        });
    }

    // ========================================
    // WAITING (room created, show code)
    // ========================================
    private showWaiting(): void {
        this.clearAll();
        this.playerCount = 0;
        this.transitioned = false;

        const cx = GAME.WIDTH * 0.5;
        let y = SAFE_ZONE.TOP + 50;

        const title = this.add.text(cx, y, 'WAITING FOR OPPONENT', {
            fontFamily: ARCADE_FONT, fontSize: '24px', color: TITLE_COLOR,
            stroke: '#000000', strokeThickness: 6, fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(10);
        this.elements.push(title);

        this.tweens.add({
            targets: title, alpha: 0.5, duration: 1000,
            yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        });

        y += 80;

        // Room code display
        const codeText = this.add.text(cx, y, this.roomCode, {
            fontFamily: ARCADE_FONT, fontSize: '48px', color: TITLE_COLOR,
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
            this.showMenu();
        });
        this.elements.push(cancelBtn);

        // Listen for players — count self as already in
        this.playerCount = 1;
        onJoin((player) => {
            if (player.isMe) return; // already counted
            console.log('[LOBBY] Player joined:', player.id);
            this.playerCount++;
            if (this.playerCount >= 2 && !this.transitioned) {
                this.transitioned = true;
                this.scene.start('MultiplayerGame', {
                    isHost: getIsHost(),
                    myId: getMyId(),
                });
            }
        });
    }

    // ========================================
    // JOIN ROOM (enter code)
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

        const boxW = 280;
        const boxH = 60;
        const boxCenterY = y;
        const boxTop = boxCenterY - boxH * 0.5;

        const boxGraphics = this.add.graphics();
        boxGraphics.fillStyle(0x1a1a3a);
        boxGraphics.fillRoundedRect(cx - boxW * 0.5, boxTop, boxW, boxH, 6);
        boxGraphics.lineStyle(2, 0x7777cc);
        boxGraphics.strokeRoundedRect(cx - boxW * 0.5, boxTop, boxW, boxH, 6);
        this.elements.push(boxGraphics);

        const inputText = this.add.text(cx, boxCenterY, '', {
            fontFamily: ARCADE_FONT, fontSize: '28px', color: TITLE_COLOR,
            fontStyle: 'bold', letterSpacing: 6,
        }).setOrigin(0.5).setDepth(10);
        this.elements.push(inputText);

        y += boxH * 0.5 + 20;

        const hint = this.add.text(cx, y, 'Type the room code, then tap JOIN', {
            fontFamily: ARCADE_FONT, fontSize: '12px', color: MUTED_COLOR,
        }).setOrigin(0.5).setDepth(10);
        this.elements.push(hint);

        y += 40;

        // Hidden HTML input for mobile keyboard
        const htmlInput = document.createElement('input');
        htmlInput.type = 'text';
        htmlInput.autocomplete = 'off';
        htmlInput.autocapitalize = 'off';
        htmlInput.maxLength = 6;
        htmlInput.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);opacity:0.01;width:1px;height:1px;font-size:16px;z-index:9999;';
        document.body.appendChild(htmlInput);
        htmlInput.focus();

        boxGraphics.setInteractive(
            new Phaser.Geom.Rectangle(cx - boxW * 0.5, boxTop, boxW, boxH),
            Phaser.Geom.Rectangle.Contains
        );
        boxGraphics.on('pointerdown', () => htmlInput.focus());

        htmlInput.addEventListener('input', () => {
            this.codeInput = htmlInput.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 6);
            htmlInput.value = this.codeInput;
            inputText.setText(this.codeInput);
        });

        const submitCode = async () => {
            if (this.codeInput.length < 4) return;
            try {
                htmlInput.remove();
                this.showConnecting();
                await joinRoom(this.codeInput);
                this.roomCode = this.codeInput;
                this.showWaiting();
            } catch (err) {
                console.error('Failed to join room:', err);
                hint.setText('Room not found. Try again.');
                hint.setColor('#ff4444');
                this.showJoining();
            }
        };

        htmlInput.addEventListener('keydown', (event: KeyboardEvent) => {
            if (event.key === 'Enter') submitCode();
        });

        const joinBtn = this.createButton(cx, y, 'JOIN', 180, 42, () => submitCode());
        this.elements.push(joinBtn);

        y += 55;

        const cancelBtn = this.createButton(cx, y, 'CANCEL', 180, 42, () => {
            htmlInput.remove();
            this.showMenu();
        });
        this.elements.push(cancelBtn);

        // Clean up HTML input on state change
        const origClear = this.clearAll.bind(this);
        this.clearAll = () => {
            htmlInput.remove();
            origClear();
        };
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
