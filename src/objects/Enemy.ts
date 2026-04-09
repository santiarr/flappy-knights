import Phaser from 'phaser';
import { GAME, ENEMY, PLATFORM } from '../core/Constants';

export type EnemyType = 'BOUNDER' | 'HUNTER' | 'SHADOW_LORD';

const ATLAS_PREFIX: Record<EnemyType, string> = {
    BOUNDER: 'bounder',
    HUNTER: 'hunter',
    SHADOW_LORD: 'shadow',
};

// Pre-compute platform rects for cliff detection
const PLATFORM_RECTS = PLATFORM.POSITIONS.map(p => ({
    left: p.x,
    right: p.x + p.w,
    top: p.y,
    bottom: p.y + p.h,
    centerX: p.x + p.w * 0.5,
}));

/** Interpolate a dynamic parameter based on wave number */
function dynParam(param: { start: number; end: number; waves: number }, wave: number): number {
    const t = Math.min(wave / param.waves, 1);
    return param.start + (param.end - param.start) * t;
}

export class Enemy extends Phaser.Physics.Arcade.Sprite {
    private enemyType: EnemyType = 'BOUNDER';
    private speed = ENEMY.BASE_SPEED;
    private isActive = false;

    // Two-tier intelligence (from original Joust)
    private isSmart = false;          // false = dumb line tracking, true = type-specific AI
    private trackingLine = 0;         // Y position for dumb mode patrol
    private facingRight = true;       // horizontal direction in dumb mode

    // Smart mode state
    private levelFlightTimer = 0;     // time in level flight before next decision
    private flapUpTimer = 0;          // time spent flapping upward
    private aiMode: 'level' | 'up' | 'down' = 'level';
    private directionCopyTimer = 0;   // Bounder: how long copying player direction
    private nextFlapTime = 0;

    // Walking state
    private isOnPlatform = false;

    constructor(scene: Phaser.Scene, x: number, y: number) {
        const frames = scene.textures.get('bounder_idle').getFrameNames().sort();
        super(scene, x, y, 'bounder_idle', frames[0]);
        scene.add.existing(this);
        scene.physics.add.existing(this);

        const body = this.body as Phaser.Physics.Arcade.Body;
        body.setCollideWorldBounds(false);
        body.setMaxVelocity(300, 500);
        body.setSize(30, 35);
        body.setOffset(17, 12);
        body.setDragX(40);

        this.setScale(1.4);
        this.setDepth(9);
        this.deactivate();
    }

    activate(type: EnemyType, x: number, y: number): void {
        this.enemyType = type;
        const typeConfig = ENEMY.TYPES[type];
        this.speed = ENEMY.BASE_SPEED * typeConfig.speedMultiplier;

        const prefix = ATLAS_PREFIX[type];
        this.play(`${prefix}_idle_anim`);
        this.setPosition(x, y);
        this.setActive(true);
        this.setVisible(true);
        (this.body as Phaser.Physics.Arcade.Body).enable = true;
        this.isActive = true;
        this.setAlpha(1);

        // Start dumb (line tracking)
        this.isSmart = false;
        this.trackingLine = Phaser.Utils.Array.GetRandom(ENEMY.TRACK_LINES);
        this.facingRight = Math.random() > 0.5;
        this.aiMode = 'level';
        this.levelFlightTimer = 0;
        this.flapUpTimer = 0;
        this.directionCopyTimer = 0;
        this.nextFlapTime = 0;
        this.isOnPlatform = false;
    }

    /** Called by Game.ts when the wave's smart promotion timer fires */
    promoteToSmart(): void {
        this.isSmart = true;
    }

    getIsSmart(): boolean {
        return this.isSmart;
    }

    deactivate(): void {
        this.setActive(false);
        this.setVisible(false);
        (this.body as Phaser.Physics.Arcade.Body).enable = false;
        this.isActive = false;
    }

    getEnemyType(): EnemyType { return this.enemyType; }
    getPoints(): number { return ENEMY.TYPES[this.enemyType].points; }
    getIsActive(): boolean { return this.isActive; }

