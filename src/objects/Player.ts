import Phaser from 'phaser';
import { GAME, PLAYER } from '../core/Constants';
import { EventBus, Events } from '../core/EventBus';

export class Player extends Phaser.Physics.Arcade.Sprite {
    private isInvulnerable = false;
    private invulnerableTimer = 0;
    private onGround = false;
    private isMoving = false;
    private aura: Phaser.GameObjects.Graphics;
    private auraTime = 0;

    constructor(scene: Phaser.Scene, x: number, y: number) {
        // Use first frame from idle atlas
        const frames = scene.textures.get('player_idle').getFrameNames().sort();
        super(scene, x, y, 'player_idle', frames[0]);
        scene.add.existing(this);
        scene.physics.add.existing(this);

        const body = this.body as Phaser.Physics.Arcade.Body;
        body.setCollideWorldBounds(false);
        body.setMaxVelocity(PLAYER.SPEED, PLAYER.MAX_VELOCITY_Y);
        body.setGravityY(0);
        body.setDragX(PLAYER.DRAG);
        // Hitbox for 64x55 sprite
        body.setSize(30, 35);
        body.setOffset(17, 12);

        // Golden aura glow behind the player
        this.aura = scene.add.graphics();
        this.aura.setDepth(9); // behind player (depth 10)

        this.setScale(1.4);
        this.setDepth(10);
        this.play('player_idle_anim');
    }

    flap(): void {
        const body = this.body as Phaser.Physics.Arcade.Body;
        const newVY = Math.max(body.velocity.y + PLAYER.FLAP_FORCE, -PLAYER.MAX_VELOCITY_Y);
        body.setVelocityY(newVY);
        EventBus.emit(Events.SPECTACLE_ACTION);
    }

    moveLeft(_delta: number): void {
        const body = this.body as Phaser.Physics.Arcade.Body;
        body.setAccelerationX(-PLAYER.ACCELERATION);
        this.setFlipX(true);
        this.isMoving = true;
    }

    moveRight(_delta: number): void {
        const body = this.body as Phaser.Physics.Arcade.Body;
        body.setAccelerationX(PLAYER.ACCELERATION);
        this.setFlipX(false);
        this.isMoving = true;
    }

    stopHorizontal(): void {
        const body = this.body as Phaser.Physics.Arcade.Body;
        body.setAccelerationX(0);
        this.isMoving = false;
    }

    handleScreenWrap(): void {
        if (this.x < -this.width * 0.5) {
            this.x = GAME.WIDTH + this.width * 0.5;
        } else if (this.x > GAME.WIDTH + this.width * 0.5) {
            this.x = -this.width * 0.5;
        }
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
        this.onGround = body.blocked.down || body.touching.down;
        body.setDragX(this.onGround ? PLAYER.DRAG : PLAYER.AIR_DRAG);

        // Pulsing outline around the player sprite
        this.auraTime += delta * 0.003;
        this.aura.clear();
        const pulse = 0.4 + Math.sin(this.auraTime) * 0.2;
        const w = this.displayWidth;
        const h = this.displayHeight;
        // Draw outline rectangle around sprite bounds
        this.aura.lineStyle(2, 0xffd700, pulse);
        this.aura.strokeRoundedRect(
            this.x - w * 0.5 - 2,
            this.y - h * 0.5 - 2,
            w + 4,
            h + 4,
            3
        );

        // Animation state
        const current = this.anims.currentAnim?.key;
        if (!this.onGround) {
            if (current !== 'player_charge_anim') this.play('player_charge_anim');
        } else if (this.isMoving) {
            if (current !== 'player_run_anim') this.play('player_run_anim');
        } else {
            if (current !== 'player_idle_anim') this.play('player_idle_anim');
        }

        // Invulnerability
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
