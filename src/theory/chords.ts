import { type Interval, type Pitch, isAwkward, pitchClass, pitchName, spellingsOf, transpose } from './notes'

export type Family = 'triads' | 'sevenths' | 'extended'
export type Role = 'R' | '2' | '3' | '4' | '5' | '6' | '7' | '9' | '11' | '13'

export interface ChordTone {
  role: Role
  iv: Interval
}

export interface Quality {
  id: string
  family: Family
  group: string
  label: string
  /** Text after the root in the chord name, e.g. "m7♭5". */
  suffix: string
  tones: ChordTone[]
}

const t = (role: Role, steps: number, semis: number): ChordTone => ({ role, iv: { steps, semis } })
const R = t('R', 0, 0)
const M2 = t('2', 1, 2)
const m3 = t('3', 2, 3)
const M3 = t('3', 2, 4)
const P4 = t('4', 3, 5)
const b5 = t('5', 4, 6)
const P5 = t('5', 4, 7)
const s5 = t('5', 4, 8)
const M6 = t('6', 5, 9)
const d7 = t('7', 6, 9)
const m7 = t('7', 6, 10)
const M7 = t('7', 6, 11)
const b9 = t('9', 8, 13)
const n9 = t('9', 8, 14)
const s9 = t('9', 8, 15)
const n11 = t('11', 10, 17)
const s11 = t('11', 10, 18)
const b13 = t('13', 12, 20)
const n13 = t('13', 12, 21)

const q = (id: string, family: Family, group: string, label: string, suffix: string, tones: ChordTone[]): Quality => ({
  id,
  family,
  group,
  label,
  suffix,
  tones,
})

export const QUALITIES: Quality[] = [
  // Triads
  q('maj', 'triads', 'Triads', 'Major', '', [R, M3, P5]),
  q('min', 'triads', 'Triads', 'Minor', 'm', [R, m3, P5]),
  q('dim', 'triads', 'Triads', 'Diminished', '°', [R, m3, b5]),
  q('aug', 'triads', 'Triads', 'Augmented', '+', [R, M3, s5]),
  q('sus2', 'triads', 'Triads', 'Sus2', 'sus2', [R, M2, P5]),
  q('sus4', 'triads', 'Triads', 'Sus4', 'sus4', [R, P4, P5]),
  // Sevenths
  q('maj7', 'sevenths', 'Sevenths', 'Major 7', 'maj7', [R, M3, P5, M7]),
  q('m7', 'sevenths', 'Sevenths', 'Minor 7', 'm7', [R, m3, P5, m7]),
  q('7', 'sevenths', 'Sevenths', 'Dominant 7', '7', [R, M3, P5, m7]),
  q('m7b5', 'sevenths', 'Sevenths', 'Half-diminished', 'm7♭5', [R, m3, b5, m7]),
  q('dim7', 'sevenths', 'Sevenths', 'Diminished 7', '°7', [R, m3, b5, d7]),
  q('mmaj7', 'sevenths', 'Sevenths', 'Minor-major 7', 'm(maj7)', [R, m3, P5, M7]),
  q('7sus4', 'sevenths', 'Sevenths', '7sus4', '7sus4', [R, P4, P5, m7]),
  q('maj7#5', 'sevenths', 'Sevenths', 'Augmented major 7', 'maj7♯5', [R, M3, s5, M7]),
  q('6', 'sevenths', 'Sevenths', 'Major 6', '6', [R, M3, P5, M6]),
  q('m6', 'sevenths', 'Sevenths', 'Minor 6', 'm6', [R, m3, P5, M6]),
  // Extended: 9ths
  q('maj9', 'extended', '9ths', 'Major 9', 'maj9', [R, M3, P5, M7, n9]),
  q('m9', 'extended', '9ths', 'Minor 9', 'm9', [R, m3, P5, m7, n9]),
  q('9', 'extended', '9ths', 'Dominant 9', '9', [R, M3, P5, m7, n9]),
  q('7b9', 'extended', '9ths', '7♭9', '7♭9', [R, M3, P5, m7, b9]),
  q('7#9', 'extended', '9ths', '7♯9', '7♯9', [R, M3, P5, m7, s9]),
  q('69', 'extended', '9ths', '6/9', '6/9', [R, M3, P5, M6, n9]),
  // Extended: 11ths
  q('m11', 'extended', '11ths', 'Minor 11', 'm11', [R, m3, P5, m7, n9, n11]),
  q('9sus4', 'extended', '11ths', '9sus4', '9sus4', [R, P4, P5, m7, n9]),
  q('maj7#11', 'extended', '11ths', 'Major 7♯11', 'maj7♯11', [R, M3, P5, M7, s11]),
  q('9#11', 'extended', '11ths', '9♯11', '9♯11', [R, M3, P5, m7, n9, s11]),
  // Extended: 13ths
  q('13', 'extended', '13ths', 'Dominant 13', '13', [R, M3, P5, m7, n9, n13]),
  q('maj13', 'extended', '13ths', 'Major 13', 'maj13', [R, M3, P5, M7, n9, n13]),
  q('m13', 'extended', '13ths', 'Minor 13', 'm13', [R, m3, P5, m7, n9, n13]),
  q('13b9', 'extended', '13ths', '13♭9', '13♭9', [R, M3, P5, m7, b9, n13]),
  // Extended: altered dominants
  q('7alt', 'extended', 'Altered', '7alt (♯9 ♭13)', '7alt', [R, M3, m7, s9, b13]),
  q('7b9b13', 'extended', 'Altered', '7♭9♭13', '7♭9♭13', [R, M3, m7, b9, b13]),
  q('7#5', 'extended', 'Altered', '7♯5', '7♯5', [R, M3, s5, m7]),
  q('7b5', 'extended', 'Altered', '7♭5', '7♭5', [R, M3, b5, m7]),
]

