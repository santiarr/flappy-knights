import { LAVA, LAVA_TROLL } from '../core/Constants';

export class LavaTroll {
    private graphics: Phaser.GameObjects.Graphics;
    private handX = 0;
    private handY = 0;
    private handTargetY = 0;
    private isGrabbing = false;
    private isActive = false;
    private grabTimer = 0;

    constructor(scene: Phaser.Scene) {
        this.graphics = scene.add.graphics();
        this.graphics.setDepth(7);
    }

    setActive(active: boolean): void {
        this.isActive = active;
        if (!active) {
            this.isGrabbing = false;
            this.graphics.clear();
        }
    }

    getIsActive(): boolean {
        return this.isActive;
    }

    /** Returns true if the hand grabs the player */
    checkGrab(playerX: number, playerY: number): boolean {
        if (!this.isActive) return false;

        const nearLava = playerY > LAVA.Y - LAVA_TROLL.GRAB_RANGE;
        if (nearLava && !this.isGrabbing) {
            this.isGrabbing = true;
            this.handX = playerX;
            this.handY = LAVA.Y + 10;
            this.handTargetY = playerY - 20;
            this.grabTimer = 0;
        }

        if (this.isGrabbing) {
            // Check if hand reached the player
            const dx = Math.abs(this.handX - playerX);
            const dy = Math.abs(this.handY - playerY);
            if (dx < LAVA_TROLL.HAND_WIDTH && dy < LAVA_TROLL.HAND_HEIGHT * 0.5) {
                return true;
            }
        }

        return false;
    }

    update(_time: number, delta: number): void {
        if (!this.isActive) return;

        this.graphics.clear();

        if (this.isGrabbing) {
            // Hand rises from lava toward target
            this.handY -= LAVA_TROLL.GRAB_SPEED * (delta / 16);
            this.grabTimer += delta;

            // Give up after 3 seconds
            if (this.grabTimer > 3000 || this.handY < this.handTargetY - 60) {
                this.isGrabbing = false;
                return;
            }

            this.drawHand(this.handX, this.handY);
        }
    }

    private drawHand(x: number, y: number): void {
        const w = LAVA_TROLL.HAND_WIDTH;
        const h = LAVA_TROLL.HAND_HEIGHT;

        // Arm from lava
        this.graphics.fillStyle(0x44aa44, 0.9);
        this.graphics.fillRect(x - 6, y, 12, LAVA.Y - y + 20);

        // Hand/claw
        this.graphics.fillStyle(0x55cc55);
        this.graphics.fillRect(x - w * 0.5, y - h * 0.3, w, h * 0.5);

        // Fingers/claws
        this.graphics.fillStyle(0x338833);
        for (let i = -1; i <= 1; i++) {
            this.graphics.fillTriangle(
                x + i * 10, y - h * 0.3,
                x + i * 10 - 4, y - h * 0.6,
                x + i * 10 + 4, y - h * 0.6
            );
        }
    }

    destroy(): void {
        this.graphics.destroy();
    }
}
