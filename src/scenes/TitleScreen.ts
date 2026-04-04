import Phaser, { Scene } from 'phaser';
import { GAME, SAFE_ZONE, IS_TOUCH } from '../core/Constants';

const ARCADE_FONT = '"Courier New", Courier, monospace';
const TITLE_COLOR = '#ffd700';
const SUB_COLOR = '#daa520';
const BODY_COLOR = '#cccccc';
const MUTED_COLOR = '#888888';
const KEY_COLOR = '#ffdd44';

export class TitleScreen extends Scene {
    constructor() {
        super('TitleScreen');
    }

    create(): void {
        this.cameras.main.setBackgroundColor(GAME.BACKGROUND_COLOR);

        // Draw cave background tiles
        const tileSize = 48;
        for (let y = 0; y < GAME.HEIGHT; y += tileSize) {
            for (let x = 0; x < GAME.WIDTH; x += tileSize) {
                const variant = (Math.floor(x / tileSize) + Math.floor(y / tileSize)) % 3;
                this.add.image(x + tileSize * 0.5, y + tileSize * 0.5, `cave_tile_${variant}`)
                    .setDepth(-10).setAlpha(0.5);
            }
        }

        const cx = GAME.WIDTH * 0.5;
        const safeTop = SAFE_ZONE.TOP;
        let y = safeTop + 30;

        // Title
        const title = this.add.text(cx, y, 'FLAPPY KNIGHTS', {
            fontFamily: ARCADE_FONT,
            fontSize: '44px',
            color: TITLE_COLOR,
            stroke: '#000000',
            strokeThickness: 8,
            fontStyle: 'bold',
            align: 'center',
        }).setOrigin(0.5).setDepth(10);

        // Subtle title glow pulse
        this.tweens.add({
            targets: title,
            alpha: 0.7,
            duration: 1500,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
        });

        y += 50;

        // Subtitle
        this.add.text(cx, y, 'AERIAL LANCE COMBAT', {
            fontFamily: ARCADE_FONT,
            fontSize: '16px',
            color: SUB_COLOR,
            letterSpacing: 6,
        }).setOrigin(0.5).setDepth(10);

        y += 45;

        // --- Two-column layout for landscape: left = controls, right = combat/enemies ---
        const leftCol = GAME.WIDTH * 0.28;
        const rightCol = GAME.WIDTH * 0.72;
        let leftY = y;
        let rightY = y;

        // --- Left column: Controls ---
        this.add.text(leftCol, leftY, '-- HOW TO PLAY --', {
            fontFamily: ARCADE_FONT,
            fontSize: '14px',
            color: TITLE_COLOR,
            fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(10);

        leftY += 30;

        // Platform-specific controls
        const controls: [string, string][] = IS_TOUCH
            ? [
                ['JOYSTICK', 'Move left / right'],
                ['TAP', 'Flap to fly'],
            ]
            : [
                ['<- ->', 'Move left / right'],
                ['SPACE', 'Flap to fly'],
                ['R', 'Restart (game over)'],
            ];

        for (const [key, desc] of controls) {
            this.add.text(leftCol - 70, leftY, key, {
                fontFamily: ARCADE_FONT,
                fontSize: '13px',
                color: KEY_COLOR,
                fontStyle: 'bold',
            }).setOrigin(1, 0.5).setDepth(10);

            this.add.text(leftCol - 50, leftY, desc, {
                fontFamily: ARCADE_FONT,
                fontSize: '12px',
                color: BODY_COLOR,
            }).setOrigin(0, 0.5).setDepth(10);

            leftY += 26;
        }

        leftY += 10;

        // Combat rules in left column
        this.add.text(leftCol, leftY, '-- COMBAT --', {
            fontFamily: ARCADE_FONT,
            fontSize: '14px',
            color: TITLE_COLOR,
            fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(10);

        leftY += 28;

        const rules = [
            'Collide with enemies to fight.',
            'The HIGHER rider wins!',
            'Defeated foes drop eggs --',
            'collect them for bonus points',
            'before they hatch!',
        ];

        for (const line of rules) {
            this.add.text(leftCol, leftY, line, {
                fontFamily: ARCADE_FONT,
                fontSize: '11px',
                color: BODY_COLOR,
            }).setOrigin(0.5).setDepth(10);
            leftY += 18;
        }

        // --- Right column: Enemies ---
        this.add.text(rightCol, rightY, '-- ENEMIES --', {
            fontFamily: ARCADE_FONT,
            fontSize: '14px',
            color: TITLE_COLOR,
            fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(10);

        rightY += 30;

        const enemies: [string, string, string][] = [
            ['BOUNDER', '#cc3333', 'Slow, patrols platforms'],
            ['HUNTER', '#888888', 'Flanks, avoids cliffs'],
            ['SHADOW LORD', '#5577ee', 'Fast, ambushes from above'],
        ];

        for (const [name, color, desc] of enemies) {
            this.add.text(rightCol - 60, rightY, name, {
                fontFamily: ARCADE_FONT,
                fontSize: '12px',
                color: color,
                fontStyle: 'bold',
            }).setOrigin(1, 0.5).setDepth(10);

            this.add.text(rightCol - 40, rightY, desc, {
                fontFamily: ARCADE_FONT,
                fontSize: '11px',
                color: MUTED_COLOR,
            }).setOrigin(0, 0.5).setDepth(10);

            rightY += 24;
        }

        rightY += 15;

        // Warnings
        this.add.text(rightCol, rightY, 'Watch out for the PTERODACTYL', {
            fontFamily: ARCADE_FONT,
            fontSize: '11px',
            color: '#ff6644',
        }).setOrigin(0.5).setDepth(10);
        rightY += 18;
        this.add.text(rightCol, rightY, 'and the LAVA TROLL below!', {
            fontFamily: ARCADE_FONT,
            fontSize: '11px',
            color: '#ff6644',
        }).setOrigin(0.5).setDepth(10);

        // --- Bottom: Start prompt ---
        const bottomY = GAME.HEIGHT * 0.85;

        const startLabel = IS_TOUCH ? '[ TAP TO START ]' : '[ PRESS SPACE OR TAP TO START ]';
        const startText = this.add.text(cx, bottomY, startLabel, {
            fontFamily: ARCADE_FONT,
            fontSize: '16px',
            color: TITLE_COLOR,
            fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(10);

        this.tweens.add({
            targets: startText,
            alpha: 0.3,
            duration: 800,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
        });

        // --- Input to start ---
        if (this.input.keyboard) {
            this.input.keyboard.once('keydown-SPACE', () => {
                this.startGame();
            });
        }

        this.input.once('pointerdown', () => {
            this.startGame();
        });
    }

    private startGame(): void {
        this.cameras.main.fadeOut(300, 0, 0, 0);
        this.time.delayedCall(300, () => {
            this.scene.start('Game');
        });
    }
}
