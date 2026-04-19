import { useRef, useState, useCallback, useEffect } from 'react'
import type { PitchSample, DecibelSample, AudioAnalysisState } from '../types'

const FFT_SIZE = 2048
const SAMPLE_INTERVAL_MS = 100  // 10 samples/sec
const EMA_ALPHA = 0.3           // smoothing factor

function rmsToDb(rms: number): number {
  if (rms === 0) return -Infinity
  return 20 * Math.log10(rms)
}

// YIN pitch detection algorithm (de Cheveigné & Kawahara, 2002)
function detectPitchYIN(buffer: Float32Array, sampleRate: number): number {
  const bufLen = buffer.length
  const halfLen = Math.floor(bufLen / 2)

  const diff = new Float32Array(halfLen)
  for (let tau = 1; tau < halfLen; tau++) {
    let sum = 0
    for (let j = 0; j < halfLen; j++) {
      const delta = buffer[j] - buffer[j + tau]
      sum += delta * delta
    }
    diff[tau] = sum
  }

  const cmndf = new Float32Array(halfLen)
  cmndf[0] = 1
  let runningSum = 0
  for (let tau = 1; tau < halfLen; tau++) {
    runningSum += diff[tau]
    cmndf[tau] = runningSum === 0 ? 0 : diff[tau] * tau / runningSum
  }

  const threshold = 0.15
  const minFreq = 60
  const maxFreq = 500
  const minTau = Math.floor(sampleRate / maxFreq)
  const maxTau = Math.ceil(sampleRate / minFreq)

  let tau = minTau
  while (tau < maxTau && tau < halfLen - 1) {
    if (cmndf[tau] < threshold) {
      const prev = cmndf[tau - 1] ?? cmndf[tau]
      const next = cmndf[tau + 1] ?? cmndf[tau]
      const denom = 2 * (2 * cmndf[tau] - prev - next)
      const refinedTau = denom === 0 ? tau : tau + (next - prev) / denom
      return sampleRate / refinedTau
    }
    tau++
  }

  let minVal = Infinity
  let minIdx = -1
  for (let i = minTau; i < Math.min(maxTau, halfLen - 1); i++) {
    if (cmndf[i] < minVal) { minVal = cmndf[i]; minIdx = i }
  }
  if (minIdx === -1 || minVal > 0.5) return 0
  return sampleRate / minIdx
}

