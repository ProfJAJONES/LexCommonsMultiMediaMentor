import React, { useRef, useEffect, useImperativeHandle, forwardRef } from 'react'
import type { PitchSample } from '../types'

interface Props {
  samples: PitchSample[]
  currentPitch: number
  width?: number
  height?: number
}

export interface PitchGraphHandle {
  toDataURL: () => string | null
}

// Full operatic range: C2 (deep bass) → C6 (soprano high C)
const MIN_HZ = 65    // C2
const MAX_HZ = 1047  // C6

const GUTTER_L = 52  // wider — accommodates clef symbol + partial staff
const GUTTER_R = 48  // wider — Hz labels go up to 4 digits

// Musical reference points used for grid lines & right-side labels
const GRID_NOTES = [
  { hz: 65,   label: 'C2'  },
  { hz: 130,  label: 'C3'  },
  { hz: 262,  label: 'C4'  },  // Middle C
  { hz: 440,  label: 'A4'  },  // Concert A
  { hz: 523,  label: 'C5'  },
  { hz: 880,  label: 'A5'  },
  { hz: 1047, label: 'C6'  },
]

// Vocal register bands
const BANDS = [
  { lo: 65,   hi: 130,  color: 'rgba(139,92,246,0.08)',  label: 'Bass'      },
  { lo: 130,  hi: 220,  color: 'rgba(52,211,153,0.08)',  label: 'Baritone'  },
  { lo: 220,  hi: 350,  color: 'rgba(56,189,248,0.08)',  label: 'Tenor'     },
  { lo: 350,  hi: 600,  color: 'rgba(251,191,36,0.08)',  label: 'Alto/Mezzo'},
  { lo: 600,  hi: 1047, color: 'rgba(248,113,113,0.08)', label: 'Soprano'   },
]

function pitchColor(hz: number): string {
  if (hz < 130)  return '#a78bfa'  // deep bass — purple
  if (hz < 220)  return '#34d399'  // baritone — green
  if (hz < 350)  return '#38bdf8'  // tenor — sky
  if (hz < 600)  return '#fbbf24'  // mezzo/alto — amber
  return '#f87171'                  // soprano — red
}

function hzToY(hz: number, h: number): number {
  // Logarithmic scale — matches how music/voice is actually perceived
  const logMin = Math.log2(MIN_HZ)
  const logMax = Math.log2(MAX_HZ)
  return h - ((Math.log2(hz) - logMin) / (logMax - logMin)) * h
}

