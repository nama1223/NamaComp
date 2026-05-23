import type { Clef } from '../types/score'
import type { PartSpec } from './score'

// A practical instrument palette for the score manager. `transpose` is the
// written→sounding shift in semitones (e.g. B♭ trumpet sounds a major 2nd
// below written = -2). Grouped roughly by family.
export interface InstrumentPreset extends PartSpec {
  /** Short label shown on the staff. */
  name: string
  /** Full instrument name. */
  fullName: string
  clef: Clef
  transpose: number
  group: string
}

export const INSTRUMENTS: InstrumentPreset[] = [
  // Woodwinds
  { name: 'Picc', fullName: 'Piccolo', clef: 'treble', transpose: 0, group: '木管' },
  { name: 'Fl', fullName: 'Flute', clef: 'treble', transpose: 0, group: '木管' },
  { name: 'Ob', fullName: 'Oboe', clef: 'treble', transpose: 0, group: '木管' },
  { name: 'Cl', fullName: 'Clarinet in B♭', clef: 'treble', transpose: -2, group: '木管' },
  { name: 'B.Cl', fullName: 'Bass Clarinet in B♭', clef: 'treble', transpose: -14, group: '木管' },
  { name: 'Bsn', fullName: 'Bassoon', clef: 'bass', transpose: 0, group: '木管' },
  { name: 'S.Sax', fullName: 'Soprano Sax in B♭', clef: 'treble', transpose: -2, group: '木管' },
  { name: 'A.Sax', fullName: 'Alto Sax in E♭', clef: 'treble', transpose: -9, group: '木管' },
  { name: 'T.Sax', fullName: 'Tenor Sax in B♭', clef: 'treble', transpose: -14, group: '木管' },
  { name: 'B.Sax', fullName: 'Baritone Sax in E♭', clef: 'treble', transpose: -21, group: '木管' },

  // Brass
  { name: 'Trp', fullName: 'Trumpet in B♭', clef: 'treble', transpose: -2, group: '金管' },
  { name: 'Cor', fullName: 'Cornet in B♭', clef: 'treble', transpose: -2, group: '金管' },
  { name: 'Horn', fullName: 'Horn in F', clef: 'treble', transpose: -7, group: '金管' },
  { name: 'Trb', fullName: 'Trombone', clef: 'bass', transpose: 0, group: '金管' },
  { name: 'Euph', fullName: 'Euphonium', clef: 'bass', transpose: 0, group: '金管' },
  { name: 'Tuba', fullName: 'Tuba', clef: 'bass', transpose: 0, group: '金管' },

  // Strings
  { name: 'Vln', fullName: 'Violin', clef: 'treble', transpose: 0, group: '弦' },
  { name: 'Vla', fullName: 'Viola', clef: 'alto', transpose: 0, group: '弦' },
  { name: 'Vc', fullName: 'Cello', clef: 'bass', transpose: 0, group: '弦' },
  { name: 'Cb', fullName: 'Contrabass', clef: 'bass', transpose: 0, group: '弦' },

  // Keys / Voice / Percussion
  { name: 'Pf', fullName: 'Piano', clef: 'treble', transpose: 0, group: 'その他' },
  { name: 'Vox', fullName: 'Voice', clef: 'treble', transpose: 0, group: 'その他' },
  { name: 'Perc', fullName: 'Percussion', clef: 'percussion', transpose: 0, group: 'その他' },
]

export const DEFAULT_INSTRUMENT: InstrumentPreset = INSTRUMENTS[1] // Flute
