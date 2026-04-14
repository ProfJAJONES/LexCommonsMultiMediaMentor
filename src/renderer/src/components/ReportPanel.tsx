import React, { useState, useRef, useCallback, useEffect } from 'react'
import type { PitchSample, DecibelSample, FeedbackComment } from '../types/index'

// ─── Props ────────────────────────────────────────────────────────────────────

interface ReportPanelProps {
  pitchHistory: PitchSample[]
  dbHistory: DecibelSample[]
  comments: FeedbackComment[]
  movementHistory: { t: number; score: number }[]
  fileName: string
  durationSec: number
  apiKey: string
  /** Optional PNG data URLs captured from the live canvas graphs for embedding in PDF exports */
  pitchGraphImage?: string | null
  decibelGraphImage?: string | null
  onGenerateNarrative: (
    prompt: string,
    systemPrompt: string,
    onToken: (t: string) => void
  ) => Promise<void>
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TAG_COLORS: Record<string, string> = {
  pacing:      '#f59e0b',
  clarity:     '#3b82f6',
  volume:      '#8b5cf6',
  posture:     '#10b981',
  eye_contact: '#06b6d4',
  argument:    '#ef4444',
  general:     '#64748b'
}

const RANGE_CONFIG = [
  { key: 'bass',     label: 'Bass',      color: '#6366f1', range: '< 165 Hz'   },
  { key: 'lowMid',   label: 'Low-Mid',   color: '#3b82f6', range: '165–255 Hz' },
  { key: 'mid',      label: 'Mid',       color: '#0ea5e9', range: '255–350 Hz' },
  { key: 'high',     label: 'High',      color: '#06b6d4', range: '350–500 Hz' },
  { key: 'veryHigh', label: 'Very High', color: '#10b981', range: '> 500 Hz'   },
]

// ─── Stats ────────────────────────────────────────────────────────────────────

function computeStats(
  pitchHistory: PitchSample[],
  dbHistory: DecibelSample[],
  comments: FeedbackComment[]
) {
  const voiced = pitchHistory.filter(s => s.hz > 0)
  const avgPitch = voiced.length > 0
    ? voiced.reduce((a, s) => a + s.hz, 0) / voiced.length : 0
  const voicedPct = pitchHistory.length > 0
    ? (voiced.length / pitchHistory.length) * 100 : 0
  const pitchVariability = voiced.length > 1
    ? Math.sqrt(voiced.reduce((a, s) => a + (s.hz - avgPitch) ** 2, 0) / voiced.length) : 0

  const finiteDb = dbHistory.filter(s => isFinite(s.db) && s.db > -60)
  const avgDb = finiteDb.length > 0
    ? finiteDb.reduce((a, s) => a + s.db, 0) / finiteDb.length : 0
  const maxDb = finiteDb.length > 0 ? Math.max(...finiteDb.map(s => s.db)) : 0
  const minDb = finiteDb.length > 0 ? Math.min(...finiteDb.map(s => s.db)) : 0

  const ranges = {
    bass:     voiced.filter(s => s.hz < 165).length,
    lowMid:   voiced.filter(s => s.hz >= 165 && s.hz < 255).length,
    mid:      voiced.filter(s => s.hz >= 255 && s.hz < 350).length,
    high:     voiced.filter(s => s.hz >= 350 && s.hz < 500).length,
    veryHigh: voiced.filter(s => s.hz >= 500).length,
  }

  const tagCounts: Record<string, number> = {}
  for (const c of comments) tagCounts[c.tag] = (tagCounts[c.tag] ?? 0) + 1

  return {
    avgPitch:         Math.round(avgPitch),
    pitchVariability: Math.round(pitchVariability),
    voicedPct:        Math.round(voicedPct),
    avgDb:            Math.round(avgDb),
    dynamicRange:     Math.round(maxDb - minDb),
    commentCount:     comments.length,
    ranges,
    voicedCount:      voiced.length,
    tagCounts
  }
}

type Stats = ReturnType<typeof computeStats>

// ─── SVG Charts (React) ───────────────────────────────────────────────────────

function PitchTimelineChart({ pitchHistory, durationSec, width = 540, height = 120, color = '#0284c7' }: {
  pitchHistory: PitchSample[]
  durationSec: number
  width?: number
  height?: number
  color?: string
}) {
  const voiced = pitchHistory.filter(s => s.hz > 0)
  const PAD = { top: 8, bottom: 20, left: 36, right: 8 }
  const W = width - PAD.left - PAD.right
  const H = height - PAD.top - PAD.bottom

  if (voiced.length === 0 || durationSec <= 0) return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height}>
      <rect width={width} height={height} fill="#f0f9ff" rx={4} />
      <text x={width / 2} y={height / 2 + 4} textAnchor="middle" fontSize={9} fill="#94a3b8">No pitch data</text>
    </svg>
  )

  const minHz = Math.max(50, Math.min(...voiced.map(s => s.hz)) - 20)
  const maxHz = Math.min(700, Math.max(...voiced.map(s => s.hz)) + 30)
  // Use the actual recorded time range so data always fills the chart width,
  // even when the sample buffer only covers part of a long session
  const tMin = pitchHistory[0]?.t ?? 0
  const tMax = pitchHistory[pitchHistory.length - 1]?.t ?? durationSec
  const tSpan = Math.max(tMax - tMin, 1)
  const xS = (t: number) => ((t - tMin) / tSpan) * W
  const yS = (hz: number) => H - ((hz - minHz) / (maxHz - minHz)) * H
  const pts = voiced.map(s => `${xS(s.t).toFixed(1)},${yS(s.hz).toFixed(1)}`).join(' ')
  const yLabels = [minHz, Math.round((minHz + maxHz) / 2), maxHz]
  const xTicks = [0, 0.25, 0.5, 0.75, 1]
  const fmtT = (sec: number) => sec >= 60 ? `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}` : `${Math.round(sec)}s`
  // x position of first voiced sample (may be > 0 if silence at start)
  const firstVoicedX = xS(voiced[0].t)

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} style={{ display: 'block' }}>
      <rect width={width} height={height} fill="#f0f9ff" rx={4} />
      <g transform={`translate(${PAD.left},${PAD.top})`}>
        {yLabels.map(hz => {
          const y = yS(hz)
          return (
            <g key={hz}>
              <line x1={0} y1={y} x2={W} y2={y} stroke="#bae6fd" strokeWidth={0.8} />
              <text x={-4} y={y + 3} textAnchor="end" fontSize={7} fill="#94a3b8">{hz}</text>
            </g>
          )
        })}
        {xTicks.map(frac => {
          const x = frac * W
          const sec = Math.round(frac * durationSec)
          const label = sec >= 60 ? `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}` : `${sec}s`
          return (
            <g key={frac}>
              <line x1={x} y1={0} x2={x} y2={H} stroke="#e0f2fe" strokeWidth={0.5} />
              <text x={x} y={H + 12} textAnchor="middle" fontSize={7} fill="#94a3b8">{label}</text>
            </g>
          )
        })}
        {/* Dashed baseline from t=0 to first voiced sample to indicate silence */}
        {firstVoicedX > 2 && (
          <line x1={0} y1={H} x2={firstVoicedX} y2={H} stroke="#93c5fd" strokeWidth={1} strokeDasharray="3,3" />
        )}
        <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" />
      </g>
    </svg>
  )
}

