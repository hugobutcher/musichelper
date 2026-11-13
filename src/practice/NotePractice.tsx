import { useEffect, useState } from 'react'
import { playNote, stopAll } from '../audio/session'
import { NoteStaff } from '../notation/Notation'
import { midiOf, pitchName } from '../theory/notes'
import { type DrillNote, randomDrillNote } from '../theory/sightreading'
import { Section, Segmented, Sheet, SpeakerIcon, Toggle } from '../ui/controls'
import type { NoteSettings } from './settings'

interface Props {
  settings: NoteSettings
  update: (fn: (s: NoteSettings) => NoteSettings) => void
  settingsOpen: boolean
  closeSettings: () => void
}

const CLEFS = [
  { value: 'treble' as const, label: 'Treble' },
  { value: 'bass' as const, label: 'Bass' },
  { value: 'both' as const, label: 'Both' },
]

export default function NotePractice({ settings, update, settingsOpen, closeSettings }: Props) {
  const [note, setNote] = useState<DrillNote>(() => randomDrillNote(settings, null))
  const [revealed, setRevealed] = useState(false)
  const [count, setCount] = useState(0)
  const set = <K extends keyof NoteSettings>(k: K, v: NoteSettings[K]) => update((s) => ({ ...s, [k]: v }))

  // New note whenever the reading options change.
  useEffect(() => {
    setNote((prev) => randomDrillNote(settings, prev))
    setRevealed(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.clef, settings.ledgerLines, settings.accidentals])

  useEffect(() => () => stopAll(), [])

  const reveal = () => {
    setRevealed(true)
    if (settings.sound) void playNote(midiOf(note.note))
  }

  const next = () => {
    setNote((prev) => randomDrillNote(settings, prev))
    setRevealed(false)
    setCount((c) => c + 1)
  }

  const showName = settings.showNames || revealed

  return (
    <div className="note-practice">
      <div className="quick-row">
        <Segmented small options={CLEFS} value={settings.clef} onChange={(v) => set('clef', v)} />
        <button className={settings.showNames ? 'pill on' : 'pill'} onClick={() => set('showNames', !settings.showNames)} aria-pressed={settings.showNames}>
          Names {settings.showNames ? 'on' : 'off'}
        </button>
      </div>

      <div className="card paper note-card" onClick={revealed || settings.showNames ? next : reveal} role="button" aria-label="Note to read">
        <div className="chord-head">
          <div className="chord-name">{showName ? `${pitchName(note.note)}${note.note.octave}` : '?'}</div>
          <button
            className="icon-btn dark"
            onClick={(e) => {
              e.stopPropagation()
              void playNote(midiOf(note.note))
            }}
            aria-label="Hear this note"
          >
            <SpeakerIcon />
          </button>
        </div>
        <NoteStaff note={note.note} clef={note.clef} layout={settings.clef} scale={1.5} />
      </div>

      <div className="button-row">
        {!revealed && !settings.showNames ? (
          <button className="play-btn" onClick={reveal}>
            Reveal
          </button>
        ) : (
          <button className="play-btn" onClick={next}>
            Next note
          </button>
        )}
      </div>
      <p className="hint">
        Name it or play it, then {settings.showNames ? 'tap for the next note' : 'reveal to check'}. {count > 0 && <span>{count} read this session.</span>}
      </p>

      <Sheet title="Note reading" open={settingsOpen} onClose={closeSettings}>
        <Section title="Staff">
          <Segmented options={CLEFS} value={settings.clef} onChange={(v) => set('clef', v)} />
          <Toggle label="Ledger lines" hint="Notes above and below the staff" checked={settings.ledgerLines} onChange={(v) => set('ledgerLines', v)} />
          <Toggle label="Sharps and flats" checked={settings.accidentals} onChange={(v) => set('accidentals', v)} />
        </Section>
        <Section title="Feedback">
          <Toggle label="Always show note names" checked={settings.showNames} onChange={(v) => set('showNames', v)} />
          <Toggle label="Play the note when revealed" checked={settings.sound} onChange={(v) => set('sound', v)} />
        </Section>
      </Sheet>
    </div>
  )
}
