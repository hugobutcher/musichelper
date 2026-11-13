import { chordTones } from '../theory/chords'
import type { DrillChord } from '../theory/drill'
import { pitchClass } from '../theory/notes'
import { voicingMidis } from '../theory/voicing'
import { type Kit, click, getInstruments, playBass, playPiano } from './instruments'

export type GrooveId = 'swing' | 'bossa' | 'funk' | 'ballad' | 'pop' | 'click' | 'none'

export const GROOVES: { id: GrooveId; label: string }[] = [
  { id: 'swing', label: 'Swing' },
  { id: 'bossa', label: 'Bossa nova' },
  { id: 'funk', label: 'Funk' },
  { id: 'ballad', label: 'Ballad' },
  { id: 'pop', label: 'Pop / rock' },
  { id: 'click', label: 'Click only' },
  { id: 'none', label: 'Silent' },
]

export interface BarContext {
  beatDur: number
  chord: DrillChord
  next: DrillChord
  /** 0-based bar within the current chord. */
  barInChord: number
  /** Global bar counter (for 2-bar patterns). */
  bar: number
  playChords: boolean
  /**
   * Run `fn` with the exact audio time of a beat offset within this bar. Events go through the
   * transport, so Stop cancels anything not yet played and tempo changes apply mid-bar.
   */
  at: (beat: number, fn: (time: number) => void) => void
}

const SWING = 2 / 3
const BASS_LO = 36 // C2
const BASS_HI = 55 // G3

let lastBass = 43

function nearest(pc: number, ref: number): number {
  let best = BASS_LO
  for (let m = BASS_LO; m <= BASS_HI; m++) {
    if (((m % 12) + 12) % 12 === pc && Math.abs(m - ref) < Math.abs(best - ref)) best = m
  }
  return best
}

function rootPc(c: DrillChord) {
  return pitchClass(c.chord.root)
}

/** Root, 3rd, 5th, 7th (or 6th / sus tones) as pitch classes. */
function corePcs(c: DrillChord): number[] {
  return chordTones(c.chord)
    .filter((t) => ['R', '2', '3', '4', '5', '6', '7'].includes(t.role))
    .map((t) => pitchClass(t.pitch))
}

function fifthPc(c: DrillChord): number {
  const five = chordTones(c.chord).find((t) => t.role === '5')
  return five ? pitchClass(five.pitch) : (rootPc(c) + 7) % 12
}

function seventhPc(c: DrillChord): number | null {
  const seven = chordTones(c.chord).find((t) => t.role === '7')
  return seven ? pitchClass(seven.pitch) : null
}

function isLastBar(ctx: BarContext) {
  return ctx.barInChord === ctx.chord.bars - 1
}

/** A semitone above or below the next chord's root. */
function approach(ctx: BarContext): number {
  const target = nearest(rootPc(ctx.next), lastBass)
  let m = target + (Math.random() < 0.5 ? -1 : 1)
  if (m < BASS_LO || m > BASS_HI || m === lastBass) m = 2 * target - m
  return m
}

/** Four walking quarter notes: root, chord tones, chromatic approach into the next chord. */
function walkingBar(ctx: BarContext): number[] {
  const notes: number[] = []
  const pcs = corePcs(ctx.chord)
  for (let beat = 0; beat < 4; beat++) {
    let m: number
    if (beat === 0 && ctx.barInChord === 0) {
      m = nearest(rootPc(ctx.chord), lastBass)
    } else if (beat === 3 && isLastBar(ctx)) {
      m = approach(ctx)
    } else {
      const options: number[] = []
      for (let x = BASS_LO; x <= BASS_HI; x++) {
        const d = Math.abs(x - lastBass)
        if (d >= 1 && d <= 7 && pcs.includes(((x % 12) + 12) % 12)) options.push(x)
      }
      m = options.length ? options[Math.floor(Math.random() * options.length)] : nearest(rootPc(ctx.chord), lastBass)
    }
    notes.push(m)
    lastBass = m
  }
  return notes
}

type Hit = [keyof Kit, number, number]

function drums(ctx: BarContext, k: Kit, hits: Hit[]) {
  for (const [name, beat, vel] of hits) {
    ctx.at(beat, (time) => {
      switch (name) {
        case 'kick':
          k.kick.triggerAttackRelease('C1', 0.2, time, vel)
          break
        case 'ride':
          k.ride.triggerAttackRelease(320, 0.3, time, vel)
          break
        case 'rim':
          k.rim.triggerAttackRelease('D6', 0.02, time, vel)
          break
        case 'click':
          k.click.triggerAttackRelease('E6', 0.03, time, vel)
          break
        default:
          k[name].triggerAttackRelease(0.05, time, vel)
      }
    })
  }
}

/** Bass note at a beat offset; length in beats. */
function bass(ctx: BarContext, beat: number, midi: number, beats: number, vel: number) {
  ctx.at(beat, (time) => playBass(midi, beats * ctx.beatDur, time, vel))
}

function comp(ctx: BarContext, hits: [number, number][], vel = 0.45) {
  if (!ctx.playChords) return
  const midis = voicingMidis(ctx.chord.voicing)
  for (const [beat, len] of hits) ctx.at(beat, (time) => playPiano(midis, len * ctx.beatDur, time, vel))
}