function VolumeTimelineChart({ dbHistory, durationSec, width = 540, height = 80, color = '#0284c7' }: {
  dbHistory: DecibelSample[]
  durationSec: number
  width?: number
  height?: number
  color?: string
}) {
  const finite = dbHistory.filter(s => isFinite(s.db) && s.db > -60)
  const PAD = { top: 6, bottom: 18, left: 36, right: 8 }
  const W = width - PAD.left - PAD.right
  const H = height - PAD.top - PAD.bottom

  if (finite.length === 0) return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height}>
      <rect width={width} height={height} fill="#f0f9ff" rx={4} />
      <text x={width / 2} y={height / 2 + 4} textAnchor="middle" fontSize={9} fill="#94a3b8">No volume data</text>
    </svg>
  )

  const minDb = -50, maxDb = 0
  const tMin = dbHistory[0]?.t ?? 0
  const tMax = dbHistory[dbHistory.length - 1]?.t ?? durationSec
  const tSpan = Math.max(tMax - tMin, 1)
  const xS = (t: number) => ((t - tMin) / tSpan) * W
  const yS = (db: number) => H - ((db - minDb) / (maxDb - minDb)) * H
  const baseline = yS(minDb)

  let path = `M 0,${baseline} L ${xS(finite[0].t).toFixed(1)},${baseline}`
  for (const s of finite) path += ` L ${xS(s.t).toFixed(1)},${yS(s.db).toFixed(1)}`
  path += ` L ${xS(finite[finite.length - 1].t).toFixed(1)},${baseline} Z`

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} style={{ display: 'block' }}>
      <rect width={width} height={height} fill="#f0f9ff" rx={4} />
      <g transform={`translate(${PAD.left},${PAD.top})`}>
        {[-40, -20, -10, 0].map(db => {
          const y = yS(db)
          return (
            <g key={db}>
              <line x1={0} y1={y} x2={W} y2={y} stroke="#bae6fd" strokeWidth={0.5} />
              <text x={-4} y={y + 3} textAnchor="end" fontSize={7} fill="#94a3b8">{db}</text>
            </g>
          )
        })}
        <path d={path} fill={`${color}40`} stroke={color} strokeWidth={1} />
      </g>
    </svg>
  )
}

function RangeDistChart({ ranges, voicedCount, width = 540 }: {
  ranges: Stats['ranges']
  voicedCount: number
  width?: number
}) {
  const height = RANGE_CONFIG.length * 24 + 10
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} style={{ display: 'block' }}>
      <rect width={width} height={height} fill="#f0f9ff" rx={4} />
      {RANGE_CONFIG.map((cfg, i) => {
        const count = ranges[cfg.key as keyof typeof ranges]
        const pct = voicedCount > 0 ? count / voicedCount : 0
        const barW = (width - 130) * pct
        const y = 5 + i * 24
        return (
          <g key={cfg.key}>
            <text x={4} y={y + 13} fontSize={9} fill="#475569" fontWeight="600">{cfg.label}</text>
            <text x={56} y={y + 13} fontSize={8} fill="#94a3b8">{cfg.range}</text>
            <rect x={120} y={y + 2} width={Math.max(barW, 1)} height={14} fill={cfg.color} rx={3} opacity={0.8} />
            <text x={124 + barW} y={y + 13} fontSize={8} fill="#475569">{Math.round(pct * 100)}%</text>
          </g>
        )
      })}
    </svg>
  )
}

function CommentTimelineChart({ comments, durationSec, width = 540 }: {
  comments: FeedbackComment[]
  durationSec: number
  width?: number
}) {
  const height = 42
  const PAD = { left: 8, right: 8 }
  const W = width - PAD.left - PAD.right

  if (comments.length === 0 || durationSec <= 0) return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height}>
      <rect width={width} height={height} fill="#f0f9ff" rx={4} />
      <text x={width / 2} y={24} textAnchor="middle" fontSize={9} fill="#94a3b8">No comments</text>
    </svg>
  )

  const endLabel = `${Math.floor(durationSec / 60)}:${String(Math.floor(durationSec % 60)).padStart(2, '0')}`

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} style={{ display: 'block' }}>
      <rect width={width} height={height} fill="#f0f9ff" rx={4} />
      <g transform={`translate(${PAD.left},0)`}>
        <line x1={0} y1={20} x2={W} y2={20} stroke="#bae6fd" strokeWidth={1.5} />
        <text x={0} y={height - 4} fontSize={7} fill="#94a3b8">0:00</text>
        <text x={W} y={height - 4} textAnchor="end" fontSize={7} fill="#94a3b8">{endLabel}</text>
        {comments.map(c => {
          const x = (c.timestamp / durationSec) * W
          const color = TAG_COLORS[c.tag] ?? '#64748b'
          return (
            <circle key={c.id} cx={x} cy={20} r={5} fill={color} opacity={0.85}>
              <title>{`${c.tag}: ${c.text.slice(0, 60)}`}</title>
            </circle>
          )
        })}
      </g>
    </svg>
  )
}

function TagBreakdownChart({ tagCounts, width = 540 }: {
  tagCounts: Record<string, number>
  width?: number
}) {
  const entries = Object.entries(tagCounts).sort((a, b) => b[1] - a[1])
  if (entries.length === 0) return (
    <svg viewBox={`0 0 ${width} 30`} width={width} height={30}>
      <text x={width / 2} y={18} textAnchor="middle" fontSize={9} fill="#94a3b8">No comments</text>
    </svg>
  )

  const maxCount = Math.max(...entries.map(e => e[1]))
  const height = entries.length * 22 + 10

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} style={{ display: 'block' }}>
      <rect width={width} height={height} fill="#f0f9ff" rx={4} />
      {entries.map(([tag, count], i) => {
        const barW = (width - 100) * (count / maxCount)
        const y = 5 + i * 22
        const color = TAG_COLORS[tag] ?? '#64748b'
        return (
          <g key={tag}>
            <text x={4} y={y + 13} fontSize={9} fill="#475569" fontWeight="600">{tag.replace('_', ' ')}</text>
            <rect x={90} y={y + 2} width={Math.max(barW, 2)} height={14} fill={color} rx={3} opacity={0.75} />
            <text x={95 + barW} y={y + 13} fontSize={8} fill="#475569">{count}</text>
          </g>
        )
      })}
    </svg>
  )
}

