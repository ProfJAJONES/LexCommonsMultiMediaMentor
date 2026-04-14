import { useCallback, useRef, useState } from 'react'
import type { PracticeCharacter } from '../config/practiceCharacters'
import { buildPracticeSystemPrompt } from '../config/practiceCharacters'
import { streamCompletion, type AIProvider } from '../utils/aiClient'

export interface PracticeMessage {
  id: string
  speaker: 'student' | 'character' | 'system'
  text: string
  timestamp: number
}

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export function useLivePractice(apiKey: string, provider: AIProvider = 'anthropic') {
  const [messages, setMessages] = useState<PracticeMessage[]>([])
  const [isResponding, setIsResponding] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sessionActive, setSessionActive] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  // Keep a ref in sync for use inside async callbacks
  const messagesRef = useRef<PracticeMessage[]>([])
  messagesRef.current = messages

  /** Start a new session with a given character. Injects the character's opening line. */
  const startSession = useCallback((character: PracticeCharacter) => {
    abortRef.current?.abort()
    const opening: PracticeMessage = {
      id: uid(),
      speaker: 'character',
      text: character.openingLine,
      timestamp: Date.now()
    }
    setMessages([opening])
    setStreamingText('')
    setError(null)
    setSessionActive(true)
  }, [])

  const endSession = useCallback(() => {
    abortRef.current?.abort()
    setIsResponding(false)
    setStreamingText('')
    setSessionActive(false)
  }, [])

  const reset = useCallback(() => {
    abortRef.current?.abort()
    setMessages([])
    setStreamingText('')
    setError(null)
    setIsResponding(false)
    setSessionActive(false)
  }, [])

  /** Send the student's turn and stream the character's response. */
  const sendTurn = useCallback(async (
    studentText: string,
    character: PracticeCharacter,
    knowledgeBlock: string
  ) => {
    if (!apiKey.trim() || !studentText.trim()) return

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    const studentMsg: PracticeMessage = {
      id: uid(),
      speaker: 'student',
      text: studentText.trim(),
      timestamp: Date.now()
    }

    const currentMsgs = [...messagesRef.current, studentMsg]
    setMessages(currentMsgs)
    setIsResponding(true)
    setStreamingText('')
    setError(null)

    try {
      const systemPrompt = buildPracticeSystemPrompt(character, knowledgeBlock)

      // Build API message history — character messages are 'assistant', student messages are 'user'
      // API requires a user turn first, so prepend a silent trigger before the opening line.
      const apiMessages: { role: 'user' | 'assistant'; content: string }[] = []
      for (const m of currentMsgs) {
        if (m.speaker === 'system') continue
        if (m.speaker === 'character') {
          if (apiMessages.length === 0) {
            apiMessages.push({ role: 'user', content: '(Session beginning. Open in character.)' })
          }
          apiMessages.push({ role: 'assistant', content: m.text })
        } else {
          apiMessages.push({ role: 'user', content: m.text })
        }
      }

      let text = ''
      await streamCompletion(provider, apiKey, {
        system: systemPrompt,
        messages: apiMessages,
        maxTokens: 450,
        signal: controller.signal,
        onToken: tok => { text += tok; setStreamingText(text) }
      })

      const charMsg: PracticeMessage = {
        id: uid(),
        speaker: 'character',
        text,
        timestamp: Date.now()
      }
      setMessages(prev => [...prev, charMsg])
      setStreamingText('')
    } catch (e: unknown) {
      if (e instanceof Error && e.name === 'AbortError') {
        // Commit whatever streamed so far
        setMessages(prev => {
          const cur = streamingText
          if (!cur) return prev
          return [...prev, { id: uid(), speaker: 'character', text: cur, timestamp: Date.now() }]
        })
        setStreamingText('')
        return
      }
      const msg = e instanceof Error ? e.message : 'Unknown error'
      setError(`AI error: ${msg}`)
    } finally {
      setIsResponding(false)
    }
  }, [apiKey, provider, streamingText])

  const stopResponse = useCallback(() => {
    abortRef.current?.abort()
    setIsResponding(false)
    if (streamingText) {
      setMessages(prev => [...prev, {
        id: uid(),
        speaker: 'character',
        text: streamingText,
        timestamp: Date.now()
      }])
      setStreamingText('')
    }
  }, [streamingText])

  return {
    messages,
    isResponding,
    streamingText,
    error,
    sessionActive,
    startSession,
    endSession,
    reset,
    sendTurn,
    stopResponse
  }
}
