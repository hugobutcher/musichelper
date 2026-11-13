/** Spelled pitches: a letter (C=0 … B=6) plus an accidental (-2 … +2). */
export interface Pitch {
  letter: number
  acc: number
}

export interface Note extends Pitch {
  octave: number
}

/** An interval as diatonic steps + semitones, so spelling is exact (e.g. #9 vs b3). */
export interface Interval {
  steps: number
  semis: number
}

const LETTER_SEMIS = [0, 2, 4, 5, 7, 9, 11]
const LETTERS = 'CDEFGAB'

export function pitchClass(p: Pitch): number {
  return (((LETTER_SEMIS[p.letter] + p.acc) % 12) + 12) % 12
}

export function midiOf(n: Note): number {
  return (n.octave + 1) * 12 + LETTER_SEMIS[n.letter] + n.acc
}

/** Diatonic position (C4 = 28): used for staff placement and stepwise motion. */
export function diatonicIndex(n: Note): number {
  return n.octave * 7 + n.letter
}

export function transpose(p: Pitch, iv: Interval): Pitch {
  const raw = p.letter + iv.steps
  const letter = ((raw % 7) + 7) % 7
  const octaves = Math.floor(raw / 7)
  const naturalSemis = LETTER_SEMIS[letter] + 12 * octaves - LETTER_SEMIS[p.letter]
  return { letter, acc: p.acc + iv.semis - naturalSemis }
}

/** Lowest octave placement of `p` whose MIDI number is >= minMidi. */
export function placeAtOrAbove(p: Pitch, minMidi: number): Note {
  const base = LETTER_SEMIS[p.letter] + p.acc
  const octave = Math.ceil((minMidi - base) / 12) - 1
  return { letter: p.letter, acc: p.acc, octave }
}

const ACC_TEXT: Record<number, string> = { [-2]: '𝄫', [-1]: '♭', 0: '', 1: '♯', 2: '𝄪' }
const ACC_ASCII: Record<number, string> = { [-2]: 'bb', [-1]: 'b', 0: '', 1: '#', 2: '##' }

export function pitchName(p: Pitch): string {
  return LETTERS[p.letter] + ACC_TEXT[p.acc]
}

export function pitchAscii(p: Pitch): string {
  return LETTERS[p.letter] + ACC_ASCII[p.acc]
}

export function noteAscii(n: Note): string {
  return pitchAscii(n) + n.octave
}

/** VexFlow key string, e.g. "c#/4". */
export function vexKey(n: Note): string {
  return `${LETTERS[n.letter].toLowerCase()}${ACC_ASCII[n.acc]}/${n.octave}`
}

/** VexFlow accidental code for an accidental amount ("#", "b", "##", "bb", "n"). */
export function vexAccidental(acc: number): string {
  return acc === 0 ? 'n' : ACC_ASCII[acc]
}

/** Parse "C", "F#", "Bb", "Ebb" … (optionally with an octave: "C#4"). */
export function parsePitch(s: string): Pitch {
  const letter = LETTERS.indexOf(s[0].toUpperCase())
  if (letter < 0) throw new Error(`Bad pitch: ${s}`)
  let acc = 0
  for (const ch of s.slice(1)) {
    if (ch === '#' || ch === '♯') acc++
    else if (ch === 'b' || ch === '♭') acc--
    else if (/[0-9-]/.test(ch)) break
    else throw new Error(`Bad pitch: ${s}`)
  }
  return { letter, acc }
}

export function parseNote(s: string): Note {
  const m = /^([A-Ga-g][#b♯♭]*)(-?\d)$/.exec(s)
  if (!m) throw new Error(`Bad note: ${s}`)
  return { ...parsePitch(m[1]), octave: Number(m[2]) }
}

/** All spellings of a pitch class with at most one accidental. */
export function spellingsOf(pc: number): Pitch[] {
  const out: Pitch[] = []
  for (let letter = 0; letter < 7; letter++) {
    for (const acc of [0, -1, 1]) {
      if (pitchClass({ letter, acc }) === pc) out.push({ letter, acc })
    }
  }
  return out
}

/** Cb, Fb, E#, B#: legal but awkward to read. */
export function isAwkward(p: Pitch): boolean {
  return (p.acc === -1 && (p.letter === 0 || p.letter === 3)) || (p.acc === 1 && (p.letter === 2 || p.letter === 6))
}

export function sameNote(a: Note, b: Note): boolean {
  return a.letter === b.letter && a.acc === b.acc && a.octave === b.octave
}
