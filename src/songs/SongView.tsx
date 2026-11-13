import { useEffect, useMemo, useState } from 'react'
import { ChordStaff } from '../notation/Notation'
import { parseSymbol, symbolName, voiceSymbol } from '../theory/symbols'
import { Segmented } from '../ui/controls'
import { type PlayerState, SongPlayer, mixFor } from './player'
import { type ChartChord, type Song, type TimedSection, barAt, buildTimeline } from './songs'
import { type StoredSong, deleteSong, loadSongPrefs, saveSongPrefs } from './storage'

interface Props {
  song: Song
  stored: StoredSong | null
  onBack: () => void
  onChanged: () => void
}

const fmt = (t: number) => {
  const s = Math.max(0, Math.floor(t))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

const pretty = (symbol: string) => {
  const c = parseSymbol(symbol)
  return c ? symbolName(c) : 'N.C.'
}

const SPEEDS = [
  { value: 0.5, label: '50%' },
  { value: 0.75, label: '75%' },
  { value: 0.9, label: '90%' },
  { value: 1, label: '100%' },
]

/** Which chord of a bar sounds at a fraction (0–1) through the bar. */
function chordInBar(bar: ChartChord[], fraction: number): number {
  let beats = fraction * 4
  for (let i = 0; i < bar.length; i++) {
    if (beats < bar[i].beats) return i
    beats -= bar[i].beats
  }
  return bar.length - 1
}

export default function SongView({ song, stored, onBack, onChanged }: Props) {
  const [prefs, setPrefs] = useState(() => loadSongPrefs(song.id))
  const [player, setPlayer] = useState<SongPlayer | null>(null)
  const [ps, setPs] = useState<PlayerState | null>(null)
  const [piano, setPiano] = useState(true)
  const [horns, setHorns] = useState(true)
  const [loop, setLoop] = useState(false)
  const [editing, setEditing] = useState(false)
  const [manualTime, setManualTime] = useState(0)

  const updatePrefs = (fn: (p: typeof prefs) => typeof prefs) =>
    setPrefs((p) => {
      const next = fn(p)
      saveSongPrefs(song.id, next)
      return next
    })

  // Load the audio for this song.
  useEffect(() => {
    if (!stored) return
    let live = true
    let p: SongPlayer | null = null
    SongPlayer.load(song.id, stored.files, stored.duration).then((loaded) => {
      if (!live) return loaded.dispose()
      p = loaded
      loaded.setSpeed(prefs.speed)
      setPlayer(loaded)
      loaded.subscribe(setPs)
    })
    return () => {
      live = false
      p?.dispose()
      setPlayer(null)
      setPs(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [song.id, stored?.importedAt])

  const duration = ps?.duration || stored?.duration || song.sections[song.sections.length - 1].start + 60
  const starts = song.sections.map((s, i) => prefs.starts[i] ?? s.start)
  const startsKey = starts.join(',')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const timeline: TimedSection[] = useMemo(() => buildTimeline(song, starts, duration), [song, startsKey, duration])

  const time = ps ? ps.time : manualTime
  const pos = barAt(timeline, time)
  const section = timeline[pos.section]
  const bar = section.bars[pos.bar]
  const inBar = bar ? chordInBar(bar.bar, (time - bar.start) / (bar.end - bar.start)) : 0
  const current = bar?.bar[inBar]
  // The next chord change (this bar or the following bars, across sections).
  const next = useMemo(() => {
    const flat = timeline.flatMap((s) => s.bars)
    const idx = flat.indexOf(bar)
    for (let i = inBar + 1; bar && i < bar.bar.length; i++) if (bar.bar[i].symbol !== current?.symbol) return bar.bar[i]
    for (let b = idx + 1; b < flat.length; b++) for (const c of flat[b].bar) if (c.symbol !== current?.symbol) return c
    return null
  }, [timeline, bar, inBar, current])

  const currentChord = current ? parseSymbol(current.symbol) : null
  const nextChord = next ? parseSymbol(next.symbol) : null
  const names = prefs.showNames

  // Loop the current section when loop is on.
  useEffect(() => {
    player?.setLoop(loop ? [section.start, section.end] : null)
  }, [player, loop, section.start, section.end])

  const setMix = (p: boolean, h: boolean) => {
    setPiano(p)
    setHorns(h)
    player?.setMix(mixFor(p, h))
  }

  const seek = (t: number) => {
    if (player) player.seek(t)
    else setManualTime(t)
  }

  const markSection = (i: number, t: number) =>
    updatePrefs((p) => {
      const s = [...p.starts]
      s[i] = Math.round(t * 100) / 100
      return { ...p, starts: s }
    })

  const nextSectionToMark = Math.min(pos.section + 1, song.sections.length - 1)

  const remove = async () => {
    if (!stored) return
    if (!confirm(`Remove the audio for ${song.title} from this phone? You can import it again later.`)) return
    player?.dispose()
    await deleteSong(song.id, stored.files)
    onChanged()
  }

  return (
    <div className="song-view">
      <header className="song-head">
        <button className="text-btn back" onClick={onBack}>
          ‹ Songs
        </button>
        <button className={names ? 'pill on' : 'pill'} onClick={() => updatePrefs((p) => ({ ...p, showNames: !p.showNames }))}>
          Names {names ? 'on' : 'off'}
        </button>
      </header>
      <h1 className="song-h1">{song.title}</h1>
      <div className="song-sub">
        {song.artist} · {song.key} · ♩≈{song.tempo}
      </div>

      <div className="card paper song-chord">
        <div className="chord-head">
          <div className="chord-name">{names ? (current ? pretty(current.symbol) : '') : ' '}</div>
          <div className="bar-pos">
            {section.name} · bar {bar?.barInBlock ?? 1}
            {bar && bar.pass > 1 ? ` (×${bar.pass})` : ''}
          </div>
        </div>
        {currentChord ? <ChordStaff voicing={voiceSymbol(currentChord)} scale={1.0} height={180} /> : <div className="nc">No chord</div>}
        <div className="song-next">
          Next: <strong>{names ? (next ? pretty(next.symbol) : '—') : ''}</strong>
          {!names && nextChord && (
            <div className="next-staff">
              <ChordStaff voicing={voiceSymbol(nextChord)} scale={0.55} height={105} />
            </div>
          )}
        </div>
      </div>

      {stored && player ? (
        <div className="transport">
          <div className="seek-row">
            <span>{fmt(time)}</span>
            <input type="range" min={0} max={duration} step={0.1} value={time} onChange={(e) => seek(Number(e.target.value))} aria-label="Position" />
            <span>{fmt(duration)}</span>
          </div>
          <div className="transport-row">
            <button className="round" onClick={() => seek(section.start)} aria-label="Back to start of section">
              ⏮
            </button>
            <button className="round" onClick={() => seek(time - 5)} aria-label="Back 5 seconds">
              −5
            </button>
            <button className="round big" onClick={() => (ps?.playing ? player.pause() : void player.play())} aria-label={ps?.playing ? 'Pause' : 'Play'}>
              {ps?.playing ? '❚❚' : '▶'}
            </button>
            <button className="round" onClick={() => seek(time + 5)} aria-label="Forward 5 seconds">
              +5
            </button>
            <button className={loop ? 'round on' : 'round'} onClick={() => setLoop(!loop)} aria-pressed={loop} aria-label="Loop this section">
              ⟲
            </button>
          </div>
          <div className="mixer">
            <button className={piano ? 'mix-btn on' : 'mix-btn'} disabled={!player.available.includes('no-piano.mp3')} onClick={() => setMix(!piano, horns)}>
              Piano {piano ? 'on' : 'off'}
            </button>
            <button className={horns ? 'mix-btn on' : 'mix-btn'} disabled={!player.available.includes('no-horns.mp3')} onClick={() => setMix(piano, !horns)}>
              Horns {horns ? 'on' : 'off'}
            </button>
          </div>
          <Segmented
            small
            options={SPEEDS}
            value={prefs.speed}
            onChange={(v) => {
              player.setSpeed(v)
              updatePrefs((p) => ({ ...p, speed: v }))
            }}
          />
        </div>
      ) : (
        <div className="card empty small">
          {stored ? 'Loading audio…' : 'No audio on this phone yet. Add this song’s file on the Songs page to play along. You can still read the chart: tap a bar to step through it.'}
        </div>
      )}

      <h2 className="sub-h">Sections</h2>
      <ol className="sections">
        {timeline.map((s) => (
          <li key={s.index} className={s.index === pos.section ? 'on' : ''}>
            <button onClick={() => seek(s.start + 0.01)}>
              <span className="sec-name">{s.name}</span>
              <span className="sec-meta">
                {fmt(s.start)}
                {song.sections[s.index].estimated && prefs.starts[s.index] == null ? ' (est.)' : ''}
              </span>
            </button>
          </li>
        ))}
      </ol>

      <h2 className="sub-h">
        {section.name}
        <span className="sub-meta">{section.passes > 1 ? `${section.passes} times through` : ''}</span>
      </h2>
      <div className="chart-grid">
        {section.bars
          .filter((b) => b.pass === (bar?.pass ?? 1))
          .map((b) => {
            const idx = section.bars.indexOf(b)
            return (
              <button key={idx} className={idx === pos.bar ? 'bar on' : 'bar'} onClick={() => seek(b.start + 0.01)}>
                <span className="bar-no">{b.barInBlock}</span>
                <span className="bar-chords">{names ? b.bar.map((c) => pretty(c.symbol)).join('  ') : ''}</span>
              </button>
            )
          })}
      </div>

      {stored && (
        <div className="card mark-card">
          <button className="text-btn" onClick={() => setEditing(!editing)}>
            {editing ? 'Done adjusting sections' : 'Adjust section times'}
          </button>
          {editing && (
            <>
              <p className="note">
                Play the song and tap the button the moment each section begins. Times marked “est.” are guesses until you mark them.
              </p>
              <button className="play-btn" onClick={() => markSection(nextSectionToMark, time)}>
                Mark “{song.sections[nextSectionToMark].name}” at {fmt(time)}
              </button>
              <ul className="mark-list">
                {song.sections.map((s, i) => (
                  <li key={i}>
                    <span className="sec-name">{s.name}</span>
                    <span className="mark-time">{fmt(starts[i])}</span>
                    <button className="chip" onClick={() => markSection(i, starts[i] - 0.5)} aria-label="Half a second earlier">
                      −½s
                    </button>
                    <button className="chip" onClick={() => markSection(i, starts[i] + 0.5)} aria-label="Half a second later">
                      +½s
                    </button>
                    <button className="chip" onClick={() => markSection(i, time)}>
                      Now
                    </button>
                  </li>
                ))}
              </ul>
              <button className="text-btn danger" onClick={() => updatePrefs((p) => ({ ...p, starts: p.starts.map(() => null) }))}>
                Reset to default times
              </button>
            </>
          )}
        </div>
      )}

      <details className="card notes-card">
        <summary>About this chart</summary>
        <p className="note">{song.recording}</p>
        <ul>
          {song.checkByEar.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
        {stored && (
          <button className="text-btn danger" onClick={() => void remove()}>
            Remove audio from this phone
          </button>
        )}
      </details>
      <div style={{ height: 24 }} />
    </div>
  )
}
