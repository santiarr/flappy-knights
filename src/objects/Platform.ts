import Phaser from 'phaser';
import { PLATFORM } from '../core/Constants';

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
