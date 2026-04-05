import { Scene } from 'phaser';

export class Boot extends Scene {
    constructor() {
        super('Boot');
    }

    preload(): void {
        // Load knight atlases (JSON tells Phaser exact frame positions — no guessing)
        const knights = ['player', 'bounder', 'hunter', 'shadow'];
        const anims = ['idle', 'run', 'charge'];
        for (const k of knights) {
            for (const a of anims) {
                this.load.atlas(
                    `${k}_${a}`,
                    `assets/knights/${k}-${a}.png`,
                    `assets/knights/${k}-${a}.json`
                );
            }
        }

        // Pterodactyl
        this.load.atlas('ptero_fly', 'assets/knights/ptero-fly.png', 'assets/knights/ptero-fly.json');
    }

    create(): void {
        this.scene.start('Preloader');
    }
}
