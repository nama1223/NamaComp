// MusicXML 3.1 (partwise) import/export against the NamaComp model.
// Goal: good-enough round-tripping so drafts open in MuseScore / Finale etc.

import type {
  AccidentalKind,
  Clef,
  Measure,
  NoteElement,
  NoteValue,
  Part,
  Pitch,
  Score,
  Step,
} from '../types/score'
import { createDefaultScore, uid } from '../model/score'
import { durationToWholeFraction } from '../model/duration'

const DIVISIONS = 768 // divisions per quarter note (2^8 * 3 → clean 64ths & triplets)

const TYPE_NAME: Record<NoteValue, string> = {
  1: 'whole',
  2: 'half',
  4: 'quarter',
  8: 'eighth',
  16: '16th',
  32: '32nd',
  64: '64th',
}
const NAME_TO_VALUE: Record<string, NoteValue> = {
  whole: 1,
  half: 2,
  quarter: 4,
  eighth: 8,
  '16th': 16,
  '32nd': 32,
  '64th': 64,
}

const ACC_TO_XML: Record<AccidentalKind, string> = {
  sharp: 'sharp',
  flat: 'flat',
  natural: 'natural',
  'double-sharp': 'double-sharp',
  'double-flat': 'flat-flat',
}
const XML_TO_ACC: Record<string, AccidentalKind> = {
  sharp: 'sharp',
  flat: 'flat',
  natural: 'natural',
  'double-sharp': 'double-sharp',
  'sharp-sharp': 'double-sharp',
  'flat-flat': 'double-flat',
}

interface ClefSpec {
  sign: string
  line?: number
}
const CLEF_TO_XML: Record<Clef, ClefSpec> = {
  treble: { sign: 'G', line: 2 },
  bass: { sign: 'F', line: 4 },
  alto: { sign: 'C', line: 3 },
  tenor: { sign: 'C', line: 4 },
  percussion: { sign: 'percussion' },
}

function xmlToClef(sign: string, line: number | undefined): Clef {
  if (sign === 'F') return 'bass'
  if (sign === 'C') return line === 4 ? 'tenor' : 'alto'
  if (sign === 'percussion') return 'percussion'
  return 'treble'
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function durationDivisions(el: NoteElement): number {
  // whole-fraction * 4 = quarters; * DIVISIONS = MusicXML duration units.
  return Math.round(durationToWholeFraction(el.duration) * 4 * DIVISIONS)
}

// --- Export -----------------------------------------------------------------

function noteToXml(el: NoteElement, clef: Clef): string {
  const dur = durationDivisions(el)
  const typeName = TYPE_NAME[el.duration.value]
  const dots = '<dot/>'.repeat(el.duration.dots)
  const tm = el.duration.tuplet
    ? `<time-modification><actual-notes>${el.duration.tuplet.actual}</actual-notes><normal-notes>${el.duration.tuplet.normal}</normal-notes></time-modification>`
    : ''

  if (el.kind === 'rest') {
    return `<note><rest/><duration>${dur}</duration><type>${typeName}</type>${dots}${tm}</note>`
  }

  return el.pitches
    .map((p, i) => {
      const chord = i > 0 ? '<chord/>' : ''
      const alter = p.alter !== 0 ? `<alter>${p.alter}</alter>` : ''
      const accKind = el.accidentals?.[i] ?? alterToAccidental(p.alter)
      const acc = accKind ? `<accidental>${ACC_TO_XML[accKind]}</accidental>` : ''
      return (
        `<note>${chord}` +
        `<pitch><step>${p.step}</step>${alter}<octave>${p.octave}</octave></pitch>` +
        `<duration>${dur}</duration><type>${typeName}</type>${dots}${tm}${acc}` +
        `</note>`
      )
    })
    .join('')
}

function alterToAccidental(alter: number): AccidentalKind | null {
  switch (alter) {
    case 2:
      return 'double-sharp'
    case 1:
      return 'sharp'
    case -1:
      return 'flat'
    case -2:
      return 'double-flat'
    default:
      return null
  }
}

function measureToXml(
  measure: Measure,
  index: number,
  part: Part,
  score: Score,
): string {
  const number = index + 1
  let attributes = ''
  if (index === 0) {
    const c = CLEF_TO_XML[part.clef]
    const clefXml = `<clef><sign>${c.sign}</sign>${c.line ? `<line>${c.line}</line>` : ''}</clef>`
    const transposeXml =
      part.transpose !== 0
        ? `<transpose><chromatic>${part.transpose}</chromatic></transpose>`
        : ''
    attributes =
      `<attributes><divisions>${DIVISIONS}</divisions>` +
      `<key><fifths>${score.keyFifths}</fifths></key>` +
      `<time><beats>${score.time.beats}</beats><beat-type>${score.time.beatType}</beat-type></time>` +
      `${clefXml}${transposeXml}</attributes>`
  }
  const notes = measure.elements.map((el) => noteToXml(el, part.clef)).join('')
  return `<measure number="${number}">${attributes}${notes}</measure>`
}

export function exportMusicXML(score: Score): string {
  const partList = score.parts
    .map(
      (p, i) =>
        `<score-part id="P${i + 1}"><part-name>${escapeXml(p.name)}</part-name>` +
        (p.fullName ? `<part-abbreviation>${escapeXml(p.name)}</part-abbreviation>` : '') +
        `</score-part>`,
    )
    .join('')

  const parts = score.parts
    .map(
      (p, i) =>
        `<part id="P${i + 1}">` +
        p.measures.map((m, mi) => measureToXml(m, mi, p, score)).join('') +
        `</part>`,
    )
    .join('')

  const composer = score.composer
    ? `<identification><creator type="composer">${escapeXml(score.composer)}</creator></identification>`
    : ''

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.1 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">\n` +
    `<score-partwise version="3.1">` +
    `<work><work-title>${escapeXml(score.title)}</work-title></work>` +
    composer +
    `<part-list>${partList}</part-list>` +
    parts +
    `</score-partwise>\n`
  )
}

