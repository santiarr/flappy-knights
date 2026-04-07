import { GameState } from '../core/GameState';
import { NotePattern } from './music';

type SfxFn = (ctx: AudioContext, dest: AudioNode) => void;

class AudioManager {
    private ctx: AudioContext | null = null;
    private masterGain: GainNode | null = null;
    private previousVolume = 0.3;
    private initialized = false;

    // BGM state
    private bgmElement: HTMLAudioElement | null = null;
    private bgmPlaying = false;

    init(): void {
        if (this.initialized) return;
        this.ctx = new AudioContext();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = GameState.isMuted ? 0 : this.previousVolume;
        this.masterGain.connect(this.ctx.destination);
        this.initialized = true;
    }

    ensureResumed(): void {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    getContext(): AudioContext | null {
        return this.ctx;
    }

    getDestination(): AudioNode | null {
        return this.masterGain;
    }

    play(sfxFn: SfxFn): void {
        if (!this.ctx || !this.masterGain) return;
        this.ensureResumed();
        try {
            sfxFn(this.ctx, this.masterGain);
        } catch (_e) {
            // Silently ignore audio errors to avoid breaking gameplay
        }
    }

    startBGM(): void {
        if (this.bgmPlaying) return;
        this.bgmPlaying = true;

        if (!this.bgmElement) {
            this.bgmElement = new Audio('assets/audio/bgm.mp3');
            this.bgmElement.loop = true;
            this.bgmElement.volume = GameState.isMuted ? 0 : this.previousVolume;
        }

        this.bgmElement.currentTime = 0;
        this.bgmElement.play().catch(() => {
            // Autoplay blocked — will play on next user interaction
        });
    }

    stopBGM(): void {
        this.bgmPlaying = false;
        if (this.bgmElement) {
            this.bgmElement.pause();
            this.bgmElement.currentTime = 0;
        }
    }

    playJingle(_pattern: NotePattern): void {
        // Jingles not used with MP3 BGM
    }

    toggleMute(): void {
        GameState.isMuted = !GameState.isMuted;
        if (GameState.isMuted) {
            if (this.masterGain) {
                this.previousVolume = this.masterGain.gain.value || 0.3;
                this.masterGain.gain.value = 0;
            }
            if (this.bgmElement) this.bgmElement.volume = 0;
        } else {
            if (this.masterGain) this.masterGain.gain.value = this.previousVolume;
            if (this.bgmElement) this.bgmElement.volume = this.previousVolume;
        }
    }

    isMuted(): boolean {
        return GameState.isMuted;
    }
}

export const audioManager = new AudioManager();
