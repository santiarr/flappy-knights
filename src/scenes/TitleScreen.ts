import Phaser, { Scene } from 'phaser';
import { GAME, SAFE_ZONE, IS_TOUCH } from '../core/Constants';
import { capture } from '../analytics';
import { audioManager } from '../audio/AudioManager';

const ARCADE_FONT = '"Courier New", Courier, monospace';
const TITLE_COLOR = '#ffd700';
const SUB_COLOR = '#daa520';
const BODY_COLOR = '#cccccc';
const MUTED_COLOR = '#888888';
const KEY_COLOR = '#ffdd44';
const TUTORIAL_KEY = 'flappy_knights_tutorial_done';

function isFirstPlay(): boolean {
    try { return !localStorage.getItem(TUTORIAL_KEY); } catch { return true; }
}

function markTutorialDone(): void {
    try { localStorage.setItem(TUTORIAL_KEY, '1'); } catch { /* */ }
}

export class TitleScreen extends Scene {
    private showingTutorial = false;
    private tutorialElements: Phaser.GameObjects.GameObject[] = [];
    private mainElements: Phaser.GameObjects.GameObject[] = [];

    constructor() {
        super('TitleScreen');
    }

    create(): void {
        this.cameras.main.setBackgroundColor(GAME.BACKGROUND_COLOR);
        this.showingTutorial = false;
        this.tutorialElements = [];
        this.mainElements = [];

        // Cave background
        const tileSize = 48;
        for (let y = 0; y < GAME.HEIGHT; y += tileSize) {
            for (let x = 0; x < GAME.WIDTH; x += tileSize) {
                const variant = (Math.floor(x / tileSize) + Math.floor(y / tileSize)) % 3;
                this.add.image(x + tileSize * 0.5, y + tileSize * 0.5, `cave_tile_${variant}`)
                    .setDepth(-10).setAlpha(0.5);
            }
        }

        audioManager.startTitleMusic();

        if (isFirstPlay()) {
            markTutorialDone();
            this.scene.start('Tutorial');
            return;
        } else {
            this.showMainMenu();
        }
    }

