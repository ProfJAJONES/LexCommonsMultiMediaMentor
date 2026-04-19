import React, { useRef, useState, useCallback, useEffect } from 'react'
import logoUrl from './assets/logo-sidebar.svg'
import { VideoPlayer } from './components/VideoPlayer'
import { PitchGraph } from './components/PitchGraph'
import type { PitchGraphHandle } from './components/PitchGraph'
import { DecibelGraph } from './components/DecibelGraph'
import type { DecibelGraphHandle } from './components/DecibelGraph'
import { PianoKeyboard } from './components/PianoKeyboard'
import { AnnotationLayer } from './components/AnnotationLayer'
import { FeedbackPanel } from './components/FeedbackPanel'
import { SourcePicker, RecordingIndicator } from './components/ScreenRecorder'
import { CameraPanel } from './components/CameraPanel'
import { AIFeedbackPanel } from './components/AIFeedbackPanel'
import { ReportPanel } from './components/ReportPanel'
import { LivePracticePanel } from './components/LivePracticePanel'
import { BodyTracker } from './components/BodyTracker'
import { BlackHoleSetup } from './components/BlackHoleSetup'
import { useAudioAnalysis } from './hooks/useAudioAnalysis'
import { useAnnotations } from './hooks/useAnnotations'
import { useScreenRecorder } from './hooks/useScreenRecorder'
import { useCameraInput } from './hooks/useCameraInput'
import { useAIFeedback, SCOPE_LABELS } from './hooks/useAIFeedback'
import type { KnowledgeScope, ChatMessage } from './hooks/useAIFeedback'
import { useDomain, DOMAIN_CONFIG } from './hooks/useDomain'
import { PROVIDER_CONFIG } from './utils/aiClient'
import type { AIProvider } from './utils/aiClient'
import type { Domain } from './hooks/useDomain'
import type { Annotation } from './types'
import type { CaptureSource } from './hooks/useScreenRecorder'

declare global {
  interface Window {
    api: {
      openMedia: () => Promise<{ filePath: string; fileName: string } | null>
      saveFeedback: (data: string) => Promise<boolean>
      saveNotesAs: (data: string, format: 'json' | 'csv' | 'md' | 'txt') => Promise<string | null>
      saveNotesAsPDF: (html: string, name: string) => Promise<string | null>
      saveNotesAsDocx: (payload: object, name: string) => Promise<string | null>
      loadFeedback: () => Promise<Record<string, unknown> | null>
      openPath: (p: string) => Promise<void>
      getCaptureSources: () => Promise<CaptureSource[]>
      prepareCapture: (sourceId: string) => Promise<void>
      saveRecording: (buffer: Uint8Array, name: string) => Promise<string | { fallback: true; webmPath: string } | null>
      exportAnnotatedVideo: (videoPath: string, pitchPng: string, decibelPng: string, comments: Array<{ timestamp: number; tag: string; text: string }>) => Promise<string | { error: string } | null>
      saveReport: (html: string) => Promise<string | null>
      installBlackHole: () => Promise<string | null>
      openAudioMidiSetup: () => Promise<string | null>
      getMediaPermissions: () => Promise<{ camera: string; microphone: string }>
      requestMediaAccess: () => Promise<{ camera: boolean; microphone: boolean }>
    }
  }
}

type AnnotationTool = Annotation['type'] | null
const COLORS = ['#f87171', '#fbbf24', '#34d399', '#38bdf8', '#a78bfa', '#f472b6']

type SidebarTab = 'feedback' | 'annotations' | 'ai' | 'camera' | 'report' | 'practice'
type AudioSource = 'video' | 'mic' | 'blackhole'

