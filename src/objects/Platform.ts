import Phaser from 'phaser';
import { PLATFORM, LAVA } from '../core/Constants';

export class Platform extends Phaser.Physics.Arcade.Sprite {
    constructor(scene: Phaser.Scene, x: number, y: number, w: number, h: number) {
        const key = `platform_${w}_${h}`;

        // Generate tiled platform texture from pixel art tile if not exists
        if (!scene.textures.exists(key)) {
            const tileSource = scene.textures.get('platform_tile').getSourceImage() as HTMLCanvasElement;
            const tileW = tileSource.width;   // 48 (16*3)
            const tileH = tileSource.height;  // 24 (8*3)

            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d')!;

            // Tile horizontally and vertically
            for (let tx = 0; tx < w; tx += tileW) {
                for (let ty = 0; ty < h; ty += tileH) {
                    ctx.drawImage(tileSource, tx, ty);
                }
            }

            scene.textures.addCanvas(key, canvas);
        }

        super(scene, x + w * 0.5, y + h * 0.5, key);
        scene.add.existing(this);
        scene.physics.add.existing(this, true); // static body

        this.setDepth(5);

        // Lava reflection glow — stronger for lower platforms
        const distToLava = LAVA.Y - (y + h);
        const maxDist = 300; // platforms further than this get no glow
        if (distToLava < maxDist && distToLava > 0) {
            const intensity = 1 - (distToLava / maxDist);
            const glowGfx = scene.add.graphics();
            glowGfx.setDepth(4); // behind platform

            // Orange glow strip below platform
            const glowH = 8 + intensity * 12; // 8-20px
            for (let gi = 0; gi < glowH; gi++) {
                const alpha = 0.12 * intensity * (1 - gi / glowH);
                glowGfx.fillStyle(0xff6600, alpha);
                glowGfx.fillRect(x + 2, y + h + gi, w - 4, 1);
            }

            // Subtle orange tint on bottom edge of platform itself
            glowGfx.fillStyle(0xff4400, 0.08 * intensity);
            glowGfx.fillRect(x + 1, y + h - 2, w - 2, 2);
        }
    }

    static createAll(scene: Phaser.Scene): Phaser.Physics.Arcade.StaticGroup {
        const group = scene.physics.add.staticGroup();
        for (const p of PLATFORM.POSITIONS) {
            const plat = new Platform(scene, p.x, p.y, p.w, p.h);
            group.add(plat);
        }
        return group;
    }
}
