import React, { useEffect, useRef } from 'react'
import type { CameraState } from '../hooks/useCameraInput'

interface Props {
  cameraState: CameraState
  elapsedSec: number
  devices: MediaDeviceInfo[]
  selectedDeviceId: string
  error: string | null
  videoPreviewRef: React.MutableRefObject<HTMLVideoElement | null>
  onRefreshDevices: () => void
  onSelectDevice: (id: string) => void
  onStartPreview: (deviceId: string) => void
  onStopPreview: () => void
  onStartRecording: () => void
  onPauseRecording: () => void
  onResumeRecording: () => void
  onStopRecording: () => void
}

export function CameraPanel({
  cameraState,
  elapsedSec,
  devices,
  selectedDeviceId,
  error,
  videoPreviewRef,
  onRefreshDevices,
  onSelectDevice,
  onStartPreview,
  onStopPreview,
  onStartRecording,
  onPauseRecording,
  onResumeRecording,
  onStopRecording
}: Props) {
  const internalVideoRef = useRef<HTMLVideoElement>(null)

  // Sync the hook's videoPreviewRef to the rendered <video> element
  useEffect(() => {
    videoPreviewRef.current = internalVideoRef.current
  }, [videoPreviewRef])

  const mm = String(Math.floor(elapsedSec / 60)).padStart(2, '0')
  const ss = String(elapsedSec % 60).padStart(2, '0')
  const isActive = cameraState === 'recording' || cameraState === 'paused'
  const isPreviewing = cameraState === 'previewing' || isActive || cameraState === 'saving'

  return (
    <div style={styles.panel}>
      <div style={styles.header}>
        <span style={styles.title}>Camera</span>
        {error && <span style={styles.error}>{error}</span>}
      </div>

      {/* Device selector */}
      {cameraState === 'idle' && (
        <div style={styles.deviceRow}>
          <select
            value={selectedDeviceId}
            onChange={e => onSelectDevice(e.target.value)}
            style={styles.select}
          >
            {devices.length === 0 ? (
              <option value="">No cameras found</option>
            ) : (
              devices.map(d => {
                const rawLabel = d.label || `Camera ${d.deviceId.slice(0, 8)}`
                const label = rawLabel.length > 30 ? rawLabel.slice(0, 28) + '…' : rawLabel
                return (
                  <option key={d.deviceId} value={d.deviceId}>{label}</option>
                )
              })
            )}
          </select>
          <button onClick={onRefreshDevices} style={btn('#1e293b')}>
            ↺
          </button>
          <button
            onClick={() => {
              if (devices.length === 0) {
                onRefreshDevices()
              } else {
                onStartPreview(selectedDeviceId)
              }
            }}
            style={btn('#3b82f6')}
          >
            Open Camera
          </button>
        </div>
      )}

      {/* Camera preview */}
      <div style={{
        ...styles.videoContainer,
        display: isPreviewing ? 'block' : 'none'
      }}>
        <video
          ref={internalVideoRef}
          autoPlay
          muted
          playsInline
          style={styles.video}
        />

        {/* Recording overlay indicator */}
        {isActive && (
          <div style={styles.recOverlay}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: cameraState === 'paused' ? '#fbbf24' : '#f87171',
              animation: cameraState === 'recording' ? 'pulse 1s infinite' : 'none',
              flexShrink: 0,
              display: 'inline-block'
            }} />
            <span style={{ color: '#f1f5f9', fontSize: 12, fontFamily: 'monospace' }}>
              {`${mm}:${ss}`}
            </span>
          </div>
        )}
      </div>

      {/* Controls */}
      {isPreviewing && (
        <div style={styles.controls}>
          {cameraState === 'previewing' && (
            <>
              <button onClick={onStartRecording} style={btn('#dc2626')}>
                ⏺ Record
              </button>
              <button onClick={onStopPreview} style={btn('#374151')}>
                Close
              </button>
            </>
          )}
          {cameraState === 'recording' && (
            <>
              <button onClick={onPauseRecording} style={btn('#92400e')}>⏸ Pause</button>
              <button onClick={onStopRecording} style={btn('#7f1d1d')}>■ Stop & Save</button>
            </>
          )}
          {cameraState === 'paused' && (
            <>
              <button onClick={onResumeRecording} style={btn('#065f46')}>⏺ Resume</button>
              <button onClick={onStopRecording} style={btn('#7f1d1d')}>■ Stop & Save</button>
            </>
          )}
          {cameraState === 'saving' && (
            <span style={{ color: '#64748b', fontSize: 12 }}>Saving…</span>
          )}
        </div>
      )}
    </div>
  )
}

function btn(bg: string): React.CSSProperties {
  const darkNeutral = bg === '#374151' || bg === '#1e293b'
  return {
    background: darkNeutral ? '#f1f5f9' : bg,
    border: '1px solid #bae6fd',
    borderRadius: 5,
    color: darkNeutral ? '#334155' : '#f1f5f9',
    cursor: 'pointer',
    fontSize: 11,
    fontWeight: 600,
    padding: '5px 10px',
    whiteSpace: 'nowrap'
  }
}

const styles: Record<string, React.CSSProperties> = {
  panel: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    background: '#f0f9ff',
    border: '1px solid #bae6fd',
    borderRadius: 8,
    padding: 12
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  title: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  error: {
    color: '#dc2626',
    fontSize: 11
  },
  deviceRow: {
    display: 'flex',
    gap: 6,
    alignItems: 'center'
  },
  select: {
    flex: 1,
    minWidth: 0,
    maxWidth: 200,
    background: '#ffffff',
    border: '1px solid #bae6fd',
    borderRadius: 5,
    color: '#0f172a',
    fontSize: 11,
    padding: '5px 8px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  videoContainer: {
    position: 'relative',
    borderRadius: 6,
    overflow: 'hidden',
    background: '#000'
  },
  video: {
    width: '100%',
    display: 'block',
    maxHeight: 200,
    objectFit: 'cover'
  },
  recOverlay: {
    position: 'absolute',
    top: 8,
    left: 8,
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    background: 'rgba(0,0,0,0.6)',
    borderRadius: 4,
    padding: '3px 7px'
  },
  controls: {
    display: 'flex',
    gap: 6,
    flexWrap: 'wrap'
  }
}
