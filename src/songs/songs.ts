/**
 * Chord charts and section layouts for the play-along songs.
 * Chords come from data/song-research.json (researched + fact-checked; disputed spots are in `checkByEar`).
 *
 * Bar syntax: bars separated by "|". Inside a bar, chords split the 4 beats evenly unless a chord says
 * how many beats it gets with ":n" (e.g. "F6/9:1 E6:3").
 */

export interface ChartChord {
  symbol: string
  beats: number
}
export type Bar = ChartChord[]

export interface SectionPart {
  block: string
  /** 1-based first/last bar of the block to play (default: whole block). */
  from?: number
  to?: number
  /** Times through; omitted = work it out from the section's length and the tempo. */
  times?: number
}

export interface SongSection {
  name: string
  parts: SectionPart[]
  /** Default start time in seconds (from research or estimated); the user can re-mark it. */
  start: number
  /** True when the default start time is an estimate rather than sourced. */
  estimated?: boolean
}

export interface Song {
  id: string
  title: string
  artist: string
  recording: string
  key: string
  tempo: number
  feel: string
  blocks: Record<string, Bar[]>
  sections: SongSection[]
  checkByEar: string[]
}

export function bars(text: string): Bar[] {
  return text.split('|').map((barText) => {
    const tokens = barText.trim().split(/\s+/)
    const parsed = tokens.map((t) => {
      const m = /^(.*):(\d+)$/.exec(t)
      return m ? { symbol: m[1], beats: Number(m[2]) } : { symbol: t, beats: 0 }
    })
    const fixed = parsed.reduce((n, c) => n + c.beats, 0)
    const free = parsed.filter((c) => c.beats === 0)
    for (const c of free) c.beats = (4 - fixed) / free.length
    return parsed
  })
}

const t = (mmss: string) => {
  const [m, s] = mmss.split(':').map(Number)
  return m * 60 + s
}

