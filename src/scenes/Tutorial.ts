import { Scene } from 'phaser';
import { GAME, PLAYER, SAFE_ZONE, IS_TOUCH, JOYSTICK, ENEMY } from '../core/Constants';
import { Player } from '../objects/Player';
import { Enemy } from '../objects/Enemy';
import { Platform } from '../objects/Platform';
import { LavaPit } from '../objects/LavaPit';

const ARCADE_FONT = '"Courier New", Courier, monospace';

const TUTORIAL_PLATFORMS = [
    { x: 100, y: 400, w: 250, h: 16 },   // ground left
    { x: 700, y: 280, w: 250, h: 16 },   // mid right
    { x: 400, y: 180, w: 250, h: 16 },   // top center
];

export class Tutorial extends Scene {
    private player!: Player;
    private enemy?: Enemy;
    private platforms!: Phaser.Physics.Arcade.StaticGroup;
    private lavaPit!: LavaPit;
    private step = 0;
    private marker?: Phaser.GameObjects.Graphics;
    private markerTween?: Phaser.Tweens.Tween;
    private arrowGraphics?: Phaser.GameObjects.Graphics;
    private promptText!: Phaser.GameObjects.Text;
    private subText!: Phaser.GameObjects.Text;
    private stepDots: Phaser.GameObjects.Arc[] = [];
    private stepComplete = false;

    // Input
    private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
    private spaceKey!: Phaser.Input.Keyboard.Key;
    private touchFlap = false;
    private joystickGraphics!: Phaser.GameObjects.Graphics;
    private joystickKnob!: Phaser.GameObjects.Graphics;
    private joystickActive = false;
    private joystickPointerId = -1;
    private joystickValue = 0;
    private joystickOriginX = 0;
    private joystickOriginY = 0;

    constructor() {
        super('Tutorial');
    }

    create(): void {
        this.step = 0;
        this.stepComplete = false;
        this.enemy = undefined;

        // Background
        this.cameras.main.setBackgroundColor(GAME.BACKGROUND_COLOR);
        this.drawCaveBackground();

        // Physics
        this.physics.world.gravity.y = GAME.GRAVITY;
        this.physics.world.setBounds(0, 0, GAME.WIDTH, GAME.HEIGHT + 100);

        // Platforms
        this.platforms = this.physics.add.staticGroup();
        for (const p of TUTORIAL_PLATFORMS) {
            const plat = new Platform(this, p.x, p.y, p.w, p.h);
            this.platforms.add(plat);
        }

        // Lava
        this.lavaPit = new LavaPit(this);

        // Player — spawn on the LEFT side of the ground platform
        this.player = new Player(this, 140, 400 - PLAYER.SIZE * 0.5 - 10);
        this.physics.add.collider(this.player, this.platforms);

        // Player vs lava — respawn on ground platform
        this.physics.add.overlap(this.player, this.lavaPit.getZone(), () => {
            this.handlePlayerLava();
        });

        // Input
        if (this.input.keyboard) {
            this.cursors = this.input.keyboard.createCursorKeys();
            this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        }
        this.setupTouchInput();

        // Prompt text
        this.promptText = this.add.text(GAME.WIDTH * 0.5, SAFE_ZONE.TOP + 20, '', {
            fontFamily: ARCADE_FONT,
            fontSize: '28px',
            color: '#ffd700',
            stroke: '#000000',
            strokeThickness: 6,
            fontStyle: 'bold',
            align: 'center',
        }).setOrigin(0.5).setDepth(100);

        this.subText = this.add.text(GAME.WIDTH * 0.5, SAFE_ZONE.TOP + 52, '', {
            fontFamily: ARCADE_FONT,
            fontSize: '14px',
            color: '#888888',
            align: 'center',
        }).setOrigin(0.5).setDepth(100);

        // Skip button
        this.createSkipButton();

        // Step progress dots
        this.createStepDots();

        // Start step 1
        this.startStep1();
    }