export function useAudioAnalysis(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  /** When provided, analyzes this stream instead of the video element */
  externalStream?: MediaStream | null
) {
  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const destNodeRef = useRef<MediaStreamAudioDestinationNode | null>(null)
  const videoSrcRef = useRef<MediaElementAudioSourceNode | null>(null)
  const streamSrcRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const rafRef = useRef<number | null>(null)
  const lastSampleRef = useRef<number>(0)
  const smoothedPitchRef = useRef<number>(0)
  const isRunningRef = useRef(false)

  const [state, setState] = useState<AudioAnalysisState>({
    isAnalyzing: false,
    currentPitch: 0,
    currentDb: -Infinity,
    pitchHistory: [],
    dbHistory: []
  })

  // Ensure AudioContext and analyser exist — throws if AudioContext can't be created
  function ensureCtx() {
    if (!audioCtxRef.current) {
      try {
        audioCtxRef.current = new AudioContext()
      } catch (e) {
        throw new Error(`AudioContext unavailable: ${e instanceof Error ? e.message : e}`)
      }
    }
    const ctx = audioCtxRef.current
    if (!analyserRef.current) {
      const analyser = ctx.createAnalyser()
      analyser.fftSize = FFT_SIZE
      analyser.smoothingTimeConstant = 0.1
      analyser.connect(ctx.destination)
      // Also route to a MediaStream so callers can feed it to a screen recorder
      destNodeRef.current = ctx.createMediaStreamDestination()
      analyser.connect(destNodeRef.current)
      analyserRef.current = analyser
    }
    return { ctx, analyser: analyserRef.current }
  }

  function disconnectAll() {
    try { videoSrcRef.current?.disconnect() } catch { /* ok */ }
    try { streamSrcRef.current?.disconnect() } catch { /* ok */ }
  }

  function connectVideoSource(ctx: AudioContext, analyser: AnalyserNode) {
    const video = videoRef.current
    if (!video) return
    disconnectAll()
    if (!videoSrcRef.current) {
      videoSrcRef.current = ctx.createMediaElementSource(video)
    }
    // Restore speaker output for video file playback
    try { analyser.connect(ctx.destination) } catch { /* already connected */ }
    videoSrcRef.current.connect(analyser)
  }

  function connectStreamSource(ctx: AudioContext, analyser: AnalyserNode, stream: MediaStream) {
    disconnectAll()
    // Silence speakers when analyzing a mic stream — routing mic to speakers causes echo
    try { analyser.disconnect(ctx.destination) } catch { /* already disconnected */ }
    streamSrcRef.current = ctx.createMediaStreamSource(stream)
    streamSrcRef.current.connect(analyser)
  }

  // Re-wire source whenever externalStream changes while analysis is running
  useEffect(() => {
    if (!isRunningRef.current) return
    const { ctx, analyser } = ensureCtx()
    if (externalStream) {
      connectStreamSource(ctx, analyser, externalStream)
    } else {
      connectVideoSource(ctx, analyser)
    }
  }, [externalStream]) // eslint-disable-line react-hooks/exhaustive-deps

  const start = useCallback((overrideStream?: MediaStream | null) => {
    const stream = overrideStream !== undefined ? overrideStream : externalStream
    const { ctx, analyser } = ensureCtx()

    if (stream) {
      connectStreamSource(ctx, analyser, stream)
    } else {
      if (!videoRef.current) return
      connectVideoSource(ctx, analyser)
    }

    if (ctx.state === 'suspended') ctx.resume()

    const timeDomain = new Float32Array(FFT_SIZE)
    isRunningRef.current = true
    setState(s => ({ ...s, isAnalyzing: true }))

    const tick = (now: number) => {
      rafRef.current = requestAnimationFrame(tick)
      if (now - lastSampleRef.current < SAMPLE_INTERVAL_MS) return
      lastSampleRef.current = now

      analyserRef.current!.getFloatTimeDomainData(timeDomain)

      let sumSq = 0
      for (let i = 0; i < timeDomain.length; i++) sumSq += timeDomain[i] ** 2
      const rms = Math.sqrt(sumSq / timeDomain.length)
      const db = rmsToDb(rms)
      const isSilent = rms < 0.005

      let pitch = 0
      if (!isSilent) {
        const rawHz = detectPitchYIN(timeDomain, ctx.sampleRate)
        if (rawHz > 60 && rawHz < 500) {
          const prev = smoothedPitchRef.current
          const smoothed = prev === 0 ? rawHz : EMA_ALPHA * rawHz + (1 - EMA_ALPHA) * prev
          smoothedPitchRef.current = smoothed
          pitch = smoothed
        } else {
          smoothedPitchRef.current = 0
        }
      } else {
        smoothedPitchRef.current = 0
      }

      const t = videoRef.current?.currentTime ?? 0
      setState(s => ({
        ...s,
        currentPitch: pitch,
        currentDb: isFinite(db) ? db : -60,
        pitchHistory: [...s.pitchHistory, { t, hz: pitch }].slice(-18000),
        dbHistory: [...s.dbHistory, { t, db: isFinite(db) ? db : -60 }].slice(-18000)
      }))
    }

    rafRef.current = requestAnimationFrame(tick)
  }, [videoRef, externalStream]) // eslint-disable-line react-hooks/exhaustive-deps

  const stop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    isRunningRef.current = false
    setState(s => ({ ...s, isAnalyzing: false }))
  }, [])

  const reset = useCallback(() => {
    stop()
    // Close the AudioContext and null all node refs so the next session
    // starts with a completely fresh audio graph — no stale connections
    audioCtxRef.current?.close().catch(() => {})
    audioCtxRef.current = null
    analyserRef.current = null
    destNodeRef.current = null
    videoSrcRef.current = null
    streamSrcRef.current = null
    smoothedPitchRef.current = 0
    setState({
      isAnalyzing: false,
      currentPitch: 0,
      currentDb: -Infinity,
      pitchHistory: [],
      dbHistory: []
    })
  }, [stop])

  // Call within a user gesture to pre-create the AudioContext while activation is still valid.
  // Subsequent startAudio calls reuse the already-running context even after async gaps.
  const prepare = useCallback(() => { ensureCtx() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return { state, start, stop, reset, prepare, captureStream: destNodeRef.current?.stream ?? null }
}
