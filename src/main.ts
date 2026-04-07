import { AUTO, Game } from 'phaser';
import { GAME } from './core/Constants';
import { Boot } from './scenes/Boot';
import { Preloader } from './scenes/Preloader';
import { TitleScreen } from './scenes/TitleScreen';
import { Game as MainGame } from './scenes/Game';
import { GameOver } from './scenes/GameOver';
import { MultiplayerLobby } from './scenes/MultiplayerLobby';
import { audioManager } from './audio/AudioManager';
import { initAudioBridge } from './audio/AudioBridge';
import { initAnalytics } from './analytics';


const config: Phaser.Types.Core.GameConfig = {
    type: AUTO,
    width: GAME.WIDTH,
    height: GAME.HEIGHT,
    parent: 'game-container',
    backgroundColor: GAME.BACKGROUND_COLOR_STR,
    preserveDrawingBuffer: true,
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { x: 0, y: GAME.GRAVITY },
            debug: false,
        },
    },
    scene: [Boot, Preloader, TitleScreen, MainGame, GameOver, MultiplayerLobby],
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
    },
};

document.addEventListener('DOMContentLoaded', () => {
    initAnalytics();
    new Game({ ...config, parent: 'game-container' });
    initAudioBridge();

    // Initialize AudioContext on first user interaction
    const initAudio = () => {
        audioManager.init();
        document.removeEventListener('pointerdown', initAudio);
        document.removeEventListener('keydown', initAudio);
    };
    document.addEventListener('pointerdown', initAudio);
    document.addEventListener('keydown', initAudio);
});
