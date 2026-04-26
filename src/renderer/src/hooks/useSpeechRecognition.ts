import { useCallback, useRef, useState } from 'react'

export function useSpeechRecognition() {
  const [isListening, setIsListening] = useState(false)
  const [liveTranscript, setLiveTranscript] = useState('')
  const [micError, setMicError] = useState<string | null>(null)
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const finalRef = useRef('')          // confirmed final segments
  const fullRef = useRef('')           // final + latest interim (most complete at any moment)
  const networkRetryRef = useRef(false) // auto-retry once on transient network error

  const isSupported =
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)

  const start = useCallback(async () => {
    if (!isSupported) return

    setMicError(null)

    // Explicitly request mic permission first — avoids the flash-green-then-stop bug in Electron
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach(t => t.stop())
    } catch {
      setMicError('Microphone access denied. Check permissions in System Settings.')
      return
    }

    recognitionRef.current?.abort()

    const SR = (window.SpeechRecognition ?? window.webkitSpeechRecognition) as typeof SpeechRecognition
    const rec = new SR()
    rec.continuous = true
    rec.interimResults = true
    rec.lang = 'en-US'
    rec.maxAlternatives = 1

    finalRef.current = ''
    fullRef.current = ''
    networkRetryRef.current = false
    setLiveTranscript('')
    setIsListening(true)

    rec.onresult = (e: SpeechRecognitionEvent) => {
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i]
        if (result.isFinal) {
          finalRef.current += result[0].transcript + ' '
        } else {
          interim += result[0].transcript
        }
      }
      // Always keep the most complete transcript — final segments + current interim
      fullRef.current = finalRef.current + interim
      setLiveTranscript(fullRef.current)
    }

    rec.onerror = (e: SpeechRecognitionErrorEvent) => {
      if (e.error === 'aborted') return
      if (e.error === 'network' && !networkRetryRef.current) {
        // Transient network blip — retry once automatically after a short pause
        networkRetryRef.current = true
        recognitionRef.current = null
        setTimeout(() => {
          const SR2 = (window.SpeechRecognition ?? window.webkitSpeechRecognition) as typeof SpeechRecognition
          const rec2 = new SR2()
          rec2.continuous = true
          rec2.interimResults = true
          rec2.lang = 'en-US'
          rec2.maxAlternatives = 1
          rec2.onresult = rec.onresult
          rec2.onerror = rec.onerror
          rec2.onend = rec.onend
          recognitionRef.current = rec2
          rec2.start()
        }, 800)
        return
      }
      const friendly: Record<string, string> = {
        network: 'Speech recognition unavailable — check your internet connection, then tap Speak again.',
        'not-allowed': 'Microphone access denied. Check permissions in System Settings.',
        'no-speech': 'No speech detected. Tap Speak and try again.',
        'audio-capture': 'No microphone found. Connect a mic and try again.',
      }
      setMicError(friendly[e.error] ?? `Speech error: ${e.error}`)
      setIsListening(false)
    }

    rec.onend = () => {
      setIsListening(false)
      // Use fullRef — it includes interim results that never got promoted to final
      // This is the most reliable text available when stop() is called mid-utterance
    }

    recognitionRef.current = rec
    rec.start()
  }, [isSupported])

  const stop = useCallback(() => {
    recognitionRef.current?.stop()
    recognitionRef.current = null
  }, [])

  const abort = useCallback(() => {
    recognitionRef.current?.abort()
    recognitionRef.current = null
    setIsListening(false)
    setLiveTranscript('')
    finalRef.current = ''
    fullRef.current = ''
  }, [])

  /** Returns the best available transcript at this moment (final + any interim). */
  const getTranscript = useCallback(() => fullRef.current.trim() || finalRef.current.trim(), [])

  return { isListening, liveTranscript, micError, start, stop, abort, getTranscript, isSupported }
}