    // ========================================
    // Cave background (same as Game.ts)
    // ========================================
    private drawCaveBackground(): void {
        const bg = this.add.image(GAME.WIDTH * 0.5, GAME.HEIGHT * 0.5, 'bg_castle');
        const bgScale = Math.max(GAME.WIDTH / bg.width, GAME.HEIGHT / bg.height);
        bg.setScale(bgScale).setDepth(-10).setAlpha(0.4);
    }

    // ========================================
    // Skip button
    // ========================================
    private createSkipButton(): void {
        const w = 100;
        const h = 36;
        const x = GAME.WIDTH - 70;
        const y = SAFE_ZONE.TOP + 20;

        const bg = this.add.graphics();
        bg.fillStyle(0x2a2a5a, 0.8);
        bg.fillRoundedRect(-w * 0.5, -h * 0.5, w, h, 6);
        bg.lineStyle(2, 0x5555aa);
        bg.strokeRoundedRect(-w * 0.5, -h * 0.5, w, h, 6);

        const text = this.add.text(0, 0, 'SKIP', {
            fontFamily: ARCADE_FONT,
            fontSize: '14px',
            color: '#ffd700',
            fontStyle: 'bold',
        }).setOrigin(0.5);

        const container = this.add.container(x, y, [bg, text]);
        container.setSize(w, h);
        container.setInteractive({ useHandCursor: true }).setDepth(100);

        container.on('pointerover', () => {
            bg.clear();
            bg.fillStyle(0x3a3a7a, 0.9);
            bg.fillRoundedRect(-w * 0.5, -h * 0.5, w, h, 6);
            bg.lineStyle(2, 0x7777cc);
            bg.strokeRoundedRect(-w * 0.5, -h * 0.5, w, h, 6);
        });
        container.on('pointerout', () => {
            bg.clear();
            bg.fillStyle(0x2a2a5a, 0.8);
            bg.fillRoundedRect(-w * 0.5, -h * 0.5, w, h, 6);
            bg.lineStyle(2, 0x5555aa);
            bg.strokeRoundedRect(-w * 0.5, -h * 0.5, w, h, 6);
        });
        container.on('pointerdown', () => {
            this.goToGame();
        });
    }

    // ========================================
    // Step progress dots
    // ========================================
    private createStepDots(): void {
        const cx = GAME.WIDTH * 0.5;
        const y = GAME.HEIGHT - 30;
        const spacing = 24;

        for (let i = 0; i < 3; i++) {
            const dotX = cx + (i - 1) * spacing;
            const dot = this.add.circle(dotX, y, 6, 0x333333, 1);
            dot.setStrokeStyle(2, 0xffd700);
            dot.setDepth(100);
            this.stepDots.push(dot);
        }
    }

    private updateStepDots(): void {
        for (let i = 0; i < this.stepDots.length; i++) {
            if (i < this.step) {
                this.stepDots[i].setFillStyle(0xffd700, 1);
            } else {
                this.stepDots[i].setFillStyle(0x333333, 1);
            }
        }
    }

    // ========================================
    // STEP 1: MOVE
    // ========================================
    private startStep1(): void {
        this.step = 1;
        this.stepComplete = false;
        this.updateStepDots();

        this.promptText.setText('MOVE TO THE MARKER');
        this.subText.setText(IS_TOUCH ? 'Use the joystick to move' : 'Use ARROW KEYS to move');

        // Place marker on right side of ground platform (x:100, w:250 => right edge ~350, marker at ~300)
        const markerX = 300;
        const markerY = 390;
        this.createMarker(markerX, markerY);
    }

