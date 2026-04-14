import React, { useRef, useEffect, useImperativeHandle, forwardRef } from 'react'
import type { DecibelSample } from '../types'

interface Props {
  samples: DecibelSample[]
  currentDb: number
  width?: number
  height?: number
}

export interface DecibelGraphHandle {
  toDataURL: () => string | null
}

// Extended range: near-silence → clipping
const MIN_DB = -80
const MAX_DB = 0

const GUTTER_L = 90
const GUTTER_R = 36

const ZONES = [
  { lo: -80, hi: -60, label: 'Silence / Ambient', color: 'rgba(203,213,225,0.12)', textColor: '#94a3b8' },
  { lo: -60, hi: -45, label: 'Whisper',            color: 'rgba(148,163,184,0.10)', textColor: '#64748b' },
  { lo: -45, hi: -30, label: 'Soft',               color: 'rgba(74,222,128,0.10)',  textColor: '#16a34a' },
  { lo: -30, hi: -15, label: 'Normal Speaking',    color: 'rgba(56,189,248,0.10)',  textColor: '#0369a1' },
  { lo: -15, hi: -6,  label: 'Loud',               color: 'rgba(251,191,36,0.12)',  textColor: '#b45309' },
  { lo: -6,  hi:  0,  label: 'Very Loud',          color: 'rgba(248,113,113,0.15)', textColor: '#dc2626' },
]

function dbColor(db: number): string {
  if (db > -6)  return '#f87171'
  if (db > -15) return '#fbbf24'
  if (db > -30) return '#38bdf8'
  if (db > -45) return '#4ade80'
  if (db > -60) return '#94a3b8'
  return '#cbd5e1'
}

function dbToY(db: number, h: number): number {
  return ((db - MAX_DB) / (MIN_DB - MAX_DB)) * h
}

export const DecibelGraph = forwardRef<DecibelGraphHandle, Props>(function DecibelGraph(
  { samples, currentDb, width = 600, height = 80 }, ref
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

    // ── Zone shading ──────────────────────────────────────────────────────────
    for (const z of ZONES) {
      const yTop = dbToY(z.hi, height)
      const yBot = dbToY(z.lo, height)
      ctx.fillStyle = z.color
      ctx.fillRect(graphL, yTop, graphW, yBot - yTop)
    }

    // ── Zone labels (left gutter) ─────────────────────────────────────────────
    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'
    for (const z of ZONES) {
      const midY = (dbToY(z.hi, height) + dbToY(z.lo, height)) / 2
      const zoneH = dbToY(z.lo, height) - dbToY(z.hi, height)
      if (zoneH < 7) continue
      ctx.font = `${Math.min(9, zoneH * 0.55)}px -apple-system, sans-serif`
      ctx.fillStyle = z.textColor
      ctx.fillText(z.label, graphL - 5, midY)
    }

    // ── Grid lines ────────────────────────────────────────────────────────────
    ctx.lineWidth = 0.5
    for (const db of [-6, -15, -30, -45, -60]) {
      const y = dbToY(db, height)
      ctx.strokeStyle = 'rgba(186,230,253,0.8)'
      ctx.beginPath()
      ctx.moveTo(graphL, y)
      ctx.lineTo(graphR, y)
      ctx.stroke()
    }

    // ── dB labels (right gutter) ──────────────────────────────────────────────
    ctx.save()
    ctx.fillStyle = '#94a3b8'
    ctx.font = '8px monospace'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    for (const db of [0, -15, -30, -45, -60, -80]) {
      const y = dbToY(db, height)
      ctx.fillText(`${db}`, graphR + 4, y)
    }
    ctx.restore()

    // ── Gutter divider ────────────────────────────────────────────────────────
    ctx.strokeStyle = 'rgba(186,230,253,0.5)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(graphL, 0)
    ctx.lineTo(graphL, height)
    ctx.stroke()

    if (samples.length === 0) return

    // ── Bars ──────────────────────────────────────────────────────────────────
    const recent = samples.slice(-Math.floor(graphW / 2))
    const barW = Math.max(1, graphW / recent.length)

    for (let i = 0; i < recent.length; i++) {
      const s = recent[i]
      const clampedDb = Math.max(MIN_DB, Math.min(MAX_DB, s.db))
      const barH = ((clampedDb - MIN_DB) / (MAX_DB - MIN_DB)) * height
      const x = graphL + i * barW
      const y = height - barH
      ctx.fillStyle = dbColor(s.db)
      ctx.globalAlpha = 0.8
      ctx.fillRect(x, y, barW - 0.5, barH)
    }
    ctx.globalAlpha = 1
  }, [samples, currentDb, width, height])

  const clampedDb = Math.max(MIN_DB, Math.min(MAX_DB, currentDb))
  const currentZone = [...ZONES].reverse().find(z => currentDb >= z.lo) ?? ZONES[0]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: 12 }}>
        <span>VOLUME</span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {isFinite(currentDb) && (
            <span style={{
              fontSize: 10, padding: '2px 6px', borderRadius: 4,
              background: currentZone.color, color: currentZone.textColor, fontWeight: 600
            }}>
              {currentZone.label}
            </span>
          )}
          <span style={{ color: dbColor(currentDb), fontFamily: 'monospace' }}>
            {isFinite(currentDb) ? `${Math.round(clampedDb)} dBFS` : '—'}
          </span>
        </div>
      </div>
      <canvas ref={canvasRef} style={{ borderRadius: 6, display: 'block' }} />
      <div style={{ fontSize: 10, color: '#94a3b8', textAlign: 'right', lineHeight: 1.4 }}>
        dBFS = decibels relative to full scale &mdash; 0 is the loudest possible; lower numbers are quieter
      </div>
    </div>
  )
})
