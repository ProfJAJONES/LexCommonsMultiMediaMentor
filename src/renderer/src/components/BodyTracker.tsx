import React, { useRef, useEffect, useState, useCallback } from 'react'
import Anthropic from '@anthropic-ai/sdk'
import * as poseDetection from '@tensorflow-models/pose-detection'
import '@tensorflow/tfjs-backend-webgl'
import * as tf from '@tensorflow/tfjs-core'

// MoveNet 17-keypoint skeleton connections
const CONNECTIONS: [number, number][] = [
  [0, 1], [0, 2], [1, 3], [2, 4],       // face
  [5, 7], [7, 9],                         // left arm
  [6, 8], [8, 10],                        // right arm
  [5, 6],                                 // shoulders
  [5, 11], [6, 12],                       // torso sides
  [11, 12],                               // hips
  [11, 13], [13, 15],                     // left leg
  [12, 14], [14, 16]                      // right leg
]

const JOINT_COLOR = '#0ea5e9'
const BONE_COLOR = 'rgba(14, 165, 233, 0.7)'
const DIM_COLOR = 'rgba(148, 163, 184, 0.35)'
const CONFIDENCE_THRESHOLD = 0.3

interface Props {
  /** The video element to analyse — the uploaded video player */
  sourceVideoRef: React.RefObject<HTMLVideoElement | null>
  width?: number
  height?: number
  apiKey?: string
  /** Called approximately once per second with (videoTime, movementScore 0-100) */
  onMovementSample?: (t: number, score: number) => void
}

