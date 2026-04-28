import React, { useRef, useEffect, useState, useCallback } from 'react'
import Anthropic from '@anthropic-ai/sdk'
import * as poseDetection from '@tensorflow-models/pose-detection'
import * as handPoseDetection from '@tensorflow-models/hand-pose-detection'
import '@tensorflow/tfjs-backend-webgl'
import * as tf from '@tensorflow/tfjs-core'

// MoveNet 17-keypoint skeleton connections
const BODY_CONNECTIONS: [number, number][] = [
  [0, 1], [0, 2], [1, 3], [2, 4],
  [5, 7], [7, 9],
  [6, 8], [8, 10],
  [5, 6],
  [5, 11], [6, 12],
  [11, 12],
  [11, 13], [13, 15],
  [12, 14], [14, 16]
]

// MediaPipe Hands 21-keypoint connections
const HAND_CONNECTIONS: [number, number][] = [
  [0,1],[1,2],[2,3],[3,4],           // thumb
  [0,5],[5,6],[6,7],[7,8],           // index
  [0,9],[9,10],[10,11],[11,12],      // middle
  [0,13],[13,14],[14,15],[15,16],    // ring
  [0,17],[17,18],[18,19],[19,20],    // pinky
  [5,9],[9,13],[13,17]               // palm knuckles
]

const JOINT_COLOR = '#0ea5e9'
const BONE_COLOR = 'rgba(14, 165, 233, 0.7)'
const DIM_COLOR = 'rgba(148, 163, 184, 0.35)'
// ASL-mode signing arm highlights
const ARM_COLOR = '#a78bfa'
const ARM_BONE_COLOR = 'rgba(167, 139, 250, 0.8)'
// Hand skeleton colors per hand
const HAND_COLOR_R = '#34d399'   // right hand — green
const HAND_COLOR_L = '#f97316'   // left hand — orange
const CONFIDENCE_THRESHOLD = 0.3

interface Props {
  sourceVideoRef: React.RefObject<HTMLVideoElement | null>
  width?: number
  height?: number
  apiKey?: string
  signingMode?: boolean
  onMovementSample?: (t: number, score: number) => void
}

