import { useCallback, useEffect, useRef, useState } from 'react'

const LOOKAHEAD = 0.1   // seconds to schedule ahead of AudioContext clock
const TICK_MS   = 25    // scheduler polling interval (ms)

export function useMetronome() {
  const [bpm, setBpmState] = useState<number>(() => {
    const v = Number(localStorage.getItem('mm_metro_bpm'))
    return Number.isFinite(v) && v >= 20 && v <= 400 ? v : 100
  })
  // Numerator: how many clicks per measure (1–64)
  const [numerator, setNumeratorState] = useState<number>(() => {
    const v = Number(localStorage.getItem('mm_metro_numerator'))
    return Number.isFinite(v) && v >= 1 && v <= 64 ? v : 4
  })
  // Denominator: note value of the beat (2, 4, 8, 16, 32)
  const [denominator, setDenominatorState] = useState<number>(() => {
    const v = Number(localStorage.getItem('mm_metro_denominator'))
    return [2, 4, 8, 16, 32].includes(v) ? v : 4
  })
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentBeat, setCurrentBeat] = useState(-1)
  const [muted, setMuted] = useState(false)

  const ctxRef       = useRef<AudioContext | null>(null)
  const intervalRef  = useRef<ReturnType<typeof setInterval> | null>(null)
  const nextTimeRef  = useRef(0)
  const nextBeatRef  = useRef(0)
  const bpmRef       = useRef(bpm)
  const numRef       = useRef(numerator)
  const mutedRef     = useRef(false)
  const tapTimesRef  = useRef<number[]>([])

  useEffect(() => { bpmRef.current = bpm }, [bpm])
  useEffect(() => { numRef.current = numerator }, [numerator])
  useEffect(() => { mutedRef.current = muted }, [muted])

  function scheduleClick(time: number, beat: number) {
    const ctx = ctxRef.current!
    const downbeat = beat === 0
    const osc  = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = downbeat ? 1500 : 900
    const vol = mutedRef.current ? 0.0001 : (downbeat ? 0.9 : 0.6)
    gain.gain.setValueAtTime(vol, time)
    gain.gain.exponentialRampToValueAtTime(0.0001, time + (downbeat ? 0.06 : 0.04))
    osc.start(time)
    osc.stop(time + 0.08)
    const delay = Math.max(0, (time - ctx.currentTime) * 1000)
    setTimeout(() => setCurrentBeat(beat), delay)
  }

  function scheduler() {
    const ctx = ctxRef.current
    if (!ctx) return
    while (nextTimeRef.current < ctx.currentTime + LOOKAHEAD) {
      scheduleClick(nextTimeRef.current, nextBeatRef.current)
      nextTimeRef.current += 60 / bpmRef.current
      nextBeatRef.current  = (nextBeatRef.current + 1) % numRef.current
    }
  }

  const start = useCallback(() => {
    if (!ctxRef.current || ctxRef.current.state === 'closed') {
      ctxRef.current = new AudioContext()
    }
    const ctx = ctxRef.current
    if (ctx.state === 'suspended') ctx.resume()
    nextTimeRef.current = ctx.currentTime + 0.05
    nextBeatRef.current = 0
    setCurrentBeat(-1)
    setIsPlaying(true)
    intervalRef.current = setInterval(scheduler, TICK_MS)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const stop = useCallback(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
    setIsPlaying(false)
    setCurrentBeat(-1)
  }, [])

  const toggle = useCallback(() => {
    if (intervalRef.current) stop()
    else start()
  }, [stop, start])

  const setBpm = useCallback((raw: number) => {
    const v = Math.max(20, Math.min(400, Math.round(raw)))
    if (!Number.isFinite(v)) return
    setBpmState(v)
    localStorage.setItem('mm_metro_bpm', String(v))
  }, [])

  const setNumerator = useCallback((raw: number) => {
    const v = Math.max(1, Math.min(64, Math.round(raw)))
    if (!Number.isFinite(v)) return
    setNumeratorState(v)
    nextBeatRef.current = 0
    localStorage.setItem('mm_metro_numerator', String(v))
  }, [])

  const setDenominator = useCallback((v: number) => {
    setDenominatorState(v)
    localStorage.setItem('mm_metro_denominator', String(v))
  }, [])

  const tap = useCallback(() => {
    const now = performance.now()
    const kept = tapTimesRef.current.filter(t => now - t < 3000)
    kept.push(now)
    tapTimesRef.current = kept.slice(-8)
    if (kept.length >= 2) {
      const gaps = kept.slice(1).map((t, i) => t - kept[i])
      setBpm(Math.round(60000 / (gaps.reduce((a, b) => a + b) / gaps.length)))
    }
  }, [setBpm])

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      ctxRef.current?.close()
    }
  }, [])

  const toggleMute = useCallback(() => setMuted(v => !v), [])

  return { bpm, setBpm, numerator, setNumerator, denominator, setDenominator, isPlaying, currentBeat, muted, toggleMute, toggle, tap }
}
