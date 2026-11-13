import { useEffect, useMemo, useRef, useState } from 'react'
import { GROOVES, type GrooveId } from '../audio/grooves'
import { type ChordBeat, live, previewChord, setBpm, startChordSession, stopAll } from '../audio/session'
import { ChordStaff } from '../notation/Notation'
import { FAMILIES, FAMILY_LABELS, QUALITIES, chordName } from '../theory/chords'
import { type DrillChord, type DrillConfig, createDrill, drillProblem } from '../theory/drill'
import { BpmControl, Chip, Section, Segmented, Sheet, SpeakerIcon, Toggle } from '../ui/controls'
import { type ChordSettings, clampBpm } from './settings'

interface Props {
  settings: ChordSettings
  update: (fn: (s: ChordSettings) => ChordSettings) => void
  settingsOpen: boolean
  closeSettings: () => void
}

function drillConfig(s: ChordSettings): DrillConfig {
  return {
    mode: s.mode,
    families: s.families,
    qualities: s.qualities,
    iiviMajor: s.iiviMajor,
    iiviMinor: s.iiviMinor,
    barsPerChord: s.barsPerChord,
  }
}

export default function ChordPractice({ settings, update, settingsOpen, closeSettings }: Props) {
  const cfgKey = JSON.stringify(drillConfig(settings))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const cfg = useMemo(() => drillConfig(settings), [cfgKey])
  const problem = drillProblem(cfg)
  const gen = useRef<() => DrillChord>(createDrill(cfg))
  const [queue, setQueue] = useState<[DrillChord, DrillChord]>(() => [gen.current(), gen.current()])
  const [playing, setPlaying] = useState(false)
  const [beat, setBeat] = useState<ChordBeat | null>(null)

  // New chord options: new generator; refresh the chords on screen when stopped.
  useEffect(() => {
    gen.current = createDrill(cfg)
    if (!playing) setQueue([gen.current(), gen.current()])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg])

  useEffect(() => {
    live.groove = settings.groove
    live.playChords = settings.playChords
  }, [settings.groove, settings.playChords])

  useEffect(() => () => stopAll(), [])

  const set = <K extends keyof ChordSettings>(k: K, v: ChordSettings[K]) => update((s) => ({ ...s, [k]: v }))

  const changeBpm = (n: number) => {
    const bpm = clampBpm(n)
    set('bpm', bpm)
    if (playing) setBpm(bpm)
  }

  const start = async () => {
    if (problem) return
    setPlaying(true)
    // false = Stop was pressed (or the screen closed) while audio was still unlocking.
    await startChordSession({
      bpm: settings.bpm,
      groove: settings.groove,
      playChords: settings.playChords,
      countIn: settings.countIn,
      first: queue[0],
      second: queue[1],
      nextChord: () => gen.current(),
      onBeat: (b) => {
        setBeat(b)
        setQueue([b.current, b.next])
      },
    })
  }

  const stop = () => {
    stopAll()
    setPlaying(false)
    setBeat(null)
  }

  const skip = () => {
    if (playing) return
    setQueue(([, next]) => [next, gen.current()])
  }

  const [current, next] = queue
  const names = settings.showNames

  return (
    <div className="chord-practice">
      <div className="quick-row">
        <Segmented
          small
          options={[
            { value: 'random', label: 'Random' },
            { value: 'iivi', label: 'ii–V–I' },
          ]}
          value={settings.mode}
          onChange={(v) => set('mode', v)}
        />
        <button className={names ? 'pill on' : 'pill'} onClick={() => set('showNames', !names)} aria-pressed={names}>
          Names {names ? 'on' : 'off'}
        </button>
      </div>

      {problem ? (
        <div className="card empty">{problem}</div>
      ) : (
        <>
          <div className="card paper main-chord" onClick={skip} role="button" aria-label="Current chord. Tap for next chord when stopped.">
            <div className="chord-head">
              <div className="chord-name">{names ? chordName(current.chord) : ' '}</div>
              <button
                className="icon-btn dark"
                onClick={(e) => {
                  e.stopPropagation()
                  void previewChord(current)
                }}
                aria-label="Hear this chord"
              >
                <SpeakerIcon />
              </button>
            </div>
            {names && current.context && <div className="chord-context">{current.context}</div>}
            <ChordStaff voicing={current.voicing} scale={1.1} height={196} />
            {beat?.countIn ? <div className="count-in">{beat.countIn}</div> : null}
          </div>

          <div className="beat-row">
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className={beat && !beat.countIn && beat.beatInBar === i ? 'dot on' : beat?.countIn && 4 - beat.countIn === i ? 'dot count' : 'dot'} />
            ))}
            {current.bars > 1 && (
              <span className="bar-count">
                bar {(beat?.countIn ? 0 : (beat?.barInChord ?? 0)) + 1}/{current.bars}
              </span>
            )}
          </div>

          <div className="card paper next-chord" onClick={skip}>
            <div className="next-label">
              Next
              <strong>{names ? chordName(next.chord) : ''}</strong>
            </div>
            <div className="next-staff">
              <ChordStaff voicing={next.voicing} scale={0.62} height={122} />
            </div>
          </div>
        </>
      )}

      <div className="groove-row" role="radiogroup" aria-label="Backing track">
        {GROOVES.map((g) => (
          <Chip key={g.id} label={g.label} on={settings.groove === g.id} onClick={() => set('groove', g.id as GrooveId)} />
        ))}
      </div>

      <BpmControl bpm={settings.bpm} onChange={changeBpm} />

      <button className={playing ? 'play-btn stop' : 'play-btn'} onClick={playing ? stop : start} disabled={!playing && !!problem}>
        {playing ? 'Stop' : 'Start'}
      </button>
      {!playing && !problem && <p className="hint">Tap the chord to skip to the next one.</p>}

      <ChordSettingsSheet open={settingsOpen} onClose={closeSettings} settings={settings} update={update} changeBpm={changeBpm} />
    </div>
  )
}

