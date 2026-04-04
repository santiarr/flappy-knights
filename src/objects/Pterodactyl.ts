import Phaser from 'phaser';
import { GAME, PTERODACTYL } from '../core/Constants';
import { EventBus, Events } from '../core/EventBus';

export class Pterodactyl extends Phaser.Physics.Arcade.Sprite {
    private isActive = false;
    private nextFlapTime = 0;
    private lifetime = 0;
    private targetX = 0;
    private targetY = 0;

    constructor(scene: Phaser.Scene) {
        super(scene, -100, -100, 'pterodactyl_sheet', 0);
        scene.add.existing(this);
        scene.physics.add.existing(this);

        const body = this.body as Phaser.Physics.Arcade.Body;
        body.setCollideWorldBounds(false);
        body.setMaxVelocity(PTERODACTYL.SPEED * 1.2, 500);
        body.setSize(PTERODACTYL.SIZE * 0.7, PTERODACTYL.SIZE * 0.5);
        body.setOffset(PTERODACTYL.SIZE * 0.15, PTERODACTYL.SIZE * 0.25);

        this.setDepth(11);
        this.deactivate();
    }

    activate(): void {
        // Spawn from a random side, mid-height
        const fromLeft = Math.random() > 0.5;
        const x = fromLeft ? -PTERODACTYL.SIZE : GAME.WIDTH + PTERODACTYL.SIZE;
        const y = Phaser.Math.Between(100, 400);

        this.setPosition(x, y);
        this.setActive(true);
        this.setVisible(true);
        (this.body as Phaser.Physics.Arcade.Body).enable = true;
        this.isActive = true;
        this.lifetime = PTERODACTYL.DURATION;
        this.nextFlapTime = 0;
        this.setAlpha(1);
        this.setFlipX(!fromLeft);

        EventBus.emit(Events.PTERODACTYL_SPAWN);
    }

    deactivate(): void {
        this.setActive(false);
        this.setVisible(false);
        if (this.body) {
            (this.body as Phaser.Physics.Arcade.Body).enable = false;
        }
        this.isActive = false;
    }

    getIsActive(): boolean {
        return this.isActive;
    }

    update(time: number, delta: number, playerX: number, playerY: number): void {
        if (!this.isActive) return;

        this.lifetime -= delta;
        if (this.lifetime <= 0) {
            this.deactivate();
            return;
        }

        // Aggressive pursuit — swoops toward player
        this.targetX = playerX;
        this.targetY = playerY;

        const body = this.body as Phaser.Physics.Arcade.Body;
        const dx = this.targetX - this.x;
        const dy = this.targetY - this.y;

        // Fast horizontal tracking
        body.setVelocityX(dx > 0 ? PTERODACTYL.SPEED : -PTERODACTYL.SPEED);
        this.setFlipX(dx < 0);

        // Flap aggressively
        if (time > this.nextFlapTime) {
            if (dy < 0 || body.velocity.y > 50) {
                body.setVelocityY(PTERODACTYL.FLAP_FORCE);
                this.setFrame(1);
                this.scene.time.delayedCall(120, () => {
                    if (this.isActive) this.setFrame(0);
                });
            }
            this.nextFlapTime = time + PTERODACTYL.FLAP_INTERVAL;
        }

        // Screen wrap
        if (this.x < -this.width) {
            this.x = GAME.WIDTH + this.width;
        } else if (this.x > GAME.WIDTH + this.width) {
            this.x = -this.width;
        }

        // Bounce off ceiling
        if (this.y < 0) {
            this.y = 0;
            body.setVelocityY(50);
        }

        // Flash warning when about to leave (last 3 seconds)
        if (this.lifetime < 3000) {
            this.setAlpha(Math.sin(this.lifetime * 0.01) > 0 ? 1 : 0.4);
        }
    }
}
