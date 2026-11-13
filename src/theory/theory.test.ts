import { describe, expect, it } from 'vitest'
import { QUALITIES, QUALITY_BY_ID, bestRoot, chordName, chordTones } from './chords'
import { type DrillConfig, createDrill, iiVI } from './drill'
import { MAJOR_KEYS, MINOR_KEYS, keyOf, scale } from './keys'
import { midiOf, parsePitch, pitchAscii, pitchClass, vexKey } from './notes'
import { seeded } from './random'
import { generateMelody, melodyNotes, randomDrillNote } from './sightreading'
import { voiceChord } from './voicing'

const spell = (root: string, id: string) =>
  chordTones({ root: parsePitch(root), quality: QUALITY_BY_ID[id] })
    .map((t) => pitchAscii(t.pitch))
    .join(' ')

describe('chord spelling', () => {
  it.each([
    ['C', 'maj7', 'C E G B'],
    ['F#', 'm7b5', 'F# A C E'],
    ['Db', 'maj7', 'Db F Ab C'],
    ['B', 'dim7', 'B D F Ab'],
    ['C', 'dim7', 'C Eb Gb Bbb'],
    ['Eb', '7', 'Eb G Bb Db'],
    ['G', '7alt', 'G B F A# Eb'],
    ['C', '13', 'C E G Bb D A'],
    ['A', 'm11', 'A C E G B D'],
    ['Bb', 'maj7#11', 'Bb D F A E'],
    ['E', 'aug', 'E G# B#'],
    ['D', 'sus4', 'D G A'],
    ['F', '69', 'F A C D G'],
    ['Db', '7alt', 'Db F Cb E A'],
    ['E', '7#9', 'E G# B D F##'],
  ])('%s%s = %s', (root, id, expected) => {
    expect(spell(root, id)).toBe(expected)
  })

  it('picks readable roots', () => {
    const name = (pc: number, id: string) => chordName({ root: bestRoot(pc, QUALITY_BY_ID[id]), quality: QUALITY_BY_ID[id] })
    expect(name(1, 'maj')).toBe('D♭')
    expect(name(1, 'min')).toBe('C♯m')
    expect(name(8, 'maj7')).toBe('A♭maj7')
    expect(name(8, 'min')).toBe('G♯m')
    expect(name(3, 'dim7')).toBe('D♯°7')
    expect(name(10, '7')).toBe('B♭7')
    expect(name(1, 'mmaj7')).toBe('C♯m(maj7)')
    expect(name(6, '7')).toBe('F♯7')
  })

  it('only uses double accidentals where theory forces them (dim7 on some roots, ♯9 on sharp-side roots)', () => {
    const seen: string[] = []
    for (const q of QUALITIES) {
      for (let pc = 0; pc < 12; pc++) {
        const tones = chordTones({ root: bestRoot(pc, q), quality: q })
        for (const t of tones.filter((x) => Math.abs(x.pitch.acc) > 1)) {
          seen.push(`${q.id}:${t.role}`)
          expect(['dim7:7', '7#9:9', '7alt:9'], `${q.id} on pc ${pc}`).toContain(`${q.id}:${t.role}`)
        }
      }
    }
    expect(seen.length).toBeLessThan(10)
  })

  it('spells every chord tone at the right pitch', () => {
    for (const q of QUALITIES) {
      for (let pc = 0; pc < 12; pc++) {
        const root = bestRoot(pc, q)
        expect(pitchClass(root)).toBe(pc)
        for (const t of chordTones({ root, quality: q })) {
          expect(pitchClass(t.pitch)).toBe((pc + t.semis) % 12)
        }
      }
    }
  })
})

describe('voicings', () => {
  it('voices every chord in readable ranges with ascending right hand', () => {
    for (const q of QUALITIES) {
      for (let pc = 0; pc < 12; pc++) {
        const v = voiceChord({ root: bestRoot(pc, q), quality: q })
        const rh = v.rh.map(midiOf)
        const lh = v.lh.map(midiOf)
        expect(rh.every((m, i) => i === 0 || m > rh[i - 1])).toBe(true)
        expect(Math.min(...rh)).toBeGreaterThanOrEqual(57)
        expect(Math.max(...rh)).toBeLessThanOrEqual(86)
        expect(Math.min(...lh)).toBeGreaterThanOrEqual(40)
        expect(Math.max(...lh)).toBeLessThan(Math.min(...rh) + 12)
        expect(v.rh.length).toBeLessThanOrEqual(4)
      }
    }
  })

  it('G13 voicing: LH G + F, RH B E A', () => {
    const v = voiceChord({ root: parsePitch('G'), quality: QUALITY_BY_ID['13'] })
    expect(v.lh.map(vexKey)).toEqual(['g/2', 'f/3'])
    expect(v.rh.map(vexKey)).toEqual(['b/3', 'a/4', 'e/5'])
  })
})

