import posthog from 'posthog-js';
import { EventBus, Events } from './core/EventBus';
import { GameState } from './core/GameState';

let sessionStart = 0;

export function initAnalytics(): void {
    posthog.init(import.meta.env.VITE_POSTHOG_KEY as string, {
        api_host: import.meta.env.VITE_POSTHOG_HOST as string,
        capture_pageview: true,
        persistence: 'localStorage',
    });

    // Game session begins when the game scene starts
    EventBus.on(Events.GAME_START, () => {
        sessionStart = Date.now();
        posthog.capture('game_start', {
            wave: GameState.wave,
        });
    });

    // Game over — captures final session stats
    EventBus.on(Events.GAME_OVER, () => {
        const timePlayed = Math.round((Date.now() - sessionStart) / 1000);
        posthog.capture('game_over', {
            score: GameState.score,
            best_score: GameState.bestScore,
            wave_reached: GameState.wave,
            best_combo: GameState.bestCombo,
            lives_remaining: GameState.lives,
            time_played_seconds: timePlayed,
            is_new_best: GameState.score >= GameState.bestScore,
        });
    });

    // Wave progression — reveals where players drop off
    EventBus.on(Events.GAME_WAVE_COMPLETE, () => {
        posthog.capture('wave_complete', {
            wave: GameState.wave,
            score: GameState.score,
        });
    });

    // Player took damage
    EventBus.on(Events.PLAYER_DAMAGED, () => {
        posthog.capture('player_damaged', {
            wave: GameState.wave,
            score: GameState.score,
            lives_remaining: GameState.lives,
        });
    });

    // Enemy defeated (with type info from event data)
    EventBus.on(Events.ENEMY_DEFEATED, (data?: { type?: string; points?: number }) => {
        posthog.capture('enemy_defeated', {
            enemy_type: data?.type,
            points: data?.points,
            combo: GameState.combo,
            wave: GameState.wave,
        });
    });

    // Pterodactyl defeated during survival wave
    EventBus.on(Events.PTERODACTYL_DEFEATED, () => {
        posthog.capture('pterodactyl_defeated', {
            wave: GameState.wave,
            score: GameState.score,
        });
    });

    // Combo milestone hit (3x, 5x, 10x)
    EventBus.on(Events.SPECTACLE_STREAK, (data?: { streak?: number }) => {
        posthog.capture('combo_achieved', {
            combo: data?.streak,
            wave: GameState.wave,
            score: GameState.score,
        });
    });

    // Retry intent — player restarts after game over
    EventBus.on(Events.GAME_RESTART, () => {
        posthog.capture('game_restart', {
            previous_score: GameState.score,
            previous_wave: GameState.wave,
        });
    });
}

export function capture(event: string, properties?: Record<string, unknown>): void {
    posthog.capture(event, properties);
}