export const QUALITY_BY_ID: Record<string, Quality> = Object.fromEntries(QUALITIES.map((x) => [x.id, x]))

export const FAMILIES: Family[] = ['triads', 'sevenths', 'extended']

export const FAMILY_LABELS: Record<Family, string> = {
  triads: 'Triads',
  sevenths: 'Sevenths',
  extended: 'Extended chords',
}

export interface Chord {
  root: Pitch
  quality: Quality
}

export interface SpelledTone {
  role: Role
  pitch: Pitch
  /** Semitones above the root (may exceed 12). */
  semis: number
}

const TENSION_ROLES: Role[] = ['5', '9', '11', '13']

/**
 * Spell every chord tone from the root. Tensions (5ths, 9ths, 11ths, 13ths) that would need a
 * double accidental are respelled to an unused letter with at most one accidental, the way
 * charts write them (D♭7alt: E, not F♭; A, not B𝄫). Chord-defining tones keep strict spelling.
 */
export function chordTones(c: Chord): SpelledTone[] {
  const tones = c.quality.tones.map((tn) => ({ role: tn.role, pitch: transpose(c.root, tn.iv), semis: tn.iv.semis }))
  for (const tn of tones) {
    if (Math.abs(tn.pitch.acc) < 2 || !TENSION_ROLES.includes(tn.role)) continue
    const used = new Set(tones.filter((x) => x !== tn).map((x) => x.pitch.letter))
    const alt = spellingsOf(pitchClass(tn.pitch))
      .filter((p) => !used.has(p.letter))
      .sort((a, b) => Math.abs(a.acc) - Math.abs(b.acc))[0]
    if (alt) tn.pitch = alt
  }
  return tones
}

export function chordName(c: Chord): string {
  return pitchName(c.root) + c.quality.suffix
}

/** Lower is easier to read: penalises accidentals, heavily penalises double accidentals. */
export function spellingCost(root: Pitch, quality: Quality): number {
  let cost = 0
  for (const { pitch: p } of chordTones({ root, quality })) {
    const a = Math.abs(p.acc)
    cost += a + (a >= 2 ? 10 : 0) + (isAwkward(p) ? 1.5 : 0)
  }
  return cost
}

/** Conventional root names when two spellings are equally readable. */
const MINOR_ROOTS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'G#', 'A', 'Bb', 'B']
const MAJOR_ROOTS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']

/** Most readable spelling of a root pitch class for this chord quality. */
export function bestRoot(pc: number, quality: Quality): Pitch {
  const minorish = quality.tones.some((t) => t.role === '3' && t.iv.semis === 3)
  const preferred = (minorish ? MINOR_ROOTS : MAJOR_ROOTS)[pc]
  let best: Pitch | null = null
  let bestCost = Infinity
  for (const p of spellingsOf(pc)) {
    const name = 'CDEFGAB'[p.letter] + (p.acc === 1 ? '#' : p.acc === -1 ? 'b' : '')
    const c = spellingCost(p, quality) + (name === preferred ? 0 : 0.01)
    if (c < bestCost) {
      best = p
      bestCost = c
    }
  }
  return best!
}
