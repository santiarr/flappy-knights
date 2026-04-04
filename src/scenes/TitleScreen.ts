import Phaser, { Scene } from 'phaser';
import { GAME, SAFE_ZONE, COLORS } from '../core/Constants';

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
        let y = safeTop + 60;

        // Title
        const title = this.add.text(cx, y, 'FLAPPY\nKNIGHTS', {
            fontFamily: ARCADE_FONT,
            fontSize: '50px',
            color: TITLE_COLOR,
            stroke: '#000000',
            strokeThickness: 8,
            fontStyle: 'bold',
            align: 'center',
            lineSpacing: -5,
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

        y += 80;

        // Subtitle
        this.add.text(cx, y, 'AERIAL LANCE COMBAT', {
            fontFamily: ARCADE_FONT,
            fontSize: '18px',
            color: SUB_COLOR,
            letterSpacing: 6,
        }).setOrigin(0.5).setDepth(10);

        y += 70;

        // --- Tutorial section ---
        this.add.text(cx, y, '— HOW TO PLAY —', {
            fontFamily: ARCADE_FONT,
            fontSize: '16px',
            color: TITLE_COLOR,
            fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(10);

        y += 40;

        // Controls
        const controls = [
            ['← →', 'Move left / right'],
            ['SPACE', 'Flap to fly'],
            ['R', 'Restart (game over)'],
        ];

        for (const [key, desc] of controls) {
            this.add.text(cx - 100, y, key, {
                fontFamily: ARCADE_FONT,
                fontSize: '15px',
                color: KEY_COLOR,
                fontStyle: 'bold',
            }).setOrigin(1, 0.5).setDepth(10);

            this.add.text(cx - 80, y, desc, {
                fontFamily: ARCADE_FONT,
                fontSize: '14px',
                color: BODY_COLOR,
            }).setOrigin(0, 0.5).setDepth(10);

            y += 30;
        }

        y += 15;

        // Combat rules
        this.add.text(cx, y, '— COMBAT —', {
            fontFamily: ARCADE_FONT,
            fontSize: '16px',
            color: TITLE_COLOR,
            fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(10);

        y += 35;

        const rules = [
            'Collide with enemies to fight.',
            'The HIGHER rider wins!',
            'Defeated foes drop eggs —',
            'collect them for bonus points',
            'before they hatch!',
        ];

        for (const line of rules) {
            this.add.text(cx, y, line, {
                fontFamily: ARCADE_FONT,
                fontSize: '13px',
                color: BODY_COLOR,
            }).setOrigin(0.5).setDepth(10);
            y += 22;
        }

        y += 15;

        // Enemy types
        this.add.text(cx, y, '— ENEMIES —', {
            fontFamily: ARCADE_FONT,
            fontSize: '16px',
            color: TITLE_COLOR,
            fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(10);

        y += 35;

        const enemies: [string, string, string][] = [
            ['BOUNDER', '#cc3333', 'Slow, patrols platforms'],
            ['HUNTER', '#888888', 'Flanks, avoids cliffs'],
            ['SHADOW LORD', '#5577ee', 'Fast, ambushes from above'],
        ];

        for (const [name, color, desc] of enemies) {
            this.add.text(cx - 80, y, name, {
                fontFamily: ARCADE_FONT,
                fontSize: '13px',
                color: color,
                fontStyle: 'bold',
            }).setOrigin(1, 0.5).setDepth(10);

            this.add.text(cx - 60, y, desc, {
                fontFamily: ARCADE_FONT,
                fontSize: '12px',
                color: MUTED_COLOR,
            }).setOrigin(0, 0.5).setDepth(10);

            y += 24;
        }

        y += 20;

        // Warnings
        this.add.text(cx, y, 'Watch out for the PTERODACTYL', {
            fontFamily: ARCADE_FONT,
            fontSize: '12px',
            color: '#ff6644',
        }).setOrigin(0.5).setDepth(10);
        y += 20;
        this.add.text(cx, y, 'and the LAVA TROLL below!', {
            fontFamily: ARCADE_FONT,
            fontSize: '12px',
            color: '#ff6644',
        }).setOrigin(0.5).setDepth(10);

        y += 50;

        // Start prompt
        const startText = this.add.text(cx, y, '[ PRESS SPACE OR TAP TO START ]', {
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

        y += 40;

        // Touch hint
        this.add.text(cx, y, 'Touch: tap left half = flap left, right = flap right', {
            fontFamily: ARCADE_FONT,
            fontSize: '11px',
            color: MUTED_COLOR,
        }).setOrigin(0.5).setDepth(10);

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