export default function App() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const pitchGraphRef = useRef<PitchGraphHandle>(null)
  const decibelGraphRef = useRef<DecibelGraphHandle>(null)
  const [mediaPath, setMediaPath] = useState<string | null>(null)
  const [fileName, setFileName] = useState('')
  const [mediaMode, setMediaMode] = useState<'none' | 'file' | 'webcam'>('none')
  const webcamStreamRef = useRef<MediaStream | null>(null)
  const practiceMessagesRef = useRef<Array<{ speaker: string; text: string; timestamp: number }>>([])
  const aiMessagesRef = useRef<ChatMessage[]>([])
  const [webcamStream, setWebcamStream] = useState<MediaStream | null>(null)
  const [currentTime, setCurrentTime] = useState(0)
  const [videoDimensions, setVideoDimensions] = useState({ w: 0, h: 0 })
  const [videoDuration, setVideoDuration] = useState(0)
  const [movementHistory, setMovementHistory] = useState<{ t: number; score: number }[]>([])
  const [activeTool, setActiveTool] = useState<AnnotationTool>(null)
  const [activeColor, setActiveColor] = useState(COLORS[0])
  const [showAnnotationOverlay, setShowAnnotationOverlay] = useState(true)
  const [activeTab, setActiveTab] = useState<SidebarTab>('feedback')
  const [videoEnded, setVideoEnded] = useState(false)
  const [showCloseConfirm, setShowCloseConfirm] = useState(false)
  const [showBlackHoleSetup, setShowBlackHoleSetup] = useState(false)

  // Prevents concurrent media operations (import / webcam / device switch)
  const mediaLoadingRef = useRef(false)

  // Audio source for analysis graphs
  const [audioSource, setAudioSource] = useState<AudioSource>('video')
  const [micStream, setMicStream] = useState<MediaStream | null>(null)
  const [blackholeStream, setBlackholeStream] = useState<MediaStream | null>(null)
  const [micDevices, setMicDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedMicId, setSelectedMicId] = useState<string>('')
  const [cameraDevices, setCameraDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedCameraId, setSelectedCameraId] = useState<string>('')
  const [outputDevices, setOutputDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedOutputId, setSelectedOutputId] = useState<string>('')
  const [micError, setMicError] = useState<string | null>(null)
  const [webcamError, setWebcamError] = useState<string | null>(null)
  const [showAudioPicker, setShowAudioPicker] = useState(false)
  const [showSettingsDrawer, setShowSettingsDrawer] = useState(() => {
    const p = localStorage.getItem('mm_ai_provider') ?? 'anthropic'
    return !localStorage.getItem(`mm_ai_key_${p}`) && !localStorage.getItem('mm_ai_key') && !localStorage.getItem('anthropic_api_key')
  })
  const audioPickerBtnRef = useRef<HTMLButtonElement>(null)
  const [showExportMenu, setShowExportMenu] = useState(false)
  const exportBtnRef = useRef<HTMLDivElement>(null)

  // Resize state for draggable dividers
  const [sidebarWidth, setSidebarWidth] = useState(320)
  const [videoAreaHeight, setVideoAreaHeight] = useState(300)
  const [bodyTrackerWidth, setBodyTrackerWidth] = useState(220)

  // Fetch available audio input devices on mount and whenever permissions change
  function refreshMicDevices() {
    navigator.mediaDevices.enumerateDevices().then(devs => {
      const mics = devs.filter(d => d.kind === 'audioinput')
      const cams = devs.filter(d => d.kind === 'videoinput')
      const outs = devs.filter(d => d.kind === 'audiooutput')
      setMicDevices(mics)
      setCameraDevices(cams)
      setOutputDevices(outs)
      if (mics.length > 0 && !selectedMicId) setSelectedMicId(mics[0].deviceId)
      if (cams.length > 0 && !selectedCameraId) setSelectedCameraId(cams[0].deviceId)
      if (outs.length > 0 && !selectedOutputId) setSelectedOutputId(outs[0].deviceId)
    }).catch(() => {})
  }
  useEffect(() => {
    // Probe mic on startup so macOS fires the TCC permission banner immediately.
    // Audio-only — probing video here can leave the camera in a transient muted
    // state that interferes with the first real getUserMedia call for the webcam.
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(s => { s.getTracks().forEach(t => t.stop()); refreshMicDevices() })
      .catch(() => { refreshMicDevices() })
    navigator.mediaDevices.addEventListener('devicechange', refreshMicDevices)
    return () => navigator.mediaDevices.removeEventListener('devicechange', refreshMicDevices)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Wire webcam stream to the video element — same pattern as LivePracticePanel.
  // Depends on webcamStream state (not a ref) so React tracks the change reliably.
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    if (webcamStream) {
      video.srcObject = webcamStream
      video.play().catch(e => console.error('[webcam] play() failed:', e))
    } else {
      video.srcObject = null
    }
  }, [webcamStream])

  // Close audio picker when clicking outside
  useEffect(() => {
    if (!showAudioPicker) return
    function handler(e: MouseEvent) {
      if (audioPickerBtnRef.current && !audioPickerBtnRef.current.closest('[data-audio-picker]')?.contains(e.target as Node)) {
        setShowAudioPicker(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showAudioPicker])

  // Close export menu when clicking outside
  useEffect(() => {
    if (!showExportMenu) return
    function handler(e: MouseEvent) {
      if (exportBtnRef.current && !exportBtnRef.current.contains(e.target as Node)) {
        setShowExportMenu(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showExportMenu])

  async function selectAudioDevice(deviceId: string) {
    // Stop any currently-active external streams
    micStream?.getTracks().forEach(t => t.stop())
    blackholeStream?.getTracks().forEach(t => t.stop())
    setMicStream(null)
    setBlackholeStream(null)
    setMicError(null)
    setShowAudioPicker(false)

    if (deviceId === 'video') {
      setAudioSource('video')
      return
    }

    if (deviceId === 'blackhole') {
      try {
        const tempStream = await navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => null)
        tempStream?.getTracks().forEach(t => t.stop())
        const devs = await navigator.mediaDevices.enumerateDevices()
        const bhDev = devs.find(d => d.kind === 'audioinput' && d.label.toLowerCase().includes('blackhole'))
        if (!bhDev) { setShowBlackHoleSetup(true); return }
        const stream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: bhDev.deviceId } } })
        setBlackholeStream(stream)
        setSelectedMicId(bhDev.deviceId)
        setAudioSource('blackhole')
        startAudio(stream)
      } catch {
        setMicError('Could not open BlackHole device')
      }
      return
    }

    // Regular mic device — open the stream, start analysis immediately
    try {
      const audioConstraints = deviceId ? { deviceId: { exact: deviceId } } : true
      const stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints })
      setMicStream(stream)
      setSelectedMicId(deviceId)
      setAudioSource('mic')
      startAudio(stream)
      // Refresh device list so labels are populated
      const devs = await navigator.mediaDevices.enumerateDevices()
      setMicDevices(devs.filter(d => d.kind === 'audioinput'))
    } catch {
      setMicError('Microphone access denied')
    }
  }

  const { domain, setDomain } = useDomain()

  // Separate audio-only stream from the webcam (avoids MediaElementAudioSourceNode
  // unreliability with live srcObject streams)
  const [webcamAudioStream, setWebcamAudioStream] = useState<MediaStream | null>(null)

  const getCurrentTime = useCallback(() => videoRef.current?.currentTime ?? 0, [])
  // Explicit mic/blackhole selection takes priority over media mode.
  // 'video' source = webcam audio in webcam mode, or the video element in file mode (null).
  const analysisStream =
    audioSource === 'mic'        ? micStream
    : audioSource === 'blackhole'  ? blackholeStream
    : mediaMode === 'webcam'       ? webcamAudioStream
    : null
  const { state: audio, start: startAudio, stop: stopAudio, reset: resetAudio, prepare: prepareAudio } = useAudioAnalysis(
    videoRef,
    analysisStream
  )
  const ann = useAnnotations(getCurrentTime)
  const screen = useScreenRecorder()
  const camera = useCameraInput()
  const ai = useAIFeedback()
  // Keep latest AI messages in a ref so the close handler always sees current state
  useEffect(() => { aiMessagesRef.current = ai.state.messages }, [ai.state.messages])

  function stopWebcam() {
    stopAudio()
    webcamStreamRef.current?.getTracks().forEach(t => t.stop())
    webcamStreamRef.current = null
    setWebcamStream(null)
    setWebcamAudioStream(null)
    micStream?.getTracks().forEach(t => t.stop())
    blackholeStream?.getTracks().forEach(t => t.stop())
    setMicStream(null)
    setBlackholeStream(null)
    if (videoRef.current) videoRef.current.srcObject = null
  }

  function handleCloseSession() {
    // Only prompt if there is actual session work to lose
    const hasWork = ann.comments.length > 0 || ann.annotations.length > 0 || audio.pitchHistory.length > 0
    if (hasWork) {
      setShowCloseConfirm(true)
    } else {
      doClear()
    }
  }

  function doClear() {
    setShowCloseConfirm(false)
    stopWebcam()
    resetAudio()
    ann.setAnnotations([])
    ann.setComments([])
    setMediaPath(null)
    setFileName('')
    setCurrentTime(0)
    setVideoDuration(0)
    setMovementHistory([])
    setMediaMode('none')
    setVideoEnded(false)
    practiceMessagesRef.current = []
    aiMessagesRef.current = []
  }

  async function handleWebcam() {
    if (mediaLoadingRef.current) return
    mediaLoadingRef.current = true
    setWebcamError(null)
    stopWebcam()
    resetAudio()
    prepareAudio()  // create AudioContext now, within the user gesture window
    setAudioSource('video')

    // Pre-flight: check TCC status before attempting getUserMedia so we can
    // give a clear message instead of the opaque Chromium camera-blocked icon.
    const permsCheck = await window.api.getMediaPermissions().catch(() => ({ camera: 'unknown', microphone: 'unknown' }))
    if (permsCheck.camera === 'denied') {
      setWebcamError('Camera is blocked. Open System Settings → Privacy & Security → Camera, enable this app, then restart it.')
      mediaLoadingRef.current = false
      return
    }

    try {
      const videoConstraint = selectedCameraId ? { deviceId: { exact: selectedCameraId } } : true
      const audioConstraint = selectedMicId ? { deviceId: { exact: selectedMicId } } : true
      const stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraint, audio: audioConstraint })

      webcamStreamRef.current = stream
      setWebcamStream(stream)
      const audioTracks = stream.getAudioTracks()
      const audioStream = audioTracks.length > 0 ? new MediaStream(audioTracks) : null
      if (audioStream) setWebcamAudioStream(audioStream)
      // Don't set srcObject here — the webcam <video> element doesn't exist in the DOM
      // until mediaMode becomes 'webcam' and React re-renders. A useEffect below
      // connects the stream once the element is mounted.
      setMediaPath(null)
      setFileName('Live Webcam')
      setCurrentTime(0)
      setMediaMode('webcam')
      startAudio(audioStream ?? undefined)
      const devs = await navigator.mediaDevices.enumerateDevices()
      setMicDevices(devs.filter(d => d.kind === 'audioinput'))
    } catch (e) {
      // Check TCC status to give an accurate error message
      const perms = await window.api.getMediaPermissions().catch(() => ({ camera: 'unknown', microphone: 'unknown' }))
      const denied = perms.camera === 'denied' || perms.microphone === 'denied'
      const notDetermined = perms.camera === 'not-determined' || perms.microphone === 'not-determined'
      if (denied) {
        setWebcamError('Camera or microphone is blocked. Open System Settings → Privacy & Security → Camera (and Microphone), enable this app, then restart it.')
      } else if (notDetermined) {
        setWebcamError('Camera access requested — if you see a permission banner at the top of your screen, click Allow, then click Webcam again.')
      } else {
        const msg = e instanceof Error ? e.message : String(e)
        setWebcamError(`Could not open camera — it may be in use by another app. Close FaceTime, Zoom, or other camera apps and try again. (${msg})`)
      }
    } finally {
      mediaLoadingRef.current = false
    }
  }

  async function handleImport() {
    if (mediaLoadingRef.current) return
    mediaLoadingRef.current = true
    try {
      const result = await window.api.openMedia()
      if (!result) return
      stopWebcam()  // stops any active mic/blackhole streams
      resetAudio()
      setAudioSource('video')
      ann.setAnnotations([])
      ann.setComments([])
      setMediaPath(result.filePath)
      setFileName(result.fileName)
      setCurrentTime(0)
      setMediaMode('file')
      setVideoEnded(false)
    } finally {
      mediaLoadingRef.current = false
    }
  }

  const handleVideoLoaded = useCallback((duration: number) => {
    const video = videoRef.current
    if (!video) return
    setVideoDimensions({ w: video.videoWidth, h: video.videoHeight })
    setVideoDuration(duration)
  }, [])

  const handleMovementSample = useCallback((t: number, score: number) => {
    setMovementHistory(prev => [...prev, { t, score }])
  }, [])

  const handlePlay = useCallback(() => {
    startAudio()
  }, [startAudio])

  const handlePause = useCallback(() => {
    stopAudio()
  }, [stopAudio])

  function buildComprehensiveSessionHTML() {
    const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
    const TAG_COLORS: Record<string, string> = {
      pacing: '#818cf8', clarity: '#34d399', volume: '#fbbf24',
      posture: '#f472b6', eye_contact: '#60a5fa', argument: '#f87171', general: '#94a3b8'
    }
    const practiceRows = practiceMessagesRef.current.map(m => {
      const isStudent = m.speaker === 'student'
      const label = isStudent ? 'You' : 'Practice Partner'
      const bg = isStudent ? '#eff6ff' : '#f8fafc'
      const border = isStudent ? '#bfdbfe' : '#e2e8f0'
      const time = new Date(m.timestamp).toLocaleTimeString()
      const escaped = m.text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>')
      return `<div style="margin-bottom:10px;padding:10px 14px;background:${bg};border:1px solid ${border};border-radius:8px;"><div style="font-size:11px;color:#64748b;margin-bottom:3px;">${label} — ${time}</div><div style="font-size:13px;color:#0f172a;line-height:1.6;">${escaped}</div></div>`
    }).join('')
    const aiRows = aiMessagesRef.current.map(m => {
      const isUser = m.role === 'user'
      const bg = isUser ? '#eff6ff' : '#f0fdf4'
      const border = isUser ? '#bfdbfe' : '#86efac'
      const label = isUser ? (m.displayName || 'You') : 'AI Coach'
      const escaped = (m.content || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>')
      return `<div style="margin-bottom:10px;padding:10px 14px;background:${bg};border:1px solid ${border};border-radius:8px;"><div style="font-size:11px;color:#64748b;margin-bottom:3px;font-weight:600;">${label}</div><div style="font-size:13px;color:#0f172a;line-height:1.6;">${escaped}</div></div>`
    }).join('')
    const feedbackRows = ann.comments.map(c => `<tr>
      <td style="font-family:monospace;white-space:nowrap;padding:8px 12px;border-bottom:1px solid #e2e8f0;color:#0284c7;font-weight:600;">${fmtTime(c.timestamp)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;"><span style="background:${TAG_COLORS[c.tag]}22;border:1px solid ${TAG_COLORS[c.tag]}66;border-radius:4px;color:${TAG_COLORS[c.tag]};font-size:11px;font-weight:700;padding:2px 7px;text-transform:uppercase;">${c.tag.replace('_',' ')}</span></td>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;color:#475569;font-weight:600;">${c.author}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;color:#1e293b;line-height:1.5;">${c.text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</td>
    </tr>`).join('')

    const hasFeedback = ann.comments.length > 0
    const hasAI = aiMessagesRef.current.length > 0
    const hasPractice = practiceMessagesRef.current.length > 0

    return `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1e293b; margin: 40px; max-width: 900px; }
  h1 { font-size: 22px; margin-bottom: 4px; }
  h2 { font-size: 15px; font-weight: 700; color: #0284c7; margin: 32px 0 12px; border-bottom: 2px solid #bae6fd; padding-bottom: 6px; }
  .meta { color: #64748b; font-size: 13px; margin-bottom: 28px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 8px; }
  th { background: #f0f9ff; border-bottom: 2px solid #bae6fd; color: #0369a1; font-size: 11px; font-weight: 700; letter-spacing: .5px; padding: 8px 12px; text-align: left; text-transform: uppercase; }
  tr:last-child td { border-bottom: none; }
  .empty { color: #94a3b8; font-style: italic; font-size: 13px; }
  @media print { body { margin: 20px; } }
</style>
</head><body>
<h1>Session Report — ${fileName || 'Untitled'}</h1>
<div class="meta">Exported ${new Date().toLocaleString()}${durationSec > 0 ? ` &middot; Duration: ${fmtTime(durationSec)}` : ''}</div>

${hasFeedback ? `<h2>Feedback Notes</h2><table><thead><tr><th>Time</th><th>Tag</th><th>Author</th><th>Comment</th></tr></thead><tbody>${feedbackRows}</tbody></table>` : '<h2>Feedback Notes</h2><p class="empty">No feedback comments recorded.</p>'}

${hasAI ? `<h2>AI Coaching Report</h2>${aiRows}` : ''}

${hasPractice ? `<h2>Practice Session Transcript</h2>${practiceRows}` : ''}

</body></html>`
  }

  async function handleSaveSessionAndClose() {
    const slug = (fileName || 'session').replace(/\.[^.]+$/, '').replace(/\s+/g, '-')
    const datePart = new Date().toISOString().slice(0, 10)
    await window.api.saveNotesAsPDF(buildComprehensiveSessionHTML(), `${slug}-${datePart}.pdf`)
    doClear()
  }

  function buildExportJSON() {
    return JSON.stringify({
      fileName,
      annotations: ann.annotations,
      comments: ann.comments,
      pitchData: audio.pitchHistory,
      decibelData: audio.dbHistory,
      savedAt: new Date().toISOString()
    }, null, 2)
  }

  function buildExportCSV() {
    const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
    const escape = (v: string) => `"${v.replace(/"/g, '""').replace(/\n/g, ' ')}"`
    const rows = [['Timestamp', 'File', 'Author', 'Tag', 'Comment'].join(',')]
    for (const c of ann.comments) {
      rows.push([escape(fmtTime(c.timestamp)), escape(fileName), escape(c.author), escape(c.tag), escape(c.text)].join(','))
    }
    return rows.join('\r\n')
  }

  function buildExportMarkdown() {
    const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
    const lines: string[] = [
      `# Session Feedback — ${fileName || 'Untitled'}`,
      `_Exported ${new Date().toLocaleString()}_`,
      ''
    ]
    if (ann.comments.length === 0) {
      lines.push('_No feedback comments recorded._')
    } else {
      for (const c of ann.comments) {
        lines.push(`## [${fmtTime(c.timestamp)}] ${c.tag.replace('_', ' ')}`)
        lines.push(`**${c.author}** — ${c.text}`)
        lines.push('')
      }
    }
    if (ann.annotations.length > 0) {
      lines.push('---', '', `## Visual Annotations (${ann.annotations.length})`, '')
      for (const a of ann.annotations) {
        lines.push(`- **[${fmtTime(a.timestamp)}]** ${a.type}${a.label ? ` — ${a.label}` : ''}`)
      }
    }
    return lines.join('\n')
  }

  function buildExportText() {
    const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
    const lines: string[] = [
      `SESSION FEEDBACK — ${fileName || 'Untitled'}`,
      `Exported: ${new Date().toLocaleString()}`,
      '='.repeat(50),
      ''
    ]
    if (ann.comments.length === 0) {
      lines.push('No feedback comments recorded.')
    } else {
      for (const c of ann.comments) {
        lines.push(`[${fmtTime(c.timestamp)}] ${c.tag.toUpperCase().replace('_', ' ')}`)
        lines.push(`  ${c.author}: ${c.text}`)
        lines.push('')
      }
    }
    return lines.join('\n')
  }

  function buildExportHTML() {
    const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
    const TAG_COLORS: Record<string, string> = {
      pacing: '#818cf8', clarity: '#34d399', volume: '#fbbf24',
      posture: '#f472b6', eye_contact: '#60a5fa', argument: '#f87171', general: '#94a3b8'
    }
    const rows = ann.comments.map(c => `
      <tr>
        <td style="font-family:monospace;white-space:nowrap;padding:8px 12px;border-bottom:1px solid #e2e8f0;color:#0284c7;font-weight:600;">${fmtTime(c.timestamp)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;"><span style="background:${TAG_COLORS[c.tag]}22;border:1px solid ${TAG_COLORS[c.tag]}66;border-radius:4px;color:${TAG_COLORS[c.tag]};font-size:11px;font-weight:700;padding:2px 7px;text-transform:uppercase;">${c.tag.replace('_', ' ')}</span></td>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;color:#475569;font-weight:600;">${c.author}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;color:#1e293b;line-height:1.5;">${c.text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</td>
      </tr>`).join('')
    return `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1e293b; margin: 40px; }
  h1 { font-size: 22px; margin-bottom: 4px; }
  .meta { color: #64748b; font-size: 13px; margin-bottom: 28px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { background: #f0f9ff; border-bottom: 2px solid #bae6fd; color: #0369a1; font-size: 11px; font-weight: 700; letter-spacing: .5px; padding: 8px 12px; text-align: left; text-transform: uppercase; }
  tr:last-child td { border-bottom: none; }
  @media print { body { margin: 20px; } }
</style>
</head><body>
<h1>Session Feedback — ${fileName || 'Untitled'}</h1>
<p class="meta">Exported ${new Date().toLocaleString()}</p>
${ann.comments.length === 0
  ? '<p style="color:#64748b;font-style:italic;">No feedback comments recorded.</p>'
  : `<table><thead><tr><th>Time</th><th>Tag</th><th>Author</th><th>Comment</th></tr></thead><tbody>${rows}</tbody></table>`}
</body></html>`
  }

  async function handleExport(format: 'json' | 'csv' | 'md' | 'txt' | 'pdf' | 'docx') {
    const slug = (fileName || 'session-notes').replace(/\.[^.]+$/, '').replace(/\s+/g, '-')
    if (format === 'pdf') {
      await window.api.saveNotesAsPDF(buildExportHTML(), `${slug}.pdf`)
      return
    }
    if (format === 'docx') {
      await window.api.saveNotesAsDocx({
        fileName,
        exportedAt: new Date().toLocaleString(),
        comments: ann.comments.map(c => ({
          timestamp: c.timestamp,
          author: c.author,
          tag: c.tag,
          text: c.text
        }))
      }, `${slug}.docx`)
      return
    }
    const data = format === 'json' ? buildExportJSON()
               : format === 'csv' ? buildExportCSV()
               : format === 'md'  ? buildExportMarkdown()
               : buildExportText()
    await window.api.saveNotesAs(data, format)
  }

  const [isExportingVideo, setIsExportingVideo] = useState(false)
  const [videoExportMsg, setVideoExportMsg] = useState<{ ok: boolean; text: string } | null>(null)

  async function handleExportAnnotatedVideo() {
    if (!mediaPath || !window.api.exportAnnotatedVideo) return
    setIsExportingVideo(true)
    setVideoExportMsg(null)
    try {
      const pitchPng   = pitchGraphRef.current?.toDataURL()   ?? ''
      const decibelPng = decibelGraphRef.current?.toDataURL() ?? ''
      const commentPayload = ann.comments.map(c => ({ timestamp: c.timestamp, tag: c.tag, text: c.text }))
      const result = await window.api.exportAnnotatedVideo(mediaPath, pitchPng, decibelPng, commentPayload)
      if (!result) return  // cancelled
      if (typeof result === 'object' && 'error' in result) {
        setVideoExportMsg({ ok: false, text: `Export failed: ${result.error}` })
      } else {
        setVideoExportMsg({ ok: true, text: `Saved: ${result}` })
      }
    } catch (e) {
      setVideoExportMsg({ ok: false, text: `Error: ${e instanceof Error ? e.message : String(e)}` })
    } finally {
      setIsExportingVideo(false)
    }
  }

  async function handleLoad() {
    const data = await window.api.loadFeedback()
    if (!data) return
    if (Array.isArray(data.annotations)) ann.setAnnotations(data.annotations as never)
    if (Array.isArray(data.comments)) ann.setComments(data.comments as never)
  }

  function seekTo(t: number) {
    if (videoRef.current) videoRef.current.currentTime = t
  }

  // Compute overlay dimensions from the rendered video element
  const [overlayRect, setOverlayRect] = useState({ w: 0, h: 0 })
  const videoWrapRef = useRef<HTMLDivElement>(null)

  function handleResizeObserver() {
    if (videoWrapRef.current) {
      const video = videoWrapRef.current.querySelector('video')
      if (video) {
        setOverlayRect({ w: video.clientWidth, h: video.clientHeight })
      }
    }
  }

  const graphWidth = 560

  const durationSec = videoDuration
  const hasAudioData = audio.pitchHistory.length > 0 || audio.dbHistory.length > 0

  return (
    <div style={styles.root}>
      {/* Source picker modal — only shown when legacy source list is populated
           (Electron 30+ uses the native macOS picker via getDisplayMedia instead) */}
      {screen.recorderState === 'picking' && screen.sources.length > 0 && (
        <SourcePicker
          sources={screen.sources}
          onSelect={screen.startRecording}
          onCancel={screen.cancelPicker}
        />
      )}

      {/* Close session confirmation modal */}
      {showCloseConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 10, padding: 28, maxWidth: 440, width: '90%', boxShadow: '0 8px 32px rgba(0,0,0,0.25)' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#1e293b', marginBottom: 8 }}>Save before closing?</div>
            <div style={{ fontSize: 13, color: '#475569', marginBottom: 6, lineHeight: 1.5 }}>
              Your session includes:
            </div>
            <ul style={{ fontSize: 12, color: '#475569', margin: '0 0 16px 0', paddingLeft: 18, lineHeight: 1.8 }}>
              {ann.comments.length > 0 && <li><strong>{ann.comments.length}</strong> feedback comment{ann.comments.length !== 1 ? 's' : ''}</li>}
              {ann.annotations.length > 0 && <li><strong>{ann.annotations.length}</strong> video annotation{ann.annotations.length !== 1 ? 's' : ''}</li>}
              {aiMessagesRef.current.length > 0 && <li>AI coaching conversation ({aiMessagesRef.current.length} messages)</li>}
              {practiceMessagesRef.current.length > 0 && <li>Practice session transcript ({practiceMessagesRef.current.length} turns)</li>}
              {audio.pitchHistory.length > 0 && <li>Pitch &amp; volume data</li>}
            </ul>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button
                onClick={handleSaveSessionAndClose}
                style={{ ...btnStyle('#0284c7'), fontSize: 13, padding: '9px 16px', textAlign: 'left' }}
              >
                📄 Save session PDF &amp; close
              </button>
              <button
                onClick={async () => { await handleExport('pdf'); doClear() }}
                style={{ ...btnStyle('#059669'), fontSize: 13, padding: '9px 16px', textAlign: 'left' }}
              >
                📝 Save feedback notes only &amp; close
              </button>
              <button
                onClick={doClear}
                style={{ ...btnStyle('#dc2626'), fontSize: 13, padding: '9px 16px', textAlign: 'left' }}
              >
                ✕ Close without saving
              </button>
              <button
                onClick={() => setShowCloseConfirm(false)}
                style={{ ...btnStyle('#64748b'), fontSize: 13, padding: '9px 16px', textAlign: 'left' }}
              >
                ← Stay in session
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BlackHole setup modal */}
      {showBlackHoleSetup && <BlackHoleSetup onClose={() => setShowBlackHoleSetup(false)} />}

      {/* Sidebar */}
      <aside style={{ ...styles.sidebar, width: sidebarWidth, minWidth: sidebarWidth }}>
        {/* Traffic-light clearance — draggable titlebar zone */}
        <div style={{ height: 38, WebkitAppRegion: 'drag', flexShrink: 0 } as React.CSSProperties} />
        <div style={styles.sidebarHeader}>
          <img
            src={logoUrl}
            alt="LexCommons Multimedia Mentor"
            style={{ width: '100%', height: 'auto', objectFit: 'contain', objectPosition: 'left center' }}
          />
        </div>

        {/* Domain toggle */}
        <DomainBar domain={domain} onSelect={setDomain} />

        {/* Export / Import Notes */}
        <div style={{ display: 'flex', gap: 6, padding: '6px 10px', borderBottom: '1px solid #bae6fd', background: '#f0f9ff' }}>
          {/* Export dropdown */}
          <div ref={exportBtnRef} style={{ flex: 1, position: 'relative' }}>
            <button
              onClick={() => setShowExportMenu(v => !v)}
              disabled={!fileName}
              title="Export session notes in your preferred format"
              style={{ ...btnStyle('#1e293b'), width: '100%', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
            >
              Export Notes <span style={{ fontSize: 9 }}>▾</span>
            </button>
            {showExportMenu && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                zIndex: 200,
                background: '#fff',
                border: '1px solid #bae6fd',
                borderRadius: 7,
                boxShadow: '0 4px 16px rgba(0,0,0,0.13)',
                marginTop: 3,
                minWidth: 190,
                overflow: 'hidden'
              }}>
                {([
                  { format: 'pdf'  as const, icon: '📄', label: 'PDF Document', sub: 'print-ready, universal' },
                  { format: 'docx' as const, icon: '📝', label: 'Word Document', sub: 'Word, Google Docs, Pages' },
                  { format: 'csv'  as const, icon: '⊞',  label: 'CSV Spreadsheet', sub: 'Excel, Numbers, Sheets' },
                  { format: 'md'   as const, icon: '✎',  label: 'Markdown', sub: 'Notion, Obsidian, GitHub' },
                  { format: 'txt'  as const, icon: '≡',  label: 'Plain Text', sub: 'any text editor' },
                  { format: 'json' as const, icon: '{}', label: 'JSON', sub: 're-importable, full data' },
                ] as const).map(({ format, icon, label, sub }) => (
                  <button
                    key={format}
                    onClick={() => { handleExport(format); setShowExportMenu(false) }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      borderBottom: '1px solid #f0f9ff',
                      color: '#1e293b',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '8px 12px',
                      textAlign: 'left',
                      width: '100%',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#f0f9ff')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <span style={{ fontSize: 13, fontFamily: 'monospace', width: 16, textAlign: 'center', flexShrink: 0 }}>{icon}</span>
                    <span style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 600 }}>{label}</div>
                      <div style={{ fontSize: 10, color: '#64748b' }}>{sub}</div>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button onClick={handleLoad} title="Import notes from a JSON or CSV file" style={{ ...btnStyle('#1e293b'), flex: 1, fontSize: 11 }}>Import Notes</button>
        </div>

        {/* Annotated video export — only shown when a file session is active */}
        {fileName && mediaMode === 'file' && mediaPath && (
          <div style={{ padding: '6px 10px', borderBottom: '1px solid #bae6fd', background: '#f0fdf4' }}>
            <button
              onClick={handleExportAnnotatedVideo}
              disabled={isExportingVideo}
              title="Export video with pitch/volume graphs and comments burned in"
              style={{ ...btnStyle('#059669'), width: '100%', fontSize: 11 }}
            >
              {isExportingVideo ? '⏳ Exporting…' : '🎬 Export Annotated Video'}
            </button>
            {videoExportMsg && (
              <div style={{ fontSize: 10, marginTop: 4, color: videoExportMsg.ok ? '#16a34a' : '#dc2626', wordBreak: 'break-all' }}>
                {videoExportMsg.text}
              </div>
            )}
          </div>
        )}

        {/* Close Project button — only shown when a session is active */}
        {fileName && (
          <div style={{ padding: '6px 10px', borderBottom: '1px solid #bae6fd', background: '#fff7ed' }}>
            <button
              onClick={handleCloseSession}
              title="Close the current project and start fresh"
              style={{ ...btnStyle('#dc2626'), width: '100%', fontSize: 11 }}
            >
              ✕ Close Project
            </button>
          </div>
        )}

        {/* Tab bar */}
        <div style={styles.tabBar}>
          {(['feedback', 'annotations', 'ai', 'practice', 'camera', 'report'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                ...styles.tab,
                background: activeTab === tab ? '#0284c7' : 'transparent',
                color: activeTab === tab ? '#fff' : '#64748b'
              }}
            >
              {{ feedback: 'Feedback', annotations: 'Notes', ai: 'AI', practice: 'Practice', camera: 'Camera', report: 'Report' }[tab]}
            </button>
          ))}
        </div>

        {/* Sidebar content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px' }}>
          {activeTab === 'feedback' && (
            <FeedbackPanel
              comments={ann.comments}
              currentTime={currentTime}
              domain={domain}
              onAdd={ann.addComment}
              onDelete={ann.deleteComment}
              onSeek={seekTo}
            />
          )}
          {activeTab === 'annotations' && (
            <AnnotationsList
              annotations={ann.annotations}
              currentTime={currentTime}
              onDelete={ann.deleteAnnotation}
              onSeek={seekTo}
            />
          )}
          {activeTab === 'ai' && (
            <AIFeedbackPanel
              state={ai.state}
              apiKey={ai.apiKey}
              provider={ai.provider}
              role={ai.role}
              domain={domain}
              hasData={hasAudioData}
              hasVideo={mediaMode === 'file' && !!mediaPath}
              videoEnded={videoEnded}
              knowledgeScope={ai.knowledgeScope}
              onSaveKnowledgeScope={ai.saveKnowledgeScope}
              onSend={ai.send}
              onSendWithImages={ai.sendWithImages}
              onStop={ai.stop}
              onClear={ai.clearChat}
              videoRef={videoRef}
              getContext={() => ({
                pitchHistory: audio.pitchHistory,
                dbHistory: audio.dbHistory,
                comments: ann.comments,
                fileName,
                durationSec
              })}
            />
          )}
          {activeTab === 'practice' && (
            <LivePracticePanel
              apiKey={ai.apiKey}
              provider={ai.provider}
              domain={domain}
              onSessionData={msgs => { practiceMessagesRef.current = msgs }}
            />
          )}
          {activeTab === 'camera' && (
            <CameraPanel
              cameraState={camera.cameraState}
              elapsedSec={camera.elapsedSec}
              devices={camera.devices}
              selectedDeviceId={camera.selectedDeviceId}
              error={camera.error}
              videoPreviewRef={camera.videoPreviewRef}
              onRefreshDevices={camera.refreshDevices}
              onSelectDevice={camera.setSelectedDeviceId}
              onStartPreview={camera.startPreview}
              onStopPreview={camera.stopPreview}
              onStartRecording={camera.startRecording}
              onPauseRecording={camera.pauseRecording}
              onResumeRecording={camera.resumeRecording}
              onStopRecording={camera.stopRecording}
            />
          )}
          {activeTab === 'report' && (
            <div style={{ padding: '4px 0' }}>
              {fileName ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ fontWeight: 600, color: '#1e293b', fontSize: 12, wordBreak: 'break-all', lineHeight: 1.4 }}>{fileName}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    <div style={{ background: '#f0f9ff', borderRadius: 7, padding: '8px 10px', border: '1px solid #bae6fd', textAlign: 'center' }}>
                      <div style={{ fontWeight: 700, color: '#0284c7', fontSize: 20, lineHeight: 1 }}>{ann.comments.length}</div>
                      <div style={{ color: '#64748b', fontSize: 10, marginTop: 2 }}>feedback items</div>
                    </div>
                    <div style={{ background: '#f0fdf4', borderRadius: 7, padding: '8px 10px', border: '1px solid #86efac', textAlign: 'center' }}>
                      <div style={{ fontWeight: 700, color: '#16a34a', fontSize: 20, lineHeight: 1 }}>
                        {durationSec >= 60 ? `${Math.floor(durationSec / 60)}m` : `${Math.round(durationSec)}s`}
                      </div>
                      <div style={{ color: '#64748b', fontSize: 10, marginTop: 2 }}>duration</div>
                    </div>
                  </div>
                  <div style={{ background: '#faf5ff', borderRadius: 7, padding: '8px 10px', border: '1px solid #e9d5ff', textAlign: 'center' }}>
                    <div style={{ fontWeight: 700, color: '#7c3aed', fontSize: 20, lineHeight: 1 }}>{audio.pitchHistory.length}</div>
                    <div style={{ color: '#64748b', fontSize: 10, marginTop: 2 }}>pitch samples</div>
                  </div>
                  {ann.annotations.length > 0 && (
                    <div style={{ background: '#fff7ed', borderRadius: 7, padding: '8px 10px', border: '1px solid #fed7aa', textAlign: 'center' }}>
                      <div style={{ fontWeight: 700, color: '#ea580c', fontSize: 20, lineHeight: 1 }}>{ann.annotations.length}</div>
                      <div style={{ color: '#64748b', fontSize: 10, marginTop: 2 }}>annotations</div>
                    </div>
                  )}
                </div>
              ) : (
                <p style={{ color: '#94a3b8', fontSize: 12, textAlign: 'center', marginTop: 16, lineHeight: 1.5 }}>
                  Import a file or start a webcam session, then return here for the full report.
                </p>
              )}
            </div>
          )}
        </div>

        {/* ── Settings & AI Keys drawer (bottom of sidebar) ─────── */}
        <div style={{ borderTop: '2px solid #bae6fd', flexShrink: 0 }}>
          {/* Toggle bar */}
          <button
            onClick={() => setShowSettingsDrawer(v => !v)}
            style={{
              width: '100%', border: 'none', background: '#e0f2fe',
              color: '#0369a1', cursor: 'pointer', display: 'flex',
              alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 14px', fontSize: 12, fontWeight: 700
            }}
          >
            <span>⚙ Settings &amp; AI Keys</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {ai.apiKey
                ? <span style={{ fontSize: 10, fontWeight: 600, color: '#16a34a', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 10, padding: '1px 7px' }}>Key saved ✓</span>
                : <span style={{ fontSize: 10, fontWeight: 600, color: '#dc2626', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 10, padding: '1px 7px' }}>No key</span>
              }
              <span>{showSettingsDrawer ? '▴' : '▾'}</span>
            </span>
          </button>

          {/* Drawer content */}
          {showSettingsDrawer && (
            <div style={{ background: '#f8fafc', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>

              {/* Provider selector */}
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 5 }}>AI Provider</div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {(['anthropic', 'openai', 'gemini'] as const).map(p => {
                    const cfg = PROVIDER_CONFIG[p]
                    const active = ai.provider === p
                    return (
                      <button key={p} onClick={() => ai.saveProvider(p)} style={{
                        flex: 1, background: active ? '#eff6ff' : '#fff',
                        border: `1.5px solid ${active ? '#3b82f6' : '#e2e8f0'}`,
                        borderRadius: 7, color: active ? '#1d4ed8' : '#475569',
                        cursor: 'pointer', fontSize: 10, fontWeight: active ? 700 : 500,
                        padding: '5px 4px', textAlign: 'center', lineHeight: 1.3
                      }}>
                        <div style={{ fontSize: 13 }}>{cfg.icon}</div>
                        <div>{p === 'anthropic' ? 'Claude' : p === 'openai' ? 'GPT-4o' : 'Gemini'}</div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* API Key */}
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 5 }}>
                  {PROVIDER_CONFIG[ai.provider].label} API Key
                </div>
                <SidebarKeyInput
                  apiKey={ai.apiKey}
                  provider={ai.provider}
                  onSave={ai.saveApiKey}
                />
              </div>

              {/* Role */}
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 5 }}>Role</div>
                <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                  {(['professor', 'student'] as const).map(r => (
                    <button key={r} onClick={() => ai.saveRole(r)} style={{
                      flex: 1, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600,
                      padding: '5px 0',
                      background: ai.role === r ? (r === 'professor' ? '#7c3aed' : '#0369a1') : '#f1f5f9',
                      color: ai.role === r ? '#fff' : '#64748b'
                    }}>
                      {r === 'professor' ? 'Professor' : 'Student'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Knowledge Scope */}
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 }}>Knowledge Scope</div>
                <input
                  type="range" min={1} max={5} step={1}
                  value={ai.knowledgeScope}
                  onChange={e => ai.saveKnowledgeScope(parseInt(e.target.value, 10) as KnowledgeScope)}
                  style={{ width: '100%', cursor: 'pointer', accentColor: '#3b82f6' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 1, marginBottom: 4 }}>
                  {([1, 2, 3, 4, 5] as KnowledgeScope[]).map(n => (
                    <span key={n} style={{ fontSize: 9, color: ai.knowledgeScope === n ? '#1d4ed8' : '#94a3b8', fontWeight: ai.knowledgeScope === n ? 700 : 400, cursor: 'pointer', textAlign: 'center', width: '20%' }}
                      onClick={() => ai.saveKnowledgeScope(n)}>
                      {SCOPE_LABELS[n].icon}
                    </span>
                  ))}
                </div>
                <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 5, padding: '3px 7px', fontSize: 10, color: '#1e40af', lineHeight: 1.4 }}>
                  <strong>{SCOPE_LABELS[ai.knowledgeScope].icon} {SCOPE_LABELS[ai.knowledgeScope].label}</strong> — {SCOPE_LABELS[ai.knowledgeScope].description}
                </div>
              </div>

            </div>
          )}
        </div>
      </aside>

      {/* Sidebar ↔ Main resize handle */}
      <div
        onMouseDown={(e) => {
          e.preventDefault()
          const startX = e.clientX
          const startW = sidebarWidth
          function onMove(ev: MouseEvent) { setSidebarWidth(Math.max(200, Math.min(520, startW + (ev.clientX - startX)))) }
          function onUp() { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
          document.addEventListener('mousemove', onMove)
          document.addEventListener('mouseup', onUp)
        }}
        style={{ width: 5, cursor: 'col-resize', flexShrink: 0, background: 'transparent', position: 'relative', zIndex: 10 }}
        title="Drag to resize sidebar"
      >
        <div style={{ position: 'absolute', top: '50%', left: 1, transform: 'translateY(-50%)', width: 3, height: 32, background: '#bae6fd', borderRadius: 2 }} />
      </div>

      {/* Main area — report view takes over when that tab is active */}
      {activeTab === 'report' && (
        <main style={{ ...styles.main, padding: 0, overflow: 'hidden' }}>
          <ReportPanel
            pitchHistory={audio.pitchHistory}
            dbHistory={audio.dbHistory}
            comments={ann.comments}
            movementHistory={movementHistory}
            fileName={fileName}
            durationSec={durationSec}
            apiKey={ai.apiKey}
            pitchGraphImage={pitchGraphRef.current?.toDataURL() ?? null}
            decibelGraphImage={decibelGraphRef.current?.toDataURL() ?? null}
            onGenerateNarrative={ai.generateOnce}
          />
        </main>
      )}

      {/* Main area */}
      {activeTab !== 'report' && <main style={styles.main}>
        {/* Toolbar */}
        <div style={styles.toolbar}>
          <button onClick={handleImport} style={btnStyle('#3b82f6')}>
            Import Video / Audio
          </button>
          <button
            onClick={handleWebcam}
            style={{
              ...btnStyle(mediaMode === 'webcam' ? '#dc2626' : '#059669'),
              ...(mediaMode === 'webcam' ? { boxShadow: '0 0 0 2px #fca5a5' } : {})
            }}
            title={mediaMode === 'webcam' ? 'Webcam is live — click to restart' : 'Start webcam session'}
          >
            {mediaMode === 'webcam' ? '● Live' : '📷 Webcam'}
          </button>
          {webcamError && (
            <span style={{ color: '#dc2626', fontSize: 11, maxWidth: 260 }}>{webcamError}</span>
          )}
          {fileName && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={styles.fileName}>{fileName}</span>
              <button
                onClick={handleCloseSession}
                title="Close this video and start a new session"
                style={btnStyle('#1e293b')}
              >
                Close ×
              </button>
            </div>
          )}

          {screen.recorderState === 'idle' && !screen.savedPath && (
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                onClick={() => {
                  // Build the audio stream for the recording:
                  // - webcam/mic/blackhole: pass the already-open stream (avoids re-opening a device in use)
                  // - file mode: tap the Web Audio graph output (captureStream) so we record
                  //   the video's clean audio track rather than falling back to the mic
                  // - null means "no audio" — openPicker skips getUserMedia fallback
                  const audioStreamForRecording =
                    mediaMode === 'webcam'          ? (webcamStreamRef.current ?? undefined) :
                    audioSource === 'mic'           ? (micStream ?? undefined) :
                    audioSource === 'blackhole'     ? (blackholeStream ?? undefined) :
                    mediaMode === 'file'            ? (audio.captureStream ?? null) :
                    undefined
                  screen.openPicker(audioStreamForRecording)
                }}
                style={btnStyle('#7c3aed')}
              >
                ⏺ Record Screen
              </button>
              {/* Audio source picker */}
              <div style={{ position: 'relative' }} data-audio-picker>
                <button
                  ref={audioPickerBtnRef}
                  onClick={() => setShowAudioPicker(v => !v)}
                  title="Choose audio source for analysis"
                  style={{ ...btnStyle(showAudioPicker ? '#0284c7' : '#475569'), fontSize: 11, padding: '5px 9px' }}
                >
                  🎙 Audio Source
                </button>
                {showAudioPicker && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, marginTop: 4,
                    background: '#fff', border: '1px solid #bae6fd', borderRadius: 10,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.15)', zIndex: 9000,
                    minWidth: 240, padding: '8px 0'
                  }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, padding: '4px 14px 6px' }}>
                      Audio source for analysis
                    </div>

                    {/* Video file audio — always shown; active when a file is loaded */}
                    {mediaMode !== 'webcam' && (
                      <AudioPickerOption
                        active={audioSource === 'video'}
                        icon="🎬"
                        label="Video file audio"
                        sub={mediaMode === 'file' ? 'Uses the audio track from your imported video' : 'Import a video/audio file to use this source'}
                        onClick={() => selectAudioDevice('video')}
                      />
                    )}

                    {/* Webcam mic — selectable in webcam mode */}
                    {mediaMode === 'webcam' && (
                      <AudioPickerOption
                        active={audioSource === 'video'}
                        icon="📷"
                        label="Webcam microphone"
                        sub="Default: use the webcam's built-in mic"
                        onClick={() => selectAudioDevice('video')}
                      />
                    )}

                    {/* Mic devices — list all available */}
                    {micDevices.length > 0 && (
                      <>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#cbd5e1', textTransform: 'uppercase', letterSpacing: 0.5, padding: '8px 14px 4px' }}>
                          Microphones
                        </div>
                        {micDevices
                          .filter(d => !d.label.toLowerCase().includes('blackhole'))
                          .map(d => (
                            <AudioPickerOption
                              key={d.deviceId}
                              active={audioSource === 'mic' && selectedMicId === d.deviceId}
                              icon={d.label.toLowerCase().includes('built-in') || d.label.toLowerCase().includes('internal') ? '🖥' : '🎙'}
                              label={d.label || `Microphone ${d.deviceId.slice(0, 6)}`}
                              sub={d.label.toLowerCase().includes('built-in') || d.label.toLowerCase().includes('internal') ? 'Internal microphone' : 'External microphone'}
                              onClick={() => selectAudioDevice(d.deviceId)}
                            />
                          ))
                        }
                      </>
                    )}

                    {/* BlackHole */}
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#cbd5e1', textTransform: 'uppercase', letterSpacing: 0.5, padding: '8px 14px 4px' }}>
                      System audio
                    </div>
                    {micDevices.some(d => d.label.toLowerCase().includes('blackhole')) ? (
                      <AudioPickerOption
                        active={audioSource === 'blackhole'}
                        icon="◈"
                        label="BlackHole 2ch"
                        sub="Captures system audio — route your Mac's output through BlackHole in Audio MIDI Setup, then select this"
                        onClick={() => selectAudioDevice('blackhole')}
                      />
                    ) : (
                      <AudioPickerOption
                        active={false}
                        icon="◈"
                        label="BlackHole 2ch"
                        sub="Not installed — click to set up"
                        onClick={() => { setShowAudioPicker(false); setShowBlackHoleSetup(true) }}
                      />
                    )}

                  </div>
                )}
              </div>
              {micError && (
                <span style={{ color: '#dc2626', fontSize: 11, alignSelf: 'center' }}>{micError}</span>
              )}
            </div>
          )}
          {(screen.recorderState === 'recording' || screen.recorderState === 'paused' || screen.recorderState === 'saving') && (
            <>
              <RecordingIndicator
                elapsedSec={screen.elapsedSec}
                state={screen.recorderState}
                hasAudio={screen.hasAudio}
                videoRef={videoRef}
                onPause={screen.pauseRecording}
                onResume={screen.resumeRecording}
                onStop={screen.stopRecording}
              />
              {screen.audioError && (
                <span style={{ color: '#b45309', fontSize: 11, alignSelf: 'center' }}>
                  ⚠ {screen.audioError} — recording video only
                </span>
              )}
            </>
          )}
          {screen.savedPath && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: screen.savedAsFallback ? '#fffbeb' : '#f0fdf4', border: `1px solid ${screen.savedAsFallback ? '#fcd34d' : '#86efac'}`, borderRadius: 6, padding: '5px 10px' }}>
              <span style={{ color: screen.savedAsFallback ? '#92400e' : '#15803d', fontSize: 12, fontWeight: 600 }}>
                {screen.savedAsFallback ? '⚠ Saved as WebM (MP4 conversion unavailable)' : '✓ Recording saved'}
              </span>
              <span style={{ color: '#64748b', fontSize: 11 }}>— share this video with your student, or use Report → Export PDF for structured feedback</span>
              <button
                onClick={() => { window.api.openPath(screen.savedPath!); screen.clearSavedPath() }}
                style={{ ...btnStyle('#15803d'), fontSize: 11, padding: '3px 8px' }}
              >
                Show in Finder
              </button>
              <button
                onClick={screen.clearSavedPath}
                style={{ background: 'transparent', border: 'none', color: '#86efac', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 0 }}
              >
                ×
              </button>
            </div>
          )}

          <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
            {/* Annotation tools */}
            <span style={{ color: '#475569', fontSize: 12, alignSelf: 'center', marginRight: 4 }}>Draw:</span>
            {(['rect', 'circle', 'arrow', 'text'] as AnnotationTool[]).map(t => (
              <button
                key={t!}
                onClick={() => setActiveTool(activeTool === t ? null : t)}
                style={{
                  ...btnStyle(activeTool === t ? '#6366f1' : '#1e293b'),
                  minWidth: 36
                }}
              >
                {{ rect: '▭', circle: '◯', arrow: '↗', text: 'T' }[t!]}
              </button>
            ))}
            {/* Color swatches */}
            {COLORS.map(c => (
              <button
                key={c}
                onClick={() => setActiveColor(c)}
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  background: c,
                  border: activeColor === c ? '2px solid #0f172a' : '2px solid transparent',
                  cursor: 'pointer',
                  padding: 0
                }}
              />
            ))}
            <button
              onClick={() => setShowAnnotationOverlay(v => !v)}
              style={btnStyle(showAnnotationOverlay ? '#1e293b' : '#0f172a')}
            >
              {showAnnotationOverlay ? 'Annotations On' : 'Annotations Off'}
            </button>
          </div>
        </div>

        {/* Video + overlay */}
        <div
          ref={videoWrapRef}
          style={{
            position: 'relative', background: '#000', borderRadius: 8, overflow: 'hidden',
            flexShrink: 0,
            marginTop: 8,
            height: mediaMode !== 'none' ? videoAreaHeight : undefined
          }}
          onMouseEnter={handleResizeObserver}
        >
          {mediaMode === 'file' && mediaPath ? (
            <>
              <VideoPlayer
                ref={videoRef}
                src={`media://local${encodeURI(mediaPath)}`}
                onPlay={handlePlay}
                onPause={handlePause}
                onTimeUpdate={setCurrentTime}
                onLoaded={handleVideoLoaded}
                onEnded={() => setVideoEnded(true)}
              />
              {showAnnotationOverlay && overlayRect.w > 0 && (
                <div style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
                  <AnnotationLayer
                    annotations={ann.annotations}
                    currentTime={currentTime}
                    onAdd={ann.addAnnotation}
                    onDelete={ann.deleteAnnotation}
                    tool={activeTool}
                    color={activeColor}
                    width={overlayRect.w}
                    height={overlayRect.h}
                  />
                </div>
              )}
              {activeTool && (
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: overlayRect.w,
                  height: overlayRect.h,
                  cursor: 'crosshair'
                }}>
                  <AnnotationLayer
                    annotations={showAnnotationOverlay ? ann.annotations : []}
                    currentTime={currentTime}
                    onAdd={ann.addAnnotation}
                    onDelete={ann.deleteAnnotation}
                    tool={activeTool}
                    color={activeColor}
                    width={overlayRect.w}
                    height={overlayRect.h}
                  />
                </div>
              )}
            </>
          ) : mediaMode === 'webcam' ? (
            <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', background: '#000', width: '100%', height: '100%' }}>
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', borderRadius: 8 }}
              />
              {/* LIVE badge */}
              <div style={{ position: 'absolute', top: 10, left: 12, background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 4, letterSpacing: 0.5 }}>
                LIVE
              </div>
              {/* Device control bar */}
              <div style={{ position: 'absolute', bottom: 10, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 8 }}>
                {/* Mic picker */}
                <label style={devCtrl}>
                  <span>🎙</span>
                  <select
                    value={selectedMicId}
                    onChange={e => setSelectedMicId(e.target.value)}
                    style={devSelect}
                  >
                    {micDevices.map(d => (
                      <option key={d.deviceId} value={d.deviceId}>{d.label || 'Microphone'}</option>
                    ))}
                  </select>
                </label>
                {/* Speaker picker */}
                {outputDevices.length > 0 && (
                  <label style={devCtrl}>
                    <span>🔊</span>
                    <select
                      value={selectedOutputId}
                      onChange={e => {
                        setSelectedOutputId(e.target.value)
                        const v = videoRef.current as HTMLVideoElement & { setSinkId?: (id: string) => Promise<void> }
                        v?.setSinkId?.(e.target.value).catch(() => {})
                      }}
                      style={devSelect}
                    >
                      {outputDevices.map(d => (
                        <option key={d.deviceId} value={d.deviceId}>{d.label || 'Speaker'}</option>
                      ))}
                    </select>
                  </label>
                )}
                {/* Camera picker */}
                <label style={devCtrl}>
                  <span>📷</span>
                  <select
                    value={selectedCameraId}
                    onChange={e => { setSelectedCameraId(e.target.value) }}
                    style={devSelect}
                    title="Change camera — click Webcam button to apply"
                  >
                    {cameraDevices.map(d => (
                      <option key={d.deviceId} value={d.deviceId}>{d.label || 'Camera'}</option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
          ) : (
            <div style={styles.placeholder}>
              <div style={{ fontSize: 14, color: '#e2e8f0', marginBottom: 16, fontWeight: 500, letterSpacing: 0.2, textAlign: 'center', maxWidth: 520, lineHeight: 1.6 }}>
                Record or import oral advocacy practice — get real-time pitch &amp; volume analysis, annotate video, and AI coaching
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button onClick={handleImport} style={{ ...btnStyle('#3b82f6'), fontSize: 14, padding: '10px 20px' }}>
                  Import Video / Audio
                </button>
                <button onClick={handleWebcam} style={{ ...btnStyle('#059669'), fontSize: 14, padding: '10px 20px' }}>
                  📷 Use Webcam
                </button>
              </div>
              {/* Device pickers — shown before webcam starts so user can select camera first */}
              {cameraDevices.length > 0 && (
                <div style={{ display: 'flex', gap: 12, marginTop: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, color: '#334155', background: '#fff', borderRadius: 8, padding: '6px 10px', border: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: 20 }}>📷</span>
                    <select value={selectedCameraId} onChange={e => setSelectedCameraId(e.target.value)}
                      style={{ fontSize: 12, padding: '3px 6px', borderRadius: 5, border: '1px solid #cbd5e1', background: '#f8fafc', color: '#334155', maxWidth: 180 }}>
                      {cameraDevices.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || 'Camera'}</option>)}
                    </select>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, color: '#334155', background: '#fff', borderRadius: 8, padding: '6px 10px', border: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: 20 }}>🎙</span>
                    <select value={selectedMicId} onChange={e => setSelectedMicId(e.target.value)}
                      style={{ fontSize: 12, padding: '3px 6px', borderRadius: 5, border: '1px solid #cbd5e1', background: '#f8fafc', color: '#334155', maxWidth: 180 }}>
                      {micDevices.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || 'Microphone'}</option>)}
                    </select>
                  </label>
                </div>
              )}
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 12 }}>
                Supports MP4, MOV, WebM, MKV, MP3, WAV, M4A
              </div>
              {webcamError && (
                <div style={{ marginTop: 12, background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 7, color: '#dc2626', fontSize: 12, padding: '8px 12px', maxWidth: 420, lineHeight: 1.5 }}>
                  {webcamError}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Video ↔ Graphs resize handle */}
        {(mediaMode === 'file' && mediaPath || mediaMode === 'webcam') && (
          <div
            onMouseDown={(e) => {
              e.preventDefault()
              const startY = e.clientY
              const startH = videoAreaHeight
              function onMove(ev: MouseEvent) { setVideoAreaHeight(Math.max(80, Math.min(700, startH + (ev.clientY - startY)))) }
              function onUp() { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
              document.addEventListener('mousemove', onMove)
              document.addEventListener('mouseup', onUp)
            }}
            style={{ height: 10, cursor: 'row-resize', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title="Drag to resize video area"
          >
            <div style={{ width: 48, height: 3, background: '#bae6fd', borderRadius: 2 }} />
          </div>
        )}

        {/* Graphs — file mode and webcam mode — scrollable, takes remaining height */}
        {(mediaMode === 'file' && mediaPath || mediaMode === 'webcam') && (
          <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, paddingBottom: 12 }}>
          <div style={styles.graphs}>
            {/* Audio source indicator */}
            <AudioSourceBar
              source={audioSource}
              mediaMode={mediaMode}
              micDevices={micDevices}
              selectedMicId={selectedMicId}
            />

            {/* Pitch graph + Body tracker side by side */}
            <div style={{ display: 'flex', gap: 0, alignItems: 'flex-start' }}>
              <PitchGraph
                ref={pitchGraphRef}
                samples={audio.pitchHistory}
                currentPitch={audio.currentPitch}
                width={graphWidth}
                height={260}
              />

              {/* Pitch ↔ BodyTracker resize handle */}
              <div
                onMouseDown={(e) => {
                  e.preventDefault()
                  const startX = e.clientX
                  const startW = bodyTrackerWidth
                  function onMove(ev: MouseEvent) { setBodyTrackerWidth(Math.max(120, Math.min(420, startW - (ev.clientX - startX)))) }
                  function onUp() { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
                  document.addEventListener('mousemove', onMove)
                  document.addEventListener('mouseup', onUp)
                }}
                style={{ width: 10, cursor: 'col-resize', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, alignSelf: 'stretch' }}
                title="Drag to resize body tracker"
              >
                <div style={{ width: 3, height: 32, background: '#bae6fd', borderRadius: 2 }} />
              </div>

              {/* Body tracker */}
              <div style={{ flexShrink: 0 }}>
                <BodyTracker sourceVideoRef={videoRef} width={bodyTrackerWidth} height={260} apiKey={ai.apiKey} onMovementSample={handleMovementSample} />
              </div>
            </div>

            <PianoKeyboard
              hz={audio.currentPitch}
              width={graphWidth}
            />
            <DecibelGraph
              ref={decibelGraphRef}
              samples={audio.dbHistory}
              currentDb={audio.currentDb}
              width={graphWidth}
              height={80}
            />
          </div>
          </div>
        )}
      </main>}
    </div>
  )
}

