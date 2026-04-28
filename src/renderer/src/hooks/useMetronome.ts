import { useCallback, useEffect, useRef, useState } from 'react'

const LOOKAHEAD = 0.1   // seconds to schedule ahead of AudioContext clock
const TICK_MS   = 25    // scheduler polling interval (ms)

export function useMetronome() {
  const [bpm, setBpmState] = useState<number>(() => {
    const v = Number(localStorage.getItem('mm_metro_bpm'))
    return Number.isFinite(v) && v >= 20 && v <= 280 ? v : 100
  })
  const [beatsPerMeasure, setBeatsState] = useState<number>(() => {
    const v = Number(localStorage.getItem('mm_metro_beats'))
    return [2, 3, 4, 6].includes(v) ? v : 4
  })
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentBeat, setCurrentBeat] = useState(-1)

  const ctxRef        = useRef<AudioContext | null>(null)
  const intervalRef   = useRef<ReturnType<typeof setInterval> | null>(null)
  const nextTimeRef   = useRef(0)
  const nextBeatRef   = useRef(0)
  const bpmRef        = useRef(bpm)
  const beatsRef      = useRef(beatsPerMeasure)
  const tapTimesRef   = useRef<number[]>([])

  useEffect(() => { bpmRef.current = bpm }, [bpm])
  useEffect(() => { beatsRef.current = beatsPerMeasure }, [beatsPerMeasure])

  function scheduleClick(time: number, beat: number) {
    const ctx = ctxRef.current!
    const downbeat = beat === 0
    const osc  = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = downbeat ? 1500 : 900
    gain.gain.setValueAtTime(downbeat ? 0.9 : 0.6, time)
    gain.gain.exponentialRampToValueAtTime(0.001, time + (downbeat ? 0.06 : 0.04))
    osc.start(time)
    osc.stop(time + 0.08)

    // Fire visual update when this beat actually plays
    const delay = Math.max(0, (time - ctx.currentTime) * 1000)
    setTimeout(() => setCurrentBeat(beat), delay)
  }

  function scheduler() {
    const ctx = ctxRef.current
    if (!ctx) return
    while (nextTimeRef.current < ctx.currentTime + LOOKAHEAD) {
      scheduleClick(nextTimeRef.current, nextBeatRef.current)
      nextTimeRef.current += 60 / bpmRef.current
      nextBeatRef.current  = (nextBeatRef.current + 1) % beatsRef.current
    }
  }

  const start = useCallback(() => {
    if (!ctxRef.current || ctxRef.current.state === 'closed') {
      ctxRef.current = new AudioContext()
    }
    const ctx = ctxRef.current
    if (ctx.state === 'suspended') ctx.resume()
    nextTimeRef.current  = ctx.currentTime + 0.05
    nextBeatRef.current  = 0
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
    const v = Math.max(20, Math.min(280, Math.round(raw)))
    if (!Number.isFinite(v)) return
    setBpmState(v)
    localStorage.setItem('mm_metro_bpm', String(v))
  }, [])

  const setBeats = useCallback((v: number) => {
    setBeatsState(v)
    localStorage.setItem('mm_metro_beats', String(v))
    nextBeatRef.current = 0 // reset beat count when signature changes
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

  return { bpm, setBpm, beatsPerMeasure, setBeats, isPlaying, currentBeat, toggle, tap }
}
