import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Accidental, Beam, Dot, Formatter, Renderer, Stave, StaveConnector, StaveNote, type StemmableNote, Voice } from 'vexflow/bravura'
import { vexKeySpec } from '../theory/keys'
import { type Note, vexAccidental, vexKey } from '../theory/notes'
import type { Clef, Melody } from '../theory/sightreading'
import type { Voicing } from '../theory/voicing'

const INK = '#1a1a1a'
const HIGHLIGHT = '#c77d00'

/** Resolves once the bundled Bravura music font is usable. */
let fontsReady: Promise<unknown> | null = null
function whenFontsReady() {
  fontsReady ??= Promise.all([document.fonts.load('30px Bravura'), document.fonts.load('12px Academico')]).catch(() => undefined)
  return fontsReady
}

function useFonts() {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    let live = true
    whenFontsReady().then(() => live && setReady(true))
    return () => {
      live = false
    }
  }, [])
  return ready
}

function useWidth(ref: React.MutableRefObject<HTMLDivElement | null>) {
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(() => setWidth(Math.floor(el.clientWidth)))
    ro.observe(el)
    setWidth(Math.floor(el.clientWidth))
    return () => ro.disconnect()
  }, [ref])
  return width
}

type Ctx = ReturnType<Renderer['getContext']>

