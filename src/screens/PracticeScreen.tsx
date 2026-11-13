import { useState } from 'react'
import { stopAll } from '../audio/session'
import ChordPractice from '../practice/ChordPractice'
import MelodyPractice from '../practice/MelodyPractice'
import NotePractice from '../practice/NotePractice'
import { type PracticeView, usePracticeSettings } from '../practice/settings'
import { GearIcon, Segmented } from '../ui/controls'

const VIEWS: { value: PracticeView; label: string }[] = [
  { value: 'chords', label: 'Chords' },
  { value: 'notes', label: 'Note reading' },
  { value: 'melody', label: 'Melody' },
]

export default function PracticeScreen() {
  const [settings, update] = usePracticeSettings()
  const [settingsOpen, setSettingsOpen] = useState(false)

  const setView = (view: PracticeView) => {
    stopAll()
    update((s) => ({ ...s, view }))
  }

  return (
    <div className="practice">
      <header className="screen-head">
        <h1>Practice</h1>
        <button className="icon-btn" onClick={() => setSettingsOpen(true)} aria-label="Practice settings">
          <GearIcon />
        </button>
      </header>
      <Segmented options={VIEWS} value={settings.view} onChange={setView} />
      {settings.view === 'chords' && (
        <ChordPractice
          settings={settings.chords}
          update={(fn) => update((s) => ({ ...s, chords: fn(s.chords) }))}
          settingsOpen={settingsOpen}
          closeSettings={() => setSettingsOpen(false)}
        />
      )}
      {settings.view === 'notes' && (
        <NotePractice
          settings={settings.notes}
          update={(fn) => update((s) => ({ ...s, notes: fn(s.notes) }))}
          settingsOpen={settingsOpen}
          closeSettings={() => setSettingsOpen(false)}
        />
      )}
      {settings.view === 'melody' && (
        <MelodyPractice
          settings={settings.melody}
          update={(fn) => update((s) => ({ ...s, melody: fn(s.melody) }))}
          settingsOpen={settingsOpen}
          closeSettings={() => setSettingsOpen(false)}
        />
      )}
    </div>
  )
}
