import React from 'react'
import { useMetronome } from '../hooks/useMetronome'

interface Props {
  width?: number
}

export function Metronome({ width = 560 }: Props) {
  const { bpm, setBpm, beatsPerMeasure, setBeats, isPlaying, currentBeat, toggle, tap } = useMetronome()

  return (
    <div style={{ width, background: '#0f172a', borderRadius: 8, padding: '9px 14px', marginTop: 6, boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>

        <span style={{ color: '#475569', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, flexShrink: 0 }}>
          Metronome
        </span>

        {/* Time signature */}
        <select
          value={beatsPerMeasure}
          onChange={e => setBeats(Number(e.target.value))}
          style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 4, color: '#94a3b8', fontSize: 11, padding: '3px 5px', cursor: 'pointer' }}
        >
          {[2, 3, 4, 6].map(b => <option key={b} value={b}>{b}/4</option>)}
        </select>

        {/* BPM */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <button onClick={() => setBpm(bpm - 1)} style={adjBtn}>−</button>
          <input
            type="number"
            value={bpm}
            min={20} max={280}
            onChange={e => setBpm(Number(e.target.value))}
            style={{ width: 50, background: '#1e293b', border: '1px solid #334155', borderRadius: 4, color: '#e2e8f0', fontSize: 16, fontWeight: 700, textAlign: 'center', padding: '1px 0', outline: 'none' }}
          />
          <button onClick={() => setBpm(bpm + 1)} style={adjBtn}>+</button>
          <span style={{ color: '#475569', fontSize: 9, marginLeft: 1 }}>BPM</span>
        </div>

        {/* Tap tempo */}
        <button
          onClick={tap}
          title="Tap to set tempo"
          style={{ background: '#1e3a5f', border: '1px solid #1d4ed8', borderRadius: 5, color: '#93c5fd', cursor: 'pointer', fontSize: 11, fontWeight: 700, padding: '4px 10px' }}
        >
          Tap
        </button>

        {/* Start / Stop */}
        <button
          onClick={toggle}
          style={{
            background: isPlaying ? '#7f1d1d' : '#14532d',
            border: 'none',
            borderRadius: 5,
            color: isPlaying ? '#fca5a5' : '#86efac',
            cursor: 'pointer',
            fontSize: 11,
            fontWeight: 700,
            padding: '4px 12px',
            minWidth: 58
          }}
        >
          {isPlaying ? '⏹ Stop' : '▶ Start'}
        </button>

        {/* Beat indicator dots */}
        <div style={{ display: 'flex', gap: 5, marginLeft: 2, alignItems: 'center' }}>
          {Array.from({ length: beatsPerMeasure }, (_, i) => {
            const isDown = i === 0
            const active = isPlaying && currentBeat === i
            return (
              <div
                key={i}
                style={{
                  width:  isDown ? 13 : 9,
                  height: isDown ? 13 : 9,
                  borderRadius: '50%',
                  background: active ? (isDown ? '#38bdf8' : '#7dd3fc') : '#1e293b',
                  border: `1.5px solid ${isDown ? '#0284c7' : '#334155'}`,
                  transition: 'background 0.05s',
                  flexShrink: 0
                }}
              />
            )
          })}
        </div>

      </div>
    </div>
  )
}

const adjBtn: React.CSSProperties = {
  background: '#1e293b',
  border: '1px solid #334155',
  borderRadius: 4,
  color: '#94a3b8',
  cursor: 'pointer',
  fontSize: 14,
  fontWeight: 700,
  padding: '1px 8px',
  lineHeight: 1.4
}
