// Play.fun (OpenGameProtocol) integration — Hybrid mode
// Browser SDK for widget display, server-side for secure point submission
import { EventBus, Events } from './core/EventBus';
import { GameState } from './core/GameState';

const GAME_ID = 'aea6b5ee-eccf-419e-a163-652bbf568333';

let sdk: any = null;
let initialized = false;
let sessionStartTime = 0;

export async function initPlayFun(): Promise<void> {
    const SDKClass = (window as any).PlayFunSDK ?? (window as any).OpenGameSDK;
    if (!SDKClass) {
        console.warn('Play.fun SDK not loaded');
        return;
    }

    // Browser SDK — widget only (shows points, leaderboard, wallet connect)
    sdk = new SDKClass({ gameId: GAME_ID, ui: { usePointsWidget: true } });
    await sdk.init();
    initialized = true;

    // Track session start time
    EventBus.on(Events.GAME_START, () => {
        sessionStartTime = Date.now();
    });
    EventBus.on(Events.GAME_RESTART, () => {
        sessionStartTime = Date.now();
    });

    // Still buffer points client-side for the widget display
    EventBus.on(Events.SCORE_CHANGED, (_data: { score: number; delta?: number }) => {
        if (initialized && _data.delta && _data.delta > 0) {
            sdk.addPoints(_data.delta);
        }
    });

    // On game over: submit score to OUR server for validated saving
    EventBus.on(Events.GAME_OVER, () => {
        if (!initialized) return;
        const timePlayed = Date.now() - sessionStartTime;
        submitScoreToServer(GameState.score, GameState.wave, timePlayed);
    });
}

async function submitScoreToServer(score: number, wave: number, timePlayed: number): Promise<void> {
    if (score <= 0) return;

    // Get player ID from the SDK (wallet address or anonymous ID)
    let playerId = 'anonymous';
    try {
        if (sdk && sdk.getPlayerId) {
            playerId = await sdk.getPlayerId();
        } else if (sdk && sdk.playerId) {
            playerId = sdk.playerId;
        }
    } catch {
        // fallback to anonymous
    }

    try {
        const response = await fetch('/api/save-points', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ playerId, score, wave, timePlayed }),
        });

        const data = await response.json();
        if (data.success) {
            console.log(`[Play.fun] Points saved: ${score}`);
            // Trigger the SDK save modal for the widget to update
            if (sdk && sdk.savePoints) {
                sdk.savePoints();
            }
        } else {
            console.warn(`[Play.fun] Server rejected score: ${data.error}`);
        }
    } catch (err) {
        console.warn('[Play.fun] Failed to submit score:', err);
        // Fallback: save directly via browser SDK (less secure but better than losing points)
        if (sdk && sdk.savePoints) {
            sdk.savePoints();
        }
    }
}
