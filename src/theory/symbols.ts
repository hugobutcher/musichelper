import { type Chord, QUALITY_BY_ID, chordName } from './chords'
import { type Pitch, midiOf, parsePitch, pitchName, placeAtOrAbove } from './notes'
import { type Voicing, voiceChord } from './voicing'

/** Lead-sheet suffix → quality id. */
const SUFFIXES: Record<string, string> = {
  '': 'maj',
  maj: 'maj',
  m: 'min',
  min: 'min',
  '-': 'min',
  dim: 'dim',
  '°': 'dim',
  aug: 'aug',
  '+': 'aug',
  sus2: 'sus2',
  sus4: 'sus4',
  sus: 'sus4',
  maj7: 'maj7',
  M7: 'maj7',
  m7: 'm7',
  min7: 'm7',
  '-7': 'm7',
  '7': '7',
  m7b5: 'm7b5',
  ø: 'm7b5',
  ø7: 'm7b5',
  dim7: 'dim7',
  '°7': 'dim7',
  'm(maj7)': 'mmaj7',
  mmaj7: 'mmaj7',
  mMaj7: 'mmaj7',
  '7sus4': '7sus4',
  '7sus': '7sus4',
  'maj7#5': 'maj7#5',
  '6': '6',
  m6: 'm6',
  maj9: 'maj9',
  m9: 'm9',
  '9': '9',
  '7b9': '7b9',
  '7#9': '7#9',
  '69': '69',
  '6/9': '69',
  m11: 'm11',
  '9sus4': '9sus4',
  '11': '9sus4',
  'maj7#11': 'maj7#11',
  '9#11': '9#11',
  '13': '13',
  maj13: 'maj13',
  m13: 'm13',
  '13b9': '13b9',
  '7alt': '7alt',
  alt: '7alt',
  '7b9b13': '7b9b13',
  '7#5': '7#5',
  '7+': '7#5',
  '7b5': '7b5',
}

export interface SymbolChord extends Chord {
  /** Slash bass, e.g. the A in F/A. */
  bass?: Pitch
}

const NO_CHORD = /^(N\.?C\.?|NC)$/i

/** Parse "Bb7", "F#m7b5", "Cmaj7/E", "Gb6/9" … Returns null for N.C.; throws on unknown symbols. */
export function parseSymbol(symbol: string): SymbolChord | null {
  const s = symbol.trim().replace(/♭/g, 'b').replace(/♯/g, '#')
  if (NO_CHORD.test(s)) return null
  const m = /^([A-G][b#]?)(.*)$/.exec(s)
  if (!m) throw new Error(`Unknown chord symbol: ${symbol}`)
  let rest = m[2]
  let bass: Pitch | undefined
  // A slash followed by a note name is a bass note; "6/9" is not.
  const slash = /\/([A-G][b#]?)$/.exec(rest)
  if (slash) {
    bass = parsePitch(slash[1])
    rest = rest.slice(0, -slash[0].length)
  }
  const id = SUFFIXES[rest]
  if (!id) throw new Error(`Unknown chord symbol: ${symbol}`)
  return { root: parsePitch(m[1]), quality: QUALITY_BY_ID[id], bass }
}

export function symbolName(c: SymbolChord): string {
  return chordName(c) + (c.bass ? `/${pitchName(c.bass)}` : '')
}

/** Voicing for a lead-sheet chord; a slash bass replaces the left-hand root. */
export function voiceSymbol(c: SymbolChord): Voicing {
  const v = voiceChord(c)
  if (!c.bass) return v
  const bass = placeAtOrAbove(c.bass, 40)
  const top = Math.min(...v.rh.map(midiOf))
  const lh = [bass, ...v.lh.slice(1).filter((n) => midiOf(n) > midiOf(bass) && midiOf(n) < top)]
  return { lh, rh: v.rh }
}