export const SONGS: Song[] = [
  {
    id: 'freddie-freeloader',
    title: 'Freddie Freeloader',
    artist: 'Miles Davis',
    recording: 'Kind of Blue (Columbia, 1959) · Wynton Kelly, piano',
    key: 'B♭ blues',
    tempo: 129,
    feel: 'Medium swing blues',
    blocks: {
      head: bars('Bb7 | Bb7 | Bb7 | Bb7 | Eb7 | Eb7 | Bb7 | Bb7 | F7 | Eb7 | Ab7 | Ab7 | Bb7 | Bb7 | Bb7 | Bb7 | Eb7 | Eb7 | Bb7 | Bb7 | F7 | Eb7 | Ab7 | Bb7'),
      chorus: bars('Bb7 | Bb7 | Bb7 | Bb7 | Eb7 | Eb7 | Bb7 | Bb7 | F7 | Eb7 | Ab7 | Ab7'),
    },
    sections: [
      { name: 'Head', parts: [{ block: 'head', times: 1 }], start: 0 },
      { name: 'Piano solo', parts: [{ block: 'chorus', times: 4 }], start: t('0:44') },
      { name: 'Trumpet solo', parts: [{ block: 'chorus', times: 6 }], start: t('2:12') },
      { name: 'Tenor sax solo', parts: [{ block: 'chorus', times: 5 }], start: t('4:29') },
      { name: 'Alto sax solo', parts: [{ block: 'chorus', times: 5 }], start: t('6:22') },
      { name: 'Bass solo', parts: [{ block: 'chorus', times: 2 }], start: t('8:12') },
      { name: 'Head', parts: [{ block: 'head', times: 1 }], start: t('8:56') },
    ],
    checkByEar: [
      'Head bar 23 (second ending): A♭7 here; some fake books have B♭7.',
      'Solo choruses end A♭7 | A♭7 (the tune’s signature turnaround), not the usual blues turnaround.',
    ],
  },
  {
    id: 'joy-spring',
    title: 'Joy Spring',
    artist: 'Clifford Brown & Max Roach',
    recording: 'Clifford Brown & Max Roach (EmArcy, 1954) · Richie Powell, piano',
    key: 'F (second A in G♭)',
    tempo: 164,
    feel: 'Medium-up swing',
    blocks: {
      intro: bars('N.C. Bb6 Ab6 Gb6/9 | Gb6/9 | N.C. Ab6 G6 Gb6/9 | F6/9:1 E6:3 | Eb6 D7 | Db7 C7b9 | Fmaj7 | Fmaj7 C7#9'),
      head: bars(
        'Fmaj7 | Gm7 G#m7 | Am7 | Bbm7 Eb7 | F/A Ab6 | Gm7 C7 | F6 | Abm7 Db7 | Gbmaj7 | Abm7 Db7 | Gbmaj7 | Bm7 E7 | Bbm7 A7 | Abm7 Db7 | Gbmaj7 | Am7 D7 | Gmaj7 | Gm7 C7 | Fmaj7 | Fm7:2 Adim7:1 Bb7:1 | Ebmaj7 | Abm7 Db7 | Gbmaj7 | Gm7 C7 | Fmaj7 | Gm7 G#m7 | Am7 | Bbm7 Eb7 | F/A Ab6 | Gm7 C7 | F6 | Gm7 C7',
      ),
      solo: bars(
        'Fmaj7 | Gm7 C7 | Fmaj7 | Bbm7 Eb7 | Am7 Ab7 | Gm7 C7 | F6 | Abm7 Db7 | Gbmaj7 | Abm7 Db7 | Gbmaj7 | Bm7 E7 | Bbm7 A7 | Abm7 Db7 | Gbmaj7 | Am7 D7 | Gmaj7 | Gm7 C7 | Fmaj7 | Fm7 Bb7 | Ebmaj7 | Abm7 Db7 | Gbmaj7 | Gm7 C7 | Fmaj7 | Gm7 C7 | Fmaj7 | Bbm7 Eb7 | Am7 Ab7 | Gm7 C7 | F6 | Gm7 C7',
      ),
      tag: bars('Am7 Ab13 | Dbmaj7 | Am7 Ab13 | Dbmaj7 | Am7 Ab13 | Dbmaj7 | Emaj9:1 Fmaj9:3 | Fmaj9'),
    },
    sections: [
      { name: 'Intro', parts: [{ block: 'intro', times: 1 }], start: 0 },
      { name: 'Head', parts: [{ block: 'head', times: 1 }], start: t('0:12') },
      { name: 'Tenor sax solo', parts: [{ block: 'solo', times: 1 }], start: t('0:59') },
      { name: 'Trumpet solo', parts: [{ block: 'solo', times: 2 }], start: t('1:46') },
      { name: 'Piano solo', parts: [{ block: 'solo', times: 1 }], start: t('3:20') },
      { name: 'Trumpet/tenor trade', parts: [{ block: 'solo', times: 1 }], start: t('4:08'), estimated: true },
      { name: 'Drum solo', parts: [{ block: 'solo', times: 1 }], start: t('4:55') },
      { name: 'Intro', parts: [{ block: 'intro', times: 1 }], start: t('5:41'), estimated: true },
      { name: 'Head out', parts: [{ block: 'head', to: 28, times: 1 }], start: t('5:53'), estimated: true },
      { name: 'Three-time tag and ending', parts: [{ block: 'tag', times: 1 }], start: t('6:34'), estimated: true },
    ],
    checkByEar: [
      'Bar 13: B♭m7 A7 here; fake books have B♭m7 E♭7.',
      'Head bars 2 and 5 (Gm7 G♯m7, F/A A♭6) follow descriptions of this recording; fake books have Gm7 C7 and Am7 D7.',
      'Intro and tag chords come from a single transcription.',
    ],
  },
  {
    id: 'i-want-more',
    title: 'I Want More',
    artist: 'Dexter Gordon',
    recording: 'Dexter Calling… (Blue Note, 1961) · Kenny Drew, piano',
    key: 'A♭ (disputed)',
    tempo: 225,
    feel: 'Fast swing',
    blocks: {
      intro: bars('Bb7 | Bb7 | Eb7 | Eb7 | Bb7 | Bb7 | Eb7 | Eb7'),
      chorus: bars(
        'Bbm7 | Eb7 | Abmaj7 | Abmaj7 | Ebm7 | Ab7 | Dbmaj7 | Dbmaj7 G7 | Cm7 | F7 | Bbm7 | Eb7 | Cm7 F7 | Bbm7 Eb7 | Abmaj7 | Dm7b5 G7 | Cm7 | F7 | Bbm7 | Eb7 | Cm7 F7 | Bbm7 Eb7 | Abmaj7 | Cm7 F7 | Bbm7 | Eb7 | Abmaj7 | Abmaj7 | Ebm7 | Ab7 | Dbmaj7 | Dbmaj7 G7 | Cm7 | F7 | Bbm7 | Eb7 | Abmaj7 | Fm7 | Bbm7 Eb7 | Cm7 F7',
      ),
      outro: bars('Bb7 | Bb7 | Eb7 | Eb7 | Bb7 | Bb7 | Eb7 | Abmaj7'),
    },
    sections: [
      { name: 'Intro', parts: [{ block: 'intro', times: 1 }], start: 0 },
      { name: 'Head in', parts: [{ block: 'chorus', times: 1 }], start: 9, estimated: true },
      { name: 'Sax solo', parts: [{ block: 'chorus', times: 3 }], start: 51, estimated: true },
      { name: 'Piano solo', parts: [{ block: 'chorus' }], start: t('2:59'), estimated: true },
      { name: 'Head out', parts: [{ block: 'chorus', times: 1 }], start: t('4:24'), estimated: true },
      { name: 'Outro', parts: [{ block: 'outro', times: 1 }], start: t('5:07'), estimated: true },
    ],
    checkByEar: [
      'This is the least documented tune: no published lead sheet exists. Bars 9–24 and 33–40 are a reasoned reconstruction.',
      'The key (A♭) is inferred; it could be a different concert key.',
      'The 8-bar intro/outro (B♭7–E♭7) may sit elsewhere in the form.',
    ],
  },
  {
    id: 'so-what',
    title: 'So What',
    artist: 'Miles Davis',
    recording: 'Kind of Blue (Columbia, 1959) · Bill Evans, piano',
    key: 'D Dorian / E♭ Dorian',
    tempo: 138,
    feel: 'Medium modal swing',
    blocks: {
      intro: bars('Dm7 | Dm7 | Ebm7 | Ebm7 | Dm7 | Dm7 | Ebm7 | N.C.'),
      chorus: bars(
        'Dm7 | Dm7 | Dm7 | Dm7 | Dm7 | Dm7 | Dm7 | Dm7 | Dm7 | Dm7 | Dm7 | Dm7 | Dm7 | Dm7 | Dm7 | Dm7 | Ebm7 | Ebm7 | Ebm7 | Ebm7 | Ebm7 | Ebm7 | Ebm7 | Ebm7 | Dm7 | Dm7 | Dm7 | Dm7 | Dm7 | Dm7 | Dm7 | Dm7',
      ),
      ending: bars('Dm7 | Dm7 | Dm7 | Dm7 | Dm7 | Dm7 | Dm7 | Dm7 | Dm7 | Dm7 | Dm7 | Dm7 | Dm7 | Dm7 | Dm7 | Dm7'),
    },
    sections: [
      { name: 'Intro', parts: [{ block: 'intro', times: 1 }], start: 0 },
      { name: 'Head', parts: [{ block: 'chorus', times: 1 }], start: t('0:34') },
      { name: 'Trumpet solo', parts: [{ block: 'chorus', times: 2 }], start: t('1:27') },
      { name: 'Tenor sax solo', parts: [{ block: 'chorus', times: 2 }], start: t('3:20') },
      { name: 'Alto sax solo', parts: [{ block: 'chorus', times: 2 }], start: t('5:07') },
      { name: 'Piano solo', parts: [{ block: 'chorus', times: 1 }], start: t('6:53'), estimated: true },
      { name: 'Bass solo', parts: [{ block: 'chorus', times: 1 }, { block: 'ending' }], start: t('7:48'), estimated: true },
    ],
    checkByEar: [
      'The intro is rubato (free time); its chords are approximate.',
      'There is no bass solo as such: this section is the out-head (bass plays the melody) plus the fade-out.',
    ],
  },
  {
    id: 'afternoon-in-paris',
    title: 'An Afternoon in Paris',
    artist: 'Kenny Barron',
    recording: 'Invitation (Criss Cross, 1990)',
    key: 'C',
    tempo: 170,
    feel: 'Medium swing',
    blocks: {
      chorus: bars(
        'Cmaj7 | Cm7 F7 | Bbmaj7 | Bbm7 Eb7 | Abmaj7 | Dm7b5 G7b9 | Cmaj7 Am7 | Dm7 G7 | Cmaj7 | Cm7 F7 | Bbmaj7 | Bbm7 Eb7 | Abmaj7 | Dm7b5 G7b9 | Cmaj7 | Cmaj7 | Dm7 | G7 | Cmaj7/E | A7 | Dm7 | G7 | Cmaj7 | Dm7 G7 | Cmaj7 | Cm7 F7 | Bbmaj7 | Bbm7 Eb7 | Abmaj7 | Dm7b5 G7b9 | Cmaj7 Am7 | Dm7 G7',
      ),
      ending: bars('Cmaj7 Am7 | Dm7 G7 | Cmaj7 Am7 | Dm7 G7 | Cmaj7'),
    },
    sections: [
      { name: 'Head in', parts: [{ block: 'chorus', times: 1 }], start: 0, estimated: true },
      { name: 'Bass solo', parts: [{ block: 'chorus' }], start: 45, estimated: true },
      { name: 'Sax solo', parts: [{ block: 'chorus' }], start: 90, estimated: true },
      { name: 'Piano solo', parts: [{ block: 'chorus' }], start: 180, estimated: true },
      { name: 'Trading fours', parts: [{ block: 'chorus' }], start: 270, estimated: true },
      { name: 'Head out', parts: [{ block: 'chorus', times: 1 }], start: 360, estimated: true },
      { name: 'Ending', parts: [{ block: 'ending', times: 1 }], start: 405, estimated: true },
    ],
    checkByEar: [
      'Standard lead-sheet changes: no transcription of this recording exists, and Barron may reharmonise.',
      'Bridge bar 20: A7 here; some charts have Am7.',
      'Section start times are estimates; mark them while listening.',
    ],
  },
]