function MovementTimelineChart({ movementHistory, durationSec, width = 540, height = 80 }: {
  movementHistory: { t: number; score: number }[]
  durationSec: number
  width?: number
  height?: number
}) {
  const PAD = { top: 6, bottom: 18, left: 36, right: 8 }
  const W = width - PAD.left - PAD.right
  const H = height - PAD.top - PAD.bottom

  if (movementHistory.length === 0 || durationSec <= 0) return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height}>
      <rect width={width} height={height} fill="#f0f9ff" rx={4} />
      <text x={width / 2} y={height / 2 + 4} textAnchor="middle" fontSize={9} fill="#94a3b8">No movement data — start Body Tracker while video is playing</text>
    </svg>
  )

  const xS = (t: number) => (t / durationSec) * W
  const yS = (score: number) => H - (score / 100) * H
  const xTicks = [0, 0.25, 0.5, 0.75, 1]

  let path = `M ${xS(movementHistory[0].t).toFixed(1)},${yS(movementHistory[0].score).toFixed(1)}`
  for (let i = 1; i < movementHistory.length; i++) {
    path += ` L ${xS(movementHistory[i].t).toFixed(1)},${yS(movementHistory[i].score).toFixed(1)}`
  }
  const fillPath = `${path} L ${xS(movementHistory[movementHistory.length - 1].t).toFixed(1)},${H} L ${xS(movementHistory[0].t).toFixed(1)},${H} Z`

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} style={{ display: 'block' }}>
      <rect width={width} height={height} fill="#f0f9ff" rx={4} />
      <g transform={`translate(${PAD.left},${PAD.top})`}>
        {[0, 30, 60, 100].map(v => {
          const y = yS(v)
          return (
            <g key={v}>
              <line x1={0} y1={y} x2={W} y2={y} stroke="#bae6fd" strokeWidth={0.5} />
              <text x={-4} y={y + 3} textAnchor="end" fontSize={7} fill="#94a3b8">{v}</text>
            </g>
          )
        })}
        {xTicks.map(frac => {
          const x = frac * W
          const sec = Math.round(frac * durationSec)
          const label = sec >= 60 ? `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}` : `${sec}s`
          return (
            <g key={frac}>
              <line x1={x} y1={0} x2={x} y2={H} stroke="#e0f2fe" strokeWidth={0.5} />
              <text x={x} y={H + 12} textAnchor="middle" fontSize={7} fill="#94a3b8">{label}</text>
            </g>
          )
        })}
        <path d={fillPath} fill="rgba(16,185,129,0.2)" stroke="#10b981" strokeWidth={1.5} />
      </g>
    </svg>
  )
}

// ─── HTML Export Builder ──────────────────────────────────────────────────────

