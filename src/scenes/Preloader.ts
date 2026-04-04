import { Scene } from 'phaser';
import { GAME } from '../core/Constants';
import { renderPixelArt, renderSpriteSheet } from '../core/PixelRenderer';
import { PALETTE } from '../sprites/palette';
import { PLAYER_FRAMES } from '../sprites/player';
import { BOUNDER_FRAMES, HUNTER_FRAMES, SHADOW_LORD_FRAMES } from '../sprites/enemies';
import { EGG_PIXELS } from '../sprites/items';
import { PLATFORM_TILE, CAVE_TILES } from '../sprites/tiles';
import { PTERODACTYL_FRAMES } from '../sprites/pterodactyl';

export class Preloader extends Scene {
    constructor() {
        super('Preloader');
    }

    create(): void {
        // Loading text
        const text = this.add.text(GAME.WIDTH * 0.5, GAME.HEIGHT * 0.5, 'Loading...', {
            fontFamily: 'Arial',
            fontSize: '24px',
            color: '#ffffff',
        }).setOrigin(0.5);

        // Generate pixel art textures
        renderSpriteSheet(this, PLAYER_FRAMES, PALETTE, 'player_sheet', 3);
        renderSpriteSheet(this, BOUNDER_FRAMES, PALETTE, 'enemy_bounder_sheet', 3);
        renderSpriteSheet(this, HUNTER_FRAMES, PALETTE, 'enemy_hunter_sheet', 3);
        renderSpriteSheet(this, SHADOW_LORD_FRAMES, PALETTE, 'enemy_shadow_lord_sheet', 3);
        renderPixelArt(this, EGG_PIXELS, PALETTE, 'egg', 3);
        renderPixelArt(this, PLATFORM_TILE, PALETTE, 'platform_tile', 3);
        renderSpriteSheet(this, PTERODACTYL_FRAMES, PALETTE, 'pterodactyl_sheet', 3);

        // Cave background tiles
        CAVE_TILES.forEach((tile, i) => {
            renderPixelArt(this, tile, PALETTE, `cave_tile_${i}`, 3);
        });

        // Register animations
        this.anims.create({
            key: 'player_flap',
            frames: this.anims.generateFrameNumbers('player_sheet', { start: 0, end: 1 }),
            frameRate: 10,
            repeat: 0,
        });

        this.anims.create({
            key: 'enemy_bounder_flap',
            frames: this.anims.generateFrameNumbers('enemy_bounder_sheet', { start: 0, end: 1 }),
            frameRate: 8,
            repeat: 0,
        });

        this.anims.create({
            key: 'enemy_hunter_flap',
            frames: this.anims.generateFrameNumbers('enemy_hunter_sheet', { start: 0, end: 1 }),
            frameRate: 8,
            repeat: 0,
        });

        this.anims.create({
            key: 'enemy_shadow_lord_flap',
            frames: this.anims.generateFrameNumbers('enemy_shadow_lord_sheet', { start: 0, end: 1 }),
            frameRate: 8,
            repeat: 0,
        });

        this.anims.create({
            key: 'pterodactyl_flap',
            frames: this.anims.generateFrameNumbers('pterodactyl_sheet', { start: 0, end: 1 }),
            frameRate: 10,
            repeat: 0,
        });

        // Generate particle texture (simple white circle)
        const pg = this.add.graphics();
        pg.fillStyle(0xffffff);
        pg.fillCircle(4, 4, 4);
        pg.generateTexture('particle', 8, 8);
        pg.destroy();

        text.destroy();

        // Go to title screen
        this.scene.start('TitleScreen');
    }
}
