import { Scene } from 'phaser';
import { GAME, SAFE_ZONE, IS_TOUCH, JOYSTICK, PLAYER, WAVE, SPAWN_POINTS, ENEMY } from '../core/Constants';
import { EventBus, Events } from '../core/EventBus';
import { onJoin, getIsHost, setMyInput, type PlayroomPlayer } from '../multiplayer/playroom';
import { Player } from '../objects/Player';
import { Enemy, EnemyType } from '../objects/Enemy';
import { Egg } from '../objects/Egg';
import { Platform } from '../objects/Platform';
import { LavaPit } from '../objects/LavaPit';
import { audioManager } from '../audio/AudioManager';
import { capture } from '../analytics';
import type { PlayerResult } from '../multiplayer/types';

const ARCADE_FONT = '"Courier New", Courier, monospace';
const MAX_WAVES = 5;
const ATLAS_PREFIX: Record<string, string> = {
    BOUNDER: 'bounder',
    HUNTER: 'hunter',
    SHADOW_LORD: 'shadow',
};

interface MPPlayer {
    id: string;
    state: PlayroomPlayer;
    // Host only: full physics player
    player?: Player;
    // Non-host only: plain sprite for rendering
    sprite?: Phaser.GameObjects.Sprite;
    // Shared stats
    score: number;
    lives: number;
    combo: number;
    bestCombo: number;
    enemiesDefeated: number;
    joustWins: number;
    isRespawning: boolean;
}

interface PosState {
    x: number;
    y: number;
    vx: number;
    vy: number;
    flipX: boolean;
    anim: string;
    score: number;
    lives: number;
    isInvulnerable: boolean;
    isRespawning: boolean;
    combo: number;
}

interface EnemyData {
    id: number;
    type: string;
    x: number;
    y: number;
    flipX: boolean;
    anim: string;
}

interface EggData {
    id: number;
    x: number;
    y: number;
    active: boolean;
}

export class MultiplayerGame extends Scene {
    // Scene data
    private isHost = false;
    private myId = '';

    // Players
    private mpPlayers: MPPlayer[] = [];
    private localMPPlayer: MPPlayer | null = null;

    // Host-only: physics objects
    private enemies: Enemy[] = [];
    private eggs: Egg[] = [];
    private platforms!: Phaser.Physics.Arcade.StaticGroup;
    private lavaPit!: LavaPit;

    // Host-only: wave state
    private currentWave = 0;
    private spawnQueue: EnemyType[] = [];
    private spawnTimer = 0;
    private waveTransition = false;
    private waveTransitionTimer = 0;
    private smartPromoteTimer = 0;
    private isMatchOver = false;

    // Non-host: enemy sprites for rendering
    private enemySpriteSlots: (Phaser.GameObjects.Sprite | null)[] = [];
    private enemySlotTypes: string[] = [];
    // Non-host: egg sprites
    private eggSprites: Map<number, Phaser.GameObjects.Sprite> = new Map();

    // HUD
    private hudLocalScore!: Phaser.GameObjects.Text;
    private hudOpponentScore!: Phaser.GameObjects.Text;
    private hudWave!: Phaser.GameObjects.Text;
    private hudLocalLives!: Phaser.GameObjects.Text;
    private hudOpponentLives!: Phaser.GameObjects.Text;
    private waveText?: Phaser.GameObjects.Text;
    private waveSubText?: Phaser.GameObjects.Text;
    private countdownText?: Phaser.GameObjects.Text;

    // Input
    private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
    private spaceKey!: Phaser.Input.Keyboard.Key;
    private lastSentInput = 'stop';

    // Touch
    private touchFlap = false;
    private joystickGraphics!: Phaser.GameObjects.Graphics;
    private joystickKnob!: Phaser.GameObjects.Graphics;
    private joystickActive = false;
    private joystickPointerId = -1;
    private joystickValue = 0;
    private joystickOriginX = 0;
    private joystickOriginY = 0;

    // Waiting state
    private waitingText?: Phaser.GameObjects.Text;
    private gameStarted = false;

    constructor() {
        super('MultiplayerGame');
    }

