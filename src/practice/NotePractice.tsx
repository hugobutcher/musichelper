import { useEffect, useRef, useState } from 'react'
import { audioRunning } from '../audio/instruments'
import { playNote, stopAll } from '../audio/session'
import { NoteStaff } from '../notation/Notation'
import { midiOf, pitchClass, pitchName } from '../theory/notes'
import { type DrillNote, randomDrillNote } from '../theory/sightreading'
import { Section, Segmented, Sheet, Toggle } from '../ui/controls'
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

interface Feedback {
  pressed: number
  correct: boolean
}

const RIGHT_DELAY = 650
const WRONG_DELAY = 1600

export default function NotePractice({ settings, update, settingsOpen, closeSettings }: Props) {
  const [note, setNote] = useState<DrillNote>(() => randomDrillNote(settings, null))
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [score, setScore] = useState({ right: 0, total: 0, streak: 0 })
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const set = <K extends keyof NoteSettings>(k: K, v: NoteSettings[K]) => update((s) => ({ ...s, [k]: v }))

  const nextNote = () => {
    setNote((prev) => randomDrillNote(settings, prev))
    setFeedback(null)
  }

  // New note whenever the reading options change.
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    nextNote()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.clef, settings.ledgerLines, settings.accidentals])

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
      stopAll()
    },
    [],
  )

  const target = pitchClass(note.note)

  const press = (pc: number) => {
    if (feedback) return
    const correct = pc === target
    setFeedback({ pressed: pc, correct })
    setScore((s) => ({ right: s.right + (correct ? 1 : 0), total: s.total + 1, streak: correct ? s.streak + 1 : 0 }))
    // Only play if audio is already unlocked; a note queued before the unlock would sound late.
    if (settings.sound && audioRunning()) {
      // Play what you pressed, in the written note's octave so you hear the difference.
      const midi = midiOf(note.note) - target + pc
      void playNote(midi)
    }
    timer.current = setTimeout(nextNote, correct ? RIGHT_DELAY : WRONG_DELAY)
  }

  const answer = `${pitchName(note.note)}${note.note.octave}`

  return (
    <div className="note-practice">
      <div className="quick-row">
        <Segmented small options={CLEFS} value={settings.clef} onChange={(v) => set('clef', v)} />
        <button className={settings.showNames ? 'pill on' : 'pill'} onClick={() => set('showNames', !settings.showNames)} aria-pressed={settings.showNames}>
          Key labels {settings.showNames ? 'on' : 'off'}
        </button>
      </div>

      <div className={`card paper note-card${feedback ? (feedback.correct ? ' right' : ' wrong') : ''}`}>
        <NoteStaff note={note.note} clef={note.clef} layout={settings.clef} scale={settings.clef === 'both' ? 1.05 : 1.25} />
      </div>

      <div className="note-feedback" aria-live="polite">
        {feedback ? (
          feedback.correct ? (
            <span className="ok">✓ {answer}</span>
          ) : (
            <span className="bad">✗ It was {answer}</span>
          )
        ) : (
          <span className="score">
            {score.total ? `${score.right}/${score.total} right` : 'Tap the key for this note'}
            {score.streak >= 3 ? ` · ${score.streak} in a row` : ''}
          </span>
        )}
      </div>

      <Piano onPress={press} labels={settings.showNames} feedback={feedback} target={target} />

      <Sheet title="Note reading" open={settingsOpen} onClose={closeSettings}>
        <Section title="Staff">
          <Segmented options={CLEFS} value={settings.clef} onChange={(v) => set('clef', v)} />
          <Toggle label="Ledger lines" hint="Notes above and below the staff" checked={settings.ledgerLines} onChange={(v) => set('ledgerLines', v)} />
          <Toggle label="Sharps and flats" checked={settings.accidentals} onChange={(v) => set('accidentals', v)} />
        </Section>
        <Section title="Piano">
          <Toggle label="Label the keys" hint="Letter names on the piano" checked={settings.showNames} onChange={(v) => set('showNames', v)} />
          <Toggle label="Play the key you press" checked={settings.sound} onChange={(v) => set('sound', v)} />
        </Section>
      </Sheet>
    </div>
  )
}

const WHITE = [
  { pc: 0, name: 'C' },
  { pc: 2, name: 'D' },
  { pc: 4, name: 'E' },
  { pc: 5, name: 'F' },
  { pc: 7, name: 'G' },
  { pc: 9, name: 'A' },
  { pc: 11, name: 'B' },
]
/** Black keys: pitch class, label, and which white-key boundary they sit on (1 = between C and D). */
const BLACK = [
  { pc: 1, name: 'C♯\nD♭', at: 1 },
  { pc: 3, name: 'D♯\nE♭', at: 2 },
  { pc: 6, name: 'F♯\nG♭', at: 4 },
  { pc: 8, name: 'G♯\nA♭', at: 5 },
  { pc: 10, name: 'A♯\nB♭', at: 6 },
]

function Piano({ onPress, labels, feedback, target }: { onPress: (pc: number) => void; labels: boolean; feedback: Feedback | null; target: number }) {
  const state = (pc: number) => {
    if (!feedback) return ''
    if (pc === feedback.pressed) return feedback.correct ? ' right' : ' wrong'
    if (!feedback.correct && pc === target) return ' right'
    return ''
  }
  // pointerdown answers the instant a finger lands, without waiting for the tap to finish.
  const handler = (pc: number) => (e: React.PointerEvent) => {
    e.preventDefault()
    onPress(pc)
  }
  return (
    <div className="piano" role="group" aria-label="One-octave piano">
      {WHITE.map((k) => (
        <button key={k.pc} className={`white-key${state(k.pc)}`} onPointerDown={handler(k.pc)} aria-label={k.name}>
          {labels && <span className="key-label">{k.name}</span>}
        </button>
      ))}
      {BLACK.map((k) => (
        <button
          key={k.pc}
          className={`black-key${state(k.pc)}`}
          style={{ left: `calc(${(k.at * 100) / 7}% - var(--black-w) / 2)` }}
          onPointerDown={handler(k.pc)}
          aria-label={k.name.replace('\n', ' / ')}
        >
          {labels && <span className="key-label">{k.name}</span>}
        </button>
      ))}
    </div>
  )
}
