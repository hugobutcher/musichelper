import * as Tone from 'tone'
import type { DrillChord } from '../theory/drill'
import { midiOf } from '../theory/notes'
import type { MelodyNote } from '../theory/sightreading'
import { type GrooveId, playBar } from './grooves'
import { click, getInstruments, playPiano, releaseAll, unlockAudio } from './instruments'

// ---------------------------------------------------------------------------
// Screen wake lock while something is playing (supported in recent iOS; ignored elsewhere).

interface Sentinel extends EventTarget {
  release: () => Promise<void>
}
let wakeLock: Sentinel | null = null
let wantAwake = false
let requesting = false

async function acquireWakeLock() {
  if (!wantAwake || wakeLock || requesting || document.hidden) return
  const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<Sentinel> } }
  if (!nav.wakeLock) return
  requesting = true
  try {
    const sentinel = await nav.wakeLock.request('screen')
    if (!wantAwake) {
      void sentinel.release()
      return
    }
    wakeLock = sentinel
    // iOS/Chrome drop the lock when the app is backgrounded; forget it so we can re-request.
    sentinel.addEventListener('release', () => {
      if (wakeLock === sentinel) wakeLock = null
    })
  } catch {
    /* not allowed right now */
  } finally {
    requesting = false
  }
}

/** Keep the screen on while something plays; also tells the app it is busy (no update reloads). */
export function keepAwake(on: boolean) {
  wantAwake = on
  if (on) void acquireWakeLock()
  else if (wakeLock) {
    const s = wakeLock
    wakeLock = null
    void s.release().catch(() => undefined)
  }
}

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) void acquireWakeLock()
})

// Bumped on every stop/start, so a start that was still waiting for audio to unlock
// can tell the user pressed Stop (or left the screen) in the meantime.
let generation = 0

/** Unlock audio; false if something stopped playback while we waited. */
async function begin(): Promise<boolean> {
  const mine = ++generation
  await unlockAudio()
  getInstruments()
  return mine === generation
}

// UI callbacks timed to the audio clock. Unlike Tone.Draw these are never dropped when late
// (Draw discards anything more than 0.25 s late, e.g. when the page is briefly throttled).
const pendingUi = new Set<ReturnType<typeof setTimeout>>()
function atAudioTime(time: number, fn: () => void) {
  const ms = Math.max(0, (time - Tone.getContext().currentTime) * 1000)
  const id = setTimeout(() => {
    pendingUi.delete(id)
    fn()
  }, ms)
  pendingUi.add(id)
}

function resetTransport() {
  const transport = Tone.getTransport()
  transport.stop()
  transport.cancel()
  transport.position = 0
  pendingUi.forEach(clearTimeout)
  pendingUi.clear()
  releaseAll()
}

export function stopAll() {
  generation++
  resetTransport()
  keepAwake(false)
}

export function setBpm(bpm: number) {
  Tone.getTransport().bpm.value = bpm
}

// ---------------------------------------------------------------------------
// Chord practice

export interface ChordBeat {
  current: DrillChord
  next: DrillChord
  /** 0–3 */
  beatInBar: number
  /** 0-based bar within the current chord */
  barInChord: number
  /** Count-in beats remaining (4, 3, 2, 1) or 0 once playing. */
  countIn: number
}

export interface ChordSessionOptions {
  bpm: number
  groove: GrooveId
  playChords: boolean
  countIn: boolean
  first: DrillChord
  second: DrillChord
  nextChord: () => DrillChord
  onBeat: (b: ChordBeat) => void
}

/** Live settings the running session reads every bar. */
export const live = { groove: 'swing' as GrooveId, playChords: false }

export async function startChordSession(o: ChordSessionOptions): Promise<boolean> {
  if (!(await begin())) return false
  resetTransport()
  live.groove = o.groove
  live.playChords = o.playChords
  const transport = Tone.getTransport()
  transport.bpm.value = o.bpm
  transport.swing = 0

  let current = o.first
  let next = o.second
  let countIn = o.countIn ? 4 : 0
  let beatInChord = 0
  let bar = 0

  transport.scheduleRepeat((time) => {
    const beatDur = 60 / transport.bpm.value
    if (countIn > 0) {
      click(time, countIn === 4)
      const shown = countIn
      atAudioTime(time, () => o.onBeat({ current, next, beatInBar: 4 - shown, barInChord: 0, countIn: shown }))
      countIn--
      return
    }
    if (beatInChord === current.bars * 4) {
      current = next
      next = o.nextChord()
      beatInChord = 0
    }
    const beatInBar = beatInChord % 4
    const barInChord = Math.floor(beatInChord / 4)
    if (beatInBar === 0) {
      const barTicks = transport.getTicksAtTime(time)
      const at = (beat: number, fn: (t: number) => void) => {
        if (beat === 0) fn(time)
        else transport.scheduleOnce(fn, `${Math.round(barTicks + beat * transport.PPQ)}i`)
      }
      playBar(live.groove, { beatDur, chord: current, next, barInChord, bar, playChords: live.playChords, at })
      bar++
    }
    const snapshot: ChordBeat = { current, next, beatInBar, barInChord, countIn: 0 }
    atAudioTime(time, () => o.onBeat(snapshot))
    beatInChord++
  }, '4n')

  transport.start('+0.15')
  keepAwake(true)
  return true
}

/** Hear a chord once (tap-to-preview when stopped). */
export async function previewChord(c: DrillChord) {
  await unlockAudio()
  getInstruments()
  playPiano([...c.voicing.lh, ...c.voicing.rh].map(midiOf), 1.8, Tone.now() + 0.02, 0.55)
}

// ---------------------------------------------------------------------------
// Sight-reading

export async function playNote(midi: number) {
  await unlockAudio()
  getInstruments()
  playPiano([midi], 1.2, Tone.now() + 0.02, 0.65)
}

export interface MelodyPlayback {
  notes: MelodyNote[]
  bpm: number
  /** Play the melody's notes (false = click track only, for trying it yourself). */
  withNotes: boolean
  countIn: boolean
  onNote: (index: number) => void
  onCountIn: (beatsLeft: number) => void
  onDone: () => void
}

export async function playMelody(p: MelodyPlayback): Promise<boolean> {
  if (!(await begin())) return false
  resetTransport()
  const transport = Tone.getTransport()
  transport.bpm.value = p.bpm
  const beat = 60 / p.bpm
  const lead = p.countIn ? 4 : 0
  const total = p.notes.length ? p.notes[p.notes.length - 1].start + p.notes[p.notes.length - 1].beats : 0

  for (let i = 0; i < lead; i++) {
    transport.schedule((time) => {
      click(time, i === 0)
      atAudioTime(time, () => p.onCountIn(lead - i))
    }, i * beat)
  }
  if (!p.withNotes) {
    for (let i = 0; i < total; i++) {
      transport.schedule((time) => click(time, i % 4 === 0), (lead + i) * beat)
    }
  }
  p.notes.forEach((n, i) => {
    transport.schedule((time) => {
      if (p.withNotes) playPiano([midiOf(n.note)], n.beats * beat * 0.92, time, 0.65)
      atAudioTime(time, () => p.onNote(i))
    }, (lead + n.start) * beat)
  })
  transport.schedule((time) => {
    atAudioTime(time, () => {
      p.onDone()
      stopAll()
    })
  }, (lead + total) * beat + 0.3)

  transport.start('+0.15')
  keepAwake(true)
  return true
}

/** True while practice audio or a song is playing. */
export function isBusy() {
  return wantAwake
}