describe('ii–V–I', () => {
  const cfg: DrillConfig = {
    mode: 'iivi',
    families: { triads: false, sevenths: true, extended: false },
    qualities: {},
    iiviMajor: true,
    iiviMinor: false,
    barsPerChord: 1,
  }

  it('builds diatonic ii–V–I in every major key', () => {
    for (let s = 0; s < 60; s++) {
      const [ii, V, I] = iiVI(cfg, seeded(s))
      expect(ii.chord.quality.id).toBe('m7')
      expect(V.chord.quality.id).toBe('7')
      expect(['maj7', '6']).toContain(I.chord.quality.id)
      expect((pitchClass(V.chord.root) - pitchClass(ii.chord.root) + 12) % 12).toBe(5)
      expect((pitchClass(I.chord.root) - pitchClass(V.chord.root) + 12) % 12).toBe(5)
      expect(I.bars).toBe(2)
    }
  })

  it('Eb major gives Fm7 Bb7 Ebmaj7', () => {
    let found = false
    for (let s = 0; s < 400 && !found; s++) {
      const prog = iiVI({ ...cfg, qualities: { '6': false } }, seeded(s))
      if (pitchAscii(prog[2].chord.root) === 'Eb') {
        expect(prog.map((p) => chordName(p.chord))).toEqual(['Fm7', 'B♭7', 'E♭maj7'])
        found = true
      }
    }
    expect(found).toBe(true)
  })

  it('minor ii–V–i uses half-diminished ii', () => {
    const prog = iiVI({ ...cfg, iiviMajor: false, iiviMinor: true }, seeded(3))
    expect(prog[0].chord.quality.id).toBe('m7b5')
  })

  it('random mode only uses enabled chord types', () => {
    const next = createDrill({ ...cfg, mode: 'random', families: { triads: true, sevenths: false, extended: false }, qualities: { aug: false, sus2: false } }, seeded(9))
    for (let i = 0; i < 200; i++) {
      expect(['maj', 'min', 'dim', 'sus4']).toContain(next().chord.quality.id)
    }
  })
})

describe('sight-reading', () => {
  it('scales follow key signatures', () => {
    expect(scale(keyOf('Bb', 'major')).map(pitchAscii).join(' ')).toBe('Bb C D Eb F G A')
    expect(scale(keyOf('F#', 'minor')).map(pitchAscii).join(' ')).toBe('F# G# A B C# D E')
  })

  it('single notes stay on the chosen clef range', () => {
    const rng = seeded(1)
    let prev = null
    for (let i = 0; i < 300; i++) {
      prev = randomDrillNote({ clef: 'bass', ledgerLines: false, accidentals: false }, prev, rng)
      const m = midiOf(prev.note)
      expect(prev.clef).toBe('bass')
      expect(m).toBeGreaterThanOrEqual(43)
      expect(m).toBeLessThanOrEqual(57)
    }
  })

  it('melodies fill every bar, end on the tonic, and stay in range', () => {
    for (const difficulty of ['easy', 'medium', 'hard'] as const) {
      for (let s = 0; s < 100; s++) {
        const m = generateMelody({ clef: 'random', modes: 'both', key: 'random', bars: 4, difficulty }, seeded(s))
        expect(m.bars).toHaveLength(4)
        for (const bar of m.bars) expect(bar.reduce((n, x) => n + x.beats, 0)).toBe(4)
        const notes = melodyNotes(m)
        const last = notes[notes.length - 1].note
        expect(pitchClass(last)).toBe(pitchClass(m.key.tonic))
        for (const n of notes) {
          const midi = midiOf(n.note)
          if (m.clef === 'treble') expect(midi).toBeGreaterThanOrEqual(58)
          else expect(midi).toBeLessThanOrEqual(62)
        }
      }
    }
  })

  it('every key name parses', () => {
    for (const k of [...MAJOR_KEYS, ...MINOR_KEYS]) expect(() => parsePitch(k)).not.toThrow()
  })
})