export const SONG_BY_ID: Record<string, Song> = Object.fromEntries(SONGS.map((s) => [s.id, s]))

// ---------------------------------------------------------------------------
// Timeline: where every bar of the song falls in the recording.

export interface TimedBar {
  section: number
  /** 1-based bar number inside the block (as printed on a chart). */
  barInBlock: number
  block: string
  /** Which time through the part (1-based). */
  pass: number
  bar: Bar
  start: number
  end: number
}

export interface TimedSection {
  index: number
  name: string
  start: number
  end: number
  bars: TimedBar[]
  /** Total passes the auto part was given (for display, e.g. "4 choruses"). */
  passes: number
}

function partBars(song: Song, p: SectionPart): Bar[] {
  const all = song.blocks[p.block]
  return all.slice((p.from ?? 1) - 1, p.to ?? all.length)
}

/**
 * Lay every bar of the song onto the recording. Each section is stretched to fill exactly the time
 * between its start and the next section's start, so tempo drift between sections is absorbed.
 */
export function buildTimeline(song: Song, starts: number[], duration: number): TimedSection[] {
  const beat = 60 / song.tempo
  return song.sections.map((sec, i) => {
    const start = starts[i]
    const end = i + 1 < song.sections.length ? starts[i + 1] : Math.max(duration, start + 1)
    const length = Math.max(0.5, end - start)
    const fixedBars = sec.parts.filter((p) => p.times !== undefined).reduce((n, p) => n + partBars(song, p).length * p.times!, 0)
    const auto = sec.parts.find((p) => p.times === undefined)
    let autoTimes = 0
    if (auto) {
      const autoLen = partBars(song, auto).length
      const remaining = length / (4 * beat) - fixedBars
      autoTimes = Math.max(1, Math.round(remaining / autoLen))
    }
    const plan = sec.parts.map((p) => ({ part: p, times: p.times ?? autoTimes }))
    const totalBars = plan.reduce((n, x) => n + partBars(song, x.part).length * x.times, 0)
    // The last section usually ends with a held chord / fade: don't stretch the bars into it.
    const naturalLen = totalBars * 4 * beat
    const barLen = i === song.sections.length - 1 ? Math.min(length, naturalLen * 1.08) / totalBars : length / totalBars

    const timed: TimedBar[] = []
    let t0 = start
    for (const { part, times } of plan) {
      const pb = partBars(song, part)
      for (let pass = 1; pass <= times; pass++) {
        pb.forEach((bar, k) => {
          timed.push({ section: i, barInBlock: (part.from ?? 1) + k, block: part.block, pass, bar, start: t0, end: t0 + barLen })
          t0 += barLen
        })
      }
    }
    return { index: i, name: sec.name, start, end, bars: timed, passes: auto ? autoTimes : (plan[0]?.times ?? 1) }
  })
}

/** Find the bar playing at time t. */
export function barAt(timeline: TimedSection[], t: number): { section: number; bar: number } {
  let s = 0
  for (let i = 0; i < timeline.length; i++) if (t >= timeline[i].start) s = i
  const bars = timeline[s].bars
  let b = 0
  for (let i = 0; i < bars.length; i++) if (t >= bars[i].start) b = i
  return { section: s, bar: b }
}
