import Phaser from 'phaser';

export type PowerUpType = 'speed' | 'flap' | 'shield';

const POWER_UP_COLORS: Record<PowerUpType, number> = {
    speed: 0x44ddff,   // cyan
    flap: 0xffaa00,    // orange
    shield: 0x44ff44,  // green
};

const POWER_UP_LABELS: Record<PowerUpType, string> = {
    speed: 'SPD',
    flap: 'FLP',
    shield: 'SHD',
};

// Weighted random: 50% speed, 30% flap, 20% shield
function randomPowerUpType(): PowerUpType {
    const roll = Math.random();
    if (roll < 0.5) return 'speed';
    if (roll < 0.8) return 'flap';
    return 'shield';
}

// Fixed spawn points — center platform and alternating upper platforms
const SPAWN_POINTS = [
    { x: 585, y: 305 },   // center platform (440+290/2, 320-15)
    { x: 150, y: 215 },   // upper left (60+180/2, 230-15)
    { x: 1020, y: 215 },  // upper right (930+180/2, 230-15)
];

export class PowerUp extends Phaser.GameObjects.Container {
    private powerUpType: PowerUpType = 'speed';
    private isActive = false;
    private glowGraphics: Phaser.GameObjects.Graphics;
    private labelText: Phaser.GameObjects.Text;
    private pulseTime = 0;
    private lifetime = 0;
    private static MAX_LIFETIME = 15000; // disappears after 15 seconds if not collected

    constructor(scene: Phaser.Scene) {
        super(scene, -100, -100);
        scene.add.existing(this);

        this.glowGraphics = scene.add.graphics();
        this.add(this.glowGraphics);

        this.labelText = scene.add.text(0, 0, '', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '10px',
            color: '#ffffff',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 2,
        }).setOrigin(0.5);
        this.add(this.labelText);

        this.setDepth(15);
        this.setSize(24, 24);
        this.setVisible(false);
        this.setActive(false);
    }

    spawn(): void {
        this.powerUpType = randomPowerUpType();
        const point = SPAWN_POINTS[Math.floor(Math.random() * SPAWN_POINTS.length)];
        this.setPosition(point.x, point.y);
        this.setVisible(true);
        this.setActive(true);
        this.isActive = true;
        this.lifetime = PowerUp.MAX_LIFETIME;
        this.pulseTime = 0;
        this.labelText.setText(POWER_UP_LABELS[this.powerUpType]);

        // Add glow effect
        if (this.postFX) {
            this.postFX.clear();
            this.postFX.addGlow(POWER_UP_COLORS[this.powerUpType], 3, 0, false, 0.1, 10);
        }
    }

    deactivate(): void {
        this.setVisible(false);
        this.setActive(false);
        this.isActive = false;
        this.setPosition(-100, -100);
    }

    getIsActive(): boolean {
        return this.isActive;
    }

    getPowerUpType(): PowerUpType {
        return this.powerUpType;
    }

    update(_time: number, delta: number): void {
        if (!this.isActive) return;

        this.lifetime -= delta;
        if (this.lifetime <= 0) {
            this.deactivate();
            return;
        }

        // Pulsing visual
        this.pulseTime += delta * 0.005;
        const color = POWER_UP_COLORS[this.powerUpType];
        const pulse = 0.6 + Math.sin(this.pulseTime) * 0.4;
        const radius = 12 + Math.sin(this.pulseTime * 1.3) * 2;

        this.glowGraphics.clear();
        this.glowGraphics.fillStyle(color, pulse * 0.3);
        this.glowGraphics.fillCircle(0, 0, radius + 4);
        this.glowGraphics.fillStyle(color, pulse * 0.7);
        this.glowGraphics.fillCircle(0, 0, radius);
        this.glowGraphics.fillStyle(0xffffff, pulse * 0.5);
        this.glowGraphics.fillCircle(0, 0, radius * 0.4);

        // Flash when about to expire (last 3 seconds)
        if (this.lifetime < 3000) {
            this.setAlpha(Math.sin(this.lifetime * 0.01) > 0 ? 1 : 0.3);
        } else {
            this.setAlpha(1);
        }

        // Floating bob
        this.y += Math.sin(this.pulseTime * 2) * 0.3;
    }

    // Check overlap with a player sprite (simple distance check)
    checkOverlap(playerX: number, playerY: number): boolean {
        if (!this.isActive) return false;
        const dist = Phaser.Math.Distance.Between(this.x, this.y, playerX, playerY);
        return dist < 30;
    }
}
