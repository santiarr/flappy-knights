import { PLAYER } from './Constants';

export const GameState = {
    score: 0,
    bestScore: 0,
    lives: PLAYER.START_LIVES,
    wave: 1,
    enemiesRemaining: 0,
    combo: 0,
    bestCombo: 0,
    isMuted: false,
    bonusLivesAwarded: 0, // tracks how many bonus life thresholds have been hit

    reset(): void {
        this.score = 0;
        this.lives = PLAYER.START_LIVES;
        this.wave = 1;
        this.enemiesRemaining = 0;
        this.combo = 0;
        this.bestCombo = 0;
        this.bonusLivesAwarded = 0;
        // bestScore preserved intentionally
    },

    addScore(points: number): void {
        this.score += points;
        if (this.score > this.bestScore) {
            this.bestScore = this.score;
        }
    },

    incrementCombo(): void {
        this.combo++;
        if (this.combo > this.bestCombo) {
            this.bestCombo = this.combo;
        }
    },

    resetCombo(): void {
        this.combo = 0;
    },
};
