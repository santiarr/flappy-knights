import Phaser from 'phaser';
import { GAME, IS_TOUCH } from '../core/Constants';

const ARCADE_FONT = '"Courier New", Courier, monospace';
const TUTORIAL_KEY = 'flappy_knights_tutorial_done';

interface TutorialStep {
    text: string;
    subtext?: string;
    condition: () => boolean; // advance when this returns true
    duration?: number; // auto-advance after ms (if no condition needed)
}

export class Tutorial {
    private scene: Phaser.Scene;
    private container!: Phaser.GameObjects.Container;
    private mainText!: Phaser.GameObjects.Text;
    private subText!: Phaser.GameObjects.Text;
    private dimOverlay!: Phaser.GameObjects.Graphics;
    private steps: TutorialStep[];
    private currentStep = 0;
    private active = false;
    private stepTimer = 0;
    private conditionMet = false;
    private onComplete: () => void;

    // Track player actions for conditions
    private hasFlapped = false;
    private hasMovedLeft = false;
    private hasMovedRight = false;
    private hasDefeatedEnemy = false;

    constructor(scene: Phaser.Scene, onComplete: () => void) {
        this.scene = scene;
        this.onComplete = onComplete;

        this.steps = IS_TOUCH ? this.getMobileSteps() : this.getDesktopSteps();
    }

    static shouldShow(): boolean {
        try {
            return !localStorage.getItem(TUTORIAL_KEY);
        } catch {
            return true;
        }
    }

    static markComplete(): void {
        try {
            localStorage.setItem(TUTORIAL_KEY, '1');
        } catch {
            // ignore
        }
    }

    private getDesktopSteps(): TutorialStep[] {
        return [
            {
                text: 'WELCOME TO FLAPPY KNIGHTS',
                subtext: 'You ride a war ostrich. Your lance is your weapon.',
                duration: 3000,
                condition: () => false,
            },
            {
                text: 'Press SPACE to flap',
                subtext: 'Gravity pulls you down — keep flapping!',
                condition: () => this.hasFlapped,
            },
            {
                text: 'Use ARROW KEYS to move',
                subtext: 'Try moving left and right',
                condition: () => this.hasMovedLeft && this.hasMovedRight,
            },
            {
                text: 'You keep your momentum!',
                subtext: 'Flap while moving to fly in arcs',
                duration: 3000,
                condition: () => false,
            },
            {
                text: 'COMBAT: Get ABOVE your enemy',
                subtext: 'The higher rider wins the collision!',
                duration: 4000,
                condition: () => false,
            },
            {
                text: 'Defeated enemies drop EGGS',
                subtext: 'Collect eggs for bonus points — or they hatch into tougher foes!',
                duration: 4000,
                condition: () => false,
            },
            {
                text: 'WATCH THE LAVA!',
                subtext: 'The bottom is instant death. Stay airborne!',
                duration: 3000,
                condition: () => false,
            },
            {
                text: 'GET READY!',
                subtext: '',
                duration: 1500,
                condition: () => false,
            },
        ];
    }

    private getMobileSteps(): TutorialStep[] {
        return [
            {
                text: 'WELCOME TO FLAPPY KNIGHTS',
                subtext: 'You ride a war ostrich. Your lance is your weapon.',
                duration: 3000,
                condition: () => false,
            },
            {
                text: 'Use the JOYSTICK to move',
                subtext: 'Drag the circle on the left',
                condition: () => this.hasMovedLeft || this.hasMovedRight,
            },
            {
                text: 'TAP anywhere else to FLAP',
                subtext: 'Keep tapping to stay in the air!',
                condition: () => this.hasFlapped,
            },
            {
                text: 'You keep your momentum!',
                subtext: 'Move + flap at the same time to fly in arcs',
                duration: 3000,
                condition: () => false,
            },
            {
                text: 'COMBAT: Get ABOVE your enemy',
                subtext: 'The higher rider wins the collision!',
                duration: 4000,
                condition: () => false,
            },
            {
                text: 'Defeated enemies drop EGGS',
                subtext: 'Collect eggs for bonus — or they hatch tougher!',
                duration: 4000,
                condition: () => false,
            },
            {
                text: 'WATCH THE LAVA!',
                subtext: 'The bottom is instant death!',
                duration: 3000,
                condition: () => false,
            },
            {
                text: 'GET READY!',
                subtext: '',
                duration: 1500,
                condition: () => false,
            },
        ];
    }

