import React from 'react'
import { useMetronome } from '../hooks/useMetronome'

const DENOMINATORS = [2, 4, 8, 16, 32]

export function Metronome() {
  const {
    bpm, setBpm,
    numerator, setNumerator,
    denominator, setDenominator,
    isPlaying, currentBeat,
    muted, toggleMute,
    toggle, tap
  } = useMetronome()

  const showDots = numerator <= 20

  return (
    <div style={wrap}>
      <span style={label}>Metronome</span>

      {/* Time signature */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', border: '1px solid #cbd5e1', borderRadius: 5, overflow: 'hidden', userSelect: 'none' }}>
        {[
          { val: numerator,   up: () => setNumerator(numerator + 1),   dn: () => setNumerator(numerator - 1),   color: '#0f172a' },
          { val: denominator, up: () => setDenominator(DENOMINATORS[Math.min(DENOMINATORS.length-1, DENOMINATORS.indexOf(denominator)+1)]),
                              dn: () => setDenominator(DENOMINATORS[Math.max(0, DENOMINATORS.indexOf(denominator)-1)]),
                              color: '#64748b' }
        ].map((row, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', borderTop: i > 0 ? '1px solid #e2e8f0' : undefined }}>
            <button onClick={row.dn} style={sigBtn}>−</button>
            <span style={{ fontSize: 13, fontWeight: 700, color: row.color, width: 22, textAlign: 'center' }}>{row.val}</span>
            <button onClick={row.up} style={sigBtn}>+</button>
          </div>
        ))}
      </div>

      {/* BPM */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
        <button onClick={() => setBpm(bpm - 1)} style={adjBtn}>−</button>
        <input
          type="number" value={bpm} min={20} max={400}
          onChange={e => setBpm(Number(e.target.value))}
          style={{ width: 48, border: '1px solid #cbd5e1', borderRadius: 4, color: '#0f172a', fontSize: 15, fontWeight: 700, textAlign: 'center', padding: '2px 0', outline: 'none', background: '#fff' }}
        />
        <button onClick={() => setBpm(bpm + 1)} style={adjBtn}>+</button>
        <span style={{ color: '#94a3b8', fontSize: 9 }}>BPM</span>
      </div>

      {/* Tap */}
      <button onClick={tap} style={{ ...pill, background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}>Tap</button>

      {/* Start/Stop */}
      <button onClick={toggle} style={{ ...pill, background: isPlaying ? '#fef2f2' : '#f0fdf4', color: isPlaying ? '#dc2626' : '#16a34a', border: `1px solid ${isPlaying ? '#fca5a5' : '#86efac'}`, minWidth: 56 }}>
        {isPlaying ? '⏹ Stop' : '▶ Start'}
      </button>

      {/* Mute */}
      <button onClick={toggleMute} title={muted ? 'Unmute' : 'Mute'} style={{ ...pill, background: muted ? '#fef9c3' : '#f8fafc', color: muted ? '#854d0e' : '#64748b', border: `1px solid ${muted ? '#fde047' : '#e2e8f0'}` }}>
        {muted ? '🔇' : '🔊'}
      </button>

      {/* Beat dots */}
      {isPlaying && (
        showDots ? (
          <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap', maxWidth: 160 }}>
            {Array.from({ length: numerator }, (_, i) => {
              const isDown = i === 0
              const active = currentBeat === i
              return (
                <div key={i} style={{
                  width: isDown ? 13 : 9,
                  height: isDown ? 13 : 9,
                  borderRadius: '50%',
                  background: active ? (isDown ? '#0284c7' : '#38bdf8') : '#e2e8f0',
                  border: `2px solid ${active ? (isDown ? '#0284c7' : '#38bdf8') : '#cbd5e1'}`,
                  transition: 'background 0.05s, border-color 0.05s',
                  flexShrink: 0
                }} />
              )
            })}
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
            <span style={{ color: '#0284c7', fontSize: 18, fontWeight: 800, fontVariantNumeric: 'tabular-nums', minWidth: 26, textAlign: 'right' }}>
              {currentBeat >= 0 ? currentBeat + 1 : '–'}
            </span>
            <span style={{ color: '#94a3b8', fontSize: 11 }}>/{numerator}</span>
          </div>
        )
      )}
    </div>
  )
}

const wrap: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap',
  background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8,
  padding: '7px 10px', marginBottom: 6
}
const label: React.CSSProperties = {
  color: '#94a3b8', fontSize: 10, fontWeight: 700,
  textTransform: 'uppercase', letterSpacing: 0.5, flexShrink: 0
}
const sigBtn: React.CSSProperties = {
  background: 'none', border: 'none', color: '#94a3b8',
  cursor: 'pointer', fontSize: 11, fontWeight: 700, padding: '1px 5px', lineHeight: 1
}
const adjBtn: React.CSSProperties = {
  background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 4,
  color: '#475569', cursor: 'pointer', fontSize: 13, fontWeight: 700,
  padding: '1px 7px', lineHeight: 1.4
}
const pill: React.CSSProperties = {
  border: 'none', borderRadius: 5, cursor: 'pointer',
  fontSize: 11, fontWeight: 700, padding: '4px 10px'
}
