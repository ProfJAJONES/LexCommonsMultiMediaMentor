import React, { useCallback, useEffect, useRef, useState } from 'react'

interface Props {
  width?: number
}

const PRESETS: Array<{ label: string; seconds: number }> = [
  { label: 'Custom',            seconds: 300  },
  { label: '1:00',              seconds: 60   },
  { label: '2:00',              seconds: 120  },
  { label: '3:00  CX / Q&A',   seconds: 180  },
  { label: '4:00  LD 1AR',      seconds: 240  },
  { label: '5:00  Rebuttal',    seconds: 300  },
  { label: '6:00  LD AC',       seconds: 360  },
  { label: '7:00  LD NC',       seconds: 420  },
  { label: '8:00  Policy',      seconds: 480  },
  { label: '10:00',             seconds: 600  },
  { label: '15:00',             seconds: 900  },
  { label: '20:00',             seconds: 1200 },
  { label: '30:00',             seconds: 1800 },
]

function playBeep(ctx: AudioContext, freq: number, durationSec: number, gain = 0.5) {
  const osc  = ctx.createOscillator()
  const g    = ctx.createGain()
  osc.connect(g); g.connect(ctx.destination)
  osc.frequency.value = freq
  g.gain.setValueAtTime(gain, ctx.currentTime)
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durationSec)
  osc.start(); osc.stop(ctx.currentTime + durationSec)
}

export function CountdownTimer({ width = 560 }: Props) {
  const [presetIdx, setPresetIdx] = useState(4)            // 5:00 default
  const [totalSec, setTotalSec]   = useState(PRESETS[4].seconds)
  const [remaining, setRemaining] = useState(PRESETS[4].seconds)
  const [running, setRunning]     = useState(false)
  const [done, setDone]           = useState(false)

  // Custom time editing (only shown when Custom preset is selected and timer is stopped)
  const [customMin, setCustomMin] = useState(5)
  const [customSec, setCustomSecState] = useState(0)

  const intervalRef  = useRef<ReturnType<typeof setInterval> | null>(null)
  const remainRef    = useRef(remaining)
  const audioCtxRef  = useRef<AudioContext | null>(null)
  const warned30Ref  = useRef(false)

  useEffect(() => { remainRef.current = remaining }, [remaining])

  function getCtx() {
    if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
      audioCtxRef.current = new AudioContext()
    }
    if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume()
    return audioCtxRef.current
  }

  const stop = useCallback(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
    setRunning(false)
  }, [])

  const start = useCallback(() => {
    if (remainRef.current <= 0) return
    warned30Ref.current = remainRef.current <= 30
    setDone(false)
    setRunning(true)
    intervalRef.current = setInterval(() => {
      const next = remainRef.current - 1
      remainRef.current = next
      setRemaining(next)
      if (next === 30 && !warned30Ref.current) {
        warned30Ref.current = true
        playBeep(getCtx(), 880, 0.25, 0.4)
      }
      if (next <= 0) {
        // End signal: three short beeps
        const ctx = getCtx()
        playBeep(ctx, 1047, 0.15, 0.6)
        setTimeout(() => playBeep(ctx, 1047, 0.15, 0.6), 200)
        setTimeout(() => playBeep(ctx, 1047, 0.3,  0.8), 400)
        if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
        setRunning(false)
        setDone(true)
      }
    }, 1000)
  }, [])

  const toggle = useCallback(() => {
    if (running) stop()
    else start()
  }, [running, start, stop])

  const reset = useCallback(() => {
    stop()
    setRemaining(totalSec)
    remainRef.current = totalSec
    warned30Ref.current = false
    setDone(false)
  }, [stop, totalSec])

  function applyPreset(idx: number) {
    const p = PRESETS[idx]
    setPresetIdx(idx)
    stop()
    setDone(false)
    warned30Ref.current = false
    if (p.seconds !== 0) {
      setTotalSec(p.seconds)
      setRemaining(p.seconds)
      remainRef.current = p.seconds
    }
  }

  function applyCustom(min: number, sec: number) {
    const clamped = Math.max(1, min * 60 + sec)
    setTotalSec(clamped)
    setRemaining(clamped)
    remainRef.current = clamped
    warned30Ref.current = false
    setDone(false)
  }

  useEffect(() => () => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    audioCtxRef.current?.close()
  }, [])

  const isCustom = PRESETS[presetIdx].seconds === 300 && presetIdx === 0
  const mins = Math.floor(remaining / 60)
  const secs = remaining % 60
  const urgent = remaining <= 30 && remaining > 0
  const displayColor = done ? '#f87171' : urgent ? '#fb923c' : '#e2e8f0'

  return (
    <div style={{ width, background: '#0f172a', borderRadius: 8, padding: '9px 14px', marginTop: 6, boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>

        <span style={{ color: '#475569', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, flexShrink: 0 }}>
          Timer
        </span>

        {/* Preset selector */}
        <select
          value={presetIdx}
          onChange={e => applyPreset(Number(e.target.value))}
          disabled={running}
          style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 4, color: '#94a3b8', fontSize: 11, padding: '3px 5px', cursor: running ? 'default' : 'pointer', opacity: running ? 0.5 : 1 }}
        >
          {PRESETS.map((p, i) => (
            <option key={i} value={i}>{p.label}</option>
          ))}
        </select>

        {/* Custom time inputs — only when Custom is selected and stopped */}
        {isCustom && !running && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <input
              type="number" min={0} max={99}
              value={customMin}
              onChange={e => { const v = Number(e.target.value); setCustomMin(v); applyCustom(v, customSec) }}
              style={numInput}
            />
            <span style={{ color: '#475569', fontWeight: 700 }}>:</span>
            <input
              type="number" min={0} max={59}
              value={customSec}
              onChange={e => { const v = Math.min(59, Number(e.target.value)); setCustomSecState(v); applyCustom(customMin, v) }}
              style={numInput}
            />
          </div>
        )}

        {/* Countdown display */}
        <span style={{
          fontFamily: 'monospace', fontWeight: 800, fontSize: 22,
          color: displayColor, letterSpacing: 2, minWidth: 60, textAlign: 'center',
          animation: done ? 'blink 0.6s step-end infinite' : undefined
        }}>
          {done ? 'TIME' : `${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`}
        </span>

        {/* Start / Stop */}
        <button
          onClick={toggle}
          disabled={remaining <= 0 && !running}
          style={{
            background: running ? '#7f1d1d' : '#14532d',
            border: 'none', borderRadius: 5,
            color: running ? '#fca5a5' : '#86efac',
            cursor: 'pointer', fontSize: 11, fontWeight: 700,
            padding: '4px 12px', minWidth: 58,
            opacity: (remaining <= 0 && !running) ? 0.4 : 1
          }}
        >
          {running ? '⏸ Pause' : '▶ Start'}
        </button>

        {/* Reset */}
        <button
          onClick={reset}
          style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 5, color: '#64748b', cursor: 'pointer', fontSize: 11, fontWeight: 700, padding: '4px 10px' }}
        >
          ↺ Reset
        </button>

        {/* Warning indicator */}
        {urgent && running && (
          <span style={{ color: '#fb923c', fontSize: 10, fontWeight: 700 }}>⚠ 30s</span>
        )}

      </div>
    </div>
  )
}

const numInput: React.CSSProperties = {
  width: 40, background: '#1e293b', border: '1px solid #334155',
  borderRadius: 4, color: '#e2e8f0', fontSize: 14, fontWeight: 700,
  textAlign: 'center', padding: '1px 0', outline: 'none'
}
