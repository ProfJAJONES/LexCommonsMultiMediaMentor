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
  const pendingPipRef = useRef<MediaStream | null>(null)
  const canvasCleanupRef = useRef<(() => void) | null>(null)
  const canvasStreamRef = useRef<MediaStream | null>(null)
  // Cache the last completed recording so handleSavePackage can include it
  // even if the user manually stopped the recording before clicking Save.
  const lastBlobRef = useRef<{ uint8: Uint8Array; name: string } | null>(null)

  // ── shared recording start ─────────────────────────────────────────────────
  // audioStream: MediaStream → use its audio tracks (borrowed, don't stop on cleanup)
  //              null        → video-only, skip mic fallback
  //              undefined   → fall back to system default mic
  // pipStream: live webcam stream to composite as picture-in-picture overlay
  const beginRecording = useCallback(async (
    videoStream: MediaStream,
    audioStream: MediaStream | null | undefined,
    pipStream?: MediaStream | null
  ) => {
    displayStreamRef.current = videoStream
    setRecorderState('recording')
    setElapsedSec(0)
    setHasAudio(false)

    // ── Canvas PiP compositor ──────────────────────────────────────────────
    let recordVideoStream: MediaStream = videoStream
    if (pipStream && pipStream.getVideoTracks().length > 0) {
      try {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')!

        // Attach both videos to the DOM (hidden) so Chromium actually decodes
        // frames — off-screen video elements with desktop-capture srcObjects
        // often produce blank frames in canvas.drawImage without this.
        const hiddenStyle = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;pointer-events:none'

        const dispVid = document.createElement('video')
        dispVid.muted = true
        dispVid.srcObject = videoStream
        dispVid.style.cssText = hiddenStyle
        document.body.appendChild(dispVid)

        const pipVid = document.createElement('video')
        pipVid.muted = true
        pipVid.srcObject = pipStream
        pipVid.style.cssText = hiddenStyle
        document.body.appendChild(pipVid)

        // play() without load() — srcObject doesn't need load(); calling it can
        // reset the media element and interfere with the stream.
        await Promise.all([
          dispVid.play().catch(() => {}),
          pipVid.play().catch(() => {}),
        ])

        // Wait one rAF so Chromium delivers the first decoded frame and
        // populates videoWidth/videoHeight before we size the canvas.
        await new Promise<void>(r => requestAnimationFrame(() => r()))

        canvas.width  = dispVid.videoWidth  || 1920
        canvas.height = dispVid.videoHeight || 1080

        const margin = 16
        const pip_w  = Math.round(canvas.width / 5)

        let rafId: number
        function drawFrame() {
          ctx.drawImage(dispVid, 0, 0, canvas.width, canvas.height)
          if (pipVid.videoWidth > 0 && pipVid.videoHeight > 0) {
            const aspect = pipVid.videoWidth / pipVid.videoHeight
            const pip_h  = Math.round(pip_w / aspect)
            const x = canvas.width  - pip_w - margin
            const y = canvas.height - pip_h - margin
            const r = 10
            ctx.save()
            ctx.beginPath()
            ctx.moveTo(x + r, y)
            ctx.lineTo(x + pip_w - r, y)
            ctx.arcTo(x + pip_w, y, x + pip_w, y + r, r)
            ctx.lineTo(x + pip_w, y + pip_h - r)
            ctx.arcTo(x + pip_w, y + pip_h, x + pip_w - r, y + pip_h, r)
            ctx.lineTo(x + r, y + pip_h)
            ctx.arcTo(x, y + pip_h, x, y + pip_h - r, r)
            ctx.lineTo(x, y + r)
            ctx.arcTo(x, y, x + r, y, r)
            ctx.closePath()
            ctx.clip()
            ctx.drawImage(pipVid, x, y, pip_w, pip_h)
            ctx.restore()
          }
          rafId = requestAnimationFrame(drawFrame)
        }
        drawFrame()

        const cs = canvas.captureStream(30)
        canvasStreamRef.current = cs
        canvasCleanupRef.current = () => {
          cancelAnimationFrame(rafId)
          dispVid.pause(); dispVid.srcObject = null; dispVid.remove()
          pipVid.pause(); pipVid.srcObject = null; pipVid.remove()
        }
        recordVideoStream = cs
      } catch {
        // PiP setup failed — fall back to plain display recording
      }
    }

    const combined = new MediaStream()
    recordVideoStream.getVideoTracks().forEach(t => combined.addTrack(t))

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
  // pipStream is a live webcam stream to overlay as PiP on the recording.
  const openPicker = useCallback(async (
    audioStream?: MediaStream | null,
    pipStream?: MediaStream | null
  ) => {
    setAudioError(null)
    pendingAudioRef.current = audioStream
    pendingPipRef.current = pipStream ?? null

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
    try {
      setRecorderState('picking')
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30 } as MediaTrackConstraints,
        audio: false
      })
      await beginRecording(displayStream, audioStream, pipStream ?? undefined)
      return
    } catch (e) {
      setRecorderState('idle')
      if (e instanceof Error && e.name === 'AbortError') return
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
    setRecorderState('picking')

    try {
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
      await beginRecording(videoStream, audioArg, pendingPipRef.current)
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

  function teardownCanvas() {
    canvasCleanupRef.current?.()
    canvasCleanupRef.current = null
    canvasStreamRef.current?.getTracks().forEach(t => t.stop())
    canvasStreamRef.current = null
  }

  // Stop recording and return raw bytes — used when the caller wants to bundle
  // the webm into its own package rather than show a separate save dialog.
  const stopAndGetBlob = useCallback(async (): Promise<{ uint8: Uint8Array; name: string } | null> => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    const recorder = mediaRecorderRef.current
    if (!recorder || recorder.state === 'inactive') return null

    setRecorderState('saving')
    if (recorder.state === 'paused') recorder.resume()

    await new Promise<void>(resolve => {
      recorder.onstop = () => resolve()
      recorder.stop()
    })

    teardownCanvas()
    displayStreamRef.current?.getTracks().forEach(t => t.stop())
    micStreamRef.current?.getTracks().forEach(t => t.stop())
    displayStreamRef.current = null
    micStreamRef.current = null
    borrowedAudioRef.current = false

    const blob = new Blob(chunksRef.current, { type: 'video/webm' })
    const uint8 = new Uint8Array(await blob.arrayBuffer())
    const name = `recording-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.webm`

    chunksRef.current = []
    mediaRecorderRef.current = null
    setRecorderState('idle')
    setElapsedSec(0)
    setHasAudio(false)

    if (uint8.byteLength === 0) return null
    const result = { uint8, name }
    lastBlobRef.current = result
    return result
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

    teardownCanvas()
    displayStreamRef.current?.getTracks().forEach(t => t.stop())
    micStreamRef.current?.getTracks().forEach(t => t.stop())
    displayStreamRef.current = null
    micStreamRef.current = null
    borrowedAudioRef.current = false

    const blob = new Blob(chunksRef.current, { type: 'video/webm' })
    const uint8 = new Uint8Array(await blob.arrayBuffer())
    const name = `screen-recording-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.webm`
    if (uint8.byteLength > 0) lastBlobRef.current = { uint8, name }

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
    lastBlobRef,
    openPicker,
    cancelPicker,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    stopAndGetBlob
  }
}
