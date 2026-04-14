import { useCallback, useState } from 'react'
import type { FrameSample } from '../types'

function seekVideo(video: HTMLVideoElement, t: number): Promise<void> {
  return new Promise((resolve) => {
    if (Math.abs(video.currentTime - t) < 0.05) { resolve(); return }
    const handler = () => { video.removeEventListener('seeked', handler); resolve() }
    video.addEventListener('seeked', handler)
    video.currentTime = t
  })
}

export function useVisualAnalysis(videoRef: React.RefObject<HTMLVideoElement | null>) {
  const [isExtracting, setIsExtracting] = useState(false)

  const extractFrames = useCallback(async (count: number = 6): Promise<FrameSample[]> => {
    const video = videoRef.current
    if (!video || !video.duration || !isFinite(video.duration) || video.duration < 1) return []

    setIsExtracting(true)

    const wasPlaying = !video.paused
    if (wasPlaying) video.pause()
    const originalTime = video.currentTime

    const canvas = document.createElement('canvas')
    const MAX_W = 480
    canvas.width = MAX_W
    canvas.height = Math.round(MAX_W * ((video.videoHeight || 270) / (video.videoWidth || 480)))
    const ctx = canvas.getContext('2d')!

    const frames: FrameSample[] = []

    // Sample evenly, skipping first/last 5% to avoid black frames at start/end
    for (let i = 0; i < count; i++) {
      const pct = count === 1 ? 0.5 : 0.05 + (i / (count - 1)) * 0.90
      const t = video.duration * pct
      await seekVideo(video, t)
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      frames.push({ t, dataUrl: canvas.toDataURL('image/jpeg', 0.72) })
    }

    // Restore original playback state
    await seekVideo(video, originalTime)
    if (wasPlaying) video.play()

    setIsExtracting(false)
    return frames
  }, [videoRef])

  return { extractFrames, isExtracting }
}
