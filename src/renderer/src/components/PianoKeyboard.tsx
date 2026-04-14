import React from 'react'

// ─── Music theory helpers ────────────────────────────────────────────────────

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

// White-key note indices within an octave (C D E F G A B)
const WHITE_INDICES = [0, 2, 4, 5, 7, 9, 11]

// Black-key note indices and their x-offset within the octave (in white-key-width units)
const BLACK_KEYS = [
  { noteIndex: 1,  offset: 0.65 },  // C#
  { noteIndex: 3,  offset: 1.68 },  // D#
  { noteIndex: 6,  offset: 3.65 },  // F#
  { noteIndex: 8,  offset: 4.65 },  // G#
  { noteIndex: 10, offset: 5.68 },  // A#
]

function hzToMidi(hz: number): number | null {
  if (hz <= 0) return null
  const midi = Math.round(69 + 12 * Math.log2(hz / 440))
  return midi
}

function midiToNote(midi: number): { name: string; octave: number; index: number } {
  const index = ((midi % 12) + 12) % 12
  const octave = Math.floor(midi / 12) - 1
  return { name: NOTE_NAMES[index], octave, index }
}

// ─── Component ───────────────────────────────────────────────────────────────

const START_OCTAVE = 1   // C1 ≈ 33 Hz
const NUM_OCTAVES  = 7   // C1 → B7 covers all 88 piano keys (A0–C8)

const KW  = 20   // white key width  (px in SVG units)
const KH  = 64   // white key height
const BW  = 12   // black key width
const BH  = 40   // black key height
const OCT = WHITE_INDICES.length * KW  // 7 × 20 = 140px per octave
const TOT = NUM_OCTAVES * OCT          // total SVG width

interface Props {
  hz: number       // current pitch in Hz, 0 = silent
  width?: number   // rendered width (SVG scales to fit)
}

export function PianoKeyboard({ hz, width = TOT }: Props) {
  const midi      = hzToMidi(hz)
  const activeNote = midi !== null ? midiToNote(midi) : null

  function isActive(noteIndex: number, octave: number) {
    return activeNote !== null &&
      activeNote.index === noteIndex &&
      activeNote.octave === octave
  }

  const whites: React.ReactElement[] = []
  const blacks: React.ReactElement[] = []
  const labels: React.ReactElement[] = []

  for (let o = 0; o < NUM_OCTAVES; o++) {
    const octave = START_OCTAVE + o
    const ox = o * OCT

    // White keys
    WHITE_INDICES.forEach((noteIndex, i) => {
      const x    = ox + i * KW
      const lit  = isActive(noteIndex, octave)
      whites.push(
        <rect key={`w${o}-${i}`}
          x={x + 0.5} y={0.5} width={KW - 1} height={KH - 1}
          fill={lit ? '#38bdf8' : '#f1f5f9'}
          stroke="#475569" strokeWidth={0.6} rx={2}
        />
      )
      if (lit) {
        whites.push(
          <text key={`wl${o}-${i}`}
            x={x + KW / 2} y={KH - 7}
            textAnchor="middle" fontSize={7} fontWeight="700" fill="#0f172a"
          >
            {NOTE_NAMES[noteIndex]}
          </text>
        )
      }
    })

    // Octave label under each C
    labels.push(
      <text key={`ol${o}`}
        x={ox + KW / 2} y={KH + 12}
        textAnchor="middle" fontSize={8} fill="#475569"
      >
        C{octave}
      </text>
    )

    // Black keys (drawn on top)
    BLACK_KEYS.forEach(({ noteIndex, offset }) => {
      const x   = ox + offset * KW - BW / 2
      const lit = isActive(noteIndex, octave)
      blacks.push(
        <rect key={`b${o}-${noteIndex}`}
          x={x} y={0} width={BW} height={BH}
          fill={lit ? '#38bdf8' : '#0f172a'}
          stroke="#334155" strokeWidth={0.5} rx={2}
        />
      )
      if (lit) {
        blacks.push(
          <text key={`bl${o}-${noteIndex}`}
            x={x + BW / 2} y={BH - 6}
            textAnchor="middle" fontSize={6} fontWeight="700"
            fill={lit ? '#0f172a' : '#94a3b8'}
          >
            {NOTE_NAMES[noteIndex]}
          </text>
        )
      }
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: 12 }}>
        <span>NOTE</span>
        <span style={{ color: '#38bdf8', fontFamily: 'monospace', fontWeight: 600 }}>
          {activeNote
            ? `${activeNote.name}${activeNote.octave}`
            : '—'}
        </span>
      </div>

      {/* SVG keyboard — natural size, scrolls horizontally */}
      <div style={{ overflowX: 'auto' }}>
        <svg
          viewBox={`0 0 ${TOT} ${KH + 16}`}
          width={TOT}
          height={KH + 16}
          style={{ display: 'block', minWidth: TOT }}
        >
          {whites}
          {labels}
          {blacks}
        </svg>
      </div>
    </div>
  )
}
