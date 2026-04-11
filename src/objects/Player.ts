import Phaser from 'phaser';
import { GAME, PLAYER } from '../core/Constants';
import { EventBus, Events } from '../core/EventBus';
import type { PowerUpType } from './PowerUp';

export class Player extends Phaser.Physics.Arcade.Sprite {
    private isInvulnerable = false;
    private invulnerableTimer = 0;
    private onGround = false;
    private isMoving = false;
    private aura: Phaser.GameObjects.Graphics;
    private auraTime = 0;
    private activePowerUp: PowerUpType | null = null;
    private powerUpTimer = 0;
    private hasShield = false;
    private baseSpeed = PLAYER.SPEED;
    private baseFlapForce = PLAYER.FLAP_FORCE;

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

        this.aura = scene.add.graphics(); // kept for compatibility
        this.aura.setDepth(9);

        this.setScale(1.4);
        this.setDepth(10);
        this.play('player_idle_anim');

        // Golden glow outline using Phaser's built-in postFX
        if (this.postFX) {
            this.postFX.addGlow(0xffd700, 2, 0, false, 0.1, 10);
        }
    }

    flap(): void {
        const body = this.body as Phaser.Physics.Arcade.Body;
        const newVY = Math.max(body.velocity.y + this.getFlapForce(), -PLAYER.MAX_VELOCITY_Y);
        body.setVelocityY(newVY);
        EventBus.emit(Events.SPECTACLE_ACTION);
    }

    moveLeft(_delta: number): void {
        const body = this.body as Phaser.Physics.Arcade.Body;
        body.setMaxVelocity(this.getSpeed(), PLAYER.MAX_VELOCITY_Y);
        body.setAccelerationX(-PLAYER.ACCELERATION);
        this.setFlipX(true);
        this.isMoving = true;
    }

    moveRight(_delta: number): void {
        const body = this.body as Phaser.Physics.Arcade.Body;
        body.setMaxVelocity(this.getSpeed(), PLAYER.MAX_VELOCITY_Y);
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
        if (this.hasShield) {
            this.consumeShield();
            // Visual feedback — flash white
            this.setTint(0xffffff);
            this.scene.time.delayedCall(200, () => this.clearTint());
            return;
        }
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

        this.aura.clear(); // graphics kept for compatibility but unused

        // Animation state
        const current = this.anims.currentAnim?.key;
        if (!this.onGround) {
            if (current !== 'player_charge_anim') this.play('player_charge_anim');
        } else if (this.isMoving) {
            if (current !== 'player_run_anim') this.play('player_run_anim');
        } else {
            if (current !== 'player_idle_anim') this.play('player_idle_anim');
        }

        // Power-up timer
        if (this.activePowerUp && this.powerUpTimer > 0) {
            this.powerUpTimer -= delta;
            if (this.powerUpTimer <= 0) {
                this.clearPowerUp();
            }
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

    applyPowerUp(type: PowerUpType): void {
        // Clear previous power-up
        this.clearPowerUp();
        this.activePowerUp = type;

        switch (type) {
            case 'speed':
                this.powerUpTimer = 6000;
                // Speed is applied in moveLeft/moveRight via getSpeed()
                break;
            case 'flap':
                this.powerUpTimer = 6000;
                // Flap force is applied in flap() via getFlapForce()
                break;
            case 'shield':
                this.hasShield = true;
                this.powerUpTimer = 30000; // shield lasts until hit, but 30s max
                // Visual: add green tint
                this.setTint(0x88ff88);
                break;
        }
    }

    clearPowerUp(): void {
        this.activePowerUp = null;
        this.powerUpTimer = 0;
        this.hasShield = false;
        this.clearTint();
    }

    getActivePowerUp(): PowerUpType | null {
        return this.activePowerUp;
    }

    hasActiveShield(): boolean {
        return this.hasShield;
    }

    consumeShield(): void {
        this.hasShield = false;
        this.clearPowerUp();
    }

    private getSpeed(): number {
        return this.activePowerUp === 'speed' ? this.baseSpeed * 1.5 : this.baseSpeed;
    }

    private getFlapForce(): number {
        return this.activePowerUp === 'flap' ? this.baseFlapForce * 1.4 : this.baseFlapForce;
    }
}