// --- Import -----------------------------------------------------------------

function textOf(el: Element | null, sel: string): string | null {
  return el?.querySelector(sel)?.textContent?.trim() ?? null
}

function valueFromType(typeName: string | null): NoteValue {
  if (typeName && typeName in NAME_TO_VALUE) return NAME_TO_VALUE[typeName]
  return 4
}

function parseNote(noteEl: Element): { element: NoteElement; isChord: boolean } {
  const isChord = noteEl.querySelector('chord') !== null
  const isRest = noteEl.querySelector('rest') !== null
  const value = valueFromType(textOf(noteEl, 'type'))
  const dots = noteEl.querySelectorAll('dot').length

  const tmEl = noteEl.querySelector('time-modification')
  const tuplet = tmEl
    ? {
        actual: Number(textOf(tmEl, 'actual-notes') ?? '1'),
        normal: Number(textOf(tmEl, 'normal-notes') ?? '1'),
      }
    : undefined

  const duration = { value, dots, ...(tuplet ? { tuplet } : {}) }

  if (isRest) {
    return { element: { id: uid(), kind: 'rest', pitches: [], duration }, isChord: false }
  }

  const pitchEl = noteEl.querySelector('pitch')
  const step = (textOf(pitchEl, 'step') ?? 'C') as Step
  const octave = Number(textOf(pitchEl, 'octave') ?? '4')
  const alter = Number(textOf(pitchEl, 'alter') ?? '0')
  const accText = textOf(noteEl, 'accidental')
  const accidental = accText && accText in XML_TO_ACC ? XML_TO_ACC[accText] : null

  const element: NoteElement = {
    id: uid(),
    kind: 'note',
    pitches: [{ step, octave, alter }],
    duration,
    accidentals: [accidental],
  }
  return { element, isChord }
}

export function importMusicXML(xml: string): Score {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  if (doc.querySelector('parsererror')) {
    throw new Error('MusicXMLの解析に失敗しました（不正なXML）')
  }
  const root = doc.querySelector('score-partwise')
  if (!root) {
    throw new Error('score-partwise が見つかりません（partwise形式のMusicXMLが必要）')
  }

  const base = createDefaultScore()
  const title =
    textOf(root, 'work work-title') ?? textOf(root, 'movement-title') ?? base.title
  const composer =
    root.querySelector('identification creator[type="composer"]')?.textContent?.trim() ??
    undefined

  // part-list names
  const nameById = new Map<string, string>()
  root.querySelectorAll('part-list score-part').forEach((sp) => {
    const id = sp.getAttribute('id') ?? ''
    nameById.set(id, textOf(sp, 'part-name') ?? id)
  })

  let scoreKeyFifths = base.keyFifths
  let scoreTime = base.time

  const parts: Part[] = []
  root.querySelectorAll('part').forEach((partEl, pIndex) => {
    const id = partEl.getAttribute('id') ?? `P${pIndex + 1}`
    let clef: Clef = 'treble'
    let transpose = 0
    const measures: Measure[] = []

    partEl.querySelectorAll('measure').forEach((measureEl, mIndex) => {
      const attr = measureEl.querySelector('attributes')
      if (attr) {
        const clefEl = attr.querySelector('clef')
        if (clefEl) {
          const sign = textOf(clefEl, 'sign') ?? 'G'
          const lineText = textOf(clefEl, 'line')
          clef = xmlToClef(sign, lineText ? Number(lineText) : undefined)
        }
        const chromatic = textOf(attr, 'transpose chromatic')
        if (chromatic) transpose = Number(chromatic)
        if (mIndex === 0 && pIndex === 0) {
          const fifths = textOf(attr, 'key fifths')
          if (fifths) scoreKeyFifths = Number(fifths)
          const beats = textOf(attr, 'time beats')
          const beatType = textOf(attr, 'time beat-type')
          if (beats && beatType) {
            scoreTime = { beats: Number(beats), beatType: Number(beatType) }
          }
        }
      }

      const elements: NoteElement[] = []
      measureEl.querySelectorAll('note').forEach((noteEl) => {
        const { element, isChord } = parseNote(noteEl)
        if (isChord && elements.length > 0) {
          const prev = elements[elements.length - 1]
          prev.pitches.push(...element.pitches)
          prev.accidentals = [
            ...(prev.accidentals ?? []),
            ...(element.accidentals ?? [null]),
          ]
        } else {
          elements.push(element)
        }
      })

      measures.push({ id: uid(), elements })
    })

    parts.push({
      id: uid(),
      name: nameById.get(id) ?? id,
      clef,
      transpose,
      measures: measures.length > 0 ? measures : [{ id: uid(), elements: [] }],
    })
  })

  if (parts.length === 0) {
    throw new Error('パートが見つかりませんでした')
  }

  return {
    title,
    composer,
    fileName: title,
    parts,
    keyFifths: scoreKeyFifths,
    time: scoreTime,
    tempo: base.tempo,
  }
}