/** Draw into a fresh SVG sized width × height (CSS px); drawing coordinates are divided by `scale`. */
function useDraw(
  draw: (ctx: Ctx, w: number) => void,
  height: number,
  scale: number,
  deps: unknown[],
): React.MutableRefObject<HTMLDivElement | null> {
  const ref = useRef<HTMLDivElement | null>(null)
  const width = useWidth(ref)
  const fonts = useFonts()
  useEffect(() => {
    const el = ref.current
    if (!el || !fonts || width < 50) return
    el.innerHTML = ''
    const renderer = new Renderer(el, Renderer.Backends.SVG)
    renderer.resize(width, height)
    const ctx = renderer.getContext()
    ctx.scale(scale, scale)
    ctx.setFillStyle(INK)
    ctx.setStrokeStyle(INK)
    try {
      draw(ctx, width / scale)
    } catch (err) {
      console.error('Notation draw failed', err)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fonts, width, height, scale, ...deps])
  return ref
}

function addAccidentals(sn: StaveNote, notes: Note[]) {
  notes.forEach((n, i) => {
    if (n.acc !== 0) sn.addModifier(new Accidental(vexAccidental(n.acc)), i)
  })
}

function wholeChord(notes: Note[], clef: Clef): StaveNote {
  const sn = new StaveNote({ keys: notes.map(vexKey), duration: 'w', clef, alignCenter: true })
  addAccidentals(sn, notes)
  return sn
}

/** Grand staff with one whole-note chord (left hand on the bass staff, right hand on the treble). */
export function ChordStaff({ voicing, scale = 1.25, height = 230 }: { voicing: Voicing; scale?: number; height?: number }) {
  const key = [...voicing.lh, ...voicing.rh].map(vexKey).join(',')
  const ref = useDraw(
    (ctx, w) => {
      const x = 10
      const sw = w - 20
      const top = new Stave(x, 0, sw).addClef('treble')
      const bottom = new Stave(x, 80, sw).addClef('bass')
      top.setEndBarType(3) // BarlineType.END
      bottom.setEndBarType(3)
      top.setContext(ctx).draw()
      bottom.setContext(ctx).draw()
      new StaveConnector(top, bottom).setType('brace').setContext(ctx).draw()
      new StaveConnector(top, bottom).setType('singleLeft').setContext(ctx).draw()
      new StaveConnector(top, bottom).setType('boldDoubleRight').setContext(ctx).draw()
      drawGrandStaffNotes(ctx, top, bottom, wholeChord(voicing.rh, 'treble'), wholeChord(voicing.lh, 'bass'))
    },
    height,
    scale,
    [key],
  )
  return <div ref={ref} className="notation" aria-label="Chord in standard notation" />
}

function drawGrandStaffNotes(ctx: Ctx, top: Stave, bottom: Stave, upper: StaveNote | null, lower: StaveNote | null) {
  const start = Math.max(top.getNoteStartX(), bottom.getNoteStartX())
  top.setNoteStartX(start)
  bottom.setNoteStartX(start)
  const parts: { stave: Stave; voice: Voice }[] = []
  for (const [stave, note] of [
    [top, upper],
    [bottom, lower],
  ] as const) {
    if (!note) continue
    note.setStave(stave)
    parts.push({ stave, voice: new Voice({ numBeats: 4, beatValue: 4 }).addTickables([note]) })
  }
  if (!parts.length) return
  const voices = parts.map((p) => p.voice)
  new Formatter().joinVoices(voices).format(voices, top.getNoteEndX() - start - 10)
  for (const p of parts) p.voice.draw(ctx, p.stave)
}

/** One note on treble, bass or a grand staff ("both"). */
export function NoteStaff({ note, clef, layout, scale = 1.5 }: { note: Note; clef: Clef; layout: 'treble' | 'bass' | 'both'; scale?: number }) {
  const height = layout === 'both' ? 290 : 190
  const ref = useDraw(
    (ctx, w) => {
      const sw = Math.min(w - 20, 200)
      const x = (w - sw) / 2
      const sn = new StaveNote({ keys: [vexKey(note)], duration: 'w', clef, alignCenter: true })
      addAccidentals(sn, [note])
      if (layout === 'both') {
        const top = new Stave(x, 15, sw).addClef('treble')
        const bottom = new Stave(x, 100, sw).addClef('bass')
        top.setContext(ctx).draw()
        bottom.setContext(ctx).draw()
        new StaveConnector(top, bottom).setType('brace').setContext(ctx).draw()
        new StaveConnector(top, bottom).setType('singleLeft').setContext(ctx).draw()
        new StaveConnector(top, bottom).setType('singleRight').setContext(ctx).draw()
        drawGrandStaffNotes(ctx, top, bottom, clef === 'treble' ? sn : null, clef === 'bass' ? sn : null)
      } else {
        const stave = new Stave(x, 25, sw).addClef(clef)
        stave.setContext(ctx).draw()
        sn.setStave(stave)
        const v = new Voice({ numBeats: 4, beatValue: 4 }).addTickables([sn])
        new Formatter().joinVoices([v]).format([v], stave.getNoteEndX() - stave.getNoteStartX() - 10)
        v.draw(ctx, stave)
      }
    },
    height * (scale / 1.5),
    scale,
    [vexKey(note), clef, layout],
  )
  return <div ref={ref} className="notation" aria-label="Note in standard notation" />
}

const DURATIONS: Record<number, [string, number]> = {
  4: ['w', 0],
  3: ['h', 1],
  2: ['h', 0],
  1.5: ['q', 1],
  1: ['q', 0],
  0.5: ['8', 0],
}

/** A melody laid out two bars per line on narrow screens. `active` highlights a note index. */
export function MelodyStaff({ melody, active = -1, scale = 1.1 }: { melody: Melody; active?: number; scale?: number }) {
  const ref = useRef<HTMLDivElement | null>(null)
  const width = useWidth(ref)
  const fonts = useFonts()
  const perLine = width / scale < 520 ? 2 : 4
  const lines = Math.ceil(melody.bars.length / perLine)
  const lineH = 105
  const height = (lines * lineH + 20) * scale

  useEffect(() => {
    const el = ref.current
    if (!el || !fonts || width < 50) return
    el.innerHTML = ''
    const renderer = new Renderer(el, Renderer.Backends.SVG)
    renderer.resize(width, height)
    const ctx = renderer.getContext()
    ctx.scale(scale, scale)
    ctx.setFillStyle(INK)
    ctx.setStrokeStyle(INK)
    const w = width / scale - 10
    const keySpec = vexKeySpec(melody.key)
    let noteIndex = 0
    try {
      for (let line = 0; line < lines; line++) {
        const bars = melody.bars.slice(line * perLine, line * perLine + perLine)
        const first = new Stave(0, 0, 0).addClef(melody.clef).addKeySignature(keySpec)
        if (line === 0) first.addTimeSignature('4/4')
        const headW = first.getNoteStartX() - first.getX()
        const barW = (w - headW) / perLine
        let x = 5
        bars.forEach((bar, bi) => {
          const isFirst = bi === 0
          const stave = new Stave(x, line * lineH + 10, isFirst ? barW + headW : barW)
          if (isFirst) {
            stave.addClef(melody.clef).addKeySignature(keySpec)
            if (line === 0) stave.addTimeSignature('4/4')
          }
          const isLastBar = line * perLine + bi === melody.bars.length - 1
          if (isLastBar) stave.setEndBarType(3)
          stave.setContext(ctx).draw()
          const notes: StaveNote[] = bar.map((mn) => {
            const [duration, dots] = DURATIONS[mn.beats]
            const sn = new StaveNote({ keys: [vexKey(mn.note)], duration, dots, clef: melody.clef })
            if (dots) Dot.buildAndAttach([sn], { all: true })
            if (noteIndex === active) sn.setStyle({ fillStyle: HIGHLIGHT, strokeStyle: HIGHLIGHT })
            noteIndex++
            return sn
          })
          const voice = new Voice({ numBeats: 4, beatValue: 4 }).addTickables(notes)
          Accidental.applyAccidentals([voice], keySpec)
          const beams = Beam.generateBeams(notes as StemmableNote[])
          new Formatter().joinVoices([voice]).format([voice], stave.getNoteEndX() - stave.getNoteStartX() - 12)
          voice.draw(ctx, stave)
          beams.forEach((b) => b.setContext(ctx).draw())
          x += stave.getWidth()
        })
      }
    } catch (err) {
      console.error('Melody draw failed', err)
    }
  }, [fonts, width, height, scale, melody, active, lines, perLine])

  return <div ref={ref} className="notation" aria-label="Melody in standard notation" />
}
