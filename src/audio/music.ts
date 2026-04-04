// Note frequencies
const C3 = 130.81, D3 = 146.83, E3 = 164.81, F3 = 174.61, G3 = 196.00, A3 = 220.00, B3 = 246.94;
const C4 = 261.63, D4 = 293.66, E4 = 329.63, F4 = 349.23, G4 = 392.00, A4 = 440.00, B4 = 493.88;
const C5 = 523.25, D5 = 587.33, E5 = 659.25;
const REST = 0;

export interface Note {
    note: number;    // frequency in Hz (0 = rest)
    duration: number; // seconds
    bass?: number;    // optional bass note frequency
}

export type NotePattern = Note[];

// BPM ~130, eighth note = ~0.23s, quarter = ~0.46s
const S = 0.115; // sixteenth
const E = 0.23;  // eighth
const Q = 0.46;  // quarter
const H = 0.92;  // half

// Medieval/cave chiptune theme - dark minor key, driving rhythm
export const mainTheme: NotePattern = [
    // Phrase 1: Dark minor motif (Am)
    { note: A3, duration: E, bass: A3 * 0.5 },
    { note: C4, duration: E, bass: A3 * 0.5 },
    { note: E4, duration: E, bass: A3 * 0.5 },
    { note: A4, duration: E, bass: A3 * 0.5 },
    { note: G4, duration: E, bass: E3 },
    { note: E4, duration: E, bass: E3 },
    { note: F4, duration: Q, bass: F3 },
    { note: E4, duration: Q, bass: E3 },

    // Phrase 2: Rising tension
    { note: D4, duration: E, bass: D3 },
    { note: E4, duration: E, bass: D3 },
    { note: F4, duration: E, bass: D3 },
    { note: G4, duration: E, bass: G3 },
    { note: A4, duration: E, bass: A3 },
    { note: G4, duration: E, bass: G3 },
    { note: F4, duration: E, bass: F3 },
    { note: E4, duration: E, bass: E3 },

    // Phrase 3: Heroic lift
    { note: A4, duration: E, bass: A3 * 0.5 },
    { note: B4, duration: S },
    { note: A4, duration: S },
    { note: G4, duration: E, bass: G3 },
    { note: E4, duration: E, bass: E3 },
    { note: REST, duration: S },
    { note: A4, duration: S },
    { note: G4, duration: E, bass: G3 },
    { note: F4, duration: E, bass: F3 },
    { note: E4, duration: Q, bass: E3 },

    // Phrase 4: Resolution with cave echo feel
    { note: C4, duration: E, bass: C3 },
    { note: D4, duration: E, bass: D3 },
    { note: E4, duration: Q, bass: A3 * 0.5 },
    { note: REST, duration: S },
    { note: E4, duration: S, bass: E3 },
    { note: D4, duration: E, bass: D3 },
    { note: C4, duration: E, bass: C3 },
    { note: A3, duration: Q, bass: A3 * 0.5 },
    { note: REST, duration: E },
];

// Game over jingle - short descending minor
export const gameOverJingle: NotePattern = [
    { note: E4, duration: Q },
    { note: D4, duration: Q },
    { note: C4, duration: Q },
    { note: B3, duration: E },
    { note: A3, duration: E },
    { note: G3, duration: H },
];

// Wave complete fanfare - ascending triumphant
export const waveCompleteFanfare: NotePattern = [
    { note: C4, duration: S },
    { note: E4, duration: S },
    { note: G4, duration: S },
    { note: C5, duration: E },
    { note: REST, duration: S },
    { note: G4, duration: S },
    { note: C5, duration: Q },
];