/** Tempo field that lets you type freely and only applies (and clamps) the value when you finish. */
function BpmInput({ bpm, onCommit }: { bpm: number; onCommit: (n: number) => void }) {
  const [draft, setDraft] = useState(String(bpm))
  useEffect(() => setDraft(String(bpm)), [bpm])
  const commit = () => {
    const n = Number(draft)
    if (draft.trim() && Number.isFinite(n)) onCommit(n)
    else setDraft(String(bpm))
  }
  return (
    <input
      className="num"
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      value={draft}
      onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, ''))}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
      aria-label="Tempo in BPM"
    />
  )
}

function ChordSettingsSheet({
  open,
  onClose,
  settings,
  update,
  changeBpm,
}: {
  open: boolean
  onClose: () => void
  settings: ChordSettings
  update: Props['update']
  changeBpm: (n: number) => void
}) {
  const set = <K extends keyof ChordSettings>(k: K, v: ChordSettings[K]) => update((s) => ({ ...s, [k]: v }))
  const toggleQuality = (id: string) => update((s) => ({ ...s, qualities: { ...s.qualities, [id]: s.qualities[id] === false } }))

  return (
    <Sheet title="Chord practice" open={open} onClose={onClose}>
      <Section title="Drill">
        <Segmented
          options={[
            { value: 'random', label: 'Random chords' },
            { value: 'iivi', label: 'ii–V–I' },
          ]}
          value={settings.mode}
          onChange={(v) => set('mode', v)}
        />
        {settings.mode === 'iivi' && (
          <>
            <Toggle label="Major ii–V–I" checked={settings.iiviMajor} onChange={(v) => set('iiviMajor', v)} />
            <Toggle label="Minor ii–V–i" checked={settings.iiviMinor} onChange={(v) => set('iiviMinor', v)} />
            <p className="note">ii–V–Is use the chord families and types you have turned on below, in a random key each time.</p>
          </>
        )}
      </Section>

      {FAMILIES.map((f) => {
        const groups = [...new Set(QUALITIES.filter((q) => q.family === f).map((q) => q.group))]
        return (
          <Section
            key={f}
            title={FAMILY_LABELS[f]}
            right={<input type="checkbox" className="switch" checked={settings.families[f]} onChange={(e) => set('families', { ...settings.families, [f]: e.target.checked })} aria-label={`Use ${FAMILY_LABELS[f]}`} />}
          >
            {groups.map((g) => (
              <div key={g} className="chip-group">
                {groups.length > 1 && <div className="chip-group-title">{g}</div>}
                <div className="chips">
                  {QUALITIES.filter((q) => q.family === f && q.group === g).map((q) => (
                    <Chip key={q.id} label={q.label} on={settings.qualities[q.id] !== false} disabled={!settings.families[f]} onClick={() => toggleQuality(q.id)} />
                  ))}
                </div>
              </div>
            ))}
          </Section>
        )
      })}

      <Section title="Display">
        <Toggle label="Chord names" checked={settings.showNames} onChange={(v) => set('showNames', v)} />
        <div className="row">
          <span className="row-label">Bars per chord</span>
          <Segmented
            small
            options={[
              { value: 1, label: '1' },
              { value: 2, label: '2' },
              { value: 4, label: '4' },
            ]}
            value={settings.barsPerChord}
            onChange={(v) => set('barsPerChord', v)}
          />
        </div>
      </Section>

      <Section title="Sound">
        <div className="row">
          <span className="row-label">Tempo (saved for next time)</span>
          <BpmInput bpm={settings.bpm} onCommit={changeBpm} />
        </div>
        <div className="chips">
          {GROOVES.map((g) => (
            <Chip key={g.id} label={g.label} on={settings.groove === g.id} onClick={() => set('groove', g.id)} />
          ))}
        </div>
        <Toggle label="Play the chords too" hint="Piano plays each chord with the backing" checked={settings.playChords} onChange={(v) => set('playChords', v)} />
        <Toggle label="Count-in" checked={settings.countIn} onChange={(v) => set('countIn', v)} />
      </Section>
      <p className="credit">Piano: Salamander Grand Piano by Alexander Holm (CC BY 3.0).</p>
    </Sheet>
  )
}
