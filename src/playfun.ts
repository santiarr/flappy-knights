// Play.fun (OpenGameProtocol) integration
import { EventBus, Events } from './core/EventBus';

const GAME_ID = 'aea6b5ee-eccf-419e-a163-652bbf568333';

let sdk: any = null;
let initialized = false;

export async function initPlayFun(): Promise<void> {
    const SDKClass = (window as any).PlayFunSDK ?? (window as any).OpenGameSDK;
    if (!SDKClass) {
        console.warn('Play.fun SDK not loaded');
        return;
    }

    sdk = new SDKClass({ gameId: GAME_ID, ui: { usePointsWidget: true } });
    await sdk.init();
    initialized = true;

    // addPoints() — buffer points locally during gameplay (non-blocking)
    EventBus.on(Events.SCORE_CHANGED, (_data: { score: number; delta?: number }) => {
        if (initialized && _data.delta && _data.delta > 0) {
            sdk.addPoints(_data.delta);
        }
    });

    // savePoints() — ONLY at natural break points (opens blocking modal)
    EventBus.on(Events.GAME_OVER, () => {
        if (initialized) {
            sdk.savePoints();
        }
    });

    // Save on page unload
    window.addEventListener('beforeunload', () => {
        if (initialized) {
            sdk.savePoints();
        }
    });
}