    // ========================================
    // STEP 2: FLAP
    // ========================================
    private startStep2(): void {
        this.step = 2;
        this.stepComplete = false;
        this.updateStepDots();

        this.promptText.setText('FLAP UP TO THE PLATFORM');
        this.subText.setText(IS_TOUCH ? 'Tap right side of screen to flap' : 'Press SPACE to flap');

        // Marker on the mid-height right platform (x:700, y:280, w:250 => center ~825)
        const markerX = 825;
        const markerY = 270;
        this.createMarker(markerX, markerY);

        // Arrow pointing up from player
        this.arrowGraphics = this.add.graphics().setDepth(99);
    }

    // ========================================
    // STEP 3: KILL
    // ========================================
    private startStep3(): void {
        this.step = 3;
        this.stepComplete = false;
        this.updateStepDots();

        this.promptText.setText('FLY ABOVE THE ENEMY TO DEFEAT IT!');
        this.subText.setText('The HIGHER rider always wins');

        this.clearMarker();

        // Spawn enemy on top center platform (x:400, y:180, w:250)
        this.spawnTutorialEnemy();
    }

    private spawnTutorialEnemy(): void {
        const enemyX = 525;
        const enemyY = 150;

        this.enemy = new Enemy(this, enemyX, enemyY);
        this.physics.add.collider(this.enemy, this.platforms);
        this.enemy.activate('BOUNDER', enemyX, enemyY);

        // Set up combat overlap
        this.physics.add.overlap(this.player, this.enemy, () => {
            this.handleTutorialCombat();
        });
    }

    private handleTutorialCombat(): void {
        if (!this.enemy || !this.enemy.getIsActive() || this.stepComplete) return;

        const playerBottom = this.player.y + this.player.height * 0.3;
        const enemyBottom = this.enemy.y + this.enemy.height * 0.3;

        if (playerBottom < this.enemy.y) {
            // Player wins
            this.enemy.deactivate();
            this.stepComplete = true;
            this.showFloatingText('YOU\'RE READY!', this.player.x, this.player.y - 60, '#ffd700', 48, true);

            // Particles
            this.spawnCelebrationParticles(this.player.x, this.player.y);

            this.time.delayedCall(1000, () => {
                this.goToGame();
            });
        } else if (enemyBottom < this.player.y) {
            // Enemy wins — bounce player and reset
            const body = this.player.body as Phaser.Physics.Arcade.Body;
            body.setVelocityY(-200);

            this.showFloatingText('TRY AGAIN!', this.player.x, this.player.y - 40, '#ff4444', 24, false);

            // Respawn enemy
            this.enemy.deactivate();
            this.time.delayedCall(800, () => {
                if (this.step === 3 && !this.stepComplete) {
                    this.spawnTutorialEnemy();
                }
            });
        } else {
            // Equal — bounce both
            const body = this.player.body as Phaser.Physics.Arcade.Body;
            const eBody = this.enemy.body as Phaser.Physics.Arcade.Body;
            body.setVelocityY(-150);
            body.setVelocityX(this.player.x < this.enemy.x ? -150 : 150);
            eBody.setVelocityY(-150);
            eBody.setVelocityX(this.enemy.x < this.player.x ? -150 : 150);
        }
    }

    // ========================================
    // Marker (pulsing golden circle)
    // ========================================
    private createMarker(x: number, y: number): void {
        this.clearMarker();

        this.marker = this.add.graphics().setDepth(50);
        this.marker.fillStyle(0xffd700, 1);
        this.marker.fillCircle(x, y, 14);
        this.marker.setData('x', x);
        this.marker.setData('y', y);

        this.markerTween = this.tweens.add({
            targets: this.marker,
            alpha: { from: 1.0, to: 0.4 },
            duration: 600,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
        });
    }

    private clearMarker(): void {
        if (this.markerTween) {
            this.markerTween.destroy();
            this.markerTween = undefined;
        }
        if (this.marker) {
            this.marker.destroy();
            this.marker = undefined;
        }
        if (this.arrowGraphics) {
            this.arrowGraphics.destroy();
            this.arrowGraphics = undefined;
        }
    }

