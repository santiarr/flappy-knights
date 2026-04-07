import { GameState } from '../core/GameState';
import { NotePattern } from './music';

type SfxFn = (ctx: AudioContext, dest: AudioNode) => void;

const BGM_VOLUME = 0.1;
const TITLE_VOLUME = 0.15;

class AudioManager {
    private ctx: AudioContext | null = null;
    private masterGain: GainNode | null = null;
    private previousVolume = 0.3;
    private initialized = false;

    // Music state
    private bgmElement: HTMLAudioElement | null = null;
    private titleElement: HTMLAudioElement | null = null;
    private bgmPlaying = false;
    private titlePlaying = false;

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

    startTitleMusic(): void {
        if (this.titlePlaying) return;
        this.stopBGM();
        this.titlePlaying = true;

        if (!this.titleElement) {
            this.titleElement = new Audio('assets/audio/title.mp3');
            this.titleElement.loop = true;
        }
        this.titleElement.volume = GameState.isMuted ? 0 : TITLE_VOLUME;
        this.titleElement.currentTime = 0;
        this.titleElement.play().catch(() => {});
    }

    stopTitleMusic(): void {
        this.titlePlaying = false;
        if (this.titleElement) {
            this.titleElement.pause();
            this.titleElement.currentTime = 0;
        }
    }

    startBGM(): void {
        if (this.bgmPlaying) return;
        this.stopTitleMusic();
        this.bgmPlaying = true;

        if (!this.bgmElement) {
            this.bgmElement = new Audio('assets/audio/bgm.mp3');
            this.bgmElement.loop = true;
        }
        this.bgmElement.volume = GameState.isMuted ? 0 : BGM_VOLUME;
        this.bgmElement.currentTime = 0;
        this.bgmElement.play().catch(() => {});
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
            if (this.titleElement) this.titleElement.volume = 0;
        } else {
            if (this.masterGain) this.masterGain.gain.value = this.previousVolume;
            if (this.bgmElement && this.bgmPlaying) this.bgmElement.volume = BGM_VOLUME;
            if (this.titleElement && this.titlePlaying) this.titleElement.volume = TITLE_VOLUME;
        }
    }

    isMuted(): boolean {
        return GameState.isMuted;
    }
}

export const audioManager = new AudioManager();