export const PitchGraph = forwardRef<PitchGraphHandle, Props>(function PitchGraph(
  { samples, currentPitch, width = 600, height = 130 }, ref
) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useImperativeHandle(ref, () => ({
    toDataURL: () => canvasRef.current?.toDataURL('image/png') ?? null
  }))

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const dpr = window.devicePixelRatio || 1
    canvas.width = width * dpr
    canvas.height = height * dpr
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    ctx.scale(dpr, dpr)

    ctx.clearRect(0, 0, width, height)
    ctx.fillStyle = '#f0f9ff'
    ctx.fillRect(0, 0, width, height)

    const graphL = GUTTER_L
    const graphR = width - GUTTER_R
    const graphW = graphR - graphL

    // ── Band shading ─────────────────────────────────────────────────────────
    for (const b of BANDS) {
      const yTop = hzToY(b.hi, height)
      const yBot = hzToY(b.lo, height)
      ctx.fillStyle = b.color
      ctx.fillRect(graphL, yTop, graphW, yBot - yTop)
    }

    // ── Grid lines at musical reference points ────────────────────────────────
    ctx.lineWidth = 0.5
    for (const n of GRID_NOTES) {
      const y = hzToY(n.hz, height)
      ctx.strokeStyle = n.label.startsWith('C') ? 'rgba(148,163,184,0.6)' : '#bae6fd'
      ctx.setLineDash(n.label.startsWith('C') ? [] : [3, 3])
      ctx.beginPath()
      ctx.moveTo(graphL, y)
      ctx.lineTo(graphR, y)
      ctx.stroke()
      ctx.setLineDash([])
    }

    // ── Staff lines + clef symbols (left gutter) ─────────────────────────────
    // Treble staff lines (bottom→top): E4, G4, B4, D5, F5
    const TREBLE_LINES = [329.63, 392.00, 493.88, 587.33, 698.46]
    // Bass staff lines (bottom→top): G2, B2, D3, F3, A3
    const BASS_LINES   = [98.00, 123.47, 146.83, 174.61, 220.00]

    const staffRight = GUTTER_L - 6   // staff lines end just before graph area
    const clefCx = (staffRight) / 2    // horizontal center for clef glyphs

    ctx.save()

    // Draw staff lines in gutter — same y as their Hz position on the main graph
    ctx.strokeStyle = 'rgba(100,116,139,0.45)'
    ctx.lineWidth = 0.65
    for (const hz of TREBLE_LINES) {
      const y = hzToY(hz, height)
      ctx.beginPath(); ctx.moveTo(3, y); ctx.lineTo(staffRight, y); ctx.stroke()
    }
    for (const hz of BASS_LINES) {
      const y = hzToY(hz, height)
      ctx.beginPath(); ctx.moveTo(3, y); ctx.lineTo(staffRight, y); ctx.stroke()
    }

    // Highlight the A4 space (between G4=392 and B4=493.88) — amber tint
    // A4 (440 Hz) lives in this space, matching its position on the main graph
    const a4Top = hzToY(493.88, height)  // B4 line — higher Hz = lower y on canvas
    const a4Bot = hzToY(392.00, height)  // G4 line
    ctx.fillStyle = 'rgba(251,191,36,0.18)'
    ctx.fillRect(3, a4Top, staffRight - 3, a4Bot - a4Top)

    // ── Shared clef font size — match bass clef (which is already accurate) ──
    const bassStaffPx = hzToY(98.00, height) - hzToY(220.00, height)
    const clefFontPx  = Math.max(18, Math.round(bassStaffPx * 0.95))
    ctx.fillStyle = '#64748b'
    ctx.textAlign = 'center'

    // ── Treble clef 𝄞 ──────────────────────────────────────────────────────
    // The bottom circle of the treble clef wraps around the G4 line (392 Hz).
    // With textBaseline='alphabetic' in Georgia the curl sits just above the
    // baseline, so anchoring the baseline at G4 + a small downward nudge
    // (≈ 18% of one staff space) centres the circle on the G4 line.
    const trebleSpacePx = (hzToY(329.63, height) - hzToY(392.00, height)) // one space: E4→G4
    ctx.font = `${clefFontPx}px Georgia, "Times New Roman", serif`
    ctx.textBaseline = 'alphabetic'
    ctx.fillText('\u{1D11E}', clefCx, hzToY(392.00, height) + trebleSpacePx * 0.18)

    // ── Bass clef 𝄢 ────────────────────────────────────────────────────────
    // Top of glyph aligns near the top staff line (A3); nub lands on F3 (174.61 Hz)
    ctx.font = `${clefFontPx}px Georgia, "Times New Roman", serif`
    ctx.textBaseline = 'top'
    ctx.fillText('\u{1D122}', clefCx, hzToY(220.00, height))

    // Faint divider at Middle C (C4 = 261.63 Hz)
    ctx.strokeStyle = 'rgba(148,163,184,0.35)'
    ctx.lineWidth = 0.5
    ctx.setLineDash([2, 3])
    ctx.beginPath()
    ctx.moveTo(0, hzToY(262, height))
    ctx.lineTo(GUTTER_L - 2, hzToY(262, height))
    ctx.stroke()
    ctx.setLineDash([])

    ctx.restore()

    // ── Note labels (right gutter) ────────────────────────────────────────────
    ctx.save()
    ctx.font = '8px monospace'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    for (const n of GRID_NOTES) {
      const y = hzToY(n.hz, height)
      ctx.fillStyle = n.label.startsWith('C') ? '#64748b' : '#94a3b8'
      ctx.fillText(`${n.label} ${n.hz}`, graphR + 4, y)
    }
    ctx.restore()

    // ── Average pitch dashed line ─────────────────────────────────────────────
    const recent = samples.length > 0
      ? samples.slice(-Math.max(2, Math.floor(graphW / 2)))
      : []
    const voiced = recent.filter(s => s.hz > 0)
    if (voiced.length > 1) {
      const avg = voiced.reduce((a, s) => a + s.hz, 0) / voiced.length
      const avgY = hzToY(avg, height)
      ctx.save()
      ctx.strokeStyle = 'rgba(2,132,199,0.45)'
      ctx.lineWidth = 1
      ctx.setLineDash([6, 4])
      ctx.beginPath()
      ctx.moveTo(graphL, avgY)
      ctx.lineTo(graphR, avgY)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.fillStyle = 'rgba(2,132,199,0.75)'
      ctx.font = '8px monospace'
      ctx.textAlign = 'right'
      ctx.textBaseline = 'bottom'
      ctx.fillText(`avg ${Math.round(avg)} Hz`, graphR - 2, avgY - 1)
      ctx.restore()
    }

    // ── Pitch line ────────────────────────────────────────────────────────────
    if (recent.length < 2) {
      if (currentPitch > 0) {
        const y = hzToY(currentPitch, height)
        ctx.beginPath()
        ctx.arc(graphR - 8, y, 5, 0, Math.PI * 2)
        ctx.fillStyle = pitchColor(currentPitch)
        ctx.fill()
      }
      return
    }

    const xStep = graphW / (recent.length - 1)
    for (let i = 1; i < recent.length; i++) {
      const prev = recent[i - 1]
      const curr = recent[i]
      if (prev.hz === 0 || curr.hz === 0) continue
      const x0 = graphL + (i - 1) * xStep
      const x1 = graphL + i * xStep
      const y0 = hzToY(prev.hz, height)
      const y1 = hzToY(curr.hz, height)
      const grad = ctx.createLinearGradient(x0, 0, x1, 0)
      grad.addColorStop(0, pitchColor(prev.hz))
      grad.addColorStop(1, pitchColor(curr.hz))
      ctx.beginPath()
      ctx.strokeStyle = grad
      ctx.lineWidth = 2.5
      ctx.lineJoin = 'round'
      ctx.moveTo(x0, y0)
      ctx.lineTo(x1, y1)
      ctx.stroke()
    }

    if (currentPitch > 0) {
      const y = hzToY(currentPitch, height)
      const color = pitchColor(currentPitch)
      ctx.save()
      ctx.shadowColor = color
      ctx.shadowBlur = 8
      ctx.beginPath()
      ctx.arc(graphR - 8, y, 5, 0, Math.PI * 2)
      ctx.fillStyle = color
      ctx.fill()
      ctx.restore()
    }
  }, [samples, currentPitch, width, height])

  function rangeLabel(hz: number) {
    if (hz === 0)    return '—'
    if (hz < 130)   return 'Bass'
    if (hz < 220)   return 'Baritone'
    if (hz < 350)   return 'Tenor'
    if (hz < 600)   return 'Alto / Mezzo'
    return 'Soprano'
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748b', fontSize: 12 }}>
        <span>PITCH</span>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {currentPitch > 0 && (
            <span style={{
              fontSize: 10, padding: '2px 6px', borderRadius: 4,
              background: pitchColor(currentPitch) + '33',
              color: pitchColor(currentPitch), fontWeight: 600
            }}>
              {rangeLabel(currentPitch)}
            </span>
          )}
          <span style={{ color: pitchColor(currentPitch || 300), fontFamily: 'monospace' }}>
            {currentPitch > 0 ? `${Math.round(currentPitch)} Hz` : '—'}
          </span>
        </div>
      </div>
      <canvas ref={canvasRef} style={{ borderRadius: 6, display: 'block' }} />
    </div>
  )
})