    // ========================================
    // Floating text
    // ========================================
    private showFloatingText(
        message: string,
        x: number,
        y: number,
        color: string,
        fontSize: number,
        scaleBounce: boolean,
    ): void {
        const text = this.add.text(x, y, message, {
            fontFamily: ARCADE_FONT,
            fontSize: `${fontSize}px`,
            color,
            stroke: '#000000',
            strokeThickness: 6,
            fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(150);

        if (scaleBounce) {
            text.setScale(0.3);
            this.tweens.add({
                targets: text,
                scale: 1.0,
                duration: 400,
                ease: 'Back.easeOut',
            });
        } else {
            this.tweens.add({
                targets: text,
                y: y - 50,
                alpha: 0,
                duration: 800,
                ease: 'Power2',
                onComplete: () => text.destroy(),
            });
        }
    }

    // ========================================
    // Celebration particles
    // ========================================
    private spawnCelebrationParticles(x: number, y: number): void {
        const emitter = this.add.particles(x, y, 'particle', {
            speed: { min: 80, max: 200 },
            angle: { min: 0, max: 360 },
            lifespan: 800,
            scale: { start: 0.6, end: 0.1 },
            alpha: { start: 1, end: 0 },
            tint: [0xffd700, 0xffaa00, 0xffffff, 0x44ff44],
            quantity: 20,
            gravityY: 150,
            emitting: false,
        });
        emitter.setDepth(120);
        emitter.explode(20, x, y);
        this.time.delayedCall(1000, () => emitter.destroy());
    }

    // ========================================
    // Lava handling
    // ========================================
    private handlePlayerLava(): void {
        if (this.player.getIsInvulnerable()) return;

        // Respawn on ground platform
        this.player.setPosition(140, 400 - PLAYER.SIZE * 0.5 - 10);
        (this.player.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
        this.player.damage();
    }

    // ========================================
    // Touch input (same as Game.ts)
    // ========================================
    private setupTouchInput(): void {
        if (!IS_TOUCH) return;

        this.joystickGraphics = this.add.graphics().setDepth(200);
        this.joystickKnob = this.add.graphics().setDepth(201);

        this.input.addPointer(1);

        this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            if (!this.joystickActive && pointer.x < GAME.WIDTH * 0.5) {
                this.joystickActive = true;
                this.joystickPointerId = pointer.id;
                this.joystickOriginX = pointer.x;
                this.joystickOriginY = pointer.y;

                this.joystickGraphics.clear();
                this.joystickGraphics.lineStyle(3, 0xffffff, JOYSTICK.ALPHA_ACTIVE);
                this.joystickGraphics.strokeCircle(this.joystickOriginX, this.joystickOriginY, JOYSTICK.RADIUS);
                this.drawKnob(this.joystickOriginX, this.joystickOriginY, JOYSTICK.ALPHA_ACTIVE);
            } else {
                this.touchFlap = true;
            }
        });

        this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
            if (pointer.id === this.joystickPointerId && this.joystickActive) {
                const dx = pointer.x - this.joystickOriginX;
                const clampedX = Phaser.Math.Clamp(dx, -JOYSTICK.RADIUS, JOYSTICK.RADIUS);
                this.joystickValue = clampedX / JOYSTICK.RADIUS;

                if (Math.abs(this.joystickValue) < JOYSTICK.DEAD_ZONE) {
                    this.joystickValue = 0;
                }

                this.drawKnob(
                    this.joystickOriginX + clampedX,
                    this.joystickOriginY,
                    JOYSTICK.ALPHA_ACTIVE,
                );
            }
        });

