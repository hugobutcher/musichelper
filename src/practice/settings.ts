import { useCallback, useState } from 'react'
import type { GrooveId } from '../audio/grooves'
import type { DrillConfig } from '../theory/drill'
import type { MelodyConfig, NoteDrillConfig } from '../theory/sightreading'

export type PracticeView = 'chords' | 'notes' | 'melody'

export interface ChordSettings extends DrillConfig {
  showNames: boolean
  bpm: number
  groove: GrooveId
  playChords: boolean
  countIn: boolean
}

export interface NoteSettings extends NoteDrillConfig {
  showNames: boolean
  sound: boolean
}

export interface MelodySettings extends MelodyConfig {
  bpm: number
  countIn: boolean
}

export interface PracticeSettings {
  view: PracticeView
  chords: ChordSettings
  notes: NoteSettings
  melody: MelodySettings
}

export const DEFAULTS: PracticeSettings = {
  view: 'chords',
  chords: {
    mode: 'random',
    families: { triads: true, sevenths: true, extended: false },
    qualities: {},
    iiviMajor: true,
    iiviMinor: true,
    barsPerChord: 1,
    showNames: true,
    bpm: 80,
    groove: 'swing',
    playChords: false,
    countIn: true,
  },
  notes: { clef: 'treble', ledgerLines: false, accidentals: false, showNames: false, sound: true },
  melody: { clef: 'treble', modes: 'major', key: 'random', bars: 4, difficulty: 'easy', bpm: 70, countIn: true },
}

const KEY = 'mh.practice.v1'

function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x)
}

/** Fill in anything missing from saved settings (e.g. after an app update adds a field). */
function merge<T>(defaults: T, saved: unknown): T {
  if (!isObject(defaults) || !isObject(saved)) return (saved !== undefined && typeof saved === typeof defaults ? saved : defaults) as T
  const out: Record<string, unknown> = { ...defaults }
  for (const k of Object.keys(saved)) {
    out[k] = k in defaults ? merge((defaults as Record<string, unknown>)[k], saved[k]) : saved[k]
  }
  return out as T
}

export function loadSettings(): PracticeSettings {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? merge(DEFAULTS, JSON.parse(raw)) : DEFAULTS
  } catch {
    return DEFAULTS
  }
}

function saveSettings(s: PracticeSettings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    /* storage unavailable */
  }
}

/** Settings state that saves itself on every change. */
export function usePracticeSettings() {
  const [settings, setSettings] = useState<PracticeSettings>(loadSettings)
  const update = useCallback((fn: (s: PracticeSettings) => PracticeSettings) => {
    setSettings((prev) => {
      const next = fn(prev)
      saveSettings(next)
      return next
    })
  }, [])
  return [settings, update] as const
}

export const clampBpm = (n: number) => Math.max(30, Math.min(260, Math.round(n)))