export function BodyTracker({ sourceVideoRef, width = 260, height = 340, apiKey, onMovementSample }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const detectorRef = useRef<poseDetection.PoseDetector | null>(null)
  const rafRef = useRef<number>(0)
  const lastSampleMsRef = useRef<number>(0)
  const movementScoreRef = useRef<number>(0)

  const [enabled, setEnabled] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [movementScore, setMovementScore] = useState(0)
  const prevKeypoints = useRef<poseDetection.Keypoint[]>([])

  // Facial expression state
  const [expression, setExpression] = useState<string | null>(null)
  const expressionTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const analyzeExpression = useCallback(async () => {
    if (!apiKey?.trim()) return
    const video = sourceVideoRef.current
    if (!video || video.readyState < 2) return
    try {
      const canvas = document.createElement('canvas')
      canvas.width = 160
      canvas.height = Math.round(160 * ((video.videoHeight || 480) / (video.videoWidth || 640)))
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.6)
      const base64 = dataUrl.replace(/^data:image\/jpeg;base64,/, '')
      const client = new Anthropic({ apiKey: apiKey.trim(), dangerouslyAllowBrowser: true })
      const resp = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 12,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64 } },
            { type: 'text', text: "Describe the person's facial expression in 2-3 words only. Examples: \"focused, composed\", \"nervous, tense\", \"confident, calm\". Reply with only those words, nothing else." }
          ]
        }]
      })
      const text = resp.content[0].type === 'text' ? resp.content[0].text.trim() : null
      if (text) setExpression(text)
    } catch {
      // silently ignore expression API errors
    }
  }, [apiKey, sourceVideoRef])

  const drawFrame = useCallback((poses: poseDetection.Pose[], videoW: number, videoH: number) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    if (poses.length === 0) return

    const kp = poses[0].keypoints
    const scaleX = canvas.width / (videoW || 640)
    const scaleY = canvas.height / (videoH || 480)

    const scaled = kp.map(k => ({ ...k, x: k.x * scaleX, y: k.y * scaleY }))

    // Bones
    for (const [a, b] of CONNECTIONS) {
      const kA = scaled[a], kB = scaled[b]
      const conf = Math.min(kA.score ?? 0, kB.score ?? 0)
      ctx.beginPath()
      ctx.moveTo(kA.x, kA.y)
      ctx.lineTo(kB.x, kB.y)
      ctx.strokeStyle = conf >= CONFIDENCE_THRESHOLD ? BONE_COLOR : DIM_COLOR
      ctx.lineWidth = conf >= CONFIDENCE_THRESHOLD ? 2.5 : 1.5
      ctx.stroke()
    }

    // Joints
    for (const k of scaled) {
      const conf = k.score ?? 0
      ctx.beginPath()
      ctx.arc(k.x, k.y, conf >= CONFIDENCE_THRESHOLD ? 5 : 3, 0, Math.PI * 2)
      ctx.fillStyle = conf >= CONFIDENCE_THRESHOLD ? JOINT_COLOR : DIM_COLOR
      ctx.fill()
    }

    // Movement energy
    const prev = prevKeypoints.current
    if (prev.length === kp.length) {
      let totalDelta = 0, counted = 0
      for (let i = 0; i < kp.length; i++) {
        if ((kp[i].score ?? 0) >= CONFIDENCE_THRESHOLD && (prev[i].score ?? 0) >= CONFIDENCE_THRESHOLD) {
          const dx = kp[i].x - prev[i].x
          const dy = kp[i].y - prev[i].y
          totalDelta += Math.sqrt(dx * dx + dy * dy)
          counted++
        }
      }
      if (counted > 0) {
        const rawScore = Math.min(100, (totalDelta / counted) * 5)
        const next = Math.round(movementScoreRef.current * 0.7 + rawScore * 0.3)
        movementScoreRef.current = next
        setMovementScore(next)
      }
    }
    prevKeypoints.current = kp
  }, [])

  const runDetection = useCallback(async () => {
    const video = sourceVideoRef.current
    const detector = detectorRef.current
    if (!video || !detector || video.readyState < 2 || video.paused) {
      // If paused, still detect on current frame — just don't loop as fast
      if (video && detector && video.readyState >= 2 && video.paused) {
        try {
          const poses = await detector.estimatePoses(video, { flipHorizontal: false })
          drawFrame(poses, video.videoWidth, video.videoHeight)
        } catch { /* ignore */ }
      }
      rafRef.current = requestAnimationFrame(runDetection)
      return
    }
    try {
      const poses = await detector.estimatePoses(video, { flipHorizontal: false })
      drawFrame(poses, video.videoWidth, video.videoHeight)
    } catch { /* ignore dropped frame */ }

    // Emit movement sample ~once per second
    if (onMovementSample) {
      const now = Date.now()
      if (now - lastSampleMsRef.current >= 1000) {
        lastSampleMsRef.current = now
        onMovementSample(video.currentTime, movementScoreRef.current)
      }
    }

    rafRef.current = requestAnimationFrame(runDetection)
  }, [sourceVideoRef, drawFrame, onMovementSample])

  const start = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      await tf.setBackend('webgl')
      await tf.ready()
      const detector = await poseDetection.createDetector(
        poseDetection.SupportedModels.MoveNet,
        { modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING }
      )
      detectorRef.current = detector
      setEnabled(true)
      setLoading(false)
      rafRef.current = requestAnimationFrame(runDetection)
      if (apiKey?.trim()) {
        expressionTimerRef.current = setInterval(analyzeExpression, 5000)
        analyzeExpression()
      }
    } catch {
      setError('Pose model failed to load.')
      setLoading(false)
    }
  }, [runDetection, apiKey, analyzeExpression])

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    if (expressionTimerRef.current) { clearInterval(expressionTimerRef.current); expressionTimerRef.current = null }
    detectorRef.current?.dispose()
    detectorRef.current = null
    setEnabled(false)
    setMovementScore(0)
    movementScoreRef.current = 0
    lastSampleMsRef.current = 0
    setExpression(null)
    prevKeypoints.current = []
    const canvas = canvasRef.current
    if (canvas) canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height)
  }, [])

  // Stop when component unmounts
  useEffect(() => () => { stop() }, [stop])

  const energyColor = movementScore > 60 ? '#22c55e' : movementScore > 30 ? '#f59e0b' : '#94a3b8'
  const energyLabel = movementScore > 60 ? 'Active' : movementScore > 30 ? 'Moderate' : 'Still'

  const hasVideo = !!(sourceVideoRef.current && sourceVideoRef.current.readyState >= 1)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: '#475569', textTransform: 'uppercase' }}>
          Body Movement
        </span>
        <button
          onClick={enabled ? stop : start}
          disabled={loading}
          style={{
            fontSize: 10, fontWeight: 600, padding: '3px 10px', borderRadius: 4, border: 'none',
            cursor: loading ? 'default' : 'pointer',
            background: enabled ? '#fca5a5' : '#bae6fd',
            color: enabled ? '#991b1b' : '#0369a1'
          }}
        >
          {loading ? 'Loading...' : enabled ? '⏹ Stop' : '▶ Start'}
        </button>
      </div>

      {/* Stick figure canvas */}
      <div style={{
        position: 'relative', background: '#f8fafc', borderRadius: 8,
        border: '1px solid #bae6fd', overflow: 'hidden', width, height
      }}>
        <canvas ref={canvasRef} width={width} height={height} style={{ display: 'block' }} />

        {!enabled && !loading && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 6, color: '#94a3b8'
          }}>
            <div style={{ fontSize: 36 }}>🕴</div>
            <div style={{ fontSize: 11, textAlign: 'center', maxWidth: 160 }}>
              Start tracker to analyse body movement in the video
            </div>
          </div>
        )}
        {loading && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 8, color: '#0284c7'
          }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Loading pose model…</div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>first load may take ~10s</div>
          </div>
        )}
        {error && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12 }}>
            <div style={{ fontSize: 11, color: '#dc2626', textAlign: 'center' }}>{error}</div>
          </div>
        )}
      </div>

      {/* Movement energy bar */}
      {enabled && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 10, color: '#64748b' }}>Movement energy</span>
            <span style={{ fontSize: 10, fontWeight: 700, color: energyColor }}>{energyLabel}</span>
          </div>
          <div style={{ background: '#e2e8f0', borderRadius: 4, height: 6, overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${movementScore}%`, background: energyColor,
              borderRadius: 4, transition: 'width 0.2s ease, background 0.3s ease'
            }} />
          </div>
        </div>
      )}

      {/* Facial expression */}
      {enabled && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: '#f8fafc', borderRadius: 6, padding: '5px 8px', border: '1px solid #e2e8f0'
        }}>
          <span style={{ fontSize: 10, color: '#64748b' }}>😐 Expression</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: '#334155' }}>
            {expression ?? (apiKey?.trim() ? '—' : 'Add API key to enable')}
          </span>
        </div>
      )}
    </div>
  )
}
