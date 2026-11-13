import { useEffect, useMemo, useState } from 'react'
import { playMelody, stopAll } from '../audio/session'
import { MelodyStaff } from '../notation/Notation'
import { MAJOR_KEYS, MINOR_KEYS, keyName } from '../theory/keys'
import { type Melody, generateMelody, melodyNotes } from '../theory/sightreading'
import { BpmControl, Section, Segmented, Sheet, Toggle } from '../ui/controls'
import { type MelodySettings, clampBpm } from './settings'

interface Props {
  settings: MelodySettings
  update: (fn: (s: MelodySettings) => MelodySettings) => void
  settingsOpen: boolean
  closeSettings: () => void
}

type Status = 'idle' | 'trying' | 'listening'

export default function MelodyPractice({ settings, update, settingsOpen, closeSettings }: Props) {
  const genKey = [settings.clef, settings.modes, settings.key, settings.bars, settings.difficulty].join('|')
  const [melody, setMelody] = useState<Melody>(() => generateMelody(settings))
  const [status, setStatus] = useState<Status>('idle')
  const [active, setActive] = useState(-1)
  const [countIn, setCountIn] = useState(0)
  const [showKey, setShowKey] = useState(true)
  const notes = useMemo(() => melodyNotes(melody), [melody])
  const set = <K extends keyof MelodySettings>(k: K, v: MelodySettings[K]) => update((s) => ({ ...s, [k]: v }))

  const stop = () => {
    stopAll()
    setStatus('idle')
    setActive(-1)
    setCountIn(0)
  }

  const newMelody = () => {
    stop()
    setMelody(generateMelody(settings))
  }

  useEffect(() => {
    newMelody()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [genKey])

  useEffect(() => () => stopAll(), [])

  const run = (withNotes: boolean) => {
    stop()
    setStatus(withNotes ? 'listening' : 'trying')
    void playMelody({
      notes,
      bpm: settings.bpm,
      withNotes,
      countIn: settings.countIn,
      onNote: (i) => {
        setCountIn(0)
        setActive(i)
      },
      onCountIn: setCountIn,
      onDone: () => {
        setStatus('idle')
        setActive(-1)
      },
    })
  }

  const keyOptions = settings.modes === 'minor' ? MINOR_KEYS : MAJOR_KEYS

  return (
    <div className="melody-practice">
      <div className="quick-row">
        <span className="key-label">{showKey ? keyName(melody.key) : 'Key hidden'}</span>
        <button className={showKey ? 'pill on' : 'pill'} onClick={() => setShowKey(!showKey)} aria-pressed={showKey}>
          Key {showKey ? 'shown' : 'hidden'}
        </button>
      </div>

      <div className="card paper melody-card">
        <MelodyStaff melody={melody} active={active} scale={1.05} />
        {countIn > 0 && <div className="count-in">{countIn}</div>}
      </div>

      <ol className="steps">
        <li>
          <strong>Play it yourself first.</strong> <em>Try it</em> counts you in and gives you a click while the cursor moves along.
        </li>
        <li>
          <strong>Then tap Hear it</strong> to hear how it should sound and compare.
        </li>
      </ol>

      <div className="button-row three">
        {status === 'trying' ? (
          <button className="play-btn stop" onClick={stop}>
            Stop
          </button>
        ) : (
          <button className="play-btn secondary" onClick={() => run(false)}>
            Try it
          </button>
        )}
        {status === 'listening' ? (
          <button className="play-btn stop" onClick={stop}>
            Stop
          </button>
        ) : (
          <button className="play-btn" onClick={() => run(true)}>
            Hear it
          </button>
        )}
        <button className="play-btn secondary" onClick={newMelody}>
          New
        </button>
      </div>

      <BpmControl bpm={settings.bpm} onChange={(n) => set('bpm', clampBpm(n))} />

      <Sheet title="Melody reading" open={settingsOpen} onClose={closeSettings}>
        <Section title="Staff">
          <Segmented
            options={[
              { value: 'treble', label: 'Treble' },
              { value: 'bass', label: 'Bass' },
              { value: 'random', label: 'Either' },
            ]}
            value={settings.clef}
            onChange={(v) => set('clef', v)}
          />
        </Section>
        <Section title="Key">
          <Segmented
            options={[
              { value: 'major', label: 'Major' },
              { value: 'minor', label: 'Minor' },
              { value: 'both', label: 'Both' },
            ]}
            value={settings.modes}
            onChange={(v) => update((s) => ({ ...s, modes: v, key: 'random' }))}
          />
          {settings.modes !== 'both' && (
            <div className="chips">
              {['random', ...keyOptions].map((k) => (
                <button key={k} className={settings.key === k ? 'chip on' : 'chip'} onClick={() => set('key', k)}>
                  {k === 'random' ? 'Random' : k.replace('b', '♭').replace('#', '♯') + (settings.modes === 'minor' ? 'm' : '')}
                </button>
              ))}
            </div>
          )}
        </Section>
        <Section title="Length and difficulty">
          <div className="row">
            <span className="row-label">Bars</span>
            <Segmented
              small
              options={[
                { value: 2, label: '2' },
                { value: 4, label: '4' },
                { value: 8, label: '8' },
              ]}
              value={settings.bars}
              onChange={(v) => set('bars', v)}
            />
          </div>
          <Segmented
            options={[
              { value: 'easy', label: 'Easy' },
              { value: 'medium', label: 'Medium' },
              { value: 'hard', label: 'Hard' },
            ]}
            value={settings.difficulty}
            onChange={(v) => set('difficulty', v)}
          />
          <p className="note">Easy: whole, half and quarter notes, mostly steps. Medium adds eighths, dotted rhythms and bigger leaps. Hard adds syncopation and wider leaps.</p>
        </Section>
        <Section title="Playback">
          <Toggle label="Count-in" checked={settings.countIn} onChange={(v) => set('countIn', v)} />
        </Section>
      </Sheet>
    </div>
  )
}
