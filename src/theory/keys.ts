import { type Interval, type Note, type Pitch, parsePitch, pitchAscii, pitchName, transpose } from './notes'

export type Mode = 'major' | 'minor'

export interface Key {
  tonic: Pitch
  mode: Mode
}

export const MAJOR_KEYS = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb']
export const MINOR_KEYS = ['A', 'E', 'B', 'F#', 'C#', 'G#', 'D', 'G', 'C', 'F', 'Bb', 'Eb']

/** Keys used for ii–V–I drills: one spelling per pitch class. */
export const II_V_I_MAJOR = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']
export const II_V_I_MINOR = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'G#', 'A', 'Bb', 'B']

const iv = (steps: number, semis: number): Interval => ({ steps, semis })

const MAJOR_SCALE = [iv(0, 0), iv(1, 2), iv(2, 4), iv(3, 5), iv(4, 7), iv(5, 9), iv(6, 11)]
const NATURAL_MINOR_SCALE = [iv(0, 0), iv(1, 2), iv(2, 3), iv(3, 5), iv(4, 7), iv(5, 8), iv(6, 10)]

export function keyOf(name: string, mode: Mode): Key {
  return { tonic: parsePitch(name), mode }
}

/** The 7 scale degrees (natural minor for minor keys). */
export function scale(k: Key): Pitch[] {
  return (k.mode === 'major' ? MAJOR_SCALE : NATURAL_MINOR_SCALE).map((x) => transpose(k.tonic, x))
}

export function keyName(k: Key): string {
  return `${pitchName(k.tonic)} ${k.mode}`
}

/** VexFlow key-signature spec: "Bb", "F#m" … */
export function vexKeySpec(k: Key): string {
  return pitchAscii(k.tonic) + (k.mode === 'minor' ? 'm' : '')
}

/** Accidental the key signature gives to a letter (e.g. Bb major → letter B: -1). */
export function keySignatureAcc(k: Key, letter: number): number {
  return scale(k).find((p) => p.letter === letter)!.acc
}

/** Is this note's accidental already implied by the key signature? */
export function inKey(k: Key, n: Note | Pitch): boolean {
  return keySignatureAcc(k, n.letter) === n.acc
}
