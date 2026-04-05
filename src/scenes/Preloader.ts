import { Scene } from 'phaser';
import { GAME } from '../core/Constants';
import { renderPixelArt, renderSpriteSheet } from '../core/PixelRenderer';
import { PALETTE } from '../sprites/palette';
import { EGG_PIXELS } from '../sprites/items';
import { PLATFORM_TILE, CAVE_TILES } from '../sprites/tiles';
import { PTERODACTYL_FRAMES } from '../sprites/pterodactyl';

export class Preloader extends Scene {
    constructor() {
        super('Preloader');
    }

    create(): void {
        // Procedural textures (egg, platforms, cave, pterodactyl)
        renderPixelArt(this, EGG_PIXELS, PALETTE, 'egg', 3);
        renderPixelArt(this, PLATFORM_TILE, PALETTE, 'platform_tile', 3);
        renderSpriteSheet(this, PTERODACTYL_FRAMES, PALETTE, 'pterodactyl_sheet', 3);

        CAVE_TILES.forEach((tile, i) => {
            renderPixelArt(this, tile, PALETTE, `cave_tile_${i}`, 3);
        });

        // Create animations from atlas frames
        const knights = ['player', 'bounder', 'hunter', 'shadow'];
        const animConfigs = [
            { suffix: 'idle', rate: 8 },
            { suffix: 'run', rate: 10 },
            { suffix: 'charge', rate: 12 },
        ];

        for (const k of knights) {
            for (const { suffix, rate } of animConfigs) {
                const atlasKey = `${k}_${suffix}`;
                const frames = this.textures.get(atlasKey).getFrameNames();
                // Sort frames by name to ensure correct order
                frames.sort();

                this.anims.create({
                    key: `${k}_${suffix}_anim`,
                    frames: frames.map(f => ({ key: atlasKey, frame: f })),
                    frameRate: rate,
                    repeat: -1,
                });
            }
        }

        // Pterodactyl (from atlas)
        const pteroFrames = this.textures.get('ptero_fly').getFrameNames().sort();
        this.anims.create({
            key: 'pterodactyl_flap',
            frames: pteroFrames.map(f => ({ key: 'ptero_fly', frame: f })),
            frameRate: 10, repeat: -1,
        });

        // Particle texture
        const pg = this.add.graphics();
        pg.fillStyle(0xffffff);
        pg.fillCircle(4, 4, 4);
        pg.generateTexture('particle', 8, 8);
        pg.destroy();

        this.scene.start('TitleScreen');
    }
}
