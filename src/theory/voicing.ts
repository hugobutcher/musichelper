import { type Chord, type Role, chordTones } from './chords'
import { type Note, type Pitch, midiOf, placeAtOrAbove } from './notes'

export interface Voicing {
  lh: Note[]
  rh: Note[]
}

const ROLE_ORDER: Role[] = ['R', '2', '3', '4', '5', '6', '7', '9', '11', '13']

/** Stack pitches upward in order, each strictly above the previous. */
function stack(pitches: Pitch[], startMin: number): Note[] {
  const out: Note[] = []
  let floor = startMin
  for (const p of pitches) {
    const n = placeAtOrAbove(p, floor)
    out.push(n)
    floor = midiOf(n) + 1
  }
  return out
}

/**
 * Piano voicing used for both notation and playback.
 * Triads and sevenths: left hand root, right hand the full chord in root position.
 * Extended chords: left hand root + 7th (or 5th when there is no 7th), right hand the
 * remaining tones stacked 3-5-9-11-13; the 5th is dropped from 11th and 13th chords.
 */
export function voiceChord(c: Chord): Voicing {
  const tones = chordTones(c).sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role))
  const root = tones[0]
  const lhRoot = placeAtOrAbove(root.pitch, 40) // E2 … D#3

  if (c.quality.family !== 'extended') {
    return { lh: [lhRoot], rh: stack(tones.map((x) => x.pitch), 57) } // right hand starts A3 … G#4
  }

  const partner = tones.find((x) => x.role === '7') ?? tones.find((x) => x.role === '5')
  const lh = partner ? [lhRoot, ...stack([partner.pitch], midiOf(lhRoot) + 1)] : [lhRoot]
  let rh = tones.filter((x) => x !== root && x !== partner)
  if (tones.length >= 6) rh = rh.filter((x) => x.role !== '5')
  return { lh, rh: stack(rh.map((x) => x.pitch), 57) }
}

export function voicingMidis(v: Voicing): number[] {
  return [...v.lh, ...v.rh].map(midiOf)
}
