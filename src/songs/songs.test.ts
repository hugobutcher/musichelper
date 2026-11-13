import { describe, expect, it } from 'vitest'
import { parseSymbol, symbolName, voiceSymbol } from '../theory/symbols'
import { SONGS, SONG_BY_ID, barAt, bars, buildTimeline } from './songs'

describe('song charts', () => {
  it('every chord symbol parses and every bar has 4 beats', () => {
    for (const song of SONGS) {
      for (const [name, block] of Object.entries(song.blocks)) {
        block.forEach((bar, i) => {
          expect(bar.reduce((n, c) => n + c.beats, 0), `${song.id} ${name} bar ${i + 1}`).toBe(4)
          for (const c of bar) expect(() => parseSymbol(c.symbol), `${song.id} ${c.symbol}`).not.toThrow()
        })
      }
    }
  })

  it('sections reference real blocks and are in time order', () => {
    for (const song of SONGS) {
      song.sections.forEach((s, i) => {
        for (const p of s.parts) expect(song.blocks[p.block], `${song.id} ${s.name}`).toBeDefined()
        if (i > 0) expect(s.start).toBeGreaterThan(song.sections[i - 1].start)
      })
    }
  })

  it('parses lead-sheet symbols', () => {
    expect(symbolName(parseSymbol('Cmaj7/E')!)).toBe('Cmaj7/E')
    expect(symbolName(parseSymbol('Gb6/9')!)).toBe('G♭6/9')
    expect(symbolName(parseSymbol('G#m7')!)).toBe('G♯m7')
    expect(parseSymbol('N.C.')).toBeNull()
    expect(voiceSymbol(parseSymbol('F/A')!).lh[0].letter).toBe(5) // A in the bass
  })

  it('bar parser splits beats', () => {
    expect(bars('F6/9:1 E6:3 | Gm7 C7 | Fm7:2 Adim7:1 Bb7:1')[0].map((c) => c.beats)).toEqual([1, 3])
    expect(bars('Gm7 C7')[0].map((c) => c.beats)).toEqual([2, 2])
  })
})

describe('timeline', () => {
  const song = SONG_BY_ID['freddie-freeloader']
  const starts = song.sections.map((s) => s.start)
  const tl = buildTimeline(song, starts, 587)

  it('Freddie Freeloader: piano solo is 4 × 12 bars starting at 0:44', () => {
    const piano = tl[1]
    expect(piano.bars).toHaveLength(48)
    expect(piano.bars[0].start).toBe(44)
    expect(piano.bars[47].end).toBeCloseTo(132, 5)
  })

  it('finds the bar at a time', () => {
    const { section, bar } = barAt(tl, 44 + 1.9 * (88 / 48))
    expect(section).toBe(1)
    expect(bar).toBe(1)
  })

  it('works out unknown chorus counts from the tempo', () => {
    const iwm = SONG_BY_ID['i-want-more']
    const t2 = buildTimeline(iwm, iwm.sections.map((s) => s.start), 320)
    // Piano solo 2:59 → 4:24 = 85 s; one 40-bar chorus at 225 bpm ≈ 42.7 s → 2 choruses.
    expect(t2[3].passes).toBe(2)
  })
})