const eighths = (on: number, off: number): Hit[] => [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5].map((x) => ['hat', x, x % 1 === 0 ? on : off])

export function playBar(groove: GrooveId, ctx: BarContext) {
  const { kit } = getInstruments()
  const R = () => nearest(rootPc(ctx.chord), lastBass)
  const F = () => nearest(fifthPc(ctx.chord), lastBass)

  switch (groove) {
    case 'swing': {
      drums(ctx, kit, [
        ['ride', 0, 0.9],
        ['ride', 1, 0.7],
        ['ride', 1 + SWING, 0.45],
        ['ride', 2, 0.9],
        ['ride', 3, 0.7],
        ['ride', 3 + SWING, 0.45],
        ['hat', 1, 0.35],
        ['hat', 3, 0.35],
        ['kick', 0, 0.12],
        ['kick', 2, 0.1],
      ])
      walkingBar(ctx).forEach((m, i) => bass(ctx, i, m, 0.9, i === 0 ? 0.9 : 0.75))
      comp(ctx, [
        [0, 0.8],
        [1 + SWING, 0.3],
      ])
      break
    }
    case 'bossa': {
      const clave = ctx.bar % 2 === 0 ? [0, 1.5, 3] : [1, 2.5]
      drums(ctx, kit, [
        ...eighths(0.35, 0.2),
        ...clave.map((x): Hit => ['rim', x, 0.7]),
        ['kick', 0, 0.5],
        ['kick', 1.5, 0.3],
        ['kick', 2, 0.5],
        ['kick', 3.5, 0.3],
      ])
      const r = R()
      const f = F()
      bass(ctx, 0, r, 1.4, 0.85)
      bass(ctx, 1.5, f, 2.4, 0.7)
      lastBass = f
      comp(
        ctx,
        [
          [0, 0.9],
          [1.5, 0.4],
          [2.5, 0.4],
        ],
        0.4,
      )
      break
    }
    case 'funk': {
      drums(ctx, kit, [
        ...Array.from({ length: 16 }, (_, i): Hit => ['hat', i / 4, i % 4 === 0 ? 0.45 : i % 2 === 0 ? 0.3 : 0.15]),
        ['kick', 0, 0.9],
        ['kick', 0.75, 0.6],
        ['kick', 2.5, 0.8],
        ['snare', 1, 0.85],
        ['snare', 1.75, 0.15],
        ['snare', 3, 0.85],
        ['snare', 3.25, 0.15],
      ])
      const r = R()
      const s7 = seventhPc(ctx.chord)
      const line: [number, number, number][] = [
        [r, 0, 0.4],
        [r, 0.75, 0.2],
        [r + 12, 1.5, 0.2],
        [s7 === null ? r + 7 : nearest(s7, r + 10), 2.5, 0.3],
        [r, 3, 0.2],
        [isLastBar(ctx) ? approach(ctx) : F(), 3.5, 0.3],
      ]
      for (const [m, beat, len] of line) bass(ctx, beat, m, len, 0.9)
      lastBass = r
      comp(
        ctx,
        [
          [0, 0.2],
          [1.5, 0.2],
          [2.75, 0.2],
        ],
        0.35,
      )
      break
    }
    case 'ballad': {
      drums(ctx, kit, [
        ['brush', 0, 0.5],
        ['brush', 1, 0.6],
        ['brush', 2, 0.5],
        ['brush', 3, 0.6],
        ['hat', 1, 0.25],
        ['hat', 3, 0.25],
        ['kick', 0, 0.25],
      ])
      const first = ctx.barInChord === 0 ? R() : F()
      bass(ctx, 0, first, 1.9, 0.8)
      lastBass = first
      const second = isLastBar(ctx) ? approach(ctx) : ctx.barInChord === 0 ? F() : R()
      bass(ctx, 2, second, 1.9, 0.7)
      lastBass = second
      if (ctx.barInChord === 0) comp(ctx, [[0, ctx.chord.bars * 4 - 0.1]], 0.35)
      break
    }
    case 'pop': {
      drums(ctx, kit, [...eighths(0.4, 0.25), ['kick', 0, 0.9], ['kick', 2, 0.8], ['kick', 2.5, 0.55], ['snare', 1, 0.9], ['snare', 3, 0.9]])
      const r = R()
      for (let i = 0; i < 8; i++) bass(ctx, i * 0.5, i === 7 ? (isLastBar(ctx) ? approach(ctx) : F()) : r, 0.45, i % 2 === 0 ? 0.85 : 0.65)
      lastBass = r
      comp(
        ctx,
        [
          [0, 1.9],
          [2, 1.9],
        ],
        0.35,
      )
      break
    }
    case 'click': {
      for (let i = 0; i < 4; i++) ctx.at(i, (time) => click(time, i === 0))
      if (ctx.barInChord === 0) comp(ctx, [[0, ctx.chord.bars * 4 - 0.1]], 0.4)
      break
    }
    case 'none': {
      if (ctx.barInChord === 0) comp(ctx, [[0, ctx.chord.bars * 4 - 0.1]], 0.4)
      break
    }
  }
}
