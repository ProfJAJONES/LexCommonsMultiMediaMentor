// Global type augmentations for the renderer.
// Single source of truth — do not duplicate `declare global` blocks for these
// names elsewhere in the renderer.

import type { CaptureSource } from '../hooks/useScreenRecorder'

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
      saveRecording: (
        buffer: Uint8Array,
        name: string
      ) => Promise<string | { fallback: true; webmPath: string } | null>
      exportAnnotatedVideo: (
        videoPath: string,
        pitchPng: string,
        decibelPng: string,
        comments: Array<{ timestamp: number; tag: string; text: string }>
      ) => Promise<string | { error: string } | null>
      saveReport: (html: string) => Promise<string | null>
      installBlackHole: () => Promise<string | null>
      openAudioMidiSetup: () => Promise<string | null>
      getMediaPermissions: () => Promise<{ camera: string; microphone: string }>
      requestMediaAccess: () => Promise<{ camera: boolean; microphone: boolean }>
      resetRendererMicTCC: () => Promise<{ ok: boolean; reset?: number }>
      getScreenRecordingStatus: () => Promise<string>
      openScreenRecordingSettings: () => Promise<void>
      storeGet: (key: string) => Promise<string | null>
      storeGetAll: () => Promise<Record<string, string>>
      storeSet: (key: string, value: string | null) => Promise<void>
      minimizeWindow: () => void
    }

    // Web Speech API — not yet in lib.dom (proposed standard).
    SpeechRecognition?: typeof SpeechRecognition
    webkitSpeechRecognition?: typeof SpeechRecognition
  }

  // Minimal Web Speech API surface used by useSpeechRecognition.
  // Only the fields/events we actually read are typed.
  interface SpeechRecognitionEventMap {
    audioend: Event
    audiostart: Event
    end: Event
    error: SpeechRecognitionErrorEvent
    nomatch: SpeechRecognitionEvent
    result: SpeechRecognitionEvent
    soundend: Event
    soundstart: Event
    speechend: Event
    speechstart: Event
    start: Event
  }

  interface SpeechRecognition extends EventTarget {
    continuous: boolean
    interimResults: boolean
    lang: string
    maxAlternatives: number
    onaudioend: ((this: SpeechRecognition, ev: Event) => unknown) | null
    onaudiostart: ((this: SpeechRecognition, ev: Event) => unknown) | null
    onend: ((this: SpeechRecognition, ev: Event) => unknown) | null
    onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => unknown) | null
    onnomatch: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => unknown) | null
    onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => unknown) | null
    onsoundend: ((this: SpeechRecognition, ev: Event) => unknown) | null
    onsoundstart: ((this: SpeechRecognition, ev: Event) => unknown) | null
    onspeechend: ((this: SpeechRecognition, ev: Event) => unknown) | null
    onspeechstart: ((this: SpeechRecognition, ev: Event) => unknown) | null
    onstart: ((this: SpeechRecognition, ev: Event) => unknown) | null
    start(): void
    stop(): void
    abort(): void
    addEventListener<K extends keyof SpeechRecognitionEventMap>(
      type: K,
      listener: (this: SpeechRecognition, ev: SpeechRecognitionEventMap[K]) => unknown,
      options?: boolean | AddEventListenerOptions
    ): void
    removeEventListener<K extends keyof SpeechRecognitionEventMap>(
      type: K,
      listener: (this: SpeechRecognition, ev: SpeechRecognitionEventMap[K]) => unknown,
      options?: boolean | EventListenerOptions
    ): void
  }

  // eslint-disable-next-line @typescript-eslint/no-redeclare
  const SpeechRecognition: { prototype: SpeechRecognition; new (): SpeechRecognition }

  interface SpeechRecognitionErrorEvent extends Event {
    readonly error: string
    readonly message: string
  }

  interface SpeechRecognitionEvent extends Event {
    readonly resultIndex: number
    readonly results: SpeechRecognitionResultList
  }

  interface SpeechRecognitionResultList {
    readonly length: number
    item(index: number): SpeechRecognitionResult
    [index: number]: SpeechRecognitionResult
  }

  interface SpeechRecognitionResult {
    readonly length: number
    readonly isFinal: boolean
    item(index: number): SpeechRecognitionAlternative
    [index: number]: SpeechRecognitionAlternative
  }

  interface SpeechRecognitionAlternative {
    readonly transcript: string
    readonly confidence: number
  }
}

export {}
