import { GameState } from '../core/GameState';
import { mainTheme, gameOverJingle, waveCompleteFanfare, NotePattern } from './music';

type SfxFn = (ctx: AudioContext, dest: AudioNode) => void;

class AudioManager {
    private ctx: AudioContext | null = null;
    private masterGain: GainNode | null = null;
    private previousVolume = 0.3;
    private initialized = false;

    // BGM sequencer state
    private bgmTimeout: number | null = null;
    private bgmPlaying = false;
    private bgmOscillators: OscillatorNode[] = [];

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
        if (!this.ctx || !this.masterGain || this.bgmPlaying) return;
        this.ensureResumed();
        this.bgmPlaying = true;
        this.playPattern(mainTheme, 0, true);
    }

    stopBGM(): void {
        this.bgmPlaying = false;
        if (this.bgmTimeout !== null) {
            clearTimeout(this.bgmTimeout);
            this.bgmTimeout = null;
        }
        // Stop any lingering oscillators
        for (const osc of this.bgmOscillators) {
            try { osc.stop(); } catch (_e) { /* already stopped */ }
        }
        this.bgmOscillators = [];
    }

    playJingle(pattern: NotePattern): void {
        if (!this.ctx || !this.masterGain) return;
        this.ensureResumed();
        this.playPattern(pattern, 0, false);
    }

    private playPattern(pattern: NotePattern, index: number, loop: boolean): void {
        if (!this.ctx || !this.masterGain) return;
        if (!this.bgmPlaying && loop) return;
        if (index >= pattern.length) {
            if (loop && this.bgmPlaying) {
                this.playPattern(pattern, 0, true);
            }
            return;
        }

        const note = pattern[index];
        const now = this.ctx.currentTime;

        if (note.note > 0) {
            // Melody oscillator (square wave for chiptune feel)
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'square';
            osc.frequency.value = note.note;
            gain.gain.setValueAtTime(0.12, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + note.duration * 0.95);
            osc.connect(gain);
            gain.connect(this.masterGain);
            osc.start(now);
            osc.stop(now + note.duration);
            this.bgmOscillators.push(osc);
            osc.onended = () => {
                this.bgmOscillators = this.bgmOscillators.filter(o => o !== osc);
            };

            // Bass/harmony oscillator (triangle wave, one octave down)
            if (note.bass) {
                const bassOsc = this.ctx.createOscillator();
                const bassGain = this.ctx.createGain();
                bassOsc.type = 'triangle';
                bassOsc.frequency.value = note.bass;
                bassGain.gain.setValueAtTime(0.08, now);
                bassGain.gain.exponentialRampToValueAtTime(0.001, now + note.duration * 0.9);
                bassOsc.connect(bassGain);
                bassGain.connect(this.masterGain);
                bassOsc.start(now);
                bassOsc.stop(now + note.duration);
                this.bgmOscillators.push(bassOsc);
                bassOsc.onended = () => {
                    this.bgmOscillators = this.bgmOscillators.filter(o => o !== bassOsc);
                };
            }
        }

        // Schedule next note
        const delayMs = note.duration * 1000;
        this.bgmTimeout = window.setTimeout(() => {
            this.playPattern(pattern, index + 1, loop);
        }, delayMs);
    }

    toggleMute(): void {
        if (!this.masterGain) return;
        GameState.isMuted = !GameState.isMuted;
        if (GameState.isMuted) {
            this.previousVolume = this.masterGain.gain.value || 0.3;
            this.masterGain.gain.value = 0;
        } else {
            this.masterGain.gain.value = this.previousVolume;
        }
    }

    isMuted(): boolean {
        return GameState.isMuted;
    }
}

export const audioManager = new AudioManager();
