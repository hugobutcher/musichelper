import { MAJOR_KEYS, MINOR_KEYS, type Key, type Mode, keyOf, keySignatureAcc } from './keys'
import { type Note, isAwkward, sameNote } from './notes'
import { type Rng, defaultRng, pick, weighted } from './random'

export type Clef = 'treble' | 'bass'

// ---------------------------------------------------------------------------
// Single notes

export interface NoteDrillConfig {
  clef: 'treble' | 'bass' | 'both'
  ledgerLines: boolean
  accidentals: boolean
}

export interface DrillNote {
  note: Note
  clef: Clef
}

/** Diatonic index ranges (C4 = 28). */
const NOTE_RANGES: Record<Clef, { staff: [number, number]; ledger: [number, number] }> = {
  treble: { staff: [30, 38], ledger: [26, 42] }, // E4–F5 | A3–C6
  bass: { staff: [18, 26], ledger: [14, 30] }, //  G2–A3 | C2–E4
}

function noteAt(idx: number, acc = 0): Note {
  return { letter: ((idx % 7) + 7) % 7, acc, octave: Math.floor(idx / 7) }
}

export function randomDrillNote(cfg: NoteDrillConfig, prev: DrillNote | null, rng: Rng = defaultRng): DrillNote {
  for (let attempt = 0; ; attempt++) {
    const clef: Clef = cfg.clef === 'both' ? pick(['treble', 'bass'] as const, rng) : cfg.clef
    const [lo, hi] = NOTE_RANGES[clef][cfg.ledgerLines ? 'ledger' : 'staff']
    const idx = lo + Math.floor(rng() * (hi - lo + 1))
    let acc = 0
    if (cfg.accidentals && rng() < 0.35) acc = rng() < 0.5 ? -1 : 1
    const note = noteAt(idx, acc)
    if (isAwkward(note)) continue
    if (attempt < 20 && prev && sameNote(prev.note, note)) continue
    return { note, clef }
  }
}

// ---------------------------------------------------------------------------
// Melodies

export type Difficulty = 'easy' | 'medium' | 'hard'

export interface MelodyConfig {
  clef: 'treble' | 'bass' | 'random'
  modes: 'major' | 'minor' | 'both'
  /** "random" or a key name from MAJOR_KEYS / MINOR_KEYS (uses `modes` when not random). */
  key: string
  bars: number
  difficulty: Difficulty
}

export interface MelodyNote {
  note: Note
  /** Length in beats (quarter note = 1). */
  beats: number
  /** Beat offset from the start of the melody. */
  start: number
}

export interface Melody {
  key: Key
  clef: Clef
  bars: MelodyNote[][]
}

const RHYTHMS: Record<Difficulty, number[][]> = {
  easy: [[4], [2, 2], [2, 1, 1], [1, 1, 2], [1, 1, 1, 1], [3, 1]],
  medium: [
    [2, 2],
    [2, 1, 1],
    [1, 1, 2],
    [1, 1, 1, 1],
    [3, 1],
    [1, 0.5, 0.5, 1, 1],
    [0.5, 0.5, 0.5, 0.5, 2],
    [1.5, 0.5, 2],
    [2, 1, 0.5, 0.5],
    [1, 1, 0.5, 0.5, 1],
  ],
  hard: [
    [1, 0.5, 0.5, 1, 1],
    [0.5, 0.5, 0.5, 0.5, 2],
    [1.5, 0.5, 2],
    [1.5, 0.5, 1.5, 0.5],
    [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 1],
    [0.5, 1, 0.5, 2],
    [1, 0.5, 0.5, 0.5, 0.5, 1],
    [0.5, 0.5, 1, 0.5, 0.5, 1],
  ],
}

const LAST_BAR: Record<Difficulty, number[][]> = {
  easy: [[4], [2, 2], [1, 1, 2]],
  medium: [[4], [2, 2], [1, 1, 2], [1.5, 0.5, 2]],
  hard: [[1, 1, 2], [1.5, 0.5, 2], [0.5, 0.5, 1, 2]],
}

/** Melody ranges as diatonic indexes. */
const MELODY_RANGE: Record<Clef, [number, number]> = {
  treble: [28, 40], // C4–A5
  bass: [16, 28], //   E2–C4
}

