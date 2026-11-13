import { GOOGLE_CLIENT_ID } from '../config'

/**
 * Google Drive import, entirely in the browser: OAuth sign-in by redirect (works in a Home Screen
 * web app, unlike pop-ups), then the Drive REST API with read-only access to find and download
 * the .musichelper.zip song files. Nothing is sent anywhere except Google.
 */

const SCOPE = 'https://www.googleapis.com/auth/drive.readonly'
const TOKEN_KEY = 'mh.drive.token'
const STATE_KEY = 'mh.drive.state'
const PENDING_KEY = 'mh.drive.pending'
const ERROR_KEY = 'mh.drive.error'

export interface DriveFile {
  id: string
  name: string
  size: number
  modifiedTime: string
}

export class DriveAuthError extends Error {}

export const driveConfigured = () => GOOGLE_CLIENT_ID.length > 0

function redirectUri() {
  return location.origin + import.meta.env.BASE_URL
}

/** Leave the app for Google's sign-in page; it comes back to the app with a token. */
export function startDriveSignIn() {
  const state = crypto.randomUUID()
  localStorage.setItem(STATE_KEY, state)
  localStorage.setItem(PENDING_KEY, '1')
  localStorage.removeItem(ERROR_KEY)
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri(),
    response_type: 'token',
    scope: SCOPE,
    include_granted_scopes: 'true',
    state,
  })
  location.assign(`https://accounts.google.com/o/oauth2/v2/auth?${params}`)
}

/**
 * Call once at startup, before rendering: picks up the token Google appends to the URL after
 * sign-in, stores it, and tidies the URL. Returns true if we just came back from Google.
 */
export function consumeDriveRedirect(): boolean {
  const hash = location.hash.startsWith('#') ? location.hash.slice(1) : ''
  if (!hash.includes('access_token=') && !hash.includes('error=')) return false
  const p = new URLSearchParams(hash)
  const expected = localStorage.getItem(STATE_KEY)
  localStorage.removeItem(STATE_KEY)
  history.replaceState(null, '', location.pathname + location.search)
  if (p.get('error')) {
    localStorage.removeItem(PENDING_KEY)
    localStorage.setItem(ERROR_KEY, p.get('error') === 'access_denied' ? 'Google sign-in was cancelled.' : `Google sign-in failed (${p.get('error')}).`)
  } else if (!expected || p.get('state') !== expected) {
    localStorage.removeItem(PENDING_KEY)
    localStorage.setItem(ERROR_KEY, 'Google sign-in didn’t match this app; please try again.')
  } else {
    const expiresIn = Number(p.get('expires_in') ?? '3600')
    localStorage.setItem(TOKEN_KEY, JSON.stringify({ token: p.get('access_token'), expires: Date.now() + expiresIn * 1000 }))
  }
  try {
    localStorage.setItem('mh.tab', 'songs')
    localStorage.removeItem('mh.songs.open')
  } catch {
    /* ignore */
  }
  return true
}

export function driveToken(): string | null {
  try {
    const raw = localStorage.getItem(TOKEN_KEY)
    if (!raw) return null
    const { token, expires } = JSON.parse(raw) as { token: string; expires: number }
    return token && expires - Date.now() > 60_000 ? token : null
  } catch {
    return null
  }
}

/** True once, right after returning from sign-in, so the screen can continue the import. */
export function takePendingDriveImport(): boolean {
  const pending = localStorage.getItem(PENDING_KEY) === '1'
  localStorage.removeItem(PENDING_KEY)
  return pending
}

export function takeDriveError(): string | null {
  const e = localStorage.getItem(ERROR_KEY)
  localStorage.removeItem(ERROR_KEY)
  return e
}

export function forgetDriveToken() {
  localStorage.removeItem(TOKEN_KEY)
}

const AUTH_REASONS = ['authError', 'insufficientPermissions', 'ACCESS_TOKEN_SCOPE_INSUFFICIENT', 'invalidCredentials']

async function api(token: string, url: string): Promise<Response> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (res.ok) return res
  // Only a real sign-in problem should forget the token; other 403s (Drive API not enabled,
  // rate limits, a file that can't be downloaded) are reported with Google's own message.
  let message = `Google Drive error ${res.status}`
  let reason = ''
  try {
    const body = (await res.json()) as { error?: { message?: string; errors?: { reason?: string }[]; status?: string } }
    message = body.error?.message ?? message
    reason = body.error?.errors?.[0]?.reason ?? body.error?.status ?? ''
  } catch {
    /* not JSON */
  }
  if (res.status === 401 || (res.status === 403 && AUTH_REASONS.includes(reason))) {
    forgetDriveToken()
    throw new DriveAuthError('Google Drive access expired or wasn’t granted. Sign in again.')
  }
  throw new Error(message)
}

/** All .musichelper.zip files in the user's Drive (any folder). */
export async function listSongFiles(token: string): Promise<DriveFile[]> {
  const out: DriveFile[] = []
  let pageToken = ''
  do {
    const params = new URLSearchParams({
      q: "trashed = false and (name contains 'musichelper' or mimeType = 'application/zip' or mimeType = 'application/x-zip-compressed')",
      fields: 'nextPageToken, files(id, name, size, modifiedTime)',
      pageSize: '200',
      spaces: 'drive',
      orderBy: 'modifiedTime desc',
      ...(pageToken ? { pageToken } : {}),
    })
    const res = await api(token, `https://www.googleapis.com/drive/v3/files?${params}`)
    const body = (await res.json()) as { nextPageToken?: string; files: { id: string; name: string; size?: string; modifiedTime: string }[] }
    for (const f of body.files) {
      const name = f.name.toLowerCase()
      // Newest first, so if the folder was uploaded twice only the latest copy of each song is used.
      if (name.endsWith('.musichelper.zip') && !out.some((o) => o.name.toLowerCase() === name)) {
        out.push({ id: f.id, name: f.name, size: Number(f.size ?? 0), modifiedTime: f.modifiedTime })
      }
    }
    pageToken = body.nextPageToken ?? ''
  } while (pageToken)
  return out
}

/** Download a file's bytes, reporting progress (bytes received). */
export async function downloadDriveFile(token: string, file: DriveFile, onProgress: (received: number) => void): Promise<Blob> {
  const res = await api(token, `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}?alt=media`)
  if (!res.body) return res.blob()
  const reader = res.body.getReader()
  const chunks: Uint8Array[] = []
  let received = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    received += value.length
    onProgress(received)
  }
  return new Blob(chunks as BlobPart[], { type: 'application/zip' })
}