        this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
            if (pointer.id === this.joystickPointerId) {
                this.joystickActive = false;
                this.joystickPointerId = -1;
                this.joystickValue = 0;

                this.joystickGraphics.clear();
                this.joystickKnob.clear();
            }
        });
    }

    private drawKnob(x: number, y: number, alpha: number): void {
        this.joystickKnob.clear();
        this.joystickKnob.fillStyle(0xffffff, alpha);
        this.joystickKnob.fillCircle(x, y, JOYSTICK.KNOB_RADIUS);
    }

    // ========================================
    // Input handling
    // ========================================
    private handleInput(delta: number): void {
        let moveLeft = false;
        let moveRight = false;
        let doFlap = false;

        if (this.cursors) {
            moveLeft = this.cursors.left.isDown;
            moveRight = this.cursors.right.isDown;
        }
        if (this.spaceKey && Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
            doFlap = true;
        }

        if (IS_TOUCH) {
            if (this.joystickValue < -JOYSTICK.DEAD_ZONE) moveLeft = true;
            if (this.joystickValue > JOYSTICK.DEAD_ZONE) moveRight = true;
        }
        if (this.touchFlap) {
            doFlap = true;
            this.touchFlap = false;
        }

        if (moveLeft) {
            this.player.moveLeft(delta);
        } else if (moveRight) {
            this.player.moveRight(delta);
        } else {
            this.player.stopHorizontal();
        }

        if (doFlap) {
            this.player.flap();
        }
    }

    // ========================================
    // Verification logic
    // ========================================
    private checkStepCompletion(): void {
        if (this.stepComplete) return;

        if (this.step === 1 && this.marker) {
            const markerX = this.marker.getData('x') as number;
            if (Math.abs(this.player.x - markerX) < 30) {
                this.stepComplete = true;
                this.clearMarker();
                this.showFloatingText('NICE!', this.player.x, this.player.y - 40, '#44ff44', 28, false);
                this.time.delayedCall(500, () => {
                    this.startStep2();
                });
            }
        } else if (this.step === 2 && this.marker) {
            const markerX = this.marker.getData('x') as number;
            const markerY = this.marker.getData('y') as number;
            // Player must be near the mid platform level and near the marker
            if (this.player.y < 320 && Math.abs(this.player.x - markerX) < 60 && Math.abs(this.player.y - markerY) < 50) {
                this.stepComplete = true;
                this.clearMarker();
                this.showFloatingText('GREAT!', this.player.x, this.player.y - 40, '#44ff44', 28, false);
                this.time.delayedCall(500, () => {
                    this.startStep3();
                });
            }
        }
        // Step 3 is handled by handleTutorialCombat
    }

    // ========================================
    // Draw up arrow for step 2
    // ========================================
    private drawUpArrow(): void {
        if (!this.arrowGraphics || this.step !== 2) return;
        this.arrowGraphics.clear();

        const px = this.player.x;
        const py = this.player.y - 40;

        // Pulsing effect
        const pulse = 0.5 + Math.sin(this.time.now * 0.005) * 0.3;

        this.arrowGraphics.lineStyle(3, 0xffd700, pulse);
        // Shaft
        this.arrowGraphics.lineBetween(px, py, px, py - 40);
        // Arrowhead
        this.arrowGraphics.lineBetween(px, py - 40, px - 10, py - 28);
        this.arrowGraphics.lineBetween(px, py - 40, px + 10, py - 28);
    }

    // ========================================
    // Transition to game
    // ========================================
    private goToGame(): void {
        this.cameras.main.fadeOut(300, 0, 0, 0);
        this.time.delayedCall(300, () => {
            this.scene.start('Game');
        });
    }

    // ========================================
    // Update loop
    // ========================================
    update(time: number, delta: number): void {
        this.handleInput(delta);
        this.player.update(time, delta);

        // Update enemy AI (simplified — no wave scaling)
        if (this.enemy && this.enemy.getIsActive()) {
            this.enemy.update(time, delta, this.player.x, this.player.y, 0.5, 1);
        }

        // Update lava
        this.lavaPit.update(time);

        // Step 2 arrow
        this.drawUpArrow();

        // Check completion
        this.checkStepCompletion();
    }
}
