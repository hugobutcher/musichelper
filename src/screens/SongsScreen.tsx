import { useEffect, useRef, useState } from 'react'
import SongView from '../songs/SongView'
import {
  DriveAuthError,
  downloadDriveFile,
  driveConfigured,
  driveToken,
  listSongFiles,
  startDriveSignIn,
  takeDriveError,
  takePendingDriveImport,
} from '../songs/drive'
import { SONGS, SONG_BY_ID } from '../songs/songs'
import { type StoredSong, importSongZip, listStoredSongs } from '../songs/storage'

const OPEN_KEY = 'mh.songs.open'

type Message = { kind: 'ok' | 'error'; text: string }

const mb = (bytes: number) => (bytes / 1048576).toFixed(0)

/** "joy-spring.musichelper.zip" → "Joy Spring" (falls back to the file name). */
function titleFor(fileName: string) {
  const id = fileName.replace(/\.musichelper\.zip$/i, '')
  return SONG_BY_ID[id]?.title ?? fileName
}

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
  const [progress, setProgress] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [message, setMessage] = useState<Message | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const refresh = () =>
    listStoredSongs()
      .then((list) => {
        const map = Object.fromEntries(list.map((s) => [s.songId, s]))
        setStored(map)
        return map
      })
      .catch((err) => {
        setMessage({ kind: 'error', text: `Couldn’t read saved songs: ${String(err)}` })
        return {} as Record<string, StoredSong>
      })
      .finally(() => setLoaded(true))

  // On open: load what's stored, and finish a Google Drive import if we just came back from sign-in.
  useEffect(() => {
    const err = takeDriveError()
    if (err) setMessage({ kind: 'error', text: err })
    const pending = takePendingDriveImport()
    void refresh().then((map) => {
      if (pending && driveToken()) void importFromDrive(map)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const importFromDrive = async (current: Record<string, StoredSong> = stored) => {
    const token = driveToken()
    if (!token) {
      startDriveSignIn()
      return
    }
    setBusy(true)
    setMessage(null)
    setProgress('Looking in your Google Drive…')
    const added: string[] = []
    const skipped: string[] = []
    const errors: string[] = []
    try {
      const files = await listSongFiles(token)
      if (!files.length) {
        setMessage({ kind: 'error', text: 'No .musichelper.zip files found in your Google Drive. Upload the “Music Helper import” folder to Drive, then try again.' })
        return
      }
      for (const [i, f] of files.entries()) {
        const id = f.name.replace(/\.musichelper\.zip$/i, '')
        const have = current[id]?.drive
        if (have && have.id === f.id && have.modifiedTime === f.modifiedTime) {
          skipped.push(titleFor(f.name))
          continue
        }
        const label = `${titleFor(f.name)} (${i + 1} of ${files.length})`
        setProgress(`Downloading ${label}…`)
        try {
          const blob = await downloadDriveFile(token, f, (got) => setProgress(`Downloading ${label} · ${mb(got)} of ${mb(f.size)} MB`))
          setProgress(`Saving ${label}…`)
          const s = await importSongZip(blob, f.name, { id: f.id, modifiedTime: f.modifiedTime })
          added.push(SONG_BY_ID[s.songId].title)
        } catch (err) {
          if (err instanceof DriveAuthError) throw err
          errors.push(`${f.name}: ${err instanceof Error ? err.message : String(err)}`)
        }
      }
      const parts = []
      if (added.length) parts.push(`Added ${added.join(', ')}.`)
      if (skipped.length) parts.push(`Already up to date: ${skipped.join(', ')}.`)
      if (errors.length) parts.push(errors.join(' '))
      setMessage({ kind: errors.length ? 'error' : 'ok', text: parts.join(' ') })
    } catch (err) {
      if (err instanceof DriveAuthError) {
        setMessage({ kind: 'error', text: `${err.message}` })
      } else {
        setMessage({ kind: 'error', text: `Google Drive import failed: ${err instanceof Error ? err.message : String(err)}` })
      }
    } finally {
      setProgress(null)
      setBusy(false)
      await refresh()
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
        setProgress(`Saving ${f.name}…`)
        const s = await importSongZip(f, f.name)
        done.push(SONG_BY_ID[s.songId].title)
      } catch (err) {
        errors.push(err instanceof Error ? err.message : String(err))
      }
    }
    await refresh()
    setProgress(null)
    setBusy(false)
    if (fileInput.current) fileInput.current.value = ''
    const parts = []
    if (done.length) parts.push(`Added ${done.join(', ')}.`)
    if (errors.length) parts.push(errors.join(' '))
    setMessage({ kind: errors.length ? 'error' : 'ok', text: parts.join(' ') })
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
        {driveConfigured() ? (
          <>
            <p>
              Upload the <strong>Music Helper import</strong> folder (the <strong>.musichelper.zip</strong> files) to your Google Drive, then tap below.
              The app finds them anywhere in your Drive and imports new or changed songs. Audio is kept only on this phone.
            </p>
            <button className="play-btn" disabled={busy} onClick={() => void importFromDrive()}>
              {busy ? 'Importing…' : 'Import from Google Drive'}
            </button>
          </>
        ) : (
          <p>Pick the .musichelper.zip files (one per song) made on your computer. Google Drive import isn’t set up yet.</p>
        )}
        {progress && <p className="progress">{progress}</p>}
        {message && <p className={message.kind === 'ok' ? 'msg ok' : 'msg error'}>{message.text}</p>}
        <input ref={fileInput} type="file" accept=".zip,application/zip" multiple hidden onChange={(e) => void onFiles(e.target.files)} />
        <button className={driveConfigured() ? 'text-btn files-btn' : 'play-btn'} disabled={busy} onClick={() => fileInput.current?.click()}>
          {driveConfigured() ? 'Or choose files on this phone' : 'Choose song files'}
        </button>
      </div>
    </section>
  )
}
