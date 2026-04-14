import { useState, useRef, useCallback, useEffect } from 'react'

export type CameraState = 'idle' | 'previewing' | 'recording' | 'paused' | 'saving'

export function useCameraInput() {
  const [cameraState, setCameraState] = useState<CameraState>('idle')
  const [elapsedSec, setElapsedSec] = useState(0)
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('')
  const [error, setError] = useState<string | null>(null)

  const streamRef = useRef<MediaStream | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null)

  // Enumerate devices on mount — try without permission first for count, then with permission for labels
  useEffect(() => {
    navigator.mediaDevices.enumerateDevices().then(devs => {
      const cams = devs.filter(d => d.kind === 'videoinput')
      if (cams.length > 0) {
        setDevices(cams)
        setSelectedDeviceId(id => id || cams[0].deviceId)
      }
    }).catch(() => {/* permission not yet granted — user will click Open Camera */})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Enumerate connected cameras
  const refreshDevices = useCallback(async () => {
    try {
      // Request permission first so labels are populated
      const tempStream = await navigator.mediaDevices.getUserMedia({ video: true })
      tempStream.getTracks().forEach(t => t.stop())
      const devs = await navigator.mediaDevices.enumerateDevices()
      const cams = devs.filter(d => d.kind === 'videoinput')
      setDevices(cams)
      if (cams.length > 0 && !selectedDeviceId) {
        setSelectedDeviceId(cams[0].deviceId)
      }
      setError(null)
    } catch (e) {
      setError('Camera permission denied')
    }
  }, [selectedDeviceId])

  // Start camera preview (no recording yet)
  const startPreview = useCallback(async (deviceId?: string) => {
    try {
      // Stop any existing stream
      streamRef.current?.getTracks().forEach(t => t.stop())

      const constraints: MediaStreamConstraints = {
        video: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: true
      }
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      streamRef.current = stream

      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream
        videoPreviewRef.current.play().catch(() => {/* autoplay may be blocked */})
      }
      setCameraState('previewing')
      setError(null)
    } catch (e) {
      setError('Could not access camera')
    }
  }, [])

  const stopPreview = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    if (videoPreviewRef.current) {
      videoPreviewRef.current.srcObject = null
    }
    setCameraState('idle')
  }, [])

  const startRecording = useCallback(() => {
    const stream = streamRef.current
    if (!stream) return

    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : 'video/webm'

    const recorder = new MediaRecorder(stream, { mimeType })
    chunksRef.current = []
    recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
    recorder.start(500)
    mediaRecorderRef.current = recorder

    setElapsedSec(0)
    timerRef.current = setInterval(() => setElapsedSec(s => s + 1), 1000)
    setCameraState('recording')
  }, [])

  const pauseRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current
    if (!recorder || recorder.state !== 'recording') return
    recorder.pause()
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    setCameraState('paused')
  }, [])

  const resumeRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current
    if (!recorder || recorder.state !== 'paused') return
    recorder.resume()
    timerRef.current = setInterval(() => setElapsedSec(s => s + 1), 1000)
    setCameraState('recording')
  }, [])

  const stopRecording = useCallback(async () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }

    const recorder = mediaRecorderRef.current
    if (!recorder || recorder.state === 'inactive') {
      setCameraState(streamRef.current ? 'previewing' : 'idle')
      return
    }

    setCameraState('saving')
    if (recorder.state === 'paused') recorder.resume()

    await new Promise<void>(resolve => {
      recorder.onstop = () => resolve()
      recorder.stop()
    })

    const blob = new Blob(chunksRef.current, { type: 'video/webm' })
    const uint8 = new Uint8Array(await blob.arrayBuffer())
    const name = `camera-recording-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.webm`

    try {
      await window.api.saveRecording(uint8, name)
    } catch {
      // Dialog closed or FFmpeg error — reset state below
    } finally {
      chunksRef.current = []
      mediaRecorderRef.current = null
      setElapsedSec(0)
      setCameraState(streamRef.current ? 'previewing' : 'idle')
    }
  }, [])

  return {
    cameraState,
    elapsedSec,
    devices,
    selectedDeviceId,
    error,
    videoPreviewRef,
    setSelectedDeviceId,
    refreshDevices,
    startPreview,
    stopPreview,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording
  }
}