const STEP_WEIGHTS: Record<Difficulty, { steps: number[]; weights: number[] }> = {
  easy: { steps: [1, 2, 0, 3], weights: [70, 18, 8, 4] },
  medium: { steps: [1, 2, 0, 3, 4], weights: [55, 22, 6, 10, 7] },
  hard: { steps: [1, 2, 0, 3, 4, 5], weights: [45, 22, 5, 12, 10, 6] },
}

export function melodyKey(cfg: MelodyConfig, rng: Rng = defaultRng): Key {
  const mode: Mode = cfg.modes === 'both' ? pick(['major', 'minor'] as const, rng) : cfg.modes
  const name = cfg.key !== 'random' ? cfg.key : pick(mode === 'major' ? MAJOR_KEYS : MINOR_KEYS, rng)
  return keyOf(name, mode)
}

export function generateMelody(cfg: MelodyConfig, rng: Rng = defaultRng): Melody {
  const key = melodyKey(cfg, rng)
  const clef: Clef = cfg.clef === 'random' ? pick(['treble', 'bass'] as const, rng) : cfg.clef
  const [lo, hi] = MELODY_RANGE[clef]
  const tonicLetter = key.tonic.letter
  const isTonic = (idx: number) => ((idx % 7) + 7) % 7 === tonicLetter

  const spell = (idx: number, leading = false): Note => {
    const letter = ((idx % 7) + 7) % 7
    let acc = keySignatureAcc(key, letter)
    // Harmonic minor: raise the 7th when it leads to the tonic.
    if (leading && key.mode === 'minor' && (letter + 1) % 7 === tonicLetter) acc += 1
    return { letter, acc, octave: Math.floor(idx / 7) }
  }

  // Start on tonic, 3rd or 5th near the middle of the range.
  const mid = Math.round((lo + hi) / 2)
  const starts: number[] = []
  for (let i = lo + 2; i <= hi - 2; i++) {
    const deg = (((i - tonicLetter) % 7) + 7) % 7
    if (deg === 0 || deg === 2 || deg === 4) starts.push(i)
  }
  starts.sort((a, b) => Math.abs(a - mid) - Math.abs(b - mid))
  let idx = pick(starts.slice(0, 3), rng)

  const rhythms: number[][] = []
  for (let b = 0; b < cfg.bars; b++) {
    rhythms.push(pick(b === cfg.bars - 1 ? LAST_BAR[cfg.difficulty] : RHYTHMS[cfg.difficulty], rng))
  }
  const total = rhythms.reduce((n, r) => n + r.length, 0)

  // Final note: the tonic nearest the middle; the note before it approaches by step.
  const tonics: number[] = []
  for (let i = lo; i <= hi; i++) if (isTonic(i)) tonics.push(i)
  const finalIdx = tonics.sort((a, b) => Math.abs(a - mid) - Math.abs(b - mid))[0]

  const { steps, weights } = STEP_WEIGHTS[cfg.difficulty]
  const indexes: number[] = []
  let lastMove = 0
  for (let n = 0; n < total; n++) {
    if (n === total - 1) idx = finalIdx
    else if (n === total - 2) idx = finalIdx + (rng() < 0.5 ? 1 : -1)
    else if (n > 0) {
      const size = weighted(steps, weights, rng)
      // After a leap, step back the other way.
      let dir = Math.abs(lastMove) >= 3 ? -Math.sign(lastMove) : rng() < 0.5 ? -1 : 1
      // Drift toward the final note in the last third.
      if (n > total * 0.66 && Math.abs(idx - finalIdx) > 3) dir = Math.sign(finalIdx - idx)
      let next = idx + dir * size
      if (next < lo || next > hi) next = idx - dir * size
      next = Math.min(hi, Math.max(lo, next))
      lastMove = next - idx
      idx = next
    }
    indexes.push(idx)
  }

  const bars: MelodyNote[][] = []
  let k = 0
  let start = 0
  for (const rhythm of rhythms) {
    const bar: MelodyNote[] = []
    for (const beats of rhythm) {
      const i = indexes[k]
      const leadsToTonic = k + 1 < indexes.length && indexes[k + 1] === i + 1 && isTonic(i + 1)
      bar.push({ note: spell(i, leadsToTonic), beats, start })
      start += beats
      k++
    }
    bars.push(bar)
  }
  return { key, clef, bars }
}

export function melodyNotes(m: Melody): MelodyNote[] {
  return m.bars.flat()
}