    create(data: { isHost: boolean; myId: string }): void {
        this.isHost = data?.isHost ?? getIsHost();
        this.myId = data?.myId ?? '';
        this.mpPlayers = [];
        this.localMPPlayer = null;
        this.gameStarted = false;
        this.isMatchOver = false;
        this.currentWave = 0;
        this.spawnQueue = [];
        this.spawnTimer = 0;
        this.waveTransition = false;
        this.waveTransitionTimer = 0;
        this.smartPromoteTimer = 0;
        this.enemySpriteSlots = [];
        this.enemySlotTypes = [];
        this.eggSprites = new Map();
        this.enemies = [];
        this.eggs = [];

        console.log(`[MP] MultiplayerGame.create isHost=${this.isHost} myId=${this.myId}`);

        // Background
        this.cameras.main.setBackgroundColor(GAME.BACKGROUND_COLOR);
        this.drawCaveBackground();

        // Physics (host runs full physics, non-host still needs world for platforms visual)
        if (this.isHost) {
            this.physics.world.gravity.y = GAME.GRAVITY;
            this.physics.world.setBounds(0, 0, GAME.WIDTH, GAME.HEIGHT + 100);
        }

        // Platforms
        this.platforms = Platform.createAll(this);

        // Lava
        this.lavaPit = new LavaPit(this);

        // Host: create object pools
        if (this.isHost) {
            this.createEnemyPool(12);
            this.createEggPool(12);
        }

        // Input
        if (this.input.keyboard) {
            this.cursors = this.input.keyboard.createCursorKeys();
            this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        }
        this.setupTouchInput();

        // HUD
        this.createHUD();

        // Listen for player joins
        onJoin((playroomPlayer: PlayroomPlayer) => {
            this.handlePlayerJoin(playroomPlayer);
        });

        // Event listeners (host only, for eggs)
        if (this.isHost) {
            this.setupEventListeners();
        }

        // Waiting text
        this.waitingText = this.add.text(GAME.WIDTH * 0.5, GAME.HEIGHT * 0.4, 'WAITING FOR OPPONENT...', {
            fontFamily: ARCADE_FONT,
            fontSize: '28px',
            color: '#ffd700',
            stroke: '#000000',
            strokeThickness: 6,
            fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(50);

        // Start music
        audioManager.startBGM();
        capture('multiplayer_game_start', { isHost: this.isHost });
    }

    // ==========================================
    // PLAYER JOIN / QUIT
    // ==========================================

    private handlePlayerJoin(playroomPlayer: PlayroomPlayer): void {
        // Avoid duplicate joins
        if (this.mpPlayers.find(p => p.id === playroomPlayer.id)) return;

        const isSecondPlayer = this.mpPlayers.length === 1;
        const spawnX = this.mpPlayers.length === 0 ? GAME.WIDTH * 0.3 : GAME.WIDTH * 0.7;
        const spawnY = 300;

        const mp: MPPlayer = {
            id: playroomPlayer.id,
            state: playroomPlayer,
            score: 0,
            lives: PLAYER.START_LIVES,
            combo: 0,
            bestCombo: 0,
            enemiesDefeated: 0,
            joustWins: 0,
            isRespawning: false,
        };

        if (this.isHost) {
            // Create real physics Player
            const player = new Player(this, spawnX, spawnY);
            this.physics.add.collider(player, this.platforms);
            mp.player = player;

            // Glow for players
            if (playroomPlayer.isMe) {
                // Local player: gold glow (already added in Player constructor)
            } else {
                // Opponent: colored glow using their Playroom color
                player.setTint(0xff6666);
                if (player.postFX) {
                    player.postFX.clear();
                    const color = parseInt(playroomPlayer.color.replace('#', ''), 16) || 0x44ff44;
                    player.postFX.addGlow(color, 2, 0, false, 0.1, 10);
                }
            }

            // Set up collisions for this player vs enemies/eggs/lava
            this.setupPlayerCollisions(mp);
        } else {
            // Non-host: just a sprite
            const frames = this.textures.get('player_idle').getFrameNames().sort();
            const sprite = this.add.sprite(spawnX, spawnY, 'player_idle', frames[0]);
            sprite.setScale(1.4).setDepth(10);
            sprite.play('player_idle_anim');
            if (playroomPlayer.isMe) {
                // Local player: gold glow
                if (sprite.postFX) {
                    sprite.postFX.addGlow(0xffd700, 2, 0, false, 0.1, 10);
                }
            } else {
                // Opponent: their Playroom color glow
                sprite.setTint(0xff6666);
                if (sprite.postFX) {
                    const color = parseInt(playroomPlayer.color.replace('#', ''), 16) || 0x44ff44;
                    sprite.postFX.addGlow(color, 2, 0, false, 0.1, 10);
                }
            }
            mp.sprite = sprite;
        }

        // Track local player
        if (playroomPlayer.isMe) {
            this.localMPPlayer = mp;
        }

        this.mpPlayers.push(mp);
        console.log(`[MP] Player joined: ${playroomPlayer.id} isMe=${playroomPlayer.isMe} total=${this.mpPlayers.length}`);

        // Handle quit
        playroomPlayer.onQuit(() => {
            this.handlePlayerQuit(playroomPlayer.id);
        });

        // Start the game when 2 players are in
        if (this.mpPlayers.length >= 2 && !this.gameStarted) {
            this.startGame();
        }
    }

    private handlePlayerQuit(playerId: string): void {
        console.log(`[MP] Player quit: ${playerId}`);
        const idx = this.mpPlayers.findIndex(p => p.id === playerId);
        if (idx === -1) return;

        const mp = this.mpPlayers[idx];
        if (mp.player) mp.player.destroy();
        if (mp.sprite) mp.sprite.destroy();
        this.mpPlayers.splice(idx, 1);

        if (this.gameStarted && !this.isMatchOver) {
            this.showDisconnectMessage();
        }
    }

    private startGame(): void {
        this.gameStarted = true;
        if (this.waitingText) {
            this.waitingText.destroy();
            this.waitingText = undefined;
        }

        // Countdown
        this.showCountdown(3);
        this.time.delayedCall(1000, () => this.showCountdown(2));
        this.time.delayedCall(2000, () => this.showCountdown(1));
        this.time.delayedCall(3000, () => {
            if (this.isHost) {
                this.startWave(1);
            }
        });
    }

    // ==========================================
    // HOST: Object pools + collisions
    // ==========================================

    private createEnemyPool(count: number): void {
        for (let i = 0; i < count; i++) {
            const enemy = new Enemy(this, -100, -100);
            enemy.setData('mpId', i);
            this.physics.add.collider(enemy, this.platforms);
            this.enemies.push(enemy);
        }
    }

    private createEggPool(count: number): void {
        for (let i = 0; i < count; i++) {
            const egg = new Egg(this, -100, -100);
            egg.setData('mpId', i);
            this.physics.add.collider(egg, this.platforms);
            this.eggs.push(egg);
        }
    }

    private getInactiveEnemy(): Enemy | null {
        return this.enemies.find(e => !e.getIsActive()) ?? null;
    }

    private getInactiveEgg(): Egg | null {
        return this.eggs.find(e => !e.getIsActive()) ?? null;
    }

    private setupPlayerCollisions(mp: MPPlayer): void {
        if (!mp.player) return;

        // Player vs enemies
        for (const enemy of this.enemies) {
            this.physics.add.overlap(mp.player, enemy, () => {
                this.handleCombat(mp, enemy);
            });
        }

        // Player vs eggs
        for (const egg of this.eggs) {
            this.physics.add.overlap(mp.player, egg, () => {
                if (egg.getIsActive()) {
                    const points = egg.getPoints();
                    egg.collect();
                    mp.score += points;
                }
            });
        }

        // Player vs lava
        this.physics.add.overlap(mp.player, this.lavaPit.getZone(), () => {
            this.handlePlayerLava(mp);
        });
    }

    // ==========================================
    // HOST: Combat
    // ==========================================

    private handleCombat(mp: MPPlayer, enemy: Enemy): void {
        if (!enemy.getIsActive() || !mp.player || mp.isRespawning || this.isMatchOver) return;
        if (mp.player.getIsInvulnerable()) return;

        const playerBottom = mp.player.y + mp.player.height * 0.3;
        const enemyBottom = enemy.y + enemy.height * 0.3;

        if (playerBottom < enemy.y) {
            // Player higher, player wins
            this.defeatEnemy(mp, enemy);
        } else if (enemyBottom < mp.player.y) {
            // Enemy wins
            this.playerHit(mp);
        } else {
            // Bounce
            const body = mp.player.body as Phaser.Physics.Arcade.Body;
            const eBody = enemy.body as Phaser.Physics.Arcade.Body;
            body.setVelocityY(-150);
            body.setVelocityX(mp.player.x < enemy.x ? -150 : 150);
            eBody.setVelocityY(-150);
            eBody.setVelocityX(enemy.x < mp.player.x ? -150 : 150);
        }
    }

    private defeatEnemy(mp: MPPlayer, enemy: Enemy): void {
        const points = enemy.getPoints();
        const type = enemy.getEnemyType();

        // Drop egg
        const egg = this.getInactiveEgg();
        if (egg) {
            egg.activate(enemy.x, enemy.y, type);
        }

        enemy.deactivate();
        mp.score += points;
        mp.combo++;
        mp.enemiesDefeated++;
        if (mp.combo > mp.bestCombo) mp.bestCombo = mp.combo;

        this.checkWaveComplete();
    }

    private playerHit(mp: MPPlayer): void {
        if (!mp.player || mp.player.getIsInvulnerable() || mp.isRespawning || this.isMatchOver) return;

        mp.lives--;
        mp.combo = 0;
        mp.player.damage();

        // Bounce player
        const body = mp.player.body as Phaser.Physics.Arcade.Body;
        body.setVelocityY(-200);

        if (mp.lives <= 0) {
            this.handlePlayerEliminated(mp);
        }
    }

    private handlePlayerLava(mp: MPPlayer): void {
        if (this.isMatchOver || !mp.player || mp.player.getIsInvulnerable() || mp.isRespawning) return;

        mp.lives--;

        if (mp.lives <= 0) {
            this.handlePlayerEliminated(mp);
        } else {
            // Respawn above
            mp.isRespawning = true;
            mp.player.setVisible(false);
            (mp.player.body as Phaser.Physics.Arcade.Body).enable = false;

            this.time.delayedCall(2000, () => {
                if (!mp.player || this.isMatchOver) return;
                mp.player.setPosition(GAME.WIDTH * 0.5, GAME.HEIGHT * 0.3);
                (mp.player.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
                (mp.player.body as Phaser.Physics.Arcade.Body).enable = true;
                mp.player.setVisible(true);
                mp.player.damage(); // invulnerability
                mp.isRespawning = false;
            });
        }
    }

    private handlePlayerEliminated(mp: MPPlayer): void {
        if (!mp.player) return;
        mp.isRespawning = true;
        mp.player.setVisible(false);
        (mp.player.body as Phaser.Physics.Arcade.Body).enable = false;

        // Check if match should end (other player wins)
        const alivePlayers = this.mpPlayers.filter(p => p.lives > 0);
        if (alivePlayers.length <= 1) {
            this.endMatch();
        }
    }

    // Host: PvP jousting
    private checkPvPCombat(): void {
        const players = this.mpPlayers.filter(p => p.player && p.lives > 0 && !p.isRespawning);
        if (players.length !== 2) return;

        const [p1, p2] = players;
        if (!p1.player || !p2.player) return;

        const dist = Phaser.Math.Distance.Between(p1.player.x, p1.player.y, p2.player.x, p2.player.y);
        if (dist > 40) return;

        // Both players must not be invulnerable
        if (p1.player.getIsInvulnerable() || p2.player.getIsInvulnerable()) return;

        const diff = p1.player.y - p2.player.y;
        if (Math.abs(diff) < 5) {
            // Equal height - bounce
            (p1.player.body as Phaser.Physics.Arcade.Body).setVelocity(
                p1.player.x < p2.player.x ? -150 : 150, -150
            );
            (p2.player.body as Phaser.Physics.Arcade.Body).setVelocity(
                p2.player.x < p1.player.x ? -150 : 150, -150
            );
        } else if (diff < 0) {
            // p1 is higher (lower Y), p1 wins joust
            p1.score += 1000;
            p1.joustWins++;
            this.joustDefeat(p2);
        } else {
            // p2 is higher, p2 wins joust
            p2.score += 1000;
            p2.joustWins++;
            this.joustDefeat(p1);
        }
    }

    private joustDefeat(mp: MPPlayer): void {
        if (!mp.player) return;
        mp.lives--;
        mp.combo = 0;
        mp.player.damage();

        const body = mp.player.body as Phaser.Physics.Arcade.Body;
        body.setVelocityY(-200);

        if (mp.lives <= 0) {
            this.handlePlayerEliminated(mp);
        } else {
            // Respawn after 2 seconds
            mp.isRespawning = true;
            mp.player.setVisible(false);
            (mp.player.body as Phaser.Physics.Arcade.Body).enable = false;

            this.time.delayedCall(2000, () => {
                if (!mp.player || this.isMatchOver) return;
                mp.player.setPosition(GAME.WIDTH * 0.5, GAME.HEIGHT * 0.3);
                (mp.player.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
                (mp.player.body as Phaser.Physics.Arcade.Body).enable = true;
                mp.player.setVisible(true);
                mp.player.damage();
                mp.isRespawning = false;
            });
        }
    }

    // ==========================================
    // HOST: Wave management
    // ==========================================

    private startWave(wave: number): void {
        this.currentWave = wave;
        this.spawnQueue = this.generateWaveEnemies(wave);
        Phaser.Utils.Array.Shuffle(this.spawnQueue);
        this.spawnTimer = 0;
        this.smartPromoteTimer = 0;
        this.waveTransition = false;

        this.showWaveText(wave);

        // Broadcast wave to non-host via first player's state
        if (this.mpPlayers[0]) {
            this.mpPlayers[0].state.setState('wave', wave);
        }
    }

    private generateWaveEnemies(wave: number): EnemyType[] {
        const totalEnemies = Math.min(WAVE.BASE_ENEMIES + wave, WAVE.MAX_ENEMIES);
        const enemies: EnemyType[] = [];

        for (let i = 0; i < totalEnemies; i++) {
            const roll = Math.random();
            if (wave <= 2) {
                enemies.push(roll < 0.85 ? 'BOUNDER' : 'HUNTER');
            } else if (wave <= 4) {
                const hunterChance = 0.2 + (wave - 3) * 0.15;
                const shadowChance = wave >= 4 ? 0.1 : 0;
                if (roll < shadowChance) enemies.push('SHADOW_LORD');
                else if (roll < shadowChance + hunterChance) enemies.push('HUNTER');
                else enemies.push('BOUNDER');
            } else {
                const shadowChance = Math.min(0.5, 0.3 + (wave - 5) * 0.1);
                const hunterChance = 0.3;
                if (roll < shadowChance) enemies.push('SHADOW_LORD');
                else if (roll < shadowChance + hunterChance) enemies.push('HUNTER');
                else enemies.push('BOUNDER');
            }
        }

        return enemies;
    }

    private spawnNextEnemy(): void {
        if (this.spawnQueue.length === 0) return;

        const type = this.spawnQueue.shift()!;
        const enemy = this.getInactiveEnemy();
        if (!enemy) return;

        const spawnPoint = Phaser.Utils.Array.GetRandom(SPAWN_POINTS);
        enemy.activate(type, spawnPoint.x, spawnPoint.y);
    }

    private checkWaveComplete(): void {
        if (this.waveTransition || this.isMatchOver) return;

        const activeEnemies = this.enemies.filter(e => e.getIsActive()).length;
        if (activeEnemies === 0 && this.spawnQueue.length === 0) {
            this.endWave();
        }
    }

    private endWave(): void {
        this.waveTransition = true;
        this.waveTransitionTimer = WAVE.WAVE_PAUSE;

        if (this.currentWave >= MAX_WAVES) {
            // Match over after final wave
            this.time.delayedCall(WAVE.WAVE_PAUSE, () => {
                this.endMatch();
            });
        }
    }

    private endMatch(): void {
        if (this.isMatchOver) return;
        this.isMatchOver = true;

        // Determine winner (highest score, or last player standing)
        let winnerId = '';
        const alivePlayers = this.mpPlayers.filter(p => p.lives > 0);
        if (alivePlayers.length === 1) {
            winnerId = alivePlayers[0].id;
        } else {
            // Both alive or both dead - highest score wins
            const sorted = [...this.mpPlayers].sort((a, b) => b.score - a.score);
            winnerId = sorted[0].id;
        }

        const playerResults: PlayerResult[] = this.mpPlayers.map(p => ({
            id: p.id,
            score: p.score,
            wave: this.currentWave,
            bestCombo: p.bestCombo,
            enemiesDefeated: p.enemiesDefeated,
            joustWins: p.joustWins,
        }));

        // Write match result to all players' state
        for (const mp of this.mpPlayers) {
            mp.state.setState('matchResult', {
                winner: winnerId,
                players: playerResults,
            });
        }

        // Host transitions to results
        this.time.delayedCall(1500, () => {
            this.shutdown();
            this.scene.start('MultiplayerResults', {
                winner: winnerId,
                players: playerResults,
                localPlayerId: this.myId,
            });
        });
    }

    // ==========================================
    // HOST: Input reading + state sync
    // ==========================================

    private readHostInputs(): void {
        for (const mp of this.mpPlayers) {
            if (!mp.player || mp.isRespawning) continue;

            const inputState = mp.state.getState('input') as { action: string } | null;
            if (!inputState) continue;

            const action = inputState.action;
            mp.state.setState('input', null); // consume

            switch (action) {
                case 'flap':
                    mp.player.flap();
                    break;
                case 'left':
                    mp.player.moveLeft(16);
                    break;
                case 'right':
                    mp.player.moveRight(16);
                    break;
                case 'stop':
                    mp.player.stopHorizontal();
                    break;
            }
        }
    }

    private syncStateToClients(): void {
        // Write each player's position/state
        for (const mp of this.mpPlayers) {
            if (!mp.player) continue;

            const body = mp.player.body as Phaser.Physics.Arcade.Body;
            const posState: PosState = {
                x: mp.player.x,
                y: mp.player.y,
                vx: body.velocity.x,
                vy: body.velocity.y,
                flipX: mp.player.flipX,
                anim: mp.player.anims?.currentAnim?.key ?? '',
                score: mp.score,
                lives: mp.lives,
                isInvulnerable: mp.player.getIsInvulnerable(),
                isRespawning: mp.isRespawning,
                combo: mp.combo,
            };
            mp.state.setState('pos', posState);
        }

        // Write enemy data on first player's state
        if (this.mpPlayers[0]) {
            const enemyData: EnemyData[] = this.enemies
                .filter(e => e.getIsActive())
                .map(e => ({
                    id: e.getData('mpId') as number,
                    type: e.getEnemyType(),
                    x: e.x,
                    y: e.y,
                    flipX: e.flipX,
                    anim: e.anims?.currentAnim?.key ?? '',
                }));
            this.mpPlayers[0].state.setState('enemies', enemyData);

            // Write egg data
            const eggData: EggData[] = this.eggs
                .filter(e => e.getIsActive())
                .map(e => ({
                    id: e.getData('mpId') as number,
                    x: e.x,
                    y: e.y,
                    active: true,
                }));
            this.mpPlayers[0].state.setState('eggs', eggData);
        }
    }

    // ==========================================
    // NON-HOST: Input sending
    // ==========================================

    private handleLocalInput(): void {
        let moveDir: 'left' | 'right' | 'stop' = 'stop';
        let doFlap = false;

        // Keyboard
        if (this.cursors) {
            if (this.cursors.left.isDown) moveDir = 'left';
            else if (this.cursors.right.isDown) moveDir = 'right';
        }
        if (this.spaceKey && Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
            doFlap = true;
        }

        // Touch joystick
        if (IS_TOUCH) {
            if (this.joystickValue < -JOYSTICK.DEAD_ZONE) moveDir = 'left';
            else if (this.joystickValue > JOYSTICK.DEAD_ZONE) moveDir = 'right';
        }
        if (this.touchFlap) {
            doFlap = true;
            this.touchFlap = false;
        }

        // Send input to host
        if (doFlap) {
            setMyInput('flap');
        } else if (moveDir !== this.lastSentInput) {
            setMyInput(moveDir);
            this.lastSentInput = moveDir;
        }
    }

    // For the host's own local input (the host also plays)
    private handleHostLocalInput(): void {
        if (!this.localMPPlayer?.player || this.localMPPlayer.isRespawning) return;

        let moveDir: 'left' | 'right' | 'stop' = 'stop';
        let doFlap = false;

        if (this.cursors) {
            if (this.cursors.left.isDown) moveDir = 'left';
            else if (this.cursors.right.isDown) moveDir = 'right';
        }
        if (this.spaceKey && Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
            doFlap = true;
        }

        if (IS_TOUCH) {
            if (this.joystickValue < -JOYSTICK.DEAD_ZONE) moveDir = 'left';
            else if (this.joystickValue > JOYSTICK.DEAD_ZONE) moveDir = 'right';
        }
        if (this.touchFlap) {
            doFlap = true;
            this.touchFlap = false;
        }

        const player = this.localMPPlayer.player;

        if (doFlap) {
            player.flap();
        }

        if (moveDir === 'left') {
            player.moveLeft(16);
        } else if (moveDir === 'right') {
            player.moveRight(16);
        } else {
            player.stopHorizontal();
        }
    }

    // ==========================================
    // NON-HOST: Rendering from state
    // ==========================================

    private renderFromState(): void {
        for (const mp of this.mpPlayers) {
            const pos = mp.state.getState('pos') as PosState | null;
            if (!pos) continue;

            // Update stats from state
            mp.score = pos.score;
            mp.lives = pos.lives;

            const sprite = mp.sprite;
            if (!sprite) continue;

            if (pos.isRespawning) {
                sprite.setVisible(false);
                continue;
            }
            sprite.setVisible(true);

            // Lerp position
            sprite.x = Phaser.Math.Linear(sprite.x, pos.x, 0.3);
            sprite.y = Phaser.Math.Linear(sprite.y, pos.y, 0.3);
            sprite.setFlipX(pos.flipX);

            // Invulnerability flash
            if (pos.isInvulnerable) {
                sprite.setAlpha(Math.sin(Date.now() * 0.01) > 0 ? 1 : 0.3);
            } else {
                sprite.setAlpha(1);
            }

            // Animation
            if (pos.anim && this.anims.exists(pos.anim) && sprite.anims?.currentAnim?.key !== pos.anim) {
                sprite.play(pos.anim, true);
            }
        }

        // Render enemies from first player's state
        const enemyData = this.mpPlayers[0]?.state.getState('enemies') as EnemyData[] | null;
        if (enemyData) {
            this.syncEnemySprites(enemyData);
        }

        // Render eggs
        const eggData = this.mpPlayers[0]?.state.getState('eggs') as EggData[] | null;
        if (eggData) {
            this.syncEggSprites(eggData);
        }

        // Read wave
        const wave = this.mpPlayers[0]?.state.getState('wave') as number | null;
        if (wave && wave !== this.currentWave) {
            this.currentWave = wave;
            this.showWaveText(wave);
        }

        // Check for match result
        for (const mp of this.mpPlayers) {
            const result = mp.state.getState('matchResult') as {
                winner: string;
                players: PlayerResult[];
            } | null;
            if (result && !this.isMatchOver) {
                this.isMatchOver = true;
                this.time.delayedCall(1500, () => {
                    this.shutdown();
                    this.scene.start('MultiplayerResults', {
                        winner: result.winner,
                        players: result.players,
                        localPlayerId: this.myId,
                    });
                });
                break;
            }
        }
    }

    private syncEnemySprites(enemies: EnemyData[]): void {
        // Hide all existing slots first
        for (const sprite of this.enemySpriteSlots) {
            if (sprite) sprite.setVisible(false);
        }

        for (let i = 0; i < enemies.length; i++) {
            const e = enemies[i];

            while (this.enemySpriteSlots.length <= i) {
                this.enemySpriteSlots.push(null);
                this.enemySlotTypes.push('');
            }

            const prefix = ATLAS_PREFIX[e.type] || 'bounder';
            let sprite = this.enemySpriteSlots[i];

            // Recreate if type changed
            if (sprite && this.enemySlotTypes[i] !== e.type) {
                sprite.destroy();
                sprite = null;
            }

            if (!sprite) {
                const atlasKey = `${prefix}_idle`;
                if (!this.textures.exists(atlasKey)) continue;
                const frames = this.textures.get(atlasKey).getFrameNames().sort();
                sprite = this.add.sprite(e.x, e.y, atlasKey, frames[0]);
                sprite.setScale(1.4).setDepth(9);
                this.enemySpriteSlots[i] = sprite;
                this.enemySlotTypes[i] = e.type;
            }

            sprite.x = Phaser.Math.Linear(sprite.x, e.x, 0.3);
            sprite.y = Phaser.Math.Linear(sprite.y, e.y, 0.3);
            sprite.setFlipX(e.flipX);
            sprite.setVisible(true);

            if (e.anim && this.anims.exists(e.anim) && sprite.anims?.currentAnim?.key !== e.anim) {
                sprite.play(e.anim, true);
            }
        }
    }

    private syncEggSprites(eggs: EggData[]): void {
        const activeIds = new Set<number>();

        for (const e of eggs) {
            if (!e.active) continue;
            activeIds.add(e.id);

            let sprite = this.eggSprites.get(e.id);
            if (!sprite) {
                sprite = this.add.sprite(e.x, e.y, 'egg');
                sprite.setDepth(5);
                this.eggSprites.set(e.id, sprite);
            }

            sprite.x = e.x;
            sprite.y = e.y;
            sprite.setVisible(true);
        }

        for (const [id, sprite] of this.eggSprites) {
            if (!activeIds.has(id)) {
                sprite.setVisible(false);
            }
        }
    }

    // ==========================================
    // COMMON: Visual helpers
    // ==========================================

    private drawCaveBackground(): void {
        const bg = this.add.image(GAME.WIDTH * 0.5, GAME.HEIGHT * 0.5, 'bg_castle');
        const bgScale = Math.max(GAME.WIDTH / bg.width, GAME.HEIGHT / bg.height);
        bg.setScale(bgScale).setDepth(-10).setAlpha(0.4);
    }

    private createHUD(): void {
        const hudY = SAFE_ZONE.TOP + 4;

        this.hudLocalScore = this.add.text(10, hudY, '0', {
            fontFamily: ARCADE_FONT, fontSize: '28px', color: '#ffd700',
            fontStyle: 'bold', stroke: '#000000', strokeThickness: 4,
        }).setDepth(100);

        this.hudLocalLives = this.add.text(10, hudY + 32, '\u2665\u2665\u2665', {
            fontFamily: ARCADE_FONT, fontSize: '22px', color: '#ff4444',
            stroke: '#000000', strokeThickness: 3,
        }).setDepth(100);

        this.hudWave = this.add.text(GAME.WIDTH * 0.5, hudY, 'W1', {
            fontFamily: ARCADE_FONT, fontSize: '28px', color: '#aaaacc',
            fontStyle: 'bold', stroke: '#000000', strokeThickness: 4,
        }).setOrigin(0.5, 0).setDepth(100);

        this.hudOpponentScore = this.add.text(GAME.WIDTH - 10, hudY, '0', {
            fontFamily: ARCADE_FONT, fontSize: '28px', color: '#ff6666',
            fontStyle: 'bold', stroke: '#000000', strokeThickness: 4,
        }).setOrigin(1, 0).setDepth(100);

        this.hudOpponentLives = this.add.text(GAME.WIDTH - 10, hudY + 32, '\u2665\u2665\u2665', {
            fontFamily: ARCADE_FONT, fontSize: '22px', color: '#ff4444',
            stroke: '#000000', strokeThickness: 3,
        }).setOrigin(1, 0).setDepth(100);
    }

    private updateHUD(): void {
        const local = this.mpPlayers.find(p => p.id === this.myId);
        const opponent = this.mpPlayers.find(p => p.id !== this.myId);

        if (local) {
            this.hudLocalScore.setText(`${local.score}`);
            this.hudLocalLives.setText('\u2665'.repeat(Math.max(0, local.lives)));
        }
        if (opponent) {
            this.hudOpponentScore.setText(`${opponent.score}`);
            this.hudOpponentLives.setText('\u2665'.repeat(Math.max(0, opponent.lives)));
        }

        this.hudWave.setText(`W${this.currentWave || 1}`);
    }

    private showWaveText(wave: number): void {
        if (this.waveText) this.waveText.destroy();
        if (this.waveSubText) this.waveSubText.destroy();

        this.waveText = this.add.text(GAME.WIDTH * 0.5, GAME.HEIGHT * 0.38, `WAVE ${wave}`, {
            fontFamily: ARCADE_FONT,
            fontSize: '52px',
            color: '#ffd700',
            stroke: '#000000',
            strokeThickness: 8,
            fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(20);

        if (wave === MAX_WAVES) {
            this.waveSubText = this.add.text(GAME.WIDTH * 0.5, GAME.HEIGHT * 0.44, 'FINAL WAVE', {
                fontFamily: ARCADE_FONT,
                fontSize: '24px',
                color: '#ff4444',
                stroke: '#000000',
                strokeThickness: 5,
                fontStyle: 'bold',
                letterSpacing: 4,
            }).setOrigin(0.5).setDepth(20);

            this.tweens.add({
                targets: this.waveSubText,
                alpha: 0, y: GAME.HEIGHT * 0.42,
                duration: WAVE.NEXT_WAVE_DISPLAY_TIME,
                ease: 'Power2',
                onComplete: () => { if (this.waveSubText) this.waveSubText.destroy(); },
            });
        }

        this.tweens.add({
            targets: this.waveText,
            alpha: 0, y: GAME.HEIGHT * 0.33,
            duration: WAVE.NEXT_WAVE_DISPLAY_TIME,
            ease: 'Power2',
            onComplete: () => { if (this.waveText) this.waveText.destroy(); },
        });
    }

    private showCountdown(seconds: number): void {
        if (this.countdownText) this.countdownText.destroy();
        if (seconds <= 0) return;

        this.countdownText = this.add.text(GAME.WIDTH * 0.5, GAME.HEIGHT * 0.4, `${seconds}`, {
            fontFamily: ARCADE_FONT, fontSize: '72px', color: '#ffd700',
            stroke: '#000000', strokeThickness: 10, fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(50);

        this.tweens.add({
            targets: this.countdownText,
            scaleX: 1.5, scaleY: 1.5, alpha: 0,
            duration: 900, ease: 'Power2',
            onComplete: () => { if (this.countdownText) this.countdownText.destroy(); },
        });
    }

    private showDisconnectMessage(): void {
        this.add.text(GAME.WIDTH * 0.5, GAME.HEIGHT * 0.4, 'OPPONENT DISCONNECTED', {
            fontFamily: ARCADE_FONT, fontSize: '32px', color: '#ff4444',
            stroke: '#000000', strokeThickness: 6, fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(50);

        this.time.delayedCall(2000, () => {
            this.shutdown();
            this.scene.start('TitleScreen');
        });
    }

    // ==========================================
    // TOUCH INPUT
    // ==========================================

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
                if (Math.abs(this.joystickValue) < JOYSTICK.DEAD_ZONE) this.joystickValue = 0;
                this.drawKnob(this.joystickOriginX + clampedX, this.joystickOriginY, JOYSTICK.ALPHA_ACTIVE);
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

    // ==========================================
    // EVENT LISTENERS (Host only)
    // ==========================================

    private setupEventListeners(): void {
        EventBus.on(Events.EGG_COLLECTED, (_data: { points: number }) => {
            // Points already added in overlap handler
            this.time.delayedCall(50, () => this.checkWaveComplete());
        });

        EventBus.on(Events.EGG_HATCHED, (data: { x: number; y: number; sourceType: EnemyType }) => {
            const enemy = this.getInactiveEnemy();
            if (enemy) {
                const tougherType = this.getTougherType(data.sourceType);
                enemy.activate(tougherType, data.x, data.y);
                // Re-setup collisions for new enemy position
            }
            this.time.delayedCall(50, () => this.checkWaveComplete());
        });
    }

    private getTougherType(current: EnemyType): EnemyType {
        if (current === 'BOUNDER') return 'HUNTER';
        if (current === 'HUNTER') return 'SHADOW_LORD';
        return 'SHADOW_LORD';
    }

    // ==========================================
    // UPDATE LOOP
    // ==========================================

    update(time: number, delta: number): void {
        if (this.isMatchOver) return;

        if (this.isHost) {
            this.updateHost(time, delta);
        } else {
            this.updateNonHost();
        }

        // Update lava visuals (both host and non-host)
        this.lavaPit.update(time);

        // Update HUD
        this.updateHUD();
    }

    private updateHost(time: number, delta: number): void {
        if (!this.gameStarted) return;

        // Read remote player inputs
        this.readHostInputs();

        // Handle host's own local input directly (bypass state for zero latency)
        this.handleHostLocalInput();

        // Update all players
        for (const mp of this.mpPlayers) {
            if (mp.player && !mp.isRespawning) {
                mp.player.update(time, delta);
            }
        }

        // Update enemies
        const waveSpeedScale = Math.min(
            1 + (this.currentWave - 1) * ENEMY.WAVE_SPEED_SCALE,
            ENEMY.MAX_SPEED_MULTIPLIER
        );

        // Find nearest alive player for enemy AI tracking
        const alivePlayers = this.mpPlayers.filter(p => p.player && p.lives > 0 && !p.isRespawning);
        const trackTarget = alivePlayers[0]?.player;

        for (const enemy of this.enemies) {
            if (enemy.getIsActive() && trackTarget) {
                enemy.update(time, delta, trackTarget.x, trackTarget.y, waveSpeedScale, this.currentWave);
            }
        }

        // Smart promotion
        this.smartPromoteTimer += delta;
        if (this.smartPromoteTimer >= ENEMY.SMART_PROMOTE_INTERVAL) {
            this.smartPromoteTimer = 0;
            const dumbEnemy = this.enemies.find(e => e.getIsActive() && !e.getIsSmart());
            if (dumbEnemy) {
                dumbEnemy.promoteToSmart();
            }
        }

        // Update eggs
        for (const egg of this.eggs) {
            if (egg.getIsActive()) {
                egg.update(time, delta);
            }
        }

        // Spawn enemies from queue
        if (this.spawnQueue.length > 0) {
            this.spawnTimer -= delta;
            if (this.spawnTimer <= 0) {
                this.spawnNextEnemy();
                this.spawnTimer = WAVE.SPAWN_DELAY;
            }
        }

        // Wave transition
        if (this.waveTransition && this.currentWave < MAX_WAVES) {
            this.waveTransitionTimer -= delta;
            if (this.waveTransitionTimer <= 0) {
                this.waveTransition = false;
                this.startWave(this.currentWave + 1);
            }
        }

        // PvP combat check
        this.checkPvPCombat();

        // Periodic wave completion check
        this.checkWaveComplete();

        // Sync state to clients
        this.syncStateToClients();
    }

    private updateNonHost(): void {
        // Send local input to host via Playroom state
        this.handleLocalInput();

        // Render everything from state
        this.renderFromState();
    }

    // ==========================================
    // CLEANUP
    // ==========================================

    shutdown(): void {
        audioManager.stopBGM();
        EventBus.off(Events.EGG_COLLECTED);
        EventBus.off(Events.EGG_HATCHED);

        // Clean up players
        for (const mp of this.mpPlayers) {
            if (mp.player) mp.player.destroy();
            if (mp.sprite) mp.sprite.destroy();
        }
        this.mpPlayers = [];

        // Clean up enemy sprites (non-host)
        this.enemySpriteSlots.forEach(s => { if (s) s.destroy(); });
        this.enemySpriteSlots = [];
        this.enemySlotTypes = [];

        // Clean up egg sprites (non-host)
        this.eggSprites.forEach(s => s.destroy());
        this.eggSprites.clear();

        // Clean up joystick
        if (this.joystickGraphics) this.joystickGraphics.destroy();
        if (this.joystickKnob) this.joystickKnob.destroy();

        if (this.waitingText) {
            this.waitingText.destroy();
            this.waitingText = undefined;
        }
    }
}