    update(time: number, delta: number, playerX: number, playerY: number, waveSpeedScale: number = 1, currentWave: number = 1): void {
        if (!this.isActive) return;

        const body = this.body as Phaser.Physics.Arcade.Body;
        const scaledSpeed = this.speed * waveSpeedScale;

        // Slow mode for first 2 waves (original: enemies skip every other tick)
        if (currentWave <= ENEMY.SLOW_WAVE_THRESHOLD) {
            body.setMaxVelocity(scaledSpeed * 0.7, 350);
        } else {
            body.setMaxVelocity(scaledSpeed * 1.5, 500);
        }

        // Track platform landing
        this.isOnPlatform = body.blocked.down || body.touching.down;

        // --- Lava check: panic flap or get lured ---
        if (this.y > ENEMY.LAVA_DANGER_Y) {
            const horizontalDistToPlayer = Math.abs(this.x - playerX);
            if (horizontalDistToPlayer < ENEMY.LAVA_LURE_RANGE) {
                // Player is close — let ourselves be lured (original behavior)
                // Don't panic, keep pursuing
            } else {
                // Panic flap upward
                body.setVelocityY(ENEMY.FLAP_FORCE * 1.3);
                this.doFlapAnim();
                this.wrapAndClamp(body);
                return;
            }
        }

        // --- Choose AI tier ---
        if (!this.isSmart) {
            this.updateLineTracking(time, delta, scaledSpeed, body);
        } else {
            switch (this.enemyType) {
                case 'BOUNDER':
                    this.updateBounderSmart(time, delta, playerX, playerY, scaledSpeed, body, currentWave);
                    break;
                case 'HUNTER':
                    this.updateHunterSmart(time, delta, playerX, playerY, scaledSpeed, body, currentWave);
                    break;
                case 'SHADOW_LORD':
                    this.updateShadowLordSmart(time, delta, playerX, playerY, scaledSpeed, body, currentWave);
                    break;
            }
        }

        this.wrapAndClamp(body);

        // Animation state (like Player)
        const prefix = ATLAS_PREFIX[this.enemyType];
        const current = this.anims.currentAnim?.key;
        if (!this.isOnPlatform) {
            // In the air — use charge/run anim
            if (current !== `${prefix}_charge_anim`) this.play(`${prefix}_charge_anim`);
        } else if (Math.abs(body.velocity.x) > 20) {
            if (current !== `${prefix}_run_anim`) this.play(`${prefix}_run_anim`);
        } else {
            if (current !== `${prefix}_idle_anim`) this.play(`${prefix}_idle_anim`);
        }
    }

    // ========================================
    // DUMB MODE: Line Tracking (LINET)
    // Fly along a fixed horizontal tracking line.
    // If below the line, flap up. If on/above, coast.
    // Move in current facing direction until hitting screen edge.
    // ========================================
    private updateLineTracking(time: number, _delta: number, scaledSpeed: number, body: Phaser.Physics.Arcade.Body): void {
        // Horizontal: fly in facing direction
        body.setAccelerationX(this.facingRight ? scaledSpeed * 3 : -scaledSpeed * 3);
        this.setFlipX(!this.facingRight);

        // Clamp horizontal speed
        if (Math.abs(body.velocity.x) > scaledSpeed) {
            body.setVelocityX(Math.sign(body.velocity.x) * scaledSpeed);
        }

        // Vertical: flap toward tracking line
        if (this.y > this.trackingLine + ENEMY.TRACK_THRESHOLD) {
            // Below tracking line — flap up
            if (time > this.nextFlapTime) {
                body.setVelocityY(ENEMY.FLAP_FORCE);
                this.doFlapAnim();
                this.nextFlapTime = time + Phaser.Math.Between(300, 600);
            }
        }
        // If above, gravity brings us back down — just coast

        // Occasionally switch tracking line for variety
        if (Math.random() < 0.001) {
            this.trackingLine = Phaser.Utils.Array.GetRandom(ENEMY.TRACK_LINES);
        }

        // Reverse direction at screen edges (with some randomness)
        if ((this.x < 30 && !this.facingRight) || (this.x > GAME.WIDTH - 30 && this.facingRight)) {
            this.facingRight = !this.facingRight;
        }
    }

