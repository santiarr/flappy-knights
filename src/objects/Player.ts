import Phaser from 'phaser';
import { GAME, PLAYER } from '../core/Constants';
import { EventBus, Events } from '../core/EventBus';

export class Player extends Phaser.Physics.Arcade.Sprite {
    private isInvulnerable = false;
    private invulnerableTimer = 0;
    private flapAnim = false;
    private flapTimer = 0;
    private onGround = false;

    constructor(scene: Phaser.Scene, x: number, y: number) {
        super(scene, x, y, 'player_sheet', 0);
        scene.add.existing(this);
        scene.physics.add.existing(this);

        const body = this.body as Phaser.Physics.Arcade.Body;
        body.setCollideWorldBounds(false);
        body.setMaxVelocity(PLAYER.SPEED, PLAYER.MAX_VELOCITY_Y);
        body.setGravityY(0); // scene gravity handles this
        body.setDragX(PLAYER.DRAG);
        body.setSize(PLAYER.SIZE * 0.6, PLAYER.SIZE * 0.7);
        body.setOffset(PLAYER.SIZE * 0.2, PLAYER.SIZE * 0.15);

        this.setDepth(10);
    }

    flap(): void {
        const body = this.body as Phaser.Physics.Arcade.Body;
        // Additive flap — each flap adds upward impulse rather than hard-setting
        // This means horizontal momentum is fully preserved
        const newVY = Math.max(body.velocity.y + PLAYER.FLAP_FORCE, -PLAYER.MAX_VELOCITY_Y);
        body.setVelocityY(newVY);
        this.flapAnim = true;
        this.flapTimer = 150;
        this.setFrame(1);
        EventBus.emit(Events.SPECTACLE_ACTION);
    }

    moveLeft(_delta: number): void {
        const body = this.body as Phaser.Physics.Arcade.Body;
        body.setAccelerationX(-PLAYER.ACCELERATION);
        this.setFlipX(true);
    }

    moveRight(_delta: number): void {
        const body = this.body as Phaser.Physics.Arcade.Body;
        body.setAccelerationX(PLAYER.ACCELERATION);
        this.setFlipX(false);
    }

    stopHorizontal(): void {
        const body = this.body as Phaser.Physics.Arcade.Body;
        body.setAccelerationX(0);
        // Drag handles deceleration — no instant stop
    }

    handleScreenWrap(): void {
        if (this.x < -this.width * 0.5) {
            this.x = GAME.WIDTH + this.width * 0.5;
        } else if (this.x > GAME.WIDTH + this.width * 0.5) {
            this.x = -this.width * 0.5;
        }
        // Bounce off ceiling
        if (this.y < 0) {
            this.y = 0;
            (this.body as Phaser.Physics.Arcade.Body).setVelocityY(50);
        }
    }

    damage(): void {
        if (this.isInvulnerable) return;
        this.isInvulnerable = true;
        this.invulnerableTimer = PLAYER.INVULNERABLE_DURATION;
        EventBus.emit(Events.PLAYER_DAMAGED);
    }

    getIsInvulnerable(): boolean {
        return this.isInvulnerable;
    }

    update(_time: number, delta: number): void {
        this.handleScreenWrap();

        const body = this.body as Phaser.Physics.Arcade.Body;

        // Detect if on ground (touching down)
        this.onGround = body.blocked.down || body.touching.down;

        // Less drag in the air so momentum carries through flaps
        body.setDragX(this.onGround ? PLAYER.DRAG : PLAYER.AIR_DRAG);

        // Flap animation timer
        if (this.flapAnim) {
            this.flapTimer -= delta;
            if (this.flapTimer <= 0) {
                this.flapAnim = false;
                this.setFrame(0);
            }
        }

        // Invulnerability timer
        if (this.isInvulnerable) {
            this.invulnerableTimer -= delta;
            this.setAlpha(Math.sin(this.invulnerableTimer * 0.01) > 0 ? 1 : 0.3);
            if (this.invulnerableTimer <= 0) {
                this.isInvulnerable = false;
                this.setAlpha(1);
            }
        }
    }
}
