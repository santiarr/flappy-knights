import { EventBus, Events } from '../core/EventBus';
import { audioManager } from './AudioManager';
import * as sfx from './sfx';

export function initAudioBridge(): void {
    EventBus.on(Events.PLAYER_FLAP, () => audioManager.play(sfx.sfxFlap));
    EventBus.on(Events.ENEMY_DEFEATED, () => audioManager.play(sfx.sfxEnemyDefeat));
    EventBus.on(Events.PLAYER_DAMAGED, () => audioManager.play(sfx.sfxPlayerDamage));
    EventBus.on(Events.EGG_COLLECTED, () => audioManager.play(sfx.sfxEggCollect));
    EventBus.on(Events.EGG_HATCHED, () => audioManager.play(sfx.sfxEggHatch));
    EventBus.on(Events.PTERODACTYL_SPAWN, () => audioManager.play(sfx.sfxPterodactylScreech));
    EventBus.on(Events.GAME_OVER, () => {
        audioManager.stopBGM();
        audioManager.play(sfx.sfxGameOver);
    });
    EventBus.on(Events.GAME_WAVE_COMPLETE, () => audioManager.play(sfx.sfxWaveComplete));
    EventBus.on(Events.GAME_START, () => audioManager.startBGM());
    EventBus.on(Events.GAME_RESTART, () => audioManager.startBGM());
    EventBus.on(Events.SPECTACLE_COMBO, (data: { combo: number }) => {
        const ctx = audioManager.getContext();
        const dest = audioManager.getDestination();
        if (ctx && dest) {
            sfx.sfxCombo(ctx, dest, data.combo);
        }
    });
}
