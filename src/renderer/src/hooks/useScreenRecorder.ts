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
  const [sources] = useState<CaptureSource[]>([])
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
  const micStreamRef = useRef<MediaStream | null>(null)   // stream we opened ourselves (must stop on cleanup)
  const borrowedAudioRef = useRef<boolean>(false)         // true when reusing app stream (don't stop on cleanup)

  // On macOS 15, desktopCapturer.getSources() returns empty due to Sequoia permission
  // model changes. Use getDisplayMedia() directly — it shows the native macOS screen
  // picker which handles permissions automatically.
  //
  // audioStream: pass the app's currently-active audio stream (webcam mic, selected
  // mic, or BlackHole) so the recording reuses that stream rather than trying to
  // open the same device again — which fails when it's already in use.
  // Pass undefined to fall back to opening the system default microphone.
  // audioStream: pass a live MediaStream to use its audio tracks
  //              pass null to record video-only (skips getUserMedia fallback)
  //              pass undefined to fall back to the system default microphone
  const openPicker = useCallback(async (audioStream?: MediaStream | null) => {
    setRecorderState('picking')
    setAudioError(null)
    try {
      // Native macOS screen picker — no source pre-selection needed
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false
      })
      displayStreamRef.current = displayStream

      setRecorderState('recording')
      setElapsedSec(0)
      setHasAudio(false)

      const combined = new MediaStream()
      displayStream.getVideoTracks().forEach(t => combined.addTrack(t))

      // Audio source priority:
      //   MediaStream passed in → use its tracks (reuse existing open stream)
      //   null passed in        → record video-only, skip getUserMedia
      //   undefined             → fall back to system default microphone
      const existingTracks = audioStream != null ? (audioStream as MediaStream).getAudioTracks() : []
      if (existingTracks.length > 0 && existingTracks[0].readyState === 'live') {
        existingTracks.forEach(t => combined.addTrack(t))
        borrowedAudioRef.current = true   // don't stop these on cleanup
        setHasAudio(true)
      } else if (audioStream === undefined) {
        // No stream provided — fall back to system default microphone
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
          // Continue recording video-only
        }
      }
      // else audioStream === null → video-only recording, no audio fallback

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
      displayStream.getVideoTracks()[0].onended = () => stopRecording()
    } catch {
      // User cancelled the native picker or permission denied
      setRecorderState('idle')
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const cancelPicker = useCallback(() => {
    setRecorderState('idle')
  }, [])

  // Legacy — kept for API compatibility but openPicker now handles the full flow
  const startRecording = useCallback(async (_sourceId: string, _withMic: boolean) => {
    await openPicker()
  }, [openPicker])

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
    // Only stop mic tracks if we opened the stream ourselves (micStreamRef is set).
    // If we reused the app's existing audio stream, don't touch those tracks.
    micStreamRef.current?.getTracks().forEach(t => t.stop())
    displayStreamRef.current = null
    micStreamRef.current = null
    borrowedAudioRef.current = null

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
