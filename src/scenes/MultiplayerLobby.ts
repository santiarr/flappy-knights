import { Scene } from 'phaser';
import { GAME, SAFE_ZONE } from '../core/Constants';
import { connection } from '../multiplayer/connection';

const ARCADE_FONT = '"Courier New", Courier, monospace';
const TITLE_COLOR = '#ffd700';
const SUB_COLOR = '#daa520';
const MUTED_COLOR = '#888888';

export class MultiplayerLobby extends Scene {
    private elements: Phaser.GameObjects.GameObject[] = [];
    private localPlayerId = '';
    private roomCode = '';
    private codeInput = '';
    private eventHandler: ((type: string, data: any) => void) | null = null;
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
        if (this.eventHandler) {
            connection.offEvent(this.eventHandler);
            this.eventHandler = null;
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

        const createBtn = this.createButton(cx, y, 'CREATE ROOM', 260, 46, async () => {
            try {
                const room = await connection.createRoom();
                this.localPlayerId = room.sessionId;
                this.roomCode = room.roomId;
                this.showWaiting();
            } catch (err) {
                console.error('Failed to create room:', err);
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
            this.showSearching();
            try {
                const room = await connection.quickMatch();
                this.localPlayerId = room.sessionId;
                this.roomCode = room.roomId;
                this.showWaiting();
            } catch (err) {
                console.error('Failed to quick match:', err);
                this.showMenu();
            }
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
    // STATE: Waiting (created room or joined)
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

        // Room code display — show exact roomId (case-sensitive!)
        const codeText = this.add.text(cx, y, this.roomCode.split('').join('  '), {
            fontFamily: ARCADE_FONT, fontSize: '40px', color: TITLE_COLOR,
            stroke: '#000000', strokeThickness: 8, fontStyle: 'bold',
            letterSpacing: 8,
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

        // Listen for state changes via room — when 2 players are in, start the game
        const room = connection.getRoom();
        if (room) {
            // Check if players collection exists on state and listen for additions
            const checkPlayers = () => {
                if (room.state && room.state.players && room.state.players.size >= 2) {
                    this.scene.start('MultiplayerGame', {
                        localPlayerId: this.localPlayerId,
                        roomCode: this.roomCode,
                    });
                }
            };

            // Listen for player_joined via server message
            this.eventHandler = (type: string, _data: any) => {
                if (type === 'player_joined') {
                    checkPlayers();
                }
            };
            connection.onEvent(this.eventHandler);

            // Also listen via onStateChange for broader compatibility
            room.onStateChange(() => {
                checkPlayers();
            });

            // Check immediately in case both players are already in
            checkPlayers();
        }
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

        // Single text input box for Colyseus room IDs (alphanumeric, up to 9 chars)
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

        const hint = this.add.text(cx, y, 'Type the code exactly as shown (case-sensitive)', {
            fontFamily: ARCADE_FONT, fontSize: '12px', color: MUTED_COLOR,
        }).setOrigin(0.5).setDepth(10);
        this.elements.push(hint);

        y += 40;

        // Hidden HTML input for mobile keyboard support
        const htmlInput = document.createElement('input');
        htmlInput.type = 'text';
        htmlInput.autocomplete = 'off';
        htmlInput.autocapitalize = 'off';
        htmlInput.maxLength = 9;
        htmlInput.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);opacity:0.01;width:1px;height:1px;font-size:16px;z-index:9999;';
        document.body.appendChild(htmlInput);
        htmlInput.focus();

        // Tap on box to refocus (mobile)
        boxGraphics.setInteractive(
            new Phaser.Geom.Rectangle(cx - boxW * 0.5, boxTop, boxW, boxH),
            Phaser.Geom.Rectangle.Contains
        );
        boxGraphics.on('pointerdown', () => htmlInput.focus());

        // Sync HTML input to Phaser text
        htmlInput.addEventListener('input', () => {
            this.codeInput = htmlInput.value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 9);
            htmlInput.value = this.codeInput;
            inputText.setText(this.codeInput);
        });

        const submitCode = async () => {
            if (this.codeInput.length < 3) return;
            try {
                const room = await connection.joinRoom(this.codeInput);
                this.localPlayerId = room.sessionId;
                this.roomCode = room.roomId;
                htmlInput.remove();
                this.showWaiting();
            } catch (err) {
                console.error('Failed to join room:', err);
                hint.setText('Room not found. Try again.');
                hint.setColor('#ff4444');
            }
        };

        htmlInput.addEventListener('keydown', async (event: KeyboardEvent) => {
            if (event.key === 'Enter') submitCode();
        });

        // JOIN button
        const joinBtn = this.createButton(cx, y, 'JOIN', 180, 42, () => submitCode());
        this.elements.push(joinBtn);

        y += 55;

        // CANCEL button
        const cancelBtn = this.createButton(cx, y, 'CANCEL', 180, 42, () => {
            htmlInput.remove();
            connection.disconnect();
            this.showMenu();
        });
        this.elements.push(cancelBtn);

        // Clean up HTML input when leaving this state
        const origClear = this.clearAll.bind(this);
        this.clearAll = () => {
            htmlInput.remove();
            origClear();
        };
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