    // ========================================
    // BOUNDER SMART: Mimic player direction, basic pursuit
    // - Copies player's horizontal direction
    // - Checks if player is above/below within range thresholds
    // - Alternates between level flight, going up, going down
    // - If copying direction too long without success, reverses
    // ========================================
    private updateBounderSmart(
        time: number, delta: number,
        playerX: number, playerY: number,
        scaledSpeed: number, body: Phaser.Physics.Arcade.Body,
        wave: number
    ): void {
        const levelTime = dynParam(ENEMY.DYN.BOUNDER_LEVEL_TIME, wave);
        const flapUpTime = dynParam(ENEMY.DYN.BOUNDER_FLAP_UP_TIME, wave);
        const downRange = dynParam(ENEMY.DYN.BOUNDER_DOWN_RANGE, wave);

        const dy = playerY - this.y;

        switch (this.aiMode) {
            case 'level':
                this.levelFlightTimer += delta;

                // Copy the player's horizontal direction (key Bounder behavior)
                const playerIsRight = playerX > this.x;
                body.setAccelerationX(playerIsRight ? scaledSpeed * 3 : -scaledSpeed * 3);
                this.setFlipX(!playerIsRight);
                this.directionCopyTimer += delta;

                // If copying direction for too long (>3s), reverse to try another approach
                if (this.directionCopyTimer > 3000) {
                    body.setAccelerationX(playerIsRight ? -scaledSpeed * 3 : scaledSpeed * 3);
                    this.setFlipX(playerIsRight);
                    this.directionCopyTimer = 0;
                }

                // Decision: switch to up or down based on player altitude
                if (this.levelFlightTimer > levelTime) {
                    if (dy > downRange) {
                        this.aiMode = 'down';
                    } else if (dy < -30) {
                        this.aiMode = 'up';
                        this.flapUpTimer = 0;
                    }
                    this.levelFlightTimer = 0;
                }
                break;

            case 'up':
                // Flap upward toward player
                if (time > this.nextFlapTime) {
                    body.setVelocityY(ENEMY.FLAP_FORCE);
                    this.doFlapAnim();
                    this.nextFlapTime = time + 200;
                }
                // Track player horizontally
                body.setAccelerationX(playerX > this.x ? scaledSpeed * 3 : -scaledSpeed * 3);
                this.setFlipX(playerX < this.x);

                this.flapUpTimer += delta;
                if (this.flapUpTimer > flapUpTime || this.y < playerY - 20) {
                    this.aiMode = 'level';
                    this.levelFlightTimer = 0;
                    this.directionCopyTimer = 0;
                }
                break;

            case 'down':
                // Let gravity pull us down (don't flap)
                body.setAccelerationX(playerX > this.x ? scaledSpeed * 2 : -scaledSpeed * 2);
                this.setFlipX(playerX < this.x);

                // Return to level when at player's altitude or on a platform
                if (this.y > playerY - 10 || this.isOnPlatform) {
                    this.aiMode = 'level';
                    this.levelFlightTimer = 0;
                    this.directionCopyTimer = 0;
                }
                break;
        }

        // Clamp speed
        if (Math.abs(body.velocity.x) > scaledSpeed) {
            body.setVelocityX(Math.sign(body.velocity.x) * scaledSpeed);
        }
    }