    start(): void {
        this.active = true;
        this.currentStep = 0;

        // Dim overlay
        this.dimOverlay = this.scene.add.graphics().setDepth(150);
        this.dimOverlay.fillStyle(0x000000, 0.5);
        this.dimOverlay.fillRect(0, 0, GAME.WIDTH, GAME.HEIGHT);

        // Main instruction text
        this.mainText = this.scene.add.text(GAME.WIDTH * 0.5, GAME.HEIGHT * 0.35, '', {
            fontFamily: ARCADE_FONT,
            fontSize: '28px',
            color: '#ffd700',
            stroke: '#000000',
            strokeThickness: 6,
            fontStyle: 'bold',
            align: 'center',
        }).setOrigin(0.5).setDepth(160);

        // Sub text
        this.subText = this.scene.add.text(GAME.WIDTH * 0.5, GAME.HEIGHT * 0.45, '', {
            fontFamily: ARCADE_FONT,
            fontSize: '15px',
            color: '#cccccc',
            stroke: '#000000',
            strokeThickness: 3,
            align: 'center',
        }).setOrigin(0.5).setDepth(160);

        this.container = this.scene.add.container(0, 0, [this.dimOverlay, this.mainText, this.subText]).setDepth(150);

        this.showStep(0);
    }

    private showStep(index: number): void {
        if (index >= this.steps.length) {
            this.complete();
            return;
        }

        const step = this.steps[index];
        this.currentStep = index;
        this.stepTimer = 0;
        this.conditionMet = false;

        // Animate text in
        this.mainText.setText(step.text);
        this.mainText.setAlpha(0);
        this.scene.tweens.add({
            targets: this.mainText,
            alpha: 1,
            duration: 300,
            ease: 'Power2',
        });

        this.subText.setText(step.subtext ?? '');
        this.subText.setAlpha(0);
        this.scene.tweens.add({
            targets: this.subText,
            alpha: 0.8,
            duration: 300,
            delay: 200,
            ease: 'Power2',
        });

        // Reduce dim after first step so player can see the game
        if (index > 0) {
            this.dimOverlay.clear();
            this.dimOverlay.fillStyle(0x000000, 0.3);
            this.dimOverlay.fillRect(0, 0, GAME.WIDTH, GAME.HEIGHT);
        }
    }

    private advanceStep(): void {
        // Fade out current
        this.scene.tweens.add({
            targets: [this.mainText, this.subText],
            alpha: 0,
            duration: 200,
            onComplete: () => {
                this.showStep(this.currentStep + 1);
            },
        });
    }

    private complete(): void {
        this.active = false;
        Tutorial.markComplete();

        // Fade out everything
        this.scene.tweens.add({
            targets: this.container,
            alpha: 0,
            duration: 500,
            onComplete: () => {
                this.container.destroy();
                this.onComplete();
            },
        });
    }

    // Called from Game.ts to notify of player actions
    notifyFlap(): void {
        this.hasFlapped = true;
    }

    notifyMoveLeft(): void {
        this.hasMovedLeft = true;
    }

    notifyMoveRight(): void {
        this.hasMovedRight = true;
    }

    notifyEnemyDefeated(): void {
        this.hasDefeatedEnemy = true;
    }

    isActive(): boolean {
        return this.active;
    }

    update(delta: number): void {
        if (!this.active) return;

        const step = this.steps[this.currentStep];
        if (!step) return;

        this.stepTimer += delta;

        // Check condition
        if (step.condition()) {
            this.conditionMet = true;
        }

        // Advance if condition met or duration elapsed
        if (this.conditionMet) {
            this.advanceStep();
            this.conditionMet = false;
        } else if (step.duration && this.stepTimer >= step.duration) {
            this.advanceStep();
        }
    }
}