export function BodyTracker({ sourceVideoRef, width = 260, height = 340, apiKey, signingMode = false, onMovementSample }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const detectorRef = useRef<poseDetection.PoseDetector | null>(null)
  const handDetectorRef = useRef<handPoseDetection.HandDetector | null>(null)
  const rafRef = useRef<number>(0)
  const lastSampleMsRef = useRef<number>(0)
  const movementScoreRef = useRef<number>(0)
  const detectionStartMsRef = useRef<number>(0)

  const [enabled, setEnabled] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [movementScore, setMovementScore] = useState(0)
  const [handsDetected, setHandsDetected] = useState(0)
  const [signingSpaceUsage, setSigningSpaceUsage] = useState(0)
  const prevKeypoints = useRef<poseDetection.Keypoint[]>([])
  const prevHandWrists = useRef<{ x: number; y: number }[]>([])

  // Facial / non-manual marker expression state
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
      const prompt = signingMode
        ? "Describe the signer's non-manual markers (NMMs) in 2-4 words. Focus on: eyebrow position (raised/furrowed), mouth morphemes, eye gaze direction. Examples: \"brows raised, neutral mouth\", \"furrowed brows, 'oo' mouth\", \"direct gaze, relaxed\". Reply with only those words."
        : "Describe the person's facial expression in 2-3 words only. Examples: \"focused, composed\", \"nervous, tense\", \"confident, calm\". Reply with only those words, nothing else."
      const resp = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 16,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64 } },
            { type: 'text', text: prompt }
          ]
        }]
      })
      const text = resp.content[0].type === 'text' ? resp.content[0].text.trim() : null
      if (text) setExpression(text)
    } catch {
      // silently ignore expression API errors
    }
  }, [apiKey, sourceVideoRef, signingMode])

  const drawFrame = useCallback((
    poses: poseDetection.Pose[],
    hands: handPoseDetection.Hand[],
    videoW: number,
    videoH: number
  ) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    const scaleX = canvas.width / (videoW || 640)
    const scaleY = canvas.height / (videoH || 480)

    // Draw body skeleton
    if (poses.length > 0) {
      const kp = poses[0].keypoints
      const scaled = kp.map(k => ({ ...k, x: k.x * scaleX, y: k.y * scaleY }))

      // Arm joint indices: shoulders=5,6 elbows=7,8 wrists=9,10
      const ARM_INDICES = new Set([5, 6, 7, 8, 9, 10])
      // Arm bone pairs
      const ARM_PAIRS = new Set(['5,7', '7,9', '6,8', '8,10'])

      // Draw signing space guide rectangle (between shoulders and hips)
      if (signingMode) {
        const lShoulder = scaled[5], rShoulder = scaled[6]
        const lHip = scaled[11], rHip = scaled[12]
        const lConf = Math.min(lShoulder.score ?? 0, rShoulder.score ?? 0, lHip.score ?? 0, rHip.score ?? 0)
        if (lConf >= CONFIDENCE_THRESHOLD) {
          const sx = Math.min(rShoulder.x, lShoulder.x) - 30
          const sy = Math.min(lShoulder.y, rShoulder.y) - 20
          const sw = Math.max(rShoulder.x, lShoulder.x) - sx + 30
          const sh = Math.max(lHip.y, rHip.y) - sy + 20
          ctx.strokeStyle = 'rgba(167, 139, 250, 0.3)'
          ctx.lineWidth = 1
          ctx.setLineDash([4, 4])
          ctx.strokeRect(sx, sy, sw, sh)
          ctx.setLineDash([])

          // Compute how much of signing space the hands occupy
          if (hands.length > 0) {
            let handPointsInBox = 0
            let totalHandPoints = 0
            for (const hand of hands) {
              for (const lm of hand.keypoints) {
                const hx = lm.x * scaleX, hy = lm.y * scaleY
                totalHandPoints++
                if (hx >= sx && hx <= sx + sw && hy >= sy && hy <= sy + sh) handPointsInBox++
              }
            }
            const usage = totalHandPoints > 0 ? Math.round((handPointsInBox / totalHandPoints) * 100) : 0
            setSigningSpaceUsage(usage)
          }
        }
      }

      // Bones
      for (const [a, b] of BODY_CONNECTIONS) {
        const kA = scaled[a], kB = scaled[b]
        const conf = Math.min(kA.score ?? 0, kB.score ?? 0)
        const isArm = ARM_PAIRS.has(`${a},${b}`)
        ctx.beginPath()
        ctx.moveTo(kA.x, kA.y)
        ctx.lineTo(kB.x, kB.y)
        if (signingMode) {
          ctx.strokeStyle = conf >= CONFIDENCE_THRESHOLD ? (isArm ? ARM_BONE_COLOR : DIM_COLOR) : DIM_COLOR
          ctx.lineWidth = isArm && conf >= CONFIDENCE_THRESHOLD ? 3 : 1.5
        } else {
          ctx.strokeStyle = conf >= CONFIDENCE_THRESHOLD ? BONE_COLOR : DIM_COLOR
          ctx.lineWidth = conf >= CONFIDENCE_THRESHOLD ? 2.5 : 1.5
        }
        ctx.stroke()
      }

      // Joints
      for (let i = 0; i < scaled.length; i++) {
        const k = scaled[i]
        const conf = k.score ?? 0
        const isArm = ARM_INDICES.has(i)
        ctx.beginPath()
        ctx.arc(k.x, k.y, conf >= CONFIDENCE_THRESHOLD ? 5 : 3, 0, Math.PI * 2)
        if (signingMode) {
          ctx.fillStyle = conf >= CONFIDENCE_THRESHOLD ? (isArm ? ARM_COLOR : DIM_COLOR) : DIM_COLOR
        } else {
          ctx.fillStyle = conf >= CONFIDENCE_THRESHOLD ? JOINT_COLOR : DIM_COLOR
        }
        ctx.fill()
      }

      // Movement energy (arm-weighted in signing mode)
      const prev = prevKeypoints.current
      if (prev.length === kp.length) {
        let totalDelta = 0, counted = 0
        for (let i = 0; i < kp.length; i++) {
          if ((kp[i].score ?? 0) >= CONFIDENCE_THRESHOLD && (prev[i].score ?? 0) >= CONFIDENCE_THRESHOLD) {
            const dx = kp[i].x - prev[i].x
            const dy = kp[i].y - prev[i].y
            const weight = (signingMode && ARM_INDICES.has(i)) ? 3 : 1
            totalDelta += Math.sqrt(dx * dx + dy * dy) * weight
            counted += weight
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
    }

    // Draw hand skeletons (MediaPipe Hands)
    setHandsDetected(hands.length)
    for (const hand of hands) {
      const isRight = hand.handedness === 'Right'
      const color = isRight ? HAND_COLOR_R : HAND_COLOR_L
      const boneColor = isRight ? 'rgba(52, 211, 153, 0.8)' : 'rgba(249, 115, 22, 0.8)'
      const lm = hand.keypoints.map(k => ({ x: k.x * scaleX, y: k.y * scaleY }))

      // Bones
      for (const [a, b] of HAND_CONNECTIONS) {
        ctx.beginPath()
        ctx.moveTo(lm[a].x, lm[a].y)
        ctx.lineTo(lm[b].x, lm[b].y)
        ctx.strokeStyle = boneColor
        ctx.lineWidth = 2
        ctx.stroke()
      }

      // Joints
      for (let i = 0; i < lm.length; i++) {
        ctx.beginPath()
        ctx.arc(lm[i].x, lm[i].y, i === 0 ? 6 : 3.5, 0, Math.PI * 2)
        ctx.fillStyle = color
        ctx.fill()
      }
    }
  }, [signingMode])

  const runDetection = useCallback(async () => {
    const video = sourceVideoRef.current
    const detector = detectorRef.current
    if (!video || !detector || video.readyState < 2 || video.paused) {
      if (video && detector && video.readyState >= 2 && video.paused) {
        try {
          const poses = await detector.estimatePoses(video, { flipHorizontal: false })
          const hands = handDetectorRef.current
            ? await handDetectorRef.current.estimateHands(video, { flipHorizontal: false })
            : []
          drawFrame(poses, hands, video.videoWidth, video.videoHeight)
        } catch { /* ignore */ }
      }
      rafRef.current = requestAnimationFrame(runDetection)
      return
    }
    try {
      const poses = await detector.estimatePoses(video, { flipHorizontal: false })
      const hands = handDetectorRef.current
        ? await handDetectorRef.current.estimateHands(video, { flipHorizontal: false })
        : []
      drawFrame(poses, hands, video.videoWidth, video.videoHeight)
    } catch { /* ignore dropped frame */ }

    // Emit movement sample ~once per second
    if (onMovementSample) {
      const now = Date.now()
      if (now - lastSampleMsRef.current >= 1000) {
        lastSampleMsRef.current = now
        const vt = video.currentTime
        const t = (typeof vt === 'number' && isFinite(vt) && vt > 0)
          ? vt
          : (performance.now() - detectionStartMsRef.current) / 1000
        onMovementSample(t, movementScoreRef.current)
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

      // Load hand detector in parallel (non-fatal if it fails)
      try {
        const handDetector = await handPoseDetection.createDetector(
          handPoseDetection.SupportedModels.MediaPipeHands,
          { runtime: 'tfjs', modelType: 'lite', maxHands: 2 }
        )
        handDetectorRef.current = handDetector
      } catch {
        // hand detection is optional — body tracking still works
      }

      detectionStartMsRef.current = performance.now()
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
    handDetectorRef.current?.dispose()
    handDetectorRef.current = null
    setEnabled(false)
    setMovementScore(0)
    movementScoreRef.current = 0
    lastSampleMsRef.current = 0
    setExpression(null)
    setHandsDetected(0)
    setSigningSpaceUsage(0)
    prevKeypoints.current = []
    prevHandWrists.current = []
    const canvas = canvasRef.current
    if (canvas) canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height)
  }, [])

  // Stop when component unmounts
  useEffect(() => () => { stop() }, [stop])

  const energyColor = movementScore > 60 ? '#22c55e' : movementScore > 30 ? '#f59e0b' : '#94a3b8'
  const energyLabel = movementScore > 60 ? 'Active' : movementScore > 30 ? 'Moderate' : 'Still'

  const accentColor = signingMode ? '#a78bfa' : '#0ea5e9'
  const borderColor = signingMode ? '#c4b5fd' : '#bae6fd'
  const title = signingMode ? 'Signing Tracker' : 'Body Movement'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
          {title}
        </span>
        <button
          onClick={enabled ? stop : start}
          disabled={loading}
          style={{
            fontSize: 10, fontWeight: 600, padding: '3px 10px', borderRadius: 4, border: 'none',
            cursor: loading ? 'default' : 'pointer',
            background: enabled ? '#fca5a5' : (signingMode ? '#ede9fe' : '#bae6fd'),
            color: enabled ? '#991b1b' : (signingMode ? '#6d28d9' : '#0369a1')
          }}
        >
          {loading ? 'Loading...' : enabled ? '⏹ Stop' : '▶ Start'}
        </button>
      </div>

      {/* Skeleton canvas */}
      <div style={{
        position: 'relative', background: 'var(--bg-surface)', borderRadius: 8,
        border: `1px solid ${borderColor}`, overflow: 'hidden', width, height
      }}>
        <canvas ref={canvasRef} width={width} height={height} style={{ display: 'block' }} />

        {!enabled && !loading && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 6, color: 'var(--text-faint)'
          }}>
            <div style={{ fontSize: 36 }}>{signingMode ? '🤟' : '🕴'}</div>
            <div style={{ fontSize: 11, textAlign: 'center', maxWidth: 160 }}>
              {signingMode
                ? 'Start tracker to analyse signing posture and handshape'
                : 'Start tracker to analyse body movement in the video'}
            </div>
          </div>
        )}
        {loading && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 8, color: accentColor
          }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Loading models…</div>
            <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>first load may take ~15s</div>
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
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{signingMode ? 'Signing energy' : 'Movement energy'}</span>
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

      {/* ASL-specific widgets */}
      {enabled && signingMode && (
        <>
          <div style={{
            display: 'flex', gap: 6
          }}>
            <div style={{
              flex: 1, background: '#f5f3ff', borderRadius: 6, padding: '5px 8px',
              border: '1px solid #ede9fe', display: 'flex', flexDirection: 'column', gap: 2
            }}>
              <span style={{ fontSize: 9, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: 0.5 }}>Hands</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#4c1d95' }}>{handsDetected}</span>
            </div>
            <div style={{
              flex: 1, background: '#f5f3ff', borderRadius: 6, padding: '5px 8px',
              border: '1px solid #ede9fe', display: 'flex', flexDirection: 'column', gap: 2
            }}>
              <span style={{ fontSize: 9, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: 0.5 }}>Sign Space</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#4c1d95' }}>{signingSpaceUsage}%</span>
            </div>
          </div>
          {/* Color legend */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <span style={{ fontSize: 9, color: HAND_COLOR_R, fontWeight: 600 }}>● R hand</span>
            <span style={{ fontSize: 9, color: HAND_COLOR_L, fontWeight: 600 }}>● L hand</span>
            <span style={{ fontSize: 9, color: ARM_COLOR, fontWeight: 600 }}>● Arms</span>
          </div>
        </>
      )}

      {/* Facial expression / NMM */}
      {enabled && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'var(--bg-surface)', borderRadius: 6, padding: '5px 8px', border: '1px solid var(--border-light)'
        }}>
          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{signingMode ? '🤨 NMM' : '😐 Expression'}</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-medium)' }}>
            {expression ?? (apiKey?.trim() ? '—' : 'Add API key to enable')}
          </span>
        </div>
      )}
    </div>
  )
}
