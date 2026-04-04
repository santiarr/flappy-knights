import Phaser from 'phaser';
import { EGG } from '../core/Constants';
import { EventBus, Events } from '../core/EventBus';
import { EnemyType } from './Enemy';

export class Egg extends Phaser.Physics.Arcade.Sprite {
    private hatchTimer = 0;
    private isActive = false;
    private sourceType: EnemyType = 'BOUNDER';

    constructor(scene: Phaser.Scene, x: number, y: number) {
        super(scene, x, y, 'egg');
        scene.add.existing(this);
        scene.physics.add.existing(this);

        const body = this.body as Phaser.Physics.Arcade.Body;
        body.setCollideWorldBounds(false);
        body.setBounce(0.3);
        body.setSize(EGG.SIZE * 0.8, EGG.SIZE * 0.9);
        body.setOffset(EGG.SIZE * 0.1, EGG.SIZE * 0.05);
        body.setMaxVelocity(200, 400);

        this.setDepth(8);
        this.deactivate();
    }

    activate(x: number, y: number, sourceType: EnemyType): void {
        this.sourceType = sourceType;
        this.setPosition(x, y);
        this.setActive(true);
        this.setVisible(true);
        (this.body as Phaser.Physics.Arcade.Body).enable = true;
        this.isActive = true;
        this.hatchTimer = EGG.HATCH_TIME;
        this.setAlpha(1);
        this.setTint(0xffffff);
    }

    deactivate(): void {
        this.setActive(false);
        this.setVisible(false);
        (this.body as Phaser.Physics.Arcade.Body).enable = false;
        this.isActive = false;
    }

    getIsActive(): boolean {
        return this.isActive;
    }

    getSourceType(): EnemyType {
        return this.sourceType;
    }

    getPoints(): number {
        const pointMap: Record<EnemyType, number> = {
            BOUNDER: EGG.POINTS.BOUNDER,
            HUNTER: EGG.POINTS.HUNTER,
            SHADOW_LORD: EGG.POINTS.SHADOW_LORD,
        };
        return pointMap[this.sourceType];
    }

    collect(): void {
        EventBus.emit(Events.EGG_COLLECTED, { points: this.getPoints() });
        this.deactivate();
    }

    update(_time: number, delta: number): void {
        if (!this.isActive) return;

        this.hatchTimer -= delta;

        // Flash warning when about to hatch
        if (this.hatchTimer < 1500) {
            const flash = Math.sin(this.hatchTimer * 0.015) > 0;
            this.setTint(flash ? 0xff4444 : 0xffffff);
        }

        if (this.hatchTimer <= 0) {
            EventBus.emit(Events.EGG_HATCHED, {
                x: this.x,
                y: this.y,
                sourceType: this.sourceType,
            });
            this.deactivate();
        }
    }
}
