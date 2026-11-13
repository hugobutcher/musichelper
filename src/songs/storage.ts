import { unzipSync } from 'fflate'
import { SONG_BY_ID } from './songs'

/**
 * Song audio lives only on this device, in IndexedDB. It is imported from the
 * <song>.musichelper.zip files made by tools/separate.py.
 */

export type MixFile = 'full.mp3' | 'no-piano.mp3' | 'no-horns.mp3' | 'rhythm.mp3'

export interface StoredSong {
  songId: string
  duration: number
  files: MixFile[]
  importedAt: number
}

const DB_NAME = 'musichelper'
const DB_VERSION = 1

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains('songs')) db.createObjectStore('songs', { keyPath: 'songId' })
      if (!db.objectStoreNames.contains('audio')) db.createObjectStore('audio')
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function tx<T>(stores: string[], mode: IDBTransactionMode, fn: (t: IDBTransaction) => IDBRequest<T> | void): Promise<T | undefined> {
  return openDb().then(
    (db) =>
      new Promise<T | undefined>((resolve, reject) => {
        const t = db.transaction(stores, mode)
        const req = fn(t)
        t.oncomplete = () => {
          db.close()
          resolve(req ? req.result : undefined)
        }
        t.onerror = () => {
          db.close()
          reject(t.error)
        }
        t.onabort = () => {
          db.close()
          reject(t.error ?? new Error('Storage transaction aborted'))
        }
      }),
  )
}

export async function listStoredSongs(): Promise<StoredSong[]> {
  return (await tx<StoredSong[]>(['songs'], 'readonly', (t) => t.objectStore('songs').getAll())) ?? []
}

export async function getAudio(songId: string, file: MixFile): Promise<Blob | undefined> {
  return tx<Blob>(['audio'], 'readonly', (t) => t.objectStore('audio').get(`${songId}/${file}`))
}

export async function deleteSong(songId: string, files: MixFile[]) {
  await tx(['songs', 'audio'], 'readwrite', (t) => {
    t.objectStore('songs').delete(songId)
    for (const f of files) t.objectStore('audio').delete(`${songId}/${f}`)
  })
}

/** Ask the browser not to evict our data (best effort). */
export async function requestPersistence() {
  try {
    await navigator.storage?.persist?.()
  } catch {
    /* ignore */
  }
}

/** Import one .musichelper.zip; returns the song id. */
export async function importSongZip(file: File): Promise<StoredSong> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  let entries: Record<string, Uint8Array>
  try {
    entries = unzipSync(bytes)
  } catch {
    throw new Error(`${file.name} isn’t a Music Helper song file.`)
  }
  const metaBytes = entries['meta.json']
  if (!metaBytes) throw new Error(`${file.name} is missing meta.json.`)
  const meta = JSON.parse(new TextDecoder().decode(metaBytes)) as { format?: string; songId: string; duration: number; files: MixFile[] }
  if (meta.format !== 'musichelper-song' || !SONG_BY_ID[meta.songId]) throw new Error(`${file.name} is for a song this app doesn’t know.`)
  const files = meta.files.filter((f) => entries[f])
  if (!files.includes('full.mp3')) throw new Error(`${file.name} has no full recording.`)

  const stored: StoredSong = { songId: meta.songId, duration: meta.duration, files, importedAt: Date.now() }
  await tx(['songs', 'audio'], 'readwrite', (t) => {
    for (const f of files) t.objectStore('audio').put(new Blob([entries[f]], { type: 'audio/mpeg' }), `${meta.songId}/${f}`)
    t.objectStore('songs').put(stored)
  })
  void requestPersistence()
  return stored
}

// ---------------------------------------------------------------------------
// Per-song preferences and section marks (small, so localStorage).

export interface SongPrefs {
  /** User-marked section start times (seconds); null = use the default. */
  starts: (number | null)[]
  showNames: boolean
  speed: number
}

const prefsKey = (id: string) => `mh.song.${id}.v1`

export function loadSongPrefs(id: string): SongPrefs {
  const n = SONG_BY_ID[id].sections.length
  const fallback: SongPrefs = { starts: Array(n).fill(null), showNames: true, speed: 1 }
  try {
    const raw = localStorage.getItem(prefsKey(id))
    if (!raw) return fallback
    const p = JSON.parse(raw) as Partial<SongPrefs>
    const starts = Array.isArray(p.starts) && p.starts.length === n ? p.starts.map((x) => (typeof x === 'number' ? x : null)) : fallback.starts
    return {
      starts,
      showNames: typeof p.showNames === 'boolean' ? p.showNames : true,
      speed: typeof p.speed === 'number' && p.speed >= 0.5 && p.speed <= 1 ? p.speed : 1,
    }
  } catch {
    return fallback
  }
}

export function saveSongPrefs(id: string, prefs: SongPrefs) {
  try {
    localStorage.setItem(prefsKey(id), JSON.stringify(prefs))
  } catch {
    /* storage unavailable */
  }
}