    // ========================================
    // HUNTER SMART: Bounder AI + cliff prediction
    // - Same pursuit logic as Bounder but with predictive cliff avoidance
    // - Looks ahead based on Y velocity and reverses before hitting platforms
    // - More aggressive parameters
    // ========================================
    private updateHunterSmart(
        time: number, delta: number,
        playerX: number, playerY: number,
        scaledSpeed: number, body: Phaser.Physics.Arcade.Body,
        wave: number
    ): void {
        const levelTime = dynParam(ENEMY.DYN.HUNTER_LEVEL_TIME, wave);
        const flapUpTime = dynParam(ENEMY.DYN.HUNTER_FLAP_UP_TIME, wave);

        const dy = playerY - this.y;

        // --- Cliff prediction: look ahead and reverse if platform detected ---
        const lookAhead = ENEMY.DYN.HUNTER_CLIFF_LOOK_AHEAD;
        const futureX = this.x + Math.sign(body.velocity.x) * lookAhead;
        const futureY = this.y + body.velocity.y * 0.15; // project ~150ms ahead
        if (this.checkCliffAt(futureX, futureY)) {
            // Reverse horizontal direction to avoid platform collision
            body.setVelocityX(-body.velocity.x * 0.5);
            body.setAccelerationX(-body.acceleration.x);
        }

        switch (this.aiMode) {
            case 'level':
                this.levelFlightTimer += delta;

                // Pursue player directly (more aggressive than Bounder)
                body.setAccelerationX(playerX > this.x ? scaledSpeed * 4 : -scaledSpeed * 4);
                this.setFlipX(playerX < this.x);

                if (this.levelFlightTimer > levelTime) {
                    if (dy > 60) {
                        this.aiMode = 'down';
                    } else if (dy < -30) {
                        this.aiMode = 'up';
                        this.flapUpTimer = 0;
                    }
                    this.levelFlightTimer = 0;
                }
                break;

            case 'up':
                if (time > this.nextFlapTime) {
                    body.setVelocityY(ENEMY.FLAP_FORCE);
                    this.doFlapAnim();
                    this.nextFlapTime = time + 150; // faster flap cadence than Bounder
                }
                body.setAccelerationX(playerX > this.x ? scaledSpeed * 4 : -scaledSpeed * 4);
                this.setFlipX(playerX < this.x);

                this.flapUpTimer += delta;
                if (this.flapUpTimer > flapUpTime || this.y < playerY - 30) {
                    this.aiMode = 'level';
                    this.levelFlightTimer = 0;
                }
                break;

            case 'down':
                // Fall toward player, slight horizontal tracking
                body.setAccelerationX(playerX > this.x ? scaledSpeed * 3 : -scaledSpeed * 3);
                this.setFlipX(playerX < this.x);

                if (this.y > playerY - 10 || this.isOnPlatform) {
                    this.aiMode = 'level';
                    this.levelFlightTimer = 0;
                }
                break;
        }

        // Clamp speed
        const maxVY = dynParam(ENEMY.DYN.HUNTER_MAX_VY, wave);
        body.setMaxVelocity(scaledSpeed * 1.5, maxVY);
        if (Math.abs(body.velocity.x) > scaledSpeed * 1.2) {
            body.setVelocityX(Math.sign(body.velocity.x) * scaledSpeed * 1.2);
        }
    }

