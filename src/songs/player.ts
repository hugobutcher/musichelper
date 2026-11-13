import { keepAwake, stopAll as stopPracticeAudio } from '../audio/session'
import { type MixFile, getAudio } from './storage'

/**
 * Plays one song's audio from on-device storage. Each "mix" (full, no piano, no horns, rhythm only)
 * is its own <audio> element; switching mixes jumps the new one to the same moment.
 * Only one element plays at a time, so memory stays small even for 10-minute tracks.
 */

export interface PlayerState {
  ready: boolean
  playing: boolean
  time: number
  duration: number
  mix: MixFile
}

type Listener = (s: PlayerState) => void

export function mixFor(piano: boolean, horns: boolean): MixFile {
  if (piano && horns) return 'full.mp3'
  if (!piano && horns) return 'no-piano.mp3'
  if (piano && !horns) return 'no-horns.mp3'
  return 'rhythm.mp3'
}

export class SongPlayer {
  private els = new Map<MixFile, HTMLAudioElement>()
  private urls: string[] = []
  private active: MixFile = 'full.mp3'
  private listeners = new Set<Listener>()
  private raf = 0
  private speed = 1
  loop: [number, number] | null = null
  private disposed = false
  readonly available: MixFile[]
  duration: number

  private constructor(available: MixFile[], duration: number) {
    this.available = available
    this.duration = duration
  }

  static async load(songId: string, files: MixFile[], duration: number): Promise<SongPlayer> {
    const p = new SongPlayer(files, duration)
    for (const f of files) {
      const blob = await getAudio(songId, f)
      if (!blob) continue
      const url = URL.createObjectURL(blob)
      p.urls.push(url)
      const el = new Audio()
      el.preload = f === 'full.mp3' ? 'auto' : 'metadata'
      el.src = url
      ;(el as HTMLAudioElement & { preservesPitch?: boolean }).preservesPitch = true
      ;(el as HTMLAudioElement & { webkitPreservesPitch?: boolean }).webkitPreservesPitch = true
      el.addEventListener('loadedmetadata', () => {
        if (Number.isFinite(el.duration) && el.duration > 0 && f === 'full.mp3') p.duration = el.duration
        p.emit()
      })
      // These also fire for play/pause from AirPods, the lock screen or Control Center.
      el.addEventListener('play', () => p.onPlayState(el))
      el.addEventListener('pause', () => p.onPlayState(el))
      el.addEventListener('seeked', () => p.emit())
      el.addEventListener('timeupdate', () => p.checkLoop(el))
      el.addEventListener('ended', () => {
        if (p.loop && el === p.el) {
          el.currentTime = p.loop[0]
          void el.play().catch(() => undefined)
        } else p.onPlayState(el)
      })
      p.els.set(f, el)
    }
    return p
  }

  get el(): HTMLAudioElement {
    return this.els.get(this.active) ?? this.els.get('full.mp3')!
  }

  state(): PlayerState {
    const el = this.el
    return { ready: !!el, playing: !!el && !el.paused && !el.ended, time: el?.currentTime ?? 0, duration: this.duration, mix: this.active }
  }

  subscribe(fn: Listener) {
    this.listeners.add(fn)
    fn(this.state())
    return () => this.listeners.delete(fn)
  }

  private emit() {
    if (this.disposed) return
    const s = this.state()
    this.listeners.forEach((l) => l(s))
  }

  /** Jump back to the loop start; the end is kept just short of the track end so it never "ends". */
  checkLoop(el: HTMLAudioElement) {
    if (!this.loop || el !== this.el) return
    const end = Number.isFinite(el.duration) ? Math.min(this.loop[1], el.duration - 0.15) : this.loop[1]
    if (el.currentTime >= end) el.currentTime = this.loop[0]
  }

  /** Keep the tick, the screen wake lock and the UI in step with the element's real state. */
  onPlayState(el: HTMLAudioElement) {
    if (el !== this.el || this.disposed) return
    cancelAnimationFrame(this.raf)
    if (!el.paused) this.raf = requestAnimationFrame(this.tick)
    keepAwake(!el.paused && !el.ended)
    this.emit()
  }

  private tick = () => {
    const el = this.el
    this.checkLoop(el)
    this.emit()
    if (!el.paused) this.raf = requestAnimationFrame(this.tick)
  }

  async play() {
    stopPracticeAudio()
    const el = this.el
    el.playbackRate = this.speed
    if (this.loop && (el.currentTime < this.loop[0] || el.currentTime >= this.loop[1])) el.currentTime = this.loop[0]
    try {
      await el.play()
    } catch (err) {
      console.warn('play() failed', err)
    }
    cancelAnimationFrame(this.raf)
    this.raf = requestAnimationFrame(this.tick)
    this.emit()
  }

  pause() {
    this.el.pause()
    cancelAnimationFrame(this.raf)
    this.emit()
  }

  seek(t: number) {
    this.el.currentTime = Math.max(0, Math.min(t, this.duration - 0.05))
    this.emit()
  }

  setMix(mix: MixFile) {
    if (mix === this.active || !this.els.has(mix)) return
    const from = this.el
    const to = this.els.get(mix)!
    const wasPlaying = !from.paused
    to.playbackRate = this.speed
    to.currentTime = from.currentTime
    this.active = mix
    if (wasPlaying) {
      void to.play().catch((err) => console.warn('play() failed', err))
      from.pause()
      cancelAnimationFrame(this.raf)
      this.raf = requestAnimationFrame(this.tick)
    }
    this.emit()
  }

  setSpeed(speed: number) {
    this.speed = speed
    this.el.playbackRate = speed
  }

  /** Loop between two times, or null to stop looping. */
  setLoop(range: [number, number] | null) {
    this.loop = range
  }

  dispose() {
    if (!this.el.paused) keepAwake(false)
    this.disposed = true
    cancelAnimationFrame(this.raf)
    this.els.forEach((el) => {
      el.pause()
      el.removeAttribute('src')
      el.load()
    })
    this.urls.forEach((u) => URL.revokeObjectURL(u))
    this.listeners.clear()
  }
}
