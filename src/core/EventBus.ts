import Phaser from 'phaser';

// Singleton event bus
export const EventBus = new Phaser.Events.EventEmitter();

// Event constants - domain:action naming
export const Events = {
    // Player
    PLAYER_FLAP: 'player:flap',
    PLAYER_DIED: 'player:died',
    PLAYER_DAMAGED: 'player:damaged',

    // Enemy
    ENEMY_DEFEATED: 'enemy:defeated',
    ENEMY_HATCHED: 'enemy:hatched',
    PTERODACTYL_SPAWN: 'pterodactyl:spawn',
    PTERODACTYL_DEFEATED: 'pterodactyl:defeated',

    // Egg
    EGG_COLLECTED: 'egg:collected',
    EGG_HATCHED: 'egg:hatched',

    // Score
    SCORE_CHANGED: 'score:changed',

    // Game flow
    GAME_START: 'game:start',
    GAME_OVER: 'game:over',
    GAME_RESTART: 'game:restart',
    GAME_WAVE_COMPLETE: 'game:wave_complete',
    GAME_NEXT_WAVE: 'game:next_wave',

    // Audio
    AUDIO_TOGGLE_MUTE: 'audio:toggle_mute',

    // Spectacle
    SPECTACLE_ENTRANCE: 'spectacle:entrance',
    SPECTACLE_ACTION: 'spectacle:action',
    SPECTACLE_HIT: 'spectacle:hit',
    SPECTACLE_COMBO: 'spectacle:combo',
    SPECTACLE_STREAK: 'spectacle:streak',
    SPECTACLE_NEAR_MISS: 'spectacle:near_miss',
};
