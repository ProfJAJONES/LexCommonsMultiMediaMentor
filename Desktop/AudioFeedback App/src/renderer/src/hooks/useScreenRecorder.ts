import { useState, useRef, useCallback } from 'react'

export type CaptureSource = {
  id: string
  name: string
  thumbnail: string
  appIcon: string | null
}

export type RecorderState = 'idle' | 'picking' | 'recording' | 'paused' | 'saving'

export function useScreenRecorder() {
  const [recorderState, setRecorderState] = useState<RecorderState>('idle')
  const [sources, setSources] = useState<CaptureSource[]>([])
  const [elapsedSec, setElapsedSec] = useState(0)
  const [hasAudio, setHasAudio] = useState(false)
  const [audioError, setAudioError] = useState<string | null>(null)
  const [savedPath, setSavedPathRaw] = useState<string | null>(null)
  const [savedAsFallback, setSavedAsFallback] = useState(false)

  function setSavedPath(path: string | null, fallback = false) {
    setSavedPathRaw(path)
    setSavedAsFallback(fallback)
  }

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const displayStreamRef = useRef<MediaStream | null>(null)
  const micStreamRef = useRef<MediaStream | null>(null)
  const borrowedAudioRef = useRef<boolean>(false)
  const pendingAudioRef = useRef<MediaStream | null | undefined>(undefined)

  // ── shared recording start ─────────────────────────────────────────────────
  // audioStream: MediaStream → use its audio tracks (borrowed, don't stop on cleanup)
  //              null        → video-only, skip mic fallback
  //              undefined   → fall back to system default mic
  const beginRecording = useCallback(async (videoStream: MediaStream, audioStream: MediaStream | null | undefined) => {
    displayStreamRef.current = videoStream
    setRecorderState('recording')
    setElapsedSec(0)
    setHasAudio(false)

    const combined = new MediaStream()
    videoStream.getVideoTracks().forEach(t => combined.addTrack(t))

    const existingTracks = audioStream != null ? audioStream.getAudioTracks() : []
    if (existingTracks.length > 0 && existingTracks[0].readyState === 'live') {
      existingTracks.forEach(t => combined.addTrack(t))
      borrowedAudioRef.current = true
      setHasAudio(true)
    } else if (audioStream === undefined) {
      borrowedAudioRef.current = false
      try {
        const micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
        if (micStream.getAudioTracks().length > 0) {
          micStream.getAudioTracks().forEach(t => combined.addTrack(t))
          micStreamRef.current = micStream
          setHasAudio(true)
        } else {
          setAudioError('Microphone returned no audio tracks')
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        setAudioError(`Mic unavailable: ${msg}`)
      }
    }

    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
      ? 'video/webm;codecs=vp9,opus'
      : MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
      ? 'video/webm;codecs=vp8,opus'
      : 'video/webm'

    const recorder = new MediaRecorder(combined, { mimeType })
    chunksRef.current = []
    recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
    recorder.start(500)
    mediaRecorderRef.current = recorder

    timerRef.current = setInterval(() => setElapsedSec(s => s + 1), 1000)
    videoStream.getVideoTracks()[0].onended = () => stopRecording()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── openPicker ──────────────────────────────────────────────────────────────
  // audioStream is stashed so startRecording (called from SourcePicker) can use it.
  const openPicker = useCallback(async (audioStream?: MediaStream | null) => {
    setAudioError(null)
    pendingAudioRef.current = audioStream

    // ── Path 1: desktopCapturer.getSources() — shows our custom source picker ──
    let captureSources: CaptureSource[] = []
    try {
      captureSources = await window.api.getCaptureSources()
    } catch { /* fall through to path 2 */ }

    if (captureSources.length > 0) {
      setSources(captureSources)
      setRecorderState('picking')
      return
    }

    // ── Path 2: native getDisplayMedia system picker ───────────────────────────
    // getSources returned empty (permission issue or macOS 15 behaviour change).
    // Fall back to the OS-native screen picker which works regardless of whether
    // desktopCapturer.getSources() is available. The main process handles this
    // via setDisplayMediaRequestHandler with useSystemPicker:true.
    try {
      setRecorderState('picking') // show a "loading" state while picker is open
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30 } as MediaTrackConstraints,
        audio: false
      })
      await beginRecording(displayStream, audioStream)
      return
    } catch (e) {
      setRecorderState('idle')
      // User cancelled — no error needed
      if (e instanceof Error && e.name === 'AbortError') return
      // Real failure — show what went wrong
      const screenStatus = 'getScreenRecordingStatus' in window.api
        ? await (window.api as Record<string, unknown> & { getScreenRecordingStatus: () => Promise<string> }).getScreenRecordingStatus()
        : 'unknown'
      const msg = e instanceof Error ? `${e.name}: ${e.message}` : String(e)
      setAudioError(`screen-recording-error:${msg} (TCC: ${screenStatus})`)
    }
  }, [beginRecording])

  const cancelPicker = useCallback(() => {
    setSources([])
    setRecorderState('idle')
  }, [])

  // ── startRecording — called by SourcePicker when user picks a source ────────
  const startRecording = useCallback(async (sourceId: string, withMic: boolean) => {
    setSources([])
    setRecorderState('picking') // briefly picking while we open the stream

    try {
      // Legacy Electron API — works for both window and screen sources
      const videoStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: sourceId,
            maxWidth: window.screen.width * window.devicePixelRatio,
            maxHeight: window.screen.height * window.devicePixelRatio,
          }
        } as MediaTrackConstraints
      })

      const audioArg = withMic ? pendingAudioRef.current : null
      await beginRecording(videoStream, audioArg)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setAudioError(`Could not start recording: ${msg}`)
      setRecorderState('idle')
    }
  }, [beginRecording])

  const pauseRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current
    if (!recorder || recorder.state !== 'recording') return
    recorder.pause()
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    setRecorderState('paused')
  }, [])

  const resumeRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current
    if (!recorder || recorder.state !== 'paused') return
    recorder.resume()
    timerRef.current = setInterval(() => setElapsedSec(s => s + 1), 1000)
    setRecorderState('recording')
  }, [])

  const stopRecording = useCallback(async () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }

    const recorder = mediaRecorderRef.current
    if (!recorder || recorder.state === 'inactive') return

    setRecorderState('saving')

    if (recorder.state === 'paused') recorder.resume()

    await new Promise<void>(resolve => {
      recorder.onstop = () => resolve()
      recorder.stop()
    })

    displayStreamRef.current?.getTracks().forEach(t => t.stop())
    micStreamRef.current?.getTracks().forEach(t => t.stop())
    displayStreamRef.current = null
    micStreamRef.current = null
    borrowedAudioRef.current = false

    const blob = new Blob(chunksRef.current, { type: 'video/webm' })
    const uint8 = new Uint8Array(await blob.arrayBuffer())
    const name = `screen-recording-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.webm`

    let outPath: string | null = null
    let isFallback = false
    try {
      const result = await window.api.saveRecording(uint8, name)
      if (result && typeof result === 'object' && 'fallback' in result) {
        outPath = result.webmPath
        isFallback = true
      } else {
        outPath = result as string | null
      }
    } catch {
      // Dialog closed or unexpected error
    } finally {
      chunksRef.current = []
      mediaRecorderRef.current = null
      setRecorderState('idle')
      setElapsedSec(0)
      setHasAudio(false)
    }
    if (outPath) setSavedPath(outPath, isFallback)
  }, [])

  return {
    recorderState,
    sources,
    elapsedSec,
    hasAudio,
    audioError,
    savedPath,
    savedAsFallback,
    clearSavedPath: () => setSavedPath(null),
    openPicker,
    cancelPicker,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording
  }
}