// ---- Domain toggle bar ----
const ALL_DOMAINS: Domain[] = ['law', 'theater', 'music', 'public_speaking', 'debate', 'teaching']

function DomainBar({ domain, onSelect }: { domain: Domain; onSelect: (d: Domain) => void }) {
  const cfg = DOMAIN_CONFIG[domain]
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 2,
      padding: '6px 10px',
      borderBottom: '1px solid #bae6fd',
      background: '#e0f2fe',
      overflowX: 'auto'
    }}>
      {ALL_DOMAINS.map(d => {
        const c = DOMAIN_CONFIG[d]
        const active = d === domain
        return (
          <button
            key={d}
            onClick={() => onSelect(d)}
            title={c.label}
            style={{
              background: active ? c.color + '22' : 'transparent',
              border: `1px solid ${active ? c.color + '88' : 'transparent'}`,
              borderRadius: 6,
              color: active ? c.color : '#64748b',
              cursor: 'pointer',
              fontSize: 11,
              fontWeight: active ? 700 : 400,
              padding: '4px 7px',
              whiteSpace: 'nowrap',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 1,
              minWidth: 42,
              lineHeight: 1.2
            }}
          >
            <span style={{ fontSize: 15 }}>{c.icon}</span>
            <span style={{ fontSize: 9 }}>{c.label.split(' ')[0]}</span>
          </button>
        )
      })}
    </div>
  )
}