    // ========================================
    // SHADOW LORD SMART: Tracks player's exact Y, free-falls when diving
    // - Uses player's exact Y position as tracking line (not altitude bands)
    // - When going down, does NOT flap — pure free-fall for speed
    // - Cliff-climbing: flaps over platforms when grounded
    // - Most aggressive dynamic parameters
    // ========================================
    private updateShadowLordSmart(
        time: number, delta: number,
        playerX: number, playerY: number,
        scaledSpeed: number, body: Phaser.Physics.Arcade.Body,
        wave: number
    ): void {
        const levelTime = dynParam(ENEMY.DYN.SHADOW_LEVEL_TIME, wave);
        const flapUpTime = dynParam(ENEMY.DYN.SHADOW_FLAP_UP_TIME, wave);

        // Shadow Lord tracks the player's EXACT Y (key difference from Bounder/Hunter)
        const dy = playerY - this.y;

        // Cliff-climbing: if on a platform with a cliff above, flap over it
        if (this.isOnPlatform && this.checkCliffAt(this.x, this.y - 60)) {
            body.setVelocityY(ENEMY.FLAP_FORCE * 1.2);
            this.doFlapAnim();
        }

        // Cliff avoidance similar to Hunter
        const futureX = this.x + Math.sign(body.velocity.x) * 60;
        const futureY = this.y + body.velocity.y * 0.12;
        if (this.checkCliffAt(futureX, futureY)) {
            body.setVelocityX(-body.velocity.x * 0.6);
        }

        switch (this.aiMode) {
            case 'level':
                this.levelFlightTimer += delta;

                // Track player's exact Y — try to match altitude precisely
                if (Math.abs(dy) > 20) {
                    if (dy < 0) {
                        // Player is above — flap up aggressively
                        this.aiMode = 'up';
                        this.flapUpTimer = 0;
                    } else {
                        // Player is below — free-fall
                        this.aiMode = 'down';
                    }
                    this.levelFlightTimer = 0;
                } else if (this.levelFlightTimer > levelTime) {
                    // Re-evaluate
                    this.levelFlightTimer = 0;
                }

                // Aggressive horizontal pursuit with prediction
                const predictedX = playerX + (playerX - this.x) * 0.3;
                body.setAccelerationX(predictedX > this.x ? scaledSpeed * 5 : -scaledSpeed * 5);
                this.setFlipX(predictedX < this.x);
                break;

            case 'up':
                // Aggressive flap upward
                if (time > this.nextFlapTime) {
                    body.setVelocityY(ENEMY.FLAP_FORCE * 1.1);
                    this.doFlapAnim();
                    this.nextFlapTime = time + 120; // very fast flap cadence
                }
                // Track player horizontally with prediction
                const predX = playerX + (playerX - this.x) * 0.25;
                body.setAccelerationX(predX > this.x ? scaledSpeed * 5 : -scaledSpeed * 5);
                this.setFlipX(predX < this.x);

                this.flapUpTimer += delta;
                if (this.flapUpTimer > flapUpTime || this.y < playerY - 10) {
                    this.aiMode = 'level';
                    this.levelFlightTimer = 0;
                }
                break;

            case 'down':
                // FREE-FALL: do NOT flap (original Shadow Lord behavior)
                // This makes them much faster at dropping on you
                body.setAccelerationX(playerX > this.x ? scaledSpeed * 4 : -scaledSpeed * 4);
                this.setFlipX(playerX < this.x);

                if (this.y > playerY - 5 || this.isOnPlatform) {
                    this.aiMode = 'level';
                    this.levelFlightTimer = 0;
                }
                break;
        }

        // Shadow Lords can move faster
        const maxVY = dynParam(ENEMY.DYN.SHADOW_MAX_VY, wave);
        body.setMaxVelocity(scaledSpeed * 2, maxVY);
        if (Math.abs(body.velocity.x) > scaledSpeed * 1.5) {
            body.setVelocityX(Math.sign(body.velocity.x) * scaledSpeed * 1.5);
        }
    }

    // ========================================
    // Utility methods
    // ========================================

    /** Check if there's a platform at the given world position */
    private checkCliffAt(x: number, y: number): boolean {
        for (const p of PLATFORM_RECTS) {
            if (x > p.left - 20 && x < p.right + 20 && y > p.top - 15 && y < p.bottom + 15) {
                return true;
            }
        }
        return false;
    }

    private doFlapAnim(): void {
        const prefix = ATLAS_PREFIX[this.enemyType];
        const runAnim = `${prefix}_run_anim`;
        const idleAnim = `${prefix}_idle_anim`;
        if (this.anims.currentAnim?.key !== runAnim) {
            this.play(runAnim);
        }
        this.scene.time.delayedCall(300, () => {
            if (this.isActive && this.anims.currentAnim?.key !== idleAnim) {
                this.play(idleAnim);
            }
        });
    }

    private wrapAndClamp(body: Phaser.Physics.Arcade.Body): void {
        // Screen wrap
        if (this.x < -this.width * 0.5) {
            this.x = GAME.WIDTH + this.width * 0.5;
        } else if (this.x > GAME.WIDTH + this.width * 0.5) {
            this.x = -this.width * 0.5;
        }
        // Bounce off ceiling
        if (this.y < 0) {
            this.y = 0;
            body.setVelocityY(50);
        }
    }
}
