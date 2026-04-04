// All SFX functions take AudioContext and destination node.
// Each creates short one-shot sounds using oscillators and gain nodes.

export function sfxFlap(ctx: AudioContext, dest: AudioNode): void {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.exponentialRampToValueAtTime(600, now + 0.05);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    osc.connect(gain);
    gain.connect(dest);
    osc.start(now);
    osc.stop(now + 0.06);
}

export function sfxHit(ctx: AudioContext, dest: AudioNode): void {
    const now = ctx.currentTime;

    // Noise burst via oscillator detuning trick
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(100, now);
    osc.frequency.setValueAtTime(50, now + 0.02);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.connect(gain);
    gain.connect(dest);
    osc.start(now);
    osc.stop(now + 0.09);

    // Low thud
    const thud = ctx.createOscillator();
    const thudGain = ctx.createGain();
    thud.type = 'sine';
    thud.frequency.setValueAtTime(60, now);
    thud.frequency.exponentialRampToValueAtTime(30, now + 0.08);
    thudGain.gain.setValueAtTime(0.25, now);
    thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    thud.connect(thudGain);
    thudGain.connect(dest);
    thud.start(now);
    thud.stop(now + 0.09);
}

export function sfxEnemyDefeat(ctx: AudioContext, dest: AudioNode): void {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.exponentialRampToValueAtTime(100, now + 0.15);
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.connect(gain);
    gain.connect(dest);
    osc.start(now);
    osc.stop(now + 0.16);
}

export function sfxEggCollect(ctx: AudioContext, dest: AudioNode): void {
    const now = ctx.currentTime;

    // First ding
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'square';
    osc1.frequency.value = 800;
    gain1.gain.setValueAtTime(0.12, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    osc1.connect(gain1);
    gain1.connect(dest);
    osc1.start(now);
    osc1.stop(now + 0.07);

    // Second ding (higher)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'square';
    osc2.frequency.value = 1000;
    gain2.gain.setValueAtTime(0.12, now + 0.06);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc2.connect(gain2);
    gain2.connect(dest);
    osc2.start(now + 0.06);
    osc2.stop(now + 0.13);
}

export function sfxEggHatch(ctx: AudioContext, dest: AudioNode): void {
    const now = ctx.currentTime;

    // Crack sound
    const crack = ctx.createOscillator();
    const crackGain = ctx.createGain();
    crack.type = 'sawtooth';
    crack.frequency.setValueAtTime(300, now);
    crack.frequency.exponentialRampToValueAtTime(80, now + 0.1);
    crackGain.gain.setValueAtTime(0.15, now);
    crackGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    crack.connect(crackGain);
    crackGain.connect(dest);
    crack.start(now);
    crack.stop(now + 0.11);

    // Low rumble
    const rumble = ctx.createOscillator();
    const rumbleGain = ctx.createGain();
    rumble.type = 'sine';
    rumble.frequency.setValueAtTime(50, now + 0.05);
    rumble.frequency.exponentialRampToValueAtTime(30, now + 0.2);
    rumbleGain.gain.setValueAtTime(0.2, now + 0.05);
    rumbleGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    rumble.connect(rumbleGain);
    rumbleGain.connect(dest);
    rumble.start(now + 0.05);
    rumble.stop(now + 0.21);
}

export function sfxPlayerDamage(ctx: AudioContext, dest: AudioNode): void {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.setValueAtTime(100, now + 0.1);
    osc.frequency.setValueAtTime(80, now + 0.2);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.linearRampToValueAtTime(0.15, now + 0.15);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc.connect(gain);
    gain.connect(dest);
    osc.start(now);
    osc.stop(now + 0.31);
}

export function sfxPterodactylScreech(ctx: AudioContext, dest: AudioNode): void {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    // Sweep: 600 -> 1200 -> 400
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.linearRampToValueAtTime(1200, now + 0.15);
    osc.frequency.linearRampToValueAtTime(400, now + 0.4);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.setValueAtTime(0.18, now + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    osc.connect(gain);
    gain.connect(dest);
    osc.start(now);
    osc.stop(now + 0.41);

    // Add harmonic for screech texture
    const harm = ctx.createOscillator();
    const harmGain = ctx.createGain();
    harm.type = 'square';
    harm.frequency.setValueAtTime(900, now);
    harm.frequency.linearRampToValueAtTime(1800, now + 0.15);
    harm.frequency.linearRampToValueAtTime(600, now + 0.4);
    harmGain.gain.setValueAtTime(0.06, now);
    harmGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    harm.connect(harmGain);
    harmGain.connect(dest);
    harm.start(now);
    harm.stop(now + 0.41);
}

export function sfxLavaPlop(ctx: AudioContext, dest: AudioNode): void {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.15);
    // Vibrato via detune
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 20;
    lfoGain.gain.value = 30;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    lfo.start(now);
    lfo.stop(now + 0.16);
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.connect(gain);
    gain.connect(dest);
    osc.start(now);
    osc.stop(now + 0.16);
}

export function sfxWaveComplete(ctx: AudioContext, dest: AudioNode): void {
    const now = ctx.currentTime;
    const notes = [261.63, 329.63, 392.00, 523.25]; // C4 E4 G4 C5
    notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.value = freq;
        const start = now + i * 0.08;
        gain.gain.setValueAtTime(0.12, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.15);
        osc.connect(gain);
        gain.connect(dest);
        osc.start(start);
        osc.stop(start + 0.16);
    });
}

export function sfxGameOver(ctx: AudioContext, dest: AudioNode): void {
    const now = ctx.currentTime;
    const notes = [329.63, 293.66, 261.63, 246.94, 220.00, 196.00]; // E4 D4 C4 B3 A3 G3
    notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.value = freq;
        const start = now + i * 0.2;
        const dur = i === notes.length - 1 ? 0.6 : 0.2;
        gain.gain.setValueAtTime(0.12, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
        osc.connect(gain);
        gain.connect(dest);
        osc.start(start);
        osc.stop(start + dur + 0.01);
    });
}

export function sfxCombo(ctx: AudioContext, dest: AudioNode, comboCount: number): void {
    const now = ctx.currentTime;
    const baseFreq = 400 + comboCount * 50;
    for (let i = 0; i < Math.min(comboCount, 5); i++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.value = baseFreq + i * 100;
        const start = now + i * 0.05;
        gain.gain.setValueAtTime(0.1, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.08);
        osc.connect(gain);
        gain.connect(dest);
        osc.start(start);
        osc.stop(start + 0.09);
    }
}

export function sfxBonusLife(ctx: AudioContext, dest: AudioNode): void {
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5 E5 G5 C6
    notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        const start = now + i * 0.1;
        gain.gain.setValueAtTime(0.15, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.2);
        osc.connect(gain);
        gain.connect(dest);
        osc.start(start);
        osc.stop(start + 0.21);
    });
}
