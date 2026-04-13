import React, { forwardRef, useEffect } from 'react'

interface Props {
  src: string
  onPlay?: () => void
  onPause?: () => void
  onTimeUpdate?: (t: number) => void
  onLoaded?: (duration: number) => void
  onEnded?: () => void
}

export const VideoPlayer = forwardRef<HTMLVideoElement, Props>(
  function VideoPlayer({ src, onPlay, onPause, onTimeUpdate, onLoaded, onEnded }, ref) {
    useEffect(() => {
      // nothing — event handlers set via props
    }, [])

    return (
      <video
        ref={ref}
        src={src}
        controls
        crossOrigin="anonymous"
        onPlay={onPlay}
        onPause={onPause}
        onTimeUpdate={e => onTimeUpdate?.((e.target as HTMLVideoElement).currentTime)}
        onLoadedMetadata={e => onLoaded?.((e.target as HTMLVideoElement).duration)}
        onEnded={onEnded}
        style={{
          width: '100%',
          maxHeight: 380,
          background: '#000',
          borderRadius: 8,
          display: 'block'
        }}
      />
    )
  }
)
