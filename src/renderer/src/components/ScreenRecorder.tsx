import React, { useState } from 'react'
import type { CaptureSource, RecorderState } from '../hooks/useScreenRecorder'

declare global {
  interface Window { api: { minimizeWindow: () => void } & Record<string, unknown> }
}

interface PickerProps {
  sources: CaptureSource[]
  onSelect: (id: string, withMic: boolean) => void
  onCancel: () => void
}

export function SourcePicker({ sources, onSelect, onCancel }: PickerProps) {
  const [withMic, setWithMic] = useState(true)

  return (
    <div style={overlay}>
      <div style={modal}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: '#0f172a', margin: 0 }}>
            Choose what to record
          </h2>
          <button onClick={onCancel} style={closeBtn}>×</button>
        </div>

        {/* Mic audio toggle */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          background: '#f0f9ff',
          border: `1px solid ${withMic ? '#34d39966' : '#bae6fd'}`,
          borderRadius: 7,
          padding: '10px 14px',
          marginBottom: 16,
          cursor: 'pointer',
          userSelect: 'none'
        }}
          onClick={() => setWithMic(v => !v)}
        >
          <div style={{
            width: 34,
            height: 18,
            borderRadius: 9,
            background: withMic ? '#059669' : '#334155',
            position: 'relative',
            flexShrink: 0,
            transition: 'background 0.2s'
          }}>
            <div style={{
              position: 'absolute',
              top: 2,
              left: withMic ? 18 : 2,
              width: 14,
              height: 14,
              borderRadius: '50%',
              background: '#fff',
              transition: 'left 0.15s'
            }} />
          </div>
          <div>
            <div style={{ color: '#0f172a', fontSize: 13, fontWeight: 600 }}>
              🎙 Record with microphone audio
            </div>
            <div style={{ color: '#64748b', fontSize: 11, marginTop: 2 }}>
              {withMic
                ? 'Your microphone will be mixed into the recording — the professor\'s voice will be audible'
                : 'Video only — no audio will be recorded'}
            </div>
          </div>
        </div>

        {sources.length === 0 ? (
          <p style={{ color: '#64748b', fontSize: 13, textAlign: 'center', padding: '24px 0' }}>
            Loading sources…
          </p>
        ) : (
          <div style={grid}>
            {sources.map(s => (
              <button
                key={s.id}
                onClick={() => onSelect(s.id, withMic)}
                style={sourceCard}
                title={s.name}
              >
                <img
                  src={s.thumbnail}
                  alt={s.name}
                  style={{ width: '100%', height: 100, objectFit: 'cover', borderRadius: 4, display: 'block' }}
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 4px 2px' }}>
                  {s.appIcon && (
                    <img src={s.appIcon} alt="" style={{ width: 14, height: 14, flexShrink: 0 }} />
                  )}
                  <span style={{
                    color: '#334155',
                    fontSize: 11,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {s.name}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

interface IndicatorProps {
  elapsedSec: number
  state: RecorderState
  hasAudio: boolean
  videoRef: React.RefObject<HTMLVideoElement | null>
  onPause: () => void
  onResume: () => void
  onStop: () => void
}

export function RecordingIndicator({ elapsedSec, state, hasAudio, videoRef, onPause, onResume, onStop }: IndicatorProps) {
  const mm = String(Math.floor(elapsedSec / 60)).padStart(2, '0')
  const ss = String(elapsedSec % 60).padStart(2, '0')

  function toggleVideo() {
    const v = videoRef.current
    if (!v) return
    v.paused ? v.play() : v.pause()
  }

  const isActive = state === 'recording' || state === 'paused'

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      background: '#f0f9ff',
      border: `1px solid ${state === 'paused' ? '#d97706' : '#bae6fd'}`,
      borderRadius: 6,
      padding: '5px 10px'
    }}>
      {/* Status dot */}
      <span style={{
        width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
        background: state === 'paused' ? '#fbbf24' : '#f87171',
        animation: state === 'recording' ? 'pulse 1s infinite' : 'none'
      }} />

      {/* Timer */}
      <span style={{ color: '#334155', fontSize: 12, fontFamily: 'monospace', minWidth: 40 }}>
        {state === 'saving' ? 'Saving…' : `${mm}:${ss}`}
      </span>

      {/* Audio indicator */}
      {isActive && (
        <span
          title={hasAudio ? 'Microphone audio is being recorded' : 'No audio — microphone was not enabled'}
          style={{ fontSize: 12, opacity: hasAudio ? 1 : 0.35, cursor: 'default' }}
        >
          🎙
        </span>
      )}

      {/* Hide app — lets the user bring their target window to the front */}
      {isActive && (
        <button
          onClick={() => window.api.minimizeWindow()}
          style={ctrlBtn('#f1f5f9', '#334155')}
          title="Minimize this app so you can see the window you're recording"
        >
          Hide App
        </button>
      )}

      {/* Pause / Resume recording */}
      {state === 'recording' && (
        <button onClick={onPause} style={ctrlBtn('#f1f5f9', '#334155')} title="Pause recording">
          ⏸
        </button>
      )}
      {state === 'paused' && (
        <button onClick={onResume} style={ctrlBtn('#f1f5f9', '#334155')} title="Resume recording">
          ⏺
        </button>
      )}

      {/* Pause / Resume video */}
      {isActive && videoRef.current && (
        <button onClick={toggleVideo} style={ctrlBtn('#dbeafe', '#0284c7')} title="Pause/resume student video — recording continues">
          {videoRef.current?.paused ? '▶ Video' : '⏸ Video'}
        </button>
      )}

      {/* Stop + save */}
      {isActive && (
        <button onClick={onStop} style={ctrlBtn('#7f1d1d')} title="Stop recording and save">
          ■ Stop
        </button>
      )}
    </div>
  )
}

function ctrlBtn(bg: string, textColor = '#f1f5f9'): React.CSSProperties {
  return {
    background: bg,
    border: 'none',
    borderRadius: 4,
    color: textColor,
    cursor: 'pointer',
    fontSize: 11,
    fontWeight: 600,
    padding: '3px 8px',
    whiteSpace: 'nowrap'
  }
}

// ── Styles ────────────────────────────────────────────────────────────────────

const overlay: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.7)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000
}

const modal: React.CSSProperties = {
  background: '#f0f9ff',
  border: '1px solid #bae6fd',
  borderRadius: 12,
  padding: 20,
  width: 680,
  maxWidth: '90vw',
  maxHeight: '80vh',
  overflow: 'auto'
}

const grid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
  gap: 10
}

const sourceCard: React.CSSProperties = {
  background: '#ffffff',
  border: '2px solid #bae6fd',
  borderRadius: 6,
  cursor: 'pointer',
  padding: 0,
  textAlign: 'left',
  transition: 'border-color 0.15s'
}

const closeBtn: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: '#64748b',
  cursor: 'pointer',
  fontSize: 22,
  lineHeight: 1,
  padding: 0
}
