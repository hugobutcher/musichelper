import { useEffect, useRef, useState } from 'react'
import SongView from '../songs/SongView'
import { SONGS, SONG_BY_ID } from '../songs/songs'
import { type StoredSong, importSongZip, listStoredSongs } from '../songs/storage'

const OPEN_KEY = 'mh.songs.open'

export default function SongsScreen() {
  const [stored, setStored] = useState<Record<string, StoredSong>>({})
  const [openId, setOpenId] = useState<string | null>(() => {
    try {
      const id = localStorage.getItem(OPEN_KEY)
      return id && SONG_BY_ID[id] ? id : null
    } catch {
      return null
    }
  })
  const [busy, setBusy] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const refresh = () =>
    listStoredSongs()
      .then((list) => setStored(Object.fromEntries(list.map((s) => [s.songId, s]))))
      .finally(() => setLoaded(true))
      .catch((err) => setMessage({ kind: 'error', text: `Couldn’t read saved songs: ${String(err)}` }))

  useEffect(() => {
    void refresh()
  }, [])

  const open = (id: string | null) => {
    setOpenId(id)
    try {
      if (id) localStorage.setItem(OPEN_KEY, id)
      else localStorage.removeItem(OPEN_KEY)
    } catch {
      /* ignore */
    }
  }

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return
    setBusy(true)
    setMessage(null)
    const done: string[] = []
    const errors: string[] = []
    for (const f of Array.from(files)) {
      try {
        const s = await importSongZip(f)
        done.push(SONG_BY_ID[s.songId].title)
      } catch (err) {
        errors.push(err instanceof Error ? err.message : String(err))
      }
    }
    await refresh()
    setBusy(false)
    if (fileInput.current) fileInput.current.value = ''
    if (errors.length) setMessage({ kind: 'error', text: errors.join(' ') })
    else setMessage({ kind: 'ok', text: `Added ${done.join(', ')}.` })
  }

  if (openId && !loaded) return <p className="hint">Loading…</p>
  if (openId) {
    return <SongView song={SONG_BY_ID[openId]} stored={stored[openId] ?? null} onBack={() => open(null)} onChanged={refresh} />
  }

  const count = Object.keys(stored).length

  return (
    <section>
      <header className="screen-head">
        <h1>Songs</h1>
      </header>
      <ul className="song-list">
        {SONGS.map((s) => (
          <li key={s.id}>
            <button className="song-row" disabled={busy} onClick={() => open(s.id)}>
              <div>
                <div className="song-title">{s.title}</div>
                <div className="song-artist">{s.artist}</div>
              </div>
              <span className={stored[s.id] ? 'badge ok' : 'badge'}>{stored[s.id] ? 'Audio ready' : 'Chart only'}</span>
            </button>
          </li>
        ))}
      </ul>

      <div className="card import-card">
        <h3>{count ? 'Add or update song audio' : 'Add your recordings'}</h3>
        <p>
          Pick the <strong>.musichelper.zip</strong> files (one per song) made on your computer. Put them in iCloud Drive, OneDrive or Google Drive
          (or email them to yourself), then choose them here. You can select several at once. Audio is stored only on this phone.
        </p>
        <input ref={fileInput} type="file" accept=".zip,application/zip" multiple hidden onChange={(e) => void onFiles(e.target.files)} />
        <button className="play-btn" disabled={busy} onClick={() => fileInput.current?.click()}>
          {busy ? 'Importing…' : 'Choose song files'}
        </button>
        {message && <p className={message.kind === 'ok' ? 'msg ok' : 'msg error'}>{message.text}</p>}
      </div>
    </section>
  )
}
