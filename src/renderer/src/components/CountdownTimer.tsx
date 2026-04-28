import React, { useCallback, useEffect, useRef, useState } from 'react'

const PRESETS: Array<{ label: string; seconds: number }> = [
  { label: 'Custom',           seconds: 0    },
  { label: '1:00',             seconds: 60   },
  { label: '2:00',             seconds: 120  },
  { label: '3:00  CX / Q&A',  seconds: 180  },
  { label: '4:00  LD 1AR',     seconds: 240  },
  { label: '5:00  Rebuttal',   seconds: 300  },
  { label: '6:00  LD AC',      seconds: 360  },
  { label: '7:00  LD NC',      seconds: 420  },
  { label: '8:00  Policy',     seconds: 480  },
  { label: '10:00',            seconds: 600  },
  { label: '15:00',            seconds: 900  },
  { label: '20:00',            seconds: 1200 },
  { label: '30:00',            seconds: 1800 },
]

function playBeep(ctx: AudioContext, freq: number, dur: number, vol = 0.5) {
  const osc = ctx.createOscillator()
  const g   = ctx.createGain()
  osc.connect(g); g.connect(ctx.destination)
  osc.frequency.value = freq
  g.gain.setValueAtTime(vol, ctx.currentTime)
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur)
  osc.start(); osc.stop(ctx.currentTime + dur)
}

export function CountdownTimer() {
  const [presetIdx, setPresetIdx] = useState(4)
  const [totalSec, setTotalSec]   = useState(PRESETS[4].seconds)
  const [remaining, setRemaining] = useState(PRESETS[4].seconds)
  const [running, setRunning]     = useState(false)
  const [done, setDone]           = useState(false)
  const [customMin, setCustomMin] = useState(5)
  const [customSec, setCustomSecState] = useState(0)

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const remainRef   = useRef(remaining)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const warned30Ref = useRef(false)

  useEffect(() => { remainRef.current = remaining }, [remaining])

  function getCtx() {
    if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') audioCtxRef.current = new AudioContext()
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
        playBeep(getCtx(), 880, 0.2, 0.4)
      }
      if (next <= 0) {
        const ctx = getCtx()
        playBeep(ctx, 1047, 0.12, 0.6)
        setTimeout(() => playBeep(ctx, 1047, 0.12, 0.6), 180)
        setTimeout(() => playBeep(ctx, 1047, 0.28, 0.8), 360)
        if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
        setRunning(false)
        setDone(true)
      }
    }, 1000)
  }, [])

  const toggle = useCallback(() => { if (running) stop(); else start() }, [running, start, stop])

  const reset = useCallback(() => {
    stop()
    setRemaining(totalSec)
    remainRef.current = totalSec
    warned30Ref.current = false
    setDone(false)
  }, [stop, totalSec])

  function applyPreset(idx: number) {
    stop(); setDone(false); warned30Ref.current = false
    setPresetIdx(idx)
    const p = PRESETS[idx]
    if (p.seconds > 0) {
      setTotalSec(p.seconds); setRemaining(p.seconds); remainRef.current = p.seconds
    }
  }

  function applyCustom(min: number, sec: number) {
    const v = Math.max(1, min * 60 + Math.min(59, sec))
    setTotalSec(v); setRemaining(v); remainRef.current = v
    warned30Ref.current = false; setDone(false)
  }

  useEffect(() => () => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    audioCtxRef.current?.close()
  }, [])

  const isCustom = PRESETS[presetIdx].seconds === 0
  const mins = Math.floor(remaining / 60)
  const secs = remaining % 60
  const urgent = remaining <= 30 && remaining > 0 && running

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '7px 10px', marginBottom: 6 }}>

      <span style={{ color: '#94a3b8', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, flexShrink: 0 }}>Timer</span>

      <select
        value={presetIdx}
        onChange={e => applyPreset(Number(e.target.value))}
        disabled={running}
        style={{ border: '1px solid #cbd5e1', borderRadius: 4, color: '#334155', fontSize: 11, padding: '3px 4px', cursor: running ? 'default' : 'pointer', background: '#fff', opacity: running ? 0.5 : 1 }}
      >
        {PRESETS.map((p, i) => <option key={i} value={i}>{p.label}</option>)}
      </select>

      {/* Custom MM:SS inputs */}
      {isCustom && !running && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <input type="number" min={0} max={99} value={customMin}
            onChange={e => { const v = Number(e.target.value); setCustomMin(v); applyCustom(v, customSec) }}
            style={numIn} />
          <span style={{ color: '#475569', fontWeight: 700 }}>:</span>
          <input type="number" min={0} max={59} value={customSec}
            onChange={e => { const v = Math.min(59, Number(e.target.value)); setCustomSecState(v); applyCustom(customMin, v) }}
            style={numIn} />
        </div>
      )}

      {/* Countdown display */}
      <span style={{
        fontFamily: 'monospace', fontWeight: 800, fontSize: 20, letterSpacing: 1, minWidth: 54, textAlign: 'center',
        color: done ? '#dc2626' : urgent ? '#ea580c' : '#0f172a'
      }}>
        {done ? 'TIME' : `${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`}
      </span>

      <button onClick={toggle} disabled={remaining <= 0 && !running} style={{
        background: running ? '#fef2f2' : '#f0fdf4',
        border: `1px solid ${running ? '#fca5a5' : '#86efac'}`,
        borderRadius: 5, color: running ? '#dc2626' : '#16a34a',
        cursor: 'pointer', fontSize: 11, fontWeight: 700, padding: '4px 10px', minWidth: 56,
        opacity: remaining <= 0 && !running ? 0.35 : 1
      }}>
        {running ? '⏸ Pause' : '▶ Start'}
      </button>

      <button onClick={reset} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 5, color: '#64748b', cursor: 'pointer', fontSize: 11, fontWeight: 700, padding: '4px 9px' }}>
        ↺
      </button>

      {urgent && <span style={{ color: '#ea580c', fontSize: 10, fontWeight: 700 }}>⚠ 30s</span>}
    </div>
  )
}

const numIn: React.CSSProperties = {
  width: 38, border: '1px solid #cbd5e1', borderRadius: 4,
  color: '#0f172a', fontSize: 13, fontWeight: 700, textAlign: 'center',
  padding: '2px 0', outline: 'none', background: '#fff'
}
