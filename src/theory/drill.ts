import { type Chord, type Family, type Quality, FAMILIES, QUALITIES, QUALITY_BY_ID, bestRoot } from './chords'
import { II_V_I_MAJOR, II_V_I_MINOR, type Key, keyName, keyOf } from './keys'
import { pitchClass, transpose } from './notes'
import { type Rng, defaultRng, pick } from './random'
import { type Voicing, voiceChord } from './voicing'

export type DrillMode = 'random' | 'iivi'

export interface DrillConfig {
  mode: DrillMode
  families: Record<Family, boolean>
  /** Quality id → enabled. Missing ids count as enabled. */
  qualities: Record<string, boolean>
  iiviMajor: boolean
  iiviMinor: boolean
  barsPerChord: number
}

export interface DrillChord {
  chord: Chord
  voicing: Voicing
  bars: number
  /** e.g. "ii  ·  E♭ major" for ii–V–I drills. */
  context?: string
}

export function qualityEnabled(cfg: DrillConfig, q: Quality): boolean {
  return cfg.families[q.family] && cfg.qualities[q.id] !== false
}

export function enabledQualities(cfg: DrillConfig): Quality[] {
  return QUALITIES.filter((q) => qualityEnabled(cfg, q))
}

/** Can this config produce anything? */
export function drillProblem(cfg: DrillConfig): string | null {
  if (cfg.mode === 'random') {
    return enabledQualities(cfg).length ? null : 'Turn on at least one chord type in Settings.'
  }
  if (!cfg.iiviMajor && !cfg.iiviMinor) return 'Turn on major or minor ii–V–I in Settings.'
  if (!FAMILIES.some((f) => cfg.families[f])) return 'Turn on triads, sevenths or extended chords in Settings.'
  return null
}

type Roles = { ii: string[]; V: string[]; I: string[] }

/** Preferred qualities for each role, most common first; filtered by what the user has enabled. */
const IIVI_ROLES: Record<'major' | 'minor', Record<Family, Roles>> = {
  major: {
    triads: { ii: ['min'], V: ['maj'], I: ['maj'] },
    sevenths: { ii: ['m7'], V: ['7'], I: ['maj7', '6'] },
    extended: {
      ii: ['m9', 'm11', 'm13'],
      V: ['13', '9', '13b9', '7alt', '7b9', '7b9b13', '9sus4'],
      I: ['maj9', 'maj13', '69', 'maj7#11'],
    },
  },
  minor: {
    triads: { ii: ['dim'], V: ['maj'], I: ['min'] },
    sevenths: { ii: ['m7b5'], V: ['7'], I: ['m6', 'mmaj7', 'm7'] },
    extended: { ii: ['m7b5'], V: ['7b9', '7alt', '7b9b13', '13b9'], I: ['m9', 'm11'] },
  },
}

function choose(cfg: DrillConfig, ids: string[], rng: Rng): Quality {
  const ok = ids.filter((id) => cfg.qualities[id] !== false)
  return QUALITY_BY_ID[ok.length ? pick(ok, rng) : ids[0]]
}

function make(chord: Chord, bars: number, context?: string): DrillChord {
  return { chord, voicing: voiceChord(chord), bars, context }
}

export function iiVI(cfg: DrillConfig, rng: Rng = defaultRng): DrillChord[] {
  const modes: ('major' | 'minor')[] = []
  if (cfg.iiviMajor) modes.push('major')
  if (cfg.iiviMinor) modes.push('minor')
  const mode = modes.length ? pick(modes, rng) : 'major'
  const families = FAMILIES.filter((f) => cfg.families[f])
  const family = families.length ? pick(families, rng) : 'sevenths'
  const key: Key = keyOf(pick(mode === 'major' ? II_V_I_MAJOR : II_V_I_MINOR, rng), mode)
  const roles = IIVI_ROLES[mode][family]
  const ii = transpose(key.tonic, { steps: 1, semis: 2 })
  const V = transpose(key.tonic, { steps: 4, semis: 7 })
  const b = cfg.barsPerChord
  const kn = keyName(key)
  return [
    make({ root: ii, quality: choose(cfg, roles.ii, rng) }, b, `ii · ${kn}`),
    make({ root: V, quality: choose(cfg, roles.V, rng) }, b, `V · ${kn}`),
    make({ root: key.tonic, quality: choose(cfg, roles.I, rng) }, b * 2, `${mode === 'major' ? 'I' : 'i'} · ${kn}`),
  ]
}

export function randomChord(cfg: DrillConfig, prev: Chord | null, rng: Rng = defaultRng): DrillChord {
  const qs = enabledQualities(cfg)
  const pool = qs.length ? qs : [QUALITY_BY_ID['maj7']]
  for (let attempt = 0; ; attempt++) {
    const quality = pick(pool, rng)
    const pc = Math.floor(rng() * 12)
    if (attempt < 20 && prev && prev.quality.id === quality.id && pitchClass(prev.root) === pc) continue
    return make({ root: bestRoot(pc, quality), quality }, cfg.barsPerChord)
  }
}

/** Endless stream of drill chords for the given config. */
export function createDrill(cfg: DrillConfig, rng: Rng = defaultRng): () => DrillChord {
  let buffer: DrillChord[] = []
  let prev: Chord | null = null
  return () => {
    if (cfg.mode === 'iivi') {
      if (!buffer.length) buffer = iiVI(cfg, rng)
      const next = buffer.shift()!
      prev = next.chord
      return next
    }
    const next = randomChord(cfg, prev, rng)
    prev = next.chord
    return next
  }
}