// ---- Audio source status badge (compact, read-only — picker is in the toolbar) ----
function AudioSourceBar({
  source,
  mediaMode,
  micDevices,
  selectedMicId,
}: {
  source: AudioSource
  mediaMode: 'none' | 'file' | 'webcam'
  micDevices: MediaDeviceInfo[]
  selectedMicId: string
}) {
  const dot = (color: string) => (
    <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />
  )

  if (mediaMode === 'webcam') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingBottom: 10, borderBottom: '1px solid #bae6fd' }}>
        {dot('#34d399')}
        <span style={{ fontSize: 11, color: '#059669', fontWeight: 600 }}>Webcam microphone</span>
        <span style={{ fontSize: 11, color: '#94a3b8' }}>— live from your camera</span>
      </div>
    )
  }

  if (source === 'blackhole') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingBottom: 10, borderBottom: '1px solid #bae6fd' }}>
        {dot('#7c3aed')}
        <span style={{ fontSize: 11, color: '#7c3aed', fontWeight: 600 }}>◈ BlackHole 2ch</span>
        <span style={{ fontSize: 11, color: '#94a3b8' }}>— capturing app audio</span>
      </div>
    )
  }

  if (source === 'mic') {
    const dev = micDevices.find(d => d.deviceId === selectedMicId)
    const label = dev?.label || 'Microphone'
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingBottom: 10, borderBottom: '1px solid #bae6fd' }}>
        {dot('#34d399')}
        <span style={{ fontSize: 11, color: '#059669', fontWeight: 600 }}>🎙 {label}</span>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingBottom: 10, borderBottom: '1px solid #bae6fd' }}>
      {dot('#3b82f6')}
      <span style={{ fontSize: 11, color: '#1d4ed8', fontWeight: 600 }}>Video file audio</span>
      <span style={{ fontSize: 11, color: '#94a3b8' }}>— use 🎙 Audio Source to change</span>
    </div>
  )
}