function buildReportHTML(
  stats: Stats,
  pitchHistory: PitchSample[],
  dbHistory: DecibelSample[],
  comments: FeedbackComment[],
  movementHistory: { t: number; score: number }[],
  fileName: string,
  durationSec: number,
  narrative: string,
  pitchGraphImage?: string | null,
  decibelGraphImage?: string | null
): string {
  const W = 700

  function pitchSvg(): string {
    const voiced = pitchHistory.filter(s => s.hz > 0)
    if (voiced.length === 0 || durationSec <= 0)
      return `<svg viewBox="0 0 ${W} 140" width="${W}" height="140" xmlns="http://www.w3.org/2000/svg"><rect width="${W}" height="140" fill="#f0f9ff" rx="4"/><text x="${W/2}" y="74" text-anchor="middle" font-size="11" fill="#94a3b8">No pitch data</text></svg>`

    const PAD = { top: 10, bottom: 22, left: 40, right: 10 }
    const cW = W - PAD.left - PAD.right
    const cH = 140 - PAD.top - PAD.bottom
    const minHz = Math.max(50, Math.min(...voiced.map(s => s.hz)) - 20)
    const maxHz = Math.min(700, Math.max(...voiced.map(s => s.hz)) + 30)
    const xS = (t: number) => (t / durationSec) * cW
    const yS = (hz: number) => cH - ((hz - minHz) / (maxHz - minHz)) * cH
    const pts = voiced.map(s => `${xS(s.t).toFixed(1)},${yS(s.hz).toFixed(1)}`).join(' ')
    const firstVoicedX = xS(voiced[0].t)
    const silenceBaseline = firstVoicedX > 2
      ? `<line x1="0" y1="${cH.toFixed(1)}" x2="${firstVoicedX.toFixed(1)}" y2="${cH.toFixed(1)}" stroke="#93c5fd" stroke-width="1" stroke-dasharray="3,3"/>`
      : ''
    const grid = [minHz, Math.round((minHz + maxHz) / 2), maxHz].map(hz => {
      const y = yS(hz)
      return `<line x1="0" y1="${y.toFixed(1)}" x2="${cW}" y2="${y.toFixed(1)}" stroke="#bae6fd" stroke-width="0.8"/><text x="-4" y="${(y+3).toFixed(1)}" text-anchor="end" font-size="8" fill="#94a3b8">${hz}</text>`
    }).join('')
    return `<svg viewBox="0 0 ${W} 140" width="${W}" height="140" xmlns="http://www.w3.org/2000/svg"><rect width="${W}" height="140" fill="#f0f9ff" rx="4"/><g transform="translate(${PAD.left},${PAD.top})">${grid}${silenceBaseline}<polyline points="${pts}" fill="none" stroke="#0284c7" stroke-width="1.5" stroke-linejoin="round"/></g></svg>`
  }

  function volumeSvg(): string {
    const finite = dbHistory.filter(s => isFinite(s.db) && s.db > -60)
    if (finite.length === 0 || durationSec <= 0)
      return `<svg viewBox="0 0 ${W} 90" width="${W}" height="90" xmlns="http://www.w3.org/2000/svg"><rect width="${W}" height="90" fill="#f0f9ff" rx="4"/><text x="${W/2}" y="49" text-anchor="middle" font-size="11" fill="#94a3b8">No volume data</text></svg>`

    const PAD = { top: 6, bottom: 18, left: 40, right: 10 }
    const cW = W - PAD.left - PAD.right
    const cH = 90 - PAD.top - PAD.bottom
    const xS = (t: number) => (t / durationSec) * cW
    const yS = (db: number) => cH - ((db - (-50)) / 50) * cH
    const baseline = yS(-50)
    // Step horizontally to first data point before rising — avoids false diagonal from left edge
    let path = `M 0,${baseline} L ${xS(finite[0].t).toFixed(1)},${baseline}`
    for (const s of finite) path += ` L ${xS(s.t).toFixed(1)},${yS(s.db).toFixed(1)}`
    path += ` L ${xS(finite[finite.length - 1].t).toFixed(1)},${baseline} Z`
    const grid = [-40, -20, -10, 0].map(db => {
      const y = yS(db)
      return `<line x1="0" y1="${y.toFixed(1)}" x2="${cW}" y2="${y.toFixed(1)}" stroke="#bae6fd" stroke-width="0.5"/><text x="-4" y="${(y+3).toFixed(1)}" text-anchor="end" font-size="8" fill="#94a3b8">${db}</text>`
    }).join('')
    return `<svg viewBox="0 0 ${W} 90" width="${W}" height="90" xmlns="http://www.w3.org/2000/svg"><rect width="${W}" height="90" fill="#f0f9ff" rx="4"/><g transform="translate(${PAD.left},${PAD.top})">${grid}<path d="${path}" fill="rgba(2,132,199,0.25)" stroke="#0284c7" stroke-width="1"/></g></svg>`
  }

  function rangeSvg(): string {
    const h = RANGE_CONFIG.length * 24 + 10
    const rows = RANGE_CONFIG.map((cfg, i) => {
      const count = stats.ranges[cfg.key as keyof typeof stats.ranges]
      const pct = stats.voicedCount > 0 ? count / stats.voicedCount : 0
      const barW = (W - 140) * pct
      const y = 5 + i * 24
      return `<text x="4" y="${y+13}" font-size="9" fill="#475569" font-weight="600">${cfg.label}</text><text x="62" y="${y+13}" font-size="8" fill="#94a3b8">${cfg.range}</text><rect x="130" y="${y+2}" width="${Math.max(barW,1).toFixed(1)}" height="14" fill="${cfg.color}" rx="3" opacity="0.8"/><text x="${(135+barW).toFixed(1)}" y="${y+13}" font-size="8" fill="#475569">${Math.round(pct*100)}%</text>`
    }).join('')
    return `<svg viewBox="0 0 ${W} ${h}" width="${W}" height="${h}" xmlns="http://www.w3.org/2000/svg"><rect width="${W}" height="${h}" fill="#f0f9ff" rx="4"/>${rows}</svg>`
  }

  function timelineSvg(): string {
    if (comments.length === 0 || durationSec <= 0)
      return `<svg viewBox="0 0 ${W} 42" width="${W}" height="42" xmlns="http://www.w3.org/2000/svg"><rect width="${W}" height="42" fill="#f0f9ff" rx="4"/><text x="${W/2}" y="24" text-anchor="middle" font-size="9" fill="#94a3b8">No comments</text></svg>`
    const P = 8
    const cW = W - P * 2
    const dots = comments.map(c => {
      const x = P + (c.timestamp / durationSec) * cW
      const col = TAG_COLORS[c.tag] ?? '#64748b'
      const escaped = c.text.slice(0, 60).replace(/</g, '&lt;').replace(/>/g, '&gt;')
      return `<circle cx="${x.toFixed(1)}" cy="20" r="5" fill="${col}" opacity="0.85"><title>${c.tag}: ${escaped}</title></circle>`
    }).join('')
    const endLabel = `${Math.floor(durationSec/60)}:${String(Math.floor(durationSec%60)).padStart(2,'0')}`
    return `<svg viewBox="0 0 ${W} 42" width="${W}" height="42" xmlns="http://www.w3.org/2000/svg"><rect width="${W}" height="42" fill="#f0f9ff" rx="4"/><line x1="${P}" y1="20" x2="${W-P}" y2="20" stroke="#bae6fd" stroke-width="1.5"/><text x="${P}" y="38" font-size="7" fill="#94a3b8">0:00</text><text x="${W-P}" y="38" text-anchor="end" font-size="7" fill="#94a3b8">${endLabel}</text>${dots}</svg>`
  }

  function tagSvg(): string {
    const entries = Object.entries(stats.tagCounts).sort((a, b) => b[1] - a[1])
    if (entries.length === 0)
      return `<svg viewBox="0 0 ${W} 30" width="${W}" height="30" xmlns="http://www.w3.org/2000/svg"><text x="${W/2}" y="18" text-anchor="middle" font-size="9" fill="#94a3b8">No comments</text></svg>`
    const maxC = Math.max(...entries.map(e => e[1]))
    const h = entries.length * 22 + 10
    const rows = entries.map(([tag, count], i) => {
      const barW = (W - 110) * (count / maxC)
      const y = 5 + i * 22
      const col = TAG_COLORS[tag] ?? '#64748b'
      return `<text x="4" y="${y+13}" font-size="9" fill="#475569" font-weight="600">${tag.replace('_',' ')}</text><rect x="100" y="${y+2}" width="${Math.max(barW,2).toFixed(1)}" height="14" fill="${col}" rx="3" opacity="0.75"/><text x="${(106+barW).toFixed(1)}" y="${y+13}" font-size="8" fill="#475569">${count}</text>`
    }).join('')
    return `<svg viewBox="0 0 ${W} ${h}" width="${W}" height="${h}" xmlns="http://www.w3.org/2000/svg"><rect width="${W}" height="${h}" fill="#f0f9ff" rx="4"/>${rows}</svg>`
  }

  function movementSvg(): string {
    if (movementHistory.length === 0 || durationSec <= 0)
      return `<svg viewBox="0 0 ${W} 90" width="${W}" height="90" xmlns="http://www.w3.org/2000/svg"><rect width="${W}" height="90" fill="#f0f9ff" rx="4"/><text x="${W/2}" y="49" text-anchor="middle" font-size="11" fill="#94a3b8">No movement data</text></svg>`
    const PAD = { top: 6, bottom: 18, left: 40, right: 10 }
    const cW = W - PAD.left - PAD.right
    const cH = 90 - PAD.top - PAD.bottom
    const xS = (t: number) => (t / durationSec) * cW
    const yS = (score: number) => cH - (score / 100) * cH
    let path = `M ${xS(movementHistory[0].t).toFixed(1)},${yS(movementHistory[0].score).toFixed(1)}`
    for (let i = 1; i < movementHistory.length; i++) {
      path += ` L ${xS(movementHistory[i].t).toFixed(1)},${yS(movementHistory[i].score).toFixed(1)}`
    }
    const fillPath = `${path} L ${xS(movementHistory[movementHistory.length - 1].t).toFixed(1)},${cH} L ${xS(movementHistory[0].t).toFixed(1)},${cH} Z`
    const grid = [0, 30, 60, 100].map(v => {
      const y = yS(v)
      return `<line x1="0" y1="${y.toFixed(1)}" x2="${cW}" y2="${y.toFixed(1)}" stroke="#bae6fd" stroke-width="0.5"/><text x="-4" y="${(y+3).toFixed(1)}" text-anchor="end" font-size="8" fill="#94a3b8">${v}</text>`
    }).join('')
    return `<svg viewBox="0 0 ${W} 90" width="${W}" height="90" xmlns="http://www.w3.org/2000/svg"><rect width="${W}" height="90" fill="#f0f9ff" rx="4"/><g transform="translate(${PAD.left},${PAD.top})">${grid}<path d="${fillPath}" fill="rgba(16,185,129,0.2)" stroke="#10b981" stroke-width="1.5"/></g></svg>`
  }

  function commentRows(): string {
    if (comments.length === 0) return '<p style="color:#94a3b8;font-style:italic;margin:0">No comments recorded.</p>'
    return [...comments].sort((a, b) => a.timestamp - b.timestamp).map(c => {
      const mm = Math.floor(c.timestamp / 60)
      const ss = String(Math.floor(c.timestamp % 60)).padStart(2, '0')
      const col = TAG_COLORS[c.tag] ?? '#64748b'
      const safeText = c.text.replace(/</g, '&lt;').replace(/>/g, '&gt;')
      return `<div style="margin-bottom:8px;padding:9px 12px;background:#f8fafc;border-left:3px solid ${col};border-radius:0 6px 6px 0"><span style="color:${col};font-weight:700;font-size:10px;text-transform:uppercase">${c.tag.replace('_',' ')}</span>&nbsp;&nbsp;<span style="color:#0284c7;font-family:monospace;font-size:11px">${mm}:${ss}</span><p style="margin:4px 0 0;color:#1e293b;font-size:13px">${safeText}</p></div>`
    }).join('')
  }

  const dur = durationSec > 0
    ? `${Math.floor(durationSec/60)}m ${Math.floor(durationSec%60)}s` : '—'

  const narrativeSection = narrative
    ? `<div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:16px;font-size:14px;line-height:1.75;color:#1e293b">${narrative}</div>`
    : '<p style="color:#94a3b8;font-style:italic;margin:0">No AI narrative was generated for this session.</p>'

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Session Report — ${fileName.replace(/</g,'&lt;')}</title>
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#e0f2fe;color:#0f172a;margin:0;padding:24px}
  .page{max-width:780px;margin:0 auto;background:#fff;border-radius:12px;padding:36px;border:1px solid #bae6fd}
  h1{font-size:22px;color:#0284c7;margin:0 0 4px}
  .sub{color:#64748b;font-size:13px;margin-bottom:28px}
  h2{font-size:12px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:.6px;margin:24px 0 10px;border-bottom:1px solid #e0f2fe;padding-bottom:5px}
  .card{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:24px}
  .stat{background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:14px;text-align:center}
  .sv{font-size:24px;font-weight:700;color:#0284c7}
  .sl{font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:.4px;margin-top:3px}
  .chart{margin-bottom:16px;overflow-x:auto}
  @media print{body{background:#fff;padding:0}.page{border:none;padding:0}}
</style>
</head>
<body>
<div class="page">
  <h1>Session Report</h1>
  <div class="sub">File: <strong>${fileName.replace(/</g,'&lt;')}</strong> &middot; Duration: <strong>${dur}</strong> &middot; Generated: <strong>${new Date().toLocaleDateString()}</strong></div>

  <h2>Session Scorecard</h2>
  <div class="card">
    <div class="stat"><div class="sv">${stats.avgPitch} Hz</div><div class="sl">Avg Pitch</div></div>
    <div class="stat"><div class="sv">${stats.pitchVariability} Hz</div><div class="sl">Pitch Variability &sigma;</div></div>
    <div class="stat"><div class="sv">${stats.voicedPct}%</div><div class="sl">Voiced Time</div></div>
    <div class="stat"><div class="sv">${stats.avgDb} dBFS</div><div class="sl">Avg Volume</div></div>
    <div class="stat"><div class="sv">${stats.dynamicRange} dB</div><div class="sl">Dynamic Range</div></div>
    <div class="stat"><div class="sv">${stats.commentCount}</div><div class="sl">Comments</div></div>
  </div>

  <h2>Pitch Graph</h2>
  <div class="chart">${pitchGraphImage
    ? `<img src="${pitchGraphImage}" style="max-width:100%;border-radius:6px;display:block" alt="Pitch graph">`
    : pitchSvg()}</div>

  <h2>Volume Graph</h2>
  <div class="chart">${decibelGraphImage
    ? `<img src="${decibelGraphImage}" style="max-width:100%;border-radius:6px;display:block" alt="Volume graph">`
    : volumeSvg()}</div>

  <h2>Vocal Range Distribution</h2>
  <div class="chart">${rangeSvg()}</div>

  <h2>Body Movement Timeline</h2>
  <div class="chart">${movementSvg()}</div>

  <h2>Comment Activity Timeline</h2>
  <div class="chart">${timelineSvg()}</div>

  <h2>Feedback Tag Breakdown</h2>
  <div class="chart">${tagSvg()}</div>

  <h2>All Comments</h2>
  <div style="margin-bottom:24px">${commentRows()}</div>

  <h2>AI Coaching Narrative</h2>
  ${narrativeSection}
</div>
</body>
</html>`
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ReportPanel({
  pitchHistory,
  dbHistory,
  comments,
  movementHistory,
  fileName,
  durationSec,
  apiKey,
  pitchGraphImage,
  decibelGraphImage,
  onGenerateNarrative
}: ReportPanelProps) {
  const [narrative, setNarrative] = useState('')
  const [narrativeHtml, setNarrativeHtml] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [editingNarrative, setEditingNarrative] = useState(false)
  const [genError, setGenError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [savedPath, setSavedPath] = useState<string | null>(null)
  const editorRef = useRef<HTMLDivElement>(null)

  // Session comparison
  const [compareSession, setCompareSession] = useState<{
    fileName: string
    pitchHistory: PitchSample[]
    dbHistory: DecibelSample[]
    comments: FeedbackComment[]
  } | null>(null)
  const [compareError, setCompareError] = useState<string | null>(null)

  async function handleLoadComparison() {
    setCompareError(null)
    const loadFeedback = (window.api as unknown as { loadFeedback?: () => Promise<Record<string, unknown> | null> }).loadFeedback
    if (!loadFeedback) return
    try {
      const data = await loadFeedback()
      if (!data) return
      const pitch = Array.isArray(data.pitchData) ? data.pitchData as PitchSample[] : []
      const db = Array.isArray(data.decibelData) ? data.decibelData as DecibelSample[] : []
      const comments = Array.isArray(data.comments) ? data.comments as FeedbackComment[] : []
      if (pitch.length === 0 && db.length === 0) {
        setCompareError('No audio data found in that file. Load a session JSON (not a CSV).')
        return
      }
      setCompareSession({ fileName: (data.fileName as string) || 'Comparison', pitchHistory: pitch, dbHistory: db, comments })
    } catch {
      setCompareError('Could not read comparison file.')
    }
  }

  function mdToHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>')
  }

  // Sync editor content back to narrativeHtml state (called on blur / Done)
  const syncFromEditor = useCallback(() => {
    if (editorRef.current) setNarrativeHtml(editorRef.current.innerHTML)
  }, [])

  // Keep editor innerHTML in sync when streaming (only while not in manual-edit mode)
  useEffect(() => {
    if (isGenerating && editorRef.current) {
      editorRef.current.innerHTML = mdToHtml(narrative)
    }
  }, [narrative, isGenerating])

  const stats = computeStats(pitchHistory, dbHistory, comments)
  const hasData = pitchHistory.length > 0 || dbHistory.length > 0 || comments.length > 0
  const CHART_W = 520

  async function handleGenerate() {
    if (!apiKey.trim()) {
      setGenError('Enter your Anthropic API key in the AI tab first.')
      return
    }
    setIsGenerating(true)
    setNarrative('')
    setNarrativeHtml('')
    setEditingNarrative(false)
    setGenError(null)

    const systemPrompt = `You are an expert oral advocacy coach. Write a concise, personalized coaching narrative based on the session data. Structure your response with these sections:
**Overview** — 2–3 sentences summarising the session.
**Vocal Delivery** — Analysis of pitch, variability, and voiced/silent time.
**Volume & Dynamics** — Analysis of average volume and dynamic range.
**Professor Feedback** — Synthesise the key themes from the instructor's comments.
**Top 3 Action Items** — Specific, concrete steps the student can take to improve.
Keep the total response under 500 words. Be encouraging but honest.`

    const userPrompt = `Please write a coaching narrative for this session:

File: ${fileName || 'Unnamed recording'}
Duration: ${durationSec > 0 ? `${Math.floor(durationSec/60)}m ${Math.floor(durationSec%60)}s` : 'Unknown'}

Pitch — avg ${stats.avgPitch} Hz, variability σ=${stats.pitchVariability} Hz, voiced ${stats.voicedPct}% of time
Volume — avg ${stats.avgDb} dBFS, dynamic range ${stats.dynamicRange} dB

Vocal Range Distribution:
${RANGE_CONFIG.map(cfg => {
  const count = stats.ranges[cfg.key as keyof typeof stats.ranges]
  const pct = stats.voicedCount > 0 ? Math.round((count / stats.voicedCount) * 100) : 0
  return `  ${cfg.label} (${cfg.range}): ${pct}%`
}).join('\n')}

Instructor Comments (${comments.length} total):
${comments.length > 0
  ? [...comments].sort((a, b) => a.timestamp - b.timestamp).map(c => {
      const mm = Math.floor(c.timestamp / 60)
      const ss = String(Math.floor(c.timestamp % 60)).padStart(2, '0')
      return `  [${mm}:${ss}] (${c.tag}) ${c.text}`
    }).join('\n')
  : '  None recorded.'
}`

    try {
      let full = ''
      await onGenerateNarrative(userPrompt, systemPrompt, token => {
        full += token
        setNarrative(full)
      })
      // Convert final markdown to HTML for the editor
      const html = full.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
        .replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>').replace(/\n/g,'<br>')
      setNarrativeHtml(html)
    } catch (e: unknown) {
      setGenError(e instanceof Error ? e.message : 'Generation failed')
    } finally {
      setIsGenerating(false)
    }
  }

  async function handleExport() {
    setIsSaving(true)
    setSavedPath(null)
    try {
      const html = buildReportHTML(stats, pitchHistory, dbHistory, comments, movementHistory, fileName, durationSec, narrativeHtml || narrative, pitchGraphImage, decibelGraphImage)
      const saveReport = (window.api as unknown as { saveReport?: (h: string) => Promise<string | null> }).saveReport
      if (!saveReport) { console.error('saveReport IPC not available'); return }
      const path = await saveReport(html)
      if (path) setSavedPath(path)
    } catch (e) {
      console.error('Export failed', e)
    } finally {
      setIsSaving(false)
    }
  }

  const dur = durationSec > 0
    ? `${Math.floor(durationSec/60)}m ${Math.floor(durationSec%60)}s` : '—'

  return (
    <div style={{ padding: '16px 18px', overflowY: 'auto', flex: 1 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#0284c7' }}>Session Report</div>
          <div style={{ color: '#64748b', fontSize: 12, marginTop: 2 }}>
            {fileName || 'No file loaded'}{durationSec > 0 ? ` · ${dur}` : ''}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            onClick={handleGenerate}
            disabled={isGenerating || !hasData}
            style={actionBtn(isGenerating || !hasData ? '#94a3b8' : '#0284c7')}
          >
            {isGenerating ? '⏳ Generating…' : '✨ Generate AI Narrative'}
          </button>
          <button
            onClick={handleExport}
            disabled={isSaving || !hasData}
            style={actionBtn(isSaving || !hasData ? '#94a3b8' : '#059669')}
          >
            {isSaving ? 'Saving…' : '⬇ Export PDF / HTML'}
          </button>
        </div>
      </div>

      {/* Status messages */}
      {genError && (
        <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 6, padding: '9px 13px', color: '#dc2626', fontSize: 12, marginBottom: 12 }}>
          {genError}
        </div>
      )}
      {savedPath && (
        <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 6, padding: '9px 13px', color: '#16a34a', fontSize: 12, marginBottom: 12 }}>
          Saved: {savedPath}
        </div>
      )}

      {/* Empty state */}
      {!hasData && (
        <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, padding: 28, textAlign: 'center', color: '#64748b', fontSize: 13 }}>
          Import a video and play it to generate audio data, then add feedback comments to build the session report.
        </div>
      )}

      {hasData && (
        <>
          {/* Scorecard */}
          <Section title="Session Scorecard">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              <StatCard value={`${stats.avgPitch} Hz`} label="Avg Pitch" />
              <StatCard value={`${stats.pitchVariability} Hz`} label="Variability σ" />
              <StatCard value={`${stats.voicedPct}%`} label="Voiced Time" />
              <StatCard value={`${stats.avgDb} dBFS`} label="Avg Volume" />
              <StatCard value={`${stats.dynamicRange} dB`} label="Dynamic Range" />
              <StatCard value={String(stats.commentCount)} label="Comments" />
            </div>
          </Section>

          {pitchHistory.length > 0 && (
            <Section title="Pitch Timeline">
              <PitchTimelineChart pitchHistory={pitchHistory} durationSec={durationSec} width={CHART_W} />
            </Section>
          )}

          {dbHistory.length > 0 && (
            <Section title="Volume Timeline">
              <VolumeTimelineChart dbHistory={dbHistory} durationSec={durationSec} width={CHART_W} />
            </Section>
          )}

          {/* Session Comparison */}
          <Section title="Session Comparison">
            <div style={{ marginBottom: 10, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={handleLoadComparison}
                style={{ fontSize: 11, padding: '5px 12px', borderRadius: 5, border: '1px solid #bae6fd', background: '#f0f9ff', color: '#0284c7', cursor: 'pointer', fontWeight: 600 }}
              >
                {compareSession ? '↩ Load Different Session' : '+ Load Comparison Session'}
              </button>
              {compareSession && (
                <button
                  onClick={() => setCompareSession(null)}
                  style={{ fontSize: 11, padding: '5px 10px', borderRadius: 5, border: '1px solid #fca5a5', background: '#fef2f2', color: '#dc2626', cursor: 'pointer' }}
                >
                  ✕ Clear
                </button>
              )}
              {compareError && <span style={{ fontSize: 11, color: '#dc2626' }}>{compareError}</span>}
            </div>

            {!compareSession && (
              <div style={{ color: '#94a3b8', fontSize: 12, fontStyle: 'italic', padding: '8px 0' }}>
                Load a saved session JSON to compare pitch and volume side-by-side.
              </div>
            )}

            {compareSession && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Stat diff */}
                {(() => {
                  const cs = computeStats(compareSession.pitchHistory, compareSession.dbHistory, compareSession.comments)
                  const diff = (a: number, b: number, unit: string) => {
                    const d = a - b
                    const sign = d > 0 ? '+' : ''
                    const color = Math.abs(d) < 5 ? '#64748b' : d > 0 ? '#16a34a' : '#dc2626'
                    return <span style={{ color, fontSize: 11, fontWeight: 600 }}>{sign}{Math.round(d)}{unit}</span>
                  }
                  return (
                    <div>
                      <div style={{ fontSize: 11, color: '#475569', marginBottom: 6, fontWeight: 700 }}>
                        Current <span style={{ color: '#0284c7' }}>{fileName || 'Session'}</span> vs. <span style={{ color: '#7c3aed' }}>{compareSession.fileName}</span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                        {[
                          { label: 'Avg Pitch', cur: stats.avgPitch, cmp: cs.avgPitch, unit: ' Hz' },
                          { label: 'Variability', cur: stats.pitchVariability, cmp: cs.pitchVariability, unit: ' Hz' },
                          { label: 'Voiced %', cur: stats.voicedPct, cmp: cs.voicedPct, unit: '%' },
                          { label: 'Avg Volume', cur: stats.avgDb, cmp: cs.avgDb, unit: ' dB' },
                          { label: 'Dyn Range', cur: stats.dynamicRange, cmp: cs.dynamicRange, unit: ' dB' },
                          { label: 'Comments', cur: stats.commentCount, cmp: cs.commentCount, unit: '' },
                        ].map(({ label, cur, cmp, unit }) => (
                          <div key={label} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: '8px 10px' }}>
                            <div style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 3 }}>{label}</div>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, flexWrap: 'wrap' }}>
                              <span style={{ fontSize: 13, fontWeight: 700, color: '#0284c7' }}>{cur}{unit}</span>
                              <span style={{ fontSize: 10, color: '#94a3b8' }}>vs {cmp}{unit}</span>
                            </div>
                            <div style={{ marginTop: 2 }}>{diff(cur, cmp, unit)}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })()}

                {/* Overlaid pitch chart */}
                {(pitchHistory.length > 0 || compareSession.pitchHistory.length > 0) && (
                  <div>
                    <div style={{ fontSize: 11, color: '#475569', fontWeight: 600, marginBottom: 6 }}>
                      Pitch — <span style={{ color: '#0284c7' }}>{fileName || 'Current'}</span> vs <span style={{ color: '#7c3aed' }}>{compareSession.fileName}</span>
                    </div>
                    <div style={{ position: 'relative' }}>
                      <PitchTimelineChart pitchHistory={pitchHistory} durationSec={durationSec} width={CHART_W} color="#0284c7" />
                      <div style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', opacity: 0.65 }}>
                        <PitchTimelineChart
                          pitchHistory={compareSession.pitchHistory}
                          durationSec={Math.max(durationSec, compareSession.pitchHistory.length > 0 ? compareSession.pitchHistory[compareSession.pitchHistory.length - 1].t : 0)}
                          width={CHART_W}
                          color="#7c3aed"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Overlaid volume chart */}
                {(dbHistory.length > 0 || compareSession.dbHistory.length > 0) && (
                  <div>
                    <div style={{ fontSize: 11, color: '#475569', fontWeight: 600, marginBottom: 6 }}>
                      Volume — <span style={{ color: '#0284c7' }}>{fileName || 'Current'}</span> vs <span style={{ color: '#7c3aed' }}>{compareSession.fileName}</span>
                    </div>
                    <div style={{ position: 'relative' }}>
                      <VolumeTimelineChart dbHistory={dbHistory} durationSec={durationSec} width={CHART_W} color="#0284c7" />
                      <div style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', opacity: 0.65 }}>
                        <VolumeTimelineChart
                          dbHistory={compareSession.dbHistory}
                          durationSec={Math.max(durationSec, compareSession.dbHistory.length > 0 ? compareSession.dbHistory[compareSession.dbHistory.length - 1].t : 0)}
                          width={CHART_W}
                          color="#7c3aed"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </Section>

          {pitchHistory.length > 0 && (
            <Section title="Vocal Range Distribution">
              <RangeDistChart ranges={stats.ranges} voicedCount={stats.voicedCount} width={CHART_W} />
            </Section>
          )}

          <Section title="Body Movement Timeline">
            <MovementTimelineChart movementHistory={movementHistory} durationSec={durationSec} width={CHART_W} />
          </Section>

          {comments.length > 0 && (
            <Section title="Comment Activity Timeline">
              <CommentTimelineChart comments={comments} durationSec={durationSec} width={CHART_W} />
            </Section>
          )}

          {comments.length > 0 && (
            <Section title="Feedback Tag Breakdown">
              <TagBreakdownChart tagCounts={stats.tagCounts} width={CHART_W} />
            </Section>
          )}

          {comments.length > 0 && (
            <Section title={`All Comments (${comments.length})`}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[...comments].sort((a, b) => a.timestamp - b.timestamp).map(c => {
                  const mm = Math.floor(c.timestamp / 60)
                  const ss = String(Math.floor(c.timestamp % 60)).padStart(2, '0')
                  const color = TAG_COLORS[c.tag] ?? '#64748b'
                  return (
                    <div key={c.id} style={{ background: '#f8fafc', borderLeft: `3px solid ${color}`, borderRadius: '0 6px 6px 0', padding: '8px 12px' }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 3 }}>
                        <span style={{ color, fontWeight: 700, fontSize: 10, textTransform: 'uppercase' }}>{c.tag.replace('_', ' ')}</span>
                        <span style={{ color: '#0284c7', fontFamily: 'monospace', fontSize: 11 }}>{mm}:{ss}</span>
                      </div>
                      <div style={{ color: '#1e293b', fontSize: 13 }}>{c.text}</div>
                    </div>
                  )
                })}
              </div>
            </Section>
          )}

          <Section title="AI Coaching Narrative">
            {(narrative || isGenerating) ? (
              <NarrativeEditor
                html={narrativeHtml}
                isGenerating={isGenerating}
                editingNarrative={editingNarrative}
                editorRef={editorRef}
                onEnterEdit={() => setEditingNarrative(true)}
                onDoneEdit={() => { syncFromEditor(); setEditingNarrative(false) }}
              />
            ) : (
              <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, padding: '20px 16px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                Click "✨ Generate AI Narrative" to get personalised coaching feedback.
              </div>
            )}
          </Section>
        </>
      )}
    </div>
  )
}

// ─── Small helpers ────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8, borderBottom: '1px solid #e0f2fe', paddingBottom: 4 }}>
        {title}
      </div>
      {children}
    </div>
  )
}

function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, padding: '12px 8px', textAlign: 'center' }}>
      <div style={{ fontSize: 18, fontWeight: 700, color: '#0284c7' }}>{value}</div>
      <div style={{ fontSize: 9, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 2 }}>{label}</div>
    </div>
  )
}

// ─── Rich-text narrative editor ───────────────────────────────────────────────

const HIGHLIGHTS = [
  { color: '#fef08a', label: 'Yellow' },
  { color: '#a5f3fc', label: 'Cyan'   },
  { color: '#bbf7d0', label: 'Green'  },
  { color: '#fbcfe8', label: 'Pink'   },
]

interface NarrativeEditorProps {
  html: string
  isGenerating: boolean
  editingNarrative: boolean
  editorRef: React.RefObject<HTMLDivElement>
  onEnterEdit: () => void
  onDoneEdit: () => void
}

function NarrativeEditor({ html, isGenerating, editingNarrative, editorRef, onEnterEdit, onDoneEdit }: NarrativeEditorProps) {
  // Prevent toolbar button clicks from stealing focus from the editor
  function tb(cmd: string, value?: string) {
    return (e: React.MouseEvent) => {
      e.preventDefault()
      editorRef.current?.focus()
      document.execCommand(cmd, false, value)
    }
  }

  function TBtn({ cmd, val, title, children, active }: {
    cmd: string; val?: string; title: string; children: React.ReactNode; active?: boolean
  }) {
    return (
      <button
        onMouseDown={tb(cmd, val)}
        title={title}
        style={{
          background: active ? '#e0f2fe' : 'transparent',
          border: `1px solid ${active ? '#7dd3fc' : '#e2e8f0'}`,
          borderRadius: 4,
          color: '#334155',
          cursor: 'pointer',
          fontSize: 12,
          fontWeight: 600,
          lineHeight: 1,
          padding: '3px 7px',
          minWidth: 26,
        }}
      >{children}</button>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Toolbar — always visible once there is content */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 3, alignItems: 'center',
        background: '#f8fafc', border: '1px solid #e2e8f0',
        borderRadius: '8px 8px 0 0', padding: '5px 8px',
        borderBottom: 'none'
      }}>
        {/* Text style */}
        <TBtn cmd="bold" title="Bold (⌘B)"><strong>B</strong></TBtn>
        <TBtn cmd="italic" title="Italic (⌘I)"><em>I</em></TBtn>
        <TBtn cmd="underline" title="Underline (⌘U)"><u>U</u></TBtn>
        <TBtn cmd="strikeThrough" title="Strikethrough"><s>S</s></TBtn>

        <div style={{ width: 1, height: 18, background: '#e2e8f0', margin: '0 3px' }} />

        {/* Highlight colors */}
        <span style={{ fontSize: 10, color: '#94a3b8', alignSelf: 'center', marginRight: 1 }}>HL</span>
        {HIGHLIGHTS.map(h => (
          <button
            key={h.color}
            onMouseDown={e => { e.preventDefault(); editorRef.current?.focus(); document.execCommand('hiliteColor', false, h.color) }}
            title={`Highlight ${h.label}`}
            style={{
              background: h.color, border: '1px solid #cbd5e1', borderRadius: 3,
              cursor: 'pointer', width: 18, height: 18, padding: 0,
            }}
          />
        ))}
        <button
          onMouseDown={e => { e.preventDefault(); editorRef.current?.focus(); document.execCommand('hiliteColor', false, 'transparent') }}
          title="Remove highlight"
          style={{
            background: 'transparent', border: '1px solid #e2e8f0', borderRadius: 3,
            color: '#94a3b8', cursor: 'pointer', fontSize: 10, padding: '1px 4px', lineHeight: 1.4
          }}
        >✕</button>

        <div style={{ width: 1, height: 18, background: '#e2e8f0', margin: '0 3px' }} />

        {/* Font size */}
        <TBtn cmd="fontSize" val="5" title="Larger text"><span style={{ fontSize: 15 }}>A</span></TBtn>
        <TBtn cmd="fontSize" val="3" title="Normal text"><span style={{ fontSize: 12 }}>A</span></TBtn>
        <TBtn cmd="fontSize" val="1" title="Smaller text"><span style={{ fontSize: 9 }}>A</span></TBtn>

        <div style={{ width: 1, height: 18, background: '#e2e8f0', margin: '0 3px' }} />

        {/* Alignment */}
        <TBtn cmd="justifyLeft" title="Align left">&#8676;</TBtn>
        <TBtn cmd="justifyCenter" title="Center">&#8596;</TBtn>
        <TBtn cmd="justifyRight" title="Align right">&#8677;</TBtn>

        <div style={{ width: 1, height: 18, background: '#e2e8f0', margin: '0 3px' }} />

        {/* Lists */}
        <TBtn cmd="insertUnorderedList" title="Bullet list">&#8226;&#8212;</TBtn>
        <TBtn cmd="insertOrderedList" title="Numbered list">1&#8212;</TBtn>

        <div style={{ width: 1, height: 18, background: '#e2e8f0', margin: '0 3px' }} />

        {/* Clear formatting */}
        <button
          onMouseDown={e => { e.preventDefault(); editorRef.current?.focus(); document.execCommand('removeFormat') }}
          title="Remove all formatting from selection"
          style={{
            background: 'transparent', border: '1px solid #e2e8f0', borderRadius: 4,
            color: '#64748b', cursor: 'pointer', fontSize: 10, padding: '3px 7px'
          }}
        >Clear fmt</button>

        <div style={{ flex: 1 }} />

        {/* Edit / Done toggle */}
        {!isGenerating && (
          editingNarrative ? (
            <button
              onMouseDown={e => { e.preventDefault(); onDoneEdit() }}
              style={{ background: '#0284c7', border: 'none', borderRadius: 5, color: '#fff', cursor: 'pointer', fontSize: 11, fontWeight: 600, padding: '4px 10px' }}
            >✓ Done</button>
          ) : (
            <button
              onClick={onEnterEdit}
              style={{ background: '#fff', border: '1px solid #bae6fd', borderRadius: 5, color: '#0284c7', cursor: 'pointer', fontSize: 11, fontWeight: 600, padding: '4px 10px' }}
            >✎ Edit</button>
          )
        )}
      </div>

      {/* Editor body */}
      <div
        ref={editorRef}
        contentEditable={editingNarrative && !isGenerating}
        suppressContentEditableWarning
        onBlur={editingNarrative ? onDoneEdit : undefined}
        dangerouslySetInnerHTML={!editingNarrative ? { __html: html + (isGenerating ? '<span style="color:#0284c7">▌</span>' : '') } : undefined}
        style={{
          background: '#f0f9ff',
          border: '1px solid #bae6fd',
          borderRadius: '0 0 8px 8px',
          color: '#1e293b',
          fontSize: 13,
          lineHeight: 1.8,
          minHeight: 120,
          outline: editingNarrative ? '2px solid #7dd3fc' : 'none',
          outlineOffset: -2,
          padding: 16,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          cursor: editingNarrative ? 'text' : 'default',
        }}
      />
    </div>
  )
}

function actionBtn(bg: string): React.CSSProperties {
  return {
    background: bg,
    border: 'none',
    borderRadius: 6,
    color: '#fff',
    cursor: bg === '#94a3b8' ? 'default' : 'pointer',
    fontSize: 12,
    fontWeight: 600,
    padding: '7px 14px',
    whiteSpace: 'nowrap'
  }
}
