export interface Annotation {
  id: string
  timestamp: number          // seconds into video
  type: 'rect' | 'circle' | 'arrow' | 'text'
  x: number
  y: number
  width?: number
  height?: number
  text?: string
  color: string
  label?: string             // professor's short label
  createdAt: number
}

export interface FeedbackComment {
  id: string
  timestamp: number          // seconds into video
  author: string
  text: string
  tag: 'pacing' | 'clarity' | 'volume' | 'posture' | 'eye_contact' | 'argument' | 'general'
  createdAt: number
  voiceNote?: string         // base64 audio data URL
}

export interface SessionData {
  id: string
  title: string
  mediaPath: string
  fileName: string
  createdAt: number
  annotations: Annotation[]
  comments: FeedbackComment[]
  pitchData: PitchSample[]
  decibelData: DecibelSample[]
}

export interface PitchSample {
  t: number    // seconds
  hz: number   // pitch in Hz, 0 = unvoiced
}

export interface DecibelSample {
  t: number    // seconds
  db: number   // decibel level
}

export interface AudioAnalysisState {
  isAnalyzing: boolean
  currentPitch: number
  currentDb: number
  pitchHistory: PitchSample[]
  dbHistory: DecibelSample[]
}

export interface FrameSample {
  t: number       // timestamp in seconds
  dataUrl: string // JPEG data URL (data:image/jpeg;base64,...)
}