    // ========================================
    // MAIN MENU (returning players)
    // ========================================
    private showMainMenu(): void {
        this.clearTutorial();
        this.showingTutorial = false;

        const cx = GAME.WIDTH * 0.5;
        let y = SAFE_ZONE.TOP + 50;

        // Title
        const title = this.add.text(cx, y, 'FLAPPY KNIGHTS', {
            fontFamily: ARCADE_FONT, fontSize: '44px', color: TITLE_COLOR,
            stroke: '#000000', strokeThickness: 8, fontStyle: 'bold', align: 'center',
        }).setOrigin(0.5).setDepth(10);
        this.mainElements.push(title);

        this.tweens.add({ targets: title, alpha: 0.7, duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

        y += 50;

        const sub = this.add.text(cx, y, 'AERIAL LANCE COMBAT', {
            fontFamily: ARCADE_FONT, fontSize: '16px', color: SUB_COLOR, letterSpacing: 6,
        }).setOrigin(0.5).setDepth(10);
        this.mainElements.push(sub);

        y += 70;

        // PLAY button
        const playBtn = this.createButton(cx, y, 'PLAY', 220, 50, () => this.startGame());
        this.mainElements.push(playBtn);

        y += 55;

        // MULTIPLAYER button
        const mpBtn = this.createButton(cx, y, 'MULTIPLAYER', 220, 42, () => {
            this.scene.start('MultiplayerLobby');
        });
        this.mainElements.push(mpBtn);

        y += 55;

        // HOW TO PLAY button
        const tutBtn = this.createButton(cx, y, 'HOW TO PLAY', 220, 42, () => this.startTutorialScene());
        this.mainElements.push(tutBtn);

        y += 60;

        // Quick controls hint
        const hint = IS_TOUCH
            ? 'Joystick to move | Tap to flap'
            : 'Arrow keys to move | Space to flap';
        const hintText = this.add.text(cx, y, hint, {
            fontFamily: ARCADE_FONT, fontSize: '12px', color: MUTED_COLOR,
        }).setOrigin(0.5).setDepth(10);
        this.mainElements.push(hintText);

        // Keyboard shortcut
        if (this.input.keyboard) {
            this.input.keyboard.once('keydown-SPACE', () => this.startGame());
        }
    }

    // ========================================
    // FIRST-PLAY MENU (prominent tutorial button)
    // ========================================
    private showMainMenuFirstPlay(): void {
        this.clearTutorial();
        this.showingTutorial = false;

        const cx = GAME.WIDTH * 0.5;
        let y = SAFE_ZONE.TOP + 50;

        // Title
        const title = this.add.text(cx, y, 'FLAPPY KNIGHTS', {
            fontFamily: ARCADE_FONT, fontSize: '44px', color: TITLE_COLOR,
            stroke: '#000000', strokeThickness: 8, fontStyle: 'bold', align: 'center',
        }).setOrigin(0.5).setDepth(10);
        this.mainElements.push(title);

        this.tweens.add({ targets: title, alpha: 0.7, duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

        y += 50;

        const sub = this.add.text(cx, y, 'AERIAL LANCE COMBAT', {
            fontFamily: ARCADE_FONT, fontSize: '16px', color: SUB_COLOR, letterSpacing: 6,
        }).setOrigin(0.5).setDepth(10);
        this.mainElements.push(sub);

        y += 70;

        // TUTORIAL button — prominent for first-time players
        const tutBtn = this.createButton(cx, y, 'TUTORIAL', 220, 50, () => this.startTutorialScene());
        this.mainElements.push(tutBtn);

        y += 55;

        // PLAY button
        const playBtn = this.createButton(cx, y, 'PLAY', 220, 42, () => this.startGame());
        this.mainElements.push(playBtn);

        y += 60;

        const hint = IS_TOUCH
            ? 'Joystick to move | Tap to flap'
            : 'Arrow keys to move | Space to flap';
        const hintText = this.add.text(cx, y, hint, {
            fontFamily: ARCADE_FONT, fontSize: '12px', color: MUTED_COLOR,
        }).setOrigin(0.5).setDepth(10);
        this.mainElements.push(hintText);
    }

    private startTutorialScene(): void {
        capture('tutorial started', { is_first_play: isFirstPlay() });
        this.cameras.main.fadeOut(300, 0, 0, 0);
        this.time.delayedCall(300, () => {
            this.scene.start('Tutorial');
        });
    }

    // ========================================
    // TUTORIAL VIEW (first play or button)
    // ========================================
    /** Helper: add a line with highlighted keywords */
    private addHighlightedLine(x: number, y: number, parts: { text: string; color: string; bold?: boolean }[], fontSize: string, origin: number = 0.5): void {
        // Measure total width to center
        const tempTexts = parts.map(p => this.add.text(0, 0, p.text, {
            fontFamily: ARCADE_FONT, fontSize, fontStyle: p.bold ? 'bold' : 'normal',
        }));
        const totalWidth = tempTexts.reduce((sum, t) => sum + t.width, 0);
        tempTexts.forEach(t => t.destroy());

        let curX = x - totalWidth * origin;
        for (const part of parts) {
            const t = this.add.text(curX, y, part.text, {
                fontFamily: ARCADE_FONT, fontSize, color: part.color,
                fontStyle: part.bold ? 'bold' : 'normal',
                stroke: part.bold ? '#000000' : undefined,
                strokeThickness: part.bold ? 2 : 0,
            }).setOrigin(0, 0.5).setDepth(10);
            this.tutorialElements.push(t);
            curX += t.width;
        }
    }

    private showTutorial(): void {
        this.clearMain();
        this.showingTutorial = true;
        capture('tutorial viewed', { is_first_play: isFirstPlay() });

        const cx = GAME.WIDTH * 0.5;
        const leftCol = GAME.WIDTH * 0.28;
        const rightCol = GAME.WIDTH * 0.72;

        let y = SAFE_ZONE.TOP + 30;

        // Title
        const title = this.add.text(cx, y, 'HOW TO PLAY', {
            fontFamily: ARCADE_FONT, fontSize: '36px', color: TITLE_COLOR,
            stroke: '#000000', strokeThickness: 6, fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(10);
        this.tutorialElements.push(title);

        y += 55;

        // --- Left: Controls ---
        let leftY = y;
        const ctrlTitle = this.add.text(leftCol, leftY, '-- CONTROLS --', {
            fontFamily: ARCADE_FONT, fontSize: '16px', color: TITLE_COLOR, fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(10);
        this.tutorialElements.push(ctrlTitle);
        leftY += 34;

        const controls: [string, string][] = IS_TOUCH
            ? [['JOYSTICK', 'Drag to move'], ['TAP', 'Tap anywhere to flap']]
            : [['← →', 'Move left / right'], ['SPACE', 'Flap to fly'], ['R', 'Restart (game over)'], ['M', 'Mute audio']];

        for (const [key, desc] of controls) {
            const k = this.add.text(leftCol - 60, leftY, key, {
                fontFamily: ARCADE_FONT, fontSize: '16px', color: KEY_COLOR, fontStyle: 'bold',
                stroke: '#000000', strokeThickness: 2,
            }).setOrigin(1, 0.5).setDepth(10);
            const d = this.add.text(leftCol - 40, leftY, desc, {
                fontFamily: ARCADE_FONT, fontSize: '14px', color: BODY_COLOR,
            }).setOrigin(0, 0.5).setDepth(10);
            this.tutorialElements.push(k, d);
            leftY += 30;
        }

        // --- Right: Combat ---
        let rightY = y;
        const combatTitle = this.add.text(rightCol, rightY, '-- COMBAT --', {
            fontFamily: ARCADE_FONT, fontSize: '16px', color: TITLE_COLOR, fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(10);
        this.tutorialElements.push(combatTitle);
        rightY += 34;

        // Combat rules with highlighted keywords
        this.addHighlightedLine(rightCol, rightY, [
            { text: 'Collide ', color: BODY_COLOR },
            { text: 'with enemies to fight', color: BODY_COLOR },
        ], '14px');
        rightY += 24;
        this.addHighlightedLine(rightCol, rightY, [
            { text: 'The ', color: BODY_COLOR },
            { text: 'HIGHER', color: '#44ff44', bold: true },
            { text: ' rider always wins!', color: BODY_COLOR },
        ], '14px');
        rightY += 24;
        this.addHighlightedLine(rightCol, rightY, [
            { text: 'Defeated foes drop ', color: BODY_COLOR },
            { text: 'EGGS', color: '#ffdd44', bold: true },
        ], '14px');
        rightY += 24;
        this.addHighlightedLine(rightCol, rightY, [
            { text: 'Collect eggs for ', color: BODY_COLOR },
            { text: 'BONUS POINTS', color: '#44ff44', bold: true },
        ], '14px');
        rightY += 24;
        this.addHighlightedLine(rightCol, rightY, [
            { text: 'Uncollected eggs ', color: BODY_COLOR },
            { text: 'HATCH', color: '#ff6644', bold: true },
            { text: ' tougher foes!', color: BODY_COLOR },
        ], '14px');

        // --- Bottom section: Enemies ---
        const enemyY = Math.max(leftY, rightY) + 20;
        const eTitle = this.add.text(cx, enemyY, '-- ENEMIES --', {
            fontFamily: ARCADE_FONT, fontSize: '16px', color: TITLE_COLOR, fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(10);
        this.tutorialElements.push(eTitle);

        const enemies: [string, string, string][] = [
            ['BOUNDER', '#cc3333', 'Slow patrols'],
            ['HUNTER', '#aaaaaa', 'Flanks you'],
            ['SHADOW LORD', '#5577ee', 'Ambushes from above'],
        ];

        let ex = cx - 240;
        const ey = enemyY + 30;
        for (const [name, color, desc] of enemies) {
            const n = this.add.text(ex, ey, name, {
                fontFamily: ARCADE_FONT, fontSize: '14px', color: color, fontStyle: 'bold',
                stroke: '#000000', strokeThickness: 2,
            }).setOrigin(0, 0.5).setDepth(10);
            const d = this.add.text(ex, ey + 20, desc, {
                fontFamily: ARCADE_FONT, fontSize: '12px', color: MUTED_COLOR,
            }).setOrigin(0, 0.5).setDepth(10);
            this.tutorialElements.push(n, d);
            ex += 165;
        }

        // Warning with highlights
        const warnY = ey + 48;
        this.addHighlightedLine(cx, warnY, [
            { text: 'Watch out for ', color: BODY_COLOR },
            { text: 'PTERODACTYLS', color: '#ff6644', bold: true },
            { text: ' and the ', color: BODY_COLOR },
            { text: 'LAVA TROLL', color: '#ff4422', bold: true },
            { text: '!', color: BODY_COLOR },
        ], '13px');

        // --- Buttons ---
        const btnY = GAME.HEIGHT - 55;
        if (!isFirstPlay()) {
            const backBtn = this.createButton(cx - 200, btnY, 'BACK', 120, 40, () => {
                this.showMainMenu();
            });
            this.tutorialElements.push(backBtn);

            const tutBtn = this.createButton(cx, btnY, 'PLAY TUTORIAL', 180, 40, () => {
                markTutorialDone();
                this.scene.start('Tutorial');
            });
            this.tutorialElements.push(tutBtn);

            const gotItBtn = this.createButton(cx + 200, btnY, 'PLAY!', 120, 40, () => {
                markTutorialDone();
                this.startGame();
            });
            this.tutorialElements.push(gotItBtn);
        } else {
            const tutBtn = this.createButton(cx - 130, btnY, 'PLAY TUTORIAL', 220, 45, () => {
                markTutorialDone();
                this.scene.start('Tutorial');
            });
            this.tutorialElements.push(tutBtn);

            const gotItBtn = this.createButton(cx + 130, btnY, 'SKIP — PLAY!', 220, 45, () => {
                markTutorialDone();
                this.startGame();
            });
            this.tutorialElements.push(gotItBtn);
        }

        // Keyboard shortcut
        if (this.input.keyboard) {
            this.input.keyboard.once('keydown-SPACE', () => {
                markTutorialDone();
                this.startGame();
            });
        }
    }

    // ========================================
    // Helpers
    // ========================================

    private createButton(x: number, y: number, label: string, w: number, h: number, onClick: () => void): Phaser.GameObjects.Container {
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

    private clearTutorial(): void {
        for (const el of this.tutorialElements) el.destroy();
        this.tutorialElements = [];
    }

    private clearMain(): void {
        for (const el of this.mainElements) el.destroy();
        this.mainElements = [];
        // Remove keyboard listeners
        if (this.input.keyboard) {
            this.input.keyboard.removeAllListeners();
        }
    }

    private startGame(): void {
        markTutorialDone();
        capture('game play started', { input_type: IS_TOUCH ? 'touch' : 'keyboard' });
        this.cameras.main.fadeOut(300, 0, 0, 0);
        this.time.delayedCall(300, () => {
            this.scene.start('Game');
        });
    }
}
