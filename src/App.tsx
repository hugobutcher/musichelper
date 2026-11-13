import { useState } from 'react'
import PracticeScreen from './screens/PracticeScreen'
import SongsScreen from './screens/SongsScreen'

type Tab = 'practice' | 'songs'

const TAB_KEY = 'mh.tab'

function loadTab(): Tab {
  try {
    const t = localStorage.getItem(TAB_KEY)
    return t === 'songs' ? 'songs' : 'practice'
  } catch {
    return 'practice'
  }
}

export default function App() {
  const [tab, setTab] = useState<Tab>(loadTab)

  const select = (t: Tab) => {
    setTab(t)
    try {
      localStorage.setItem(TAB_KEY, t)
    } catch {
      /* storage unavailable: fine */
    }
  }

  return (
    <div className="app">
      <main className="screen">{tab === 'practice' ? <PracticeScreen /> : <SongsScreen />}</main>
      <nav className="tabbar" aria-label="Sections">
        <button className={tab === 'practice' ? 'tab active' : 'tab'} onClick={() => select('practice')}>
          <KeysIcon />
          <span>Practice</span>
        </button>
        <button className={tab === 'songs' ? 'tab active' : 'tab'} onClick={() => select('songs')}>
          <NoteIcon />
          <span>Songs</span>
        </button>
      </nav>
    </div>
  )
}

function KeysIcon() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
      <rect x="2.5" y="4" width="19" height="16" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M7.25 4v16M12 4v16M16.75 4v16" stroke="currentColor" strokeWidth="1.4" />
      <path d="M5.6 4h3.3v9H5.6zM10.35 4h3.3v9h-3.3zM15.1 4h3.3v9h-3.3z" fill="currentColor" />
    </svg>
  )
}

function NoteIcon() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
      <path d="M9 18V5.5l11-2.5v12.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <ellipse cx="6.5" cy="18" rx="3" ry="2.4" fill="currentColor" />
      <ellipse cx="17.5" cy="15.5" rx="3" ry="2.4" fill="currentColor" />
    </svg>
  )
}