// ---- Audio picker row option ----
function AudioPickerOption({
  active, icon, label, sub, onClick, disabled = false
}: {
  active: boolean
  icon: string
  label: string
  sub: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        width: '100%', padding: '7px 14px', border: 'none',
        background: active ? '#eff6ff' : 'transparent',
        cursor: disabled ? 'default' : 'pointer',
        textAlign: 'left', opacity: disabled ? 0.5 : 1
      }}
    >
      <span style={{ fontSize: 16, flexShrink: 0 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: active ? 700 : 500, color: active ? '#1d4ed8' : '#0f172a', lineHeight: 1.2 }}>{label}</div>
        <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 1 }}>{sub}</div>
      </div>
      {active && <span style={{ color: '#3b82f6', fontSize: 14, flexShrink: 0 }}>✓</span>}
    </button>
  )
}

// ---- Small inline component for annotation list ----
function AnnotationsList({
  annotations,
  currentTime,
  onDelete,
  onSeek
}: {
  annotations: import('./types').Annotation[]
  currentTime: number
  onDelete: (id: string) => void
  onSeek?: (t: number) => void
}) {
  function fmt(sec: number) {
    const m = Math.floor(sec / 60)
    const s = Math.floor(sec % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {annotations.length === 0 && (
        <p style={{ color: '#64748b', fontSize: 13, textAlign: 'center', margin: '16px 0' }}>
          No annotations yet. Select a draw tool and click on the video.
        </p>
      )}
      {annotations.map(a => (
        <div key={a.id} style={{
          background: '#ffffff',
          borderRadius: 6,
          padding: '8px 10px',
          border: '1px solid #bae6fd',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: a.color }} />
            <button
              onClick={() => onSeek?.(a.timestamp)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#0284c7',
                cursor: 'pointer',
                fontFamily: 'monospace',
                fontSize: 11
              }}
            >
              {fmt(a.timestamp)}
            </button>
            <span style={{ color: '#64748b', fontSize: 12 }}>{a.type}</span>
            {a.text && <span style={{ color: '#334155', fontSize: 12 }}>"{a.text}"</span>}
          </div>
          <button
            onClick={() => onDelete(a.id)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              fontSize: 14,
              padding: 0
            }}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}

const devCtrl: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 4,
  background: 'rgba(0,0,0,0.6)', borderRadius: 6, padding: '4px 8px',
  cursor: 'pointer', color: '#fff', fontSize: 13
}

const devSelect: React.CSSProperties = {
  background: 'transparent', border: 'none', color: '#fff',
  fontSize: 11, cursor: 'pointer', maxWidth: 140,
  outline: 'none'
}

// ---- Styles ----
function btnStyle(bg: string): React.CSSProperties {
  // Convert dark neutral backgrounds to light; keep saturated accent colors
  const isDarkNeutral = bg === '#1e293b' || bg === '#0f172a' || bg === '#334155' || bg === '#0a1628'
  const resolvedBg = isDarkNeutral ? '#f1f5f9' : bg
  const textColor = isDarkNeutral ? '#334155' : '#f1f5f9'
  return {
    background: resolvedBg,
    border: '1px solid #bae6fd',
    borderRadius: 6,
    color: textColor,
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 500,
    padding: '6px 12px',
    whiteSpace: 'nowrap'
  }
}

// ---- Sidebar API key input (saves on every keystroke so no Enter/blur required) ----
function SidebarKeyInput({ apiKey, provider, onSave }: { apiKey: string; provider: AIProvider; onSave: (k: string) => void }) {
  const [draft, setDraft] = React.useState(apiKey)
  const [show, setShow] = React.useState(false)
  React.useEffect(() => { setDraft(apiKey) }, [apiKey])
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    setDraft(val)
    onSave(val.trim())
  }
  return (
    <div style={{ display: 'flex', gap: 5 }}>
      <input
        type={show ? 'text' : 'password'}
        value={draft}
        onChange={handleChange}
        placeholder={PROVIDER_CONFIG[provider].placeholder}
        style={{
          flex: 1, border: '1px solid #e2e8f0', borderRadius: 6,
          fontSize: 11, padding: '5px 8px', background: '#fff',
          fontFamily: 'monospace', color: '#1e293b', outline: 'none'
        }}
      />
      <button onClick={() => setShow(v => !v)} style={{ border: '1px solid #e2e8f0', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 13, padding: '0 7px' }}>
        {show ? '🙈' : '👁'}
      </button>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    display: 'flex',
    height: '100vh',
    background: '#e0f2fe',
    color: '#0f172a',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    overflow: 'hidden'
  },
  sidebar: {
    width: 320,
    minWidth: 280,
    borderRight: '1px solid #bae6fd',
    background: '#f0f9ff',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden'
  },
  sidebarHeader: {
    display: 'flex',
    justifyContent: 'flex-start',
    alignItems: 'center',
    padding: '8px 12px 12px',
    borderBottom: '1px solid #bae6fd',
    background: '#fff'
  },
  tabBar: {
    display: 'flex',
    borderBottom: '1px solid #bae6fd'
  },
  tab: {
    flex: 1,
    borderTop: 'none',
    borderBottom: 'none',
    borderLeft: 'none',
    borderRight: '1px solid #bae6fd',
    cursor: 'pointer',
    fontSize: 10,
    fontWeight: 500,
    padding: '9px 2px',
    letterSpacing: 0.1
  },
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
    padding: '12px 16px 0 28px',
    overflow: 'hidden',
    minHeight: 0
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    flexShrink: 0,
    marginBottom: 8
  },
  fileName: {
    color: '#64748b',
    fontSize: 12,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: 200
  },
  placeholder: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    minHeight: 280,
    cursor: 'pointer',
    color: '#64748b',
    userSelect: 'none'
  },
  graphs: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    background: '#f0f9ff',
    borderRadius: 8,
    padding: 14,
    border: '1px solid #bae6fd'
  }
}
