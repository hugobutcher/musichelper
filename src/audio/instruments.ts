import * as Tone from 'tone'

/**
 * Shared instruments, created after the first user gesture (iOS requires a tap before audio starts).
 * Piano: Salamander Grand Piano samples (Alexander Holm, CC BY 3.0), served by the Tone.js project
 * and cached by the service worker after first use. A synth stands in until they load.
 */

export interface Kit {
  kick: Tone.MembraneSynth
  snare: Tone.NoiseSynth
  hat: Tone.NoiseSynth
  ride: Tone.MetalSynth
  rim: Tone.Synth
  brush: Tone.NoiseSynth
  click: Tone.Synth
}

export interface Instruments {
  piano: Tone.Sampler
  pianoFallback: Tone.PolySynth
  bass: Tone.MonoSynth
  kit: Kit
  buses: { drums: Tone.Volume; bass: Tone.Volume; keys: Tone.Volume; click: Tone.Volume }
}

let instruments: Instruments | null = null
let pianoLoaded = false
let unlocked = false

const SAMPLE_BASE = 'https://tonejs.github.io/audio/salamander/'

function pianoUrls(): Record<string, string> {
  const names = ['C', 'D#', 'F#', 'A']
  const urls: Record<string, string> = {}
  for (let octave = 1; octave <= 7; octave++) {
    for (const n of names) {
      if (octave === 7 && n !== 'C') continue
      urls[`${n}${octave}`] = `${n.replace('#', 's')}${octave}.mp3`
    }
  }
  urls['A0'] = 'A0.mp3'
  return urls
}

/** Call from a tap/click handler before playing anything. */
export async function unlockAudio(): Promise<void> {
  if (unlocked && Tone.getContext().state === 'running') return
  try {
    // iOS: play through the speaker even when the ring/silent switch is on silent.
    const nav = navigator as Navigator & { audioSession?: { type: string } }
    if (nav.audioSession) nav.audioSession.type = 'playback'
  } catch {
    /* not supported */
  }
  await Tone.start()
  unlocked = true
}

export function getInstruments(): Instruments {
  if (instruments) return instruments
  const master = new Tone.Compressor({ threshold: -16, ratio: 3 }).toDestination()
  const reverb = new Tone.Reverb({ decay: 1.6, wet: 0.14 }).connect(master)

  const buses = {
    drums: new Tone.Volume(-6).connect(reverb),
    bass: new Tone.Volume(-3).connect(master),
    keys: new Tone.Volume(-4).connect(reverb),
    click: new Tone.Volume(-4).connect(master),
  }

  const piano = new Tone.Sampler({
    urls: pianoUrls(),
    baseUrl: SAMPLE_BASE,
    release: 1,
    onload: () => {
      pianoLoaded = true
    },
  }).connect(buses.keys)

  const pianoFallback = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.005, decay: 0.6, sustain: 0.25, release: 0.8 },
    volume: -10,
  }).connect(buses.keys)

  const bass = new Tone.MonoSynth({
    oscillator: { type: 'triangle' },
    filter: { Q: 1, type: 'lowpass', rolloff: -24 },
    envelope: { attack: 0.004, decay: 0.35, sustain: 0.35, release: 0.12 },
    filterEnvelope: { attack: 0.002, decay: 0.18, sustain: 0.25, release: 0.2, baseFrequency: 220, octaves: 2.8 },
  }).connect(buses.bass)

  const hp = (f: number) => new Tone.Filter(f, 'highpass').connect(buses.drums)
  const bp = (f: number) => new Tone.Filter({ frequency: f, type: 'bandpass', Q: 0.8 }).connect(buses.drums)

  const kit: Kit = {
    kick: new Tone.MembraneSynth({
      pitchDecay: 0.03,
      octaves: 5,
      envelope: { attack: 0.001, decay: 0.28, sustain: 0, release: 0.05 },
    }).connect(buses.drums),
    snare: new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.13, sustain: 0 } }).connect(hp(1400)),
    hat: new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.035, sustain: 0 } }).connect(hp(7500)),
    ride: new Tone.MetalSynth({
      envelope: { attack: 0.001, decay: 0.7, release: 0.3 },
      harmonicity: 5.1,
      modulationIndex: 20,
      resonance: 5200,
      octaves: 1.2,
      volume: -20,
    }).connect(buses.drums),
    rim: new Tone.Synth({ oscillator: { type: 'square' }, envelope: { attack: 0.001, decay: 0.025, sustain: 0, release: 0.01 }, volume: -14 }).connect(bp(1800)),
    brush: new Tone.NoiseSynth({ noise: { type: 'pink' }, envelope: { attack: 0.02, decay: 0.16, sustain: 0 }, volume: -10 }).connect(bp(3200)),
    click: new Tone.Synth({ oscillator: { type: 'sine' }, envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.01 } }).connect(buses.click),
  }

  instruments = { piano, pianoFallback, bass, kit, buses }
  return instruments
}

const midiToFreq = (m: number) => Tone.Frequency(m, 'midi').toFrequency()

// Sampler.triggerAttackRelease() forgets its voices immediately, so releaseAll() could not stop
// them. Instead we attack now and release on a timer, which keeps every sounding note stoppable.
const pendingReleases = new Set<ReturnType<typeof setTimeout>>()

/** Play MIDI notes on the piano (or the fallback synth until samples load). */
export function playPiano(midis: number[], durationSec: number, time: number, velocity = 0.6) {
  const inst = getInstruments()
  const freqs = midis.map(midiToFreq)
  if (!pianoLoaded) {
    inst.pianoFallback.triggerAttackRelease(freqs, durationSec, time, velocity)
    return
  }
  inst.piano.triggerAttack(freqs, time, velocity)
  const releaseAt = time + durationSec
  const ms = Math.max(0, (releaseAt - Tone.getContext().currentTime) * 1000 - 60)
  const id = setTimeout(() => {
    pendingReleases.delete(id)
    inst.piano.triggerRelease(freqs, Math.max(releaseAt, Tone.now()))
  }, ms)
  pendingReleases.add(id)
}

export function playBass(midi: number, durationSec: number, time: number, velocity = 0.8) {
  getInstruments().bass.triggerAttackRelease(midiToFreq(midi), durationSec, time, velocity)
}

export function click(time: number, accent: boolean) {
  getInstruments().kit.click.triggerAttackRelease(accent ? 'A6' : 'E6', 0.03, time, accent ? 1 : 0.6)
}

export function releaseAll() {
  if (!instruments) return
  pendingReleases.forEach(clearTimeout)
  pendingReleases.clear()
  instruments.piano.releaseAll()
  instruments.pianoFallback.releaseAll()
  instruments.bass.triggerRelease()
}

export function isPianoLoaded() {
  return pianoLoaded
}
