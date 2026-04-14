import { useState, useCallback, useRef } from 'react'
import type { PitchSample, DecibelSample, FeedbackComment, FrameSample } from '../types'
import type { Domain } from './useDomain'
import { DOMAIN_CONFIG } from './useDomain'
import { streamCompletion, type AIProvider } from '../utils/aiClient'

export type UserRole = 'professor' | 'student'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  /** Display name shown above the message */
  displayName?: string
}

export interface SessionContext {
  pitchHistory: PitchSample[]
  dbHistory: DecibelSample[]
  comments: FeedbackComment[]
  fileName: string
  durationSec: number
}

export interface AIFeedbackOptions {
  pitchHistory: PitchSample[]
  dbHistory: DecibelSample[]
  comments: FeedbackComment[]
  fileName: string
  durationSec: number
}

export interface AIFeedbackState {
  isLoading: boolean
  messages: ChatMessage[]
  streamingText: string
  error: string | null
}

// ─── Stats helpers ────────────────────────────────────────────────────────────

function pitchStats(samples: PitchSample[]) {
  const v = samples.filter(s => s.hz > 0).map(s => s.hz)
  if (v.length === 0) return null
  const avg = v.reduce((a, b) => a + b, 0) / v.length
  const std = Math.sqrt(v.reduce((a, b) => a + (b - avg) ** 2, 0) / v.length)
  return {
    avg: Math.round(avg),
    min: Math.round(Math.min(...v)),
    max: Math.round(Math.max(...v)),
    std: Math.round(std),
    voicedPct: Math.round((v.length / samples.length) * 100)
  }
}

function dbStats(samples: DecibelSample[]) {
  const d = samples.map(s => s.db).filter(x => isFinite(x) && x > -60)
  if (d.length === 0) return null
  const avg = d.reduce((a, b) => a + b, 0) / d.length
  return { avg: Math.round(avg), min: Math.round(Math.min(...d)), max: Math.round(Math.max(...d)) }
}

function fmtDur(sec: number) {
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60)
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

// ─── Knowledge scope levels ────────────────────────────────────────────────────

export type KnowledgeScope = 1 | 2 | 3 | 4 | 5

export const SCOPE_LABELS: Record<KnowledgeScope, { label: string; icon: string; description: string }> = {
  1: { label: 'Library Only',    icon: '🔒', description: 'Answer only from uploaded course materials. No outside knowledge.' },
  2: { label: 'Library First',   icon: '📚', description: 'Draw mainly from the library; fill minor gaps from domain knowledge.' },
  3: { label: 'Balanced',        icon: '⚖️',  description: 'Library is the primary source; supplement freely with expertise.' },
  4: { label: 'Knowledge First', icon: '🌐', description: 'Broad expertise with library for course-specific context.' },
  5: { label: 'Full Freedom',    icon: '🔓', description: 'Full AI knowledge. Library is advisory only.' },
}

function scopeInstruction(scope: KnowledgeScope, hasKB: boolean): string {
  if (!hasKB) return ''  // no KB uploaded — scope has no practical effect
  switch (scope) {
    case 1: return '\n\n## Knowledge Scope — LIBRARY ONLY\nYou MUST answer exclusively from the course materials provided below. Do not draw on general knowledge, training data, or any outside information. If the answer is not in the materials, say so explicitly rather than guessing.'
    case 2: return '\n\n## Knowledge Scope — LIBRARY FIRST\nBase every answer on the course materials below. You may use general domain knowledge only to fill small gaps directly relevant to the question — never to expand beyond what the library covers.'
    case 3: return '\n\n## Knowledge Scope — BALANCED\nUse the course materials as your primary reference. Supplement with relevant domain expertise when it adds meaningful clarity beyond what the library covers.'
    case 4: return '\n\n## Knowledge Scope — KNOWLEDGE FIRST\nDraw freely on your full domain expertise and general knowledge. Reference the course materials for course-specific standards, rubrics, and terminology.'
    case 5: return ''  // no instruction needed — this is normal AI behavior
  }
}

// ─── Build system prompt ──────────────────────────────────────────────────────

export function buildSystemPrompt(
  role: UserRole,
  knowledgeBlock: string,
  ctx: SessionContext | null,
  domain: Domain = 'law',
  scope: KnowledgeScope = 3
): string {
  const cfg = DOMAIN_CONFIG[domain]
  const basePersona = cfg.aiPersona
  const roleContext = role === 'professor'
    ? `You are assisting a ${cfg.coachTitle} (the educator/coach). Provide analytical, detailed observations and specific instructional suggestions.`
    : `You are assisting a student working with a ${cfg.coachTitle}. Be encouraging, clear, and actionable. Focus on what they can do to improve.`

  const knowledgeSection = knowledgeBlock
    ? `\n\n## Course Knowledge Base\nThe professor has provided the following course-specific materials. Use these to contextualize all feedback:\n\n${knowledgeBlock}`
    : ''

  let sessionSection = ''
  if (ctx) {
    const ps = pitchStats(ctx.pitchHistory)
    const ds = dbStats(ctx.dbHistory)
    const hasData = ps || ds

    if (hasData || ctx.comments.length > 0 || ctx.fileName) {
      sessionSection = '\n\n## Current Session Data'
      if (ctx.fileName) sessionSection += `\nFile: ${ctx.fileName}`
      if (ctx.durationSec > 0) sessionSection += `\nDuration analyzed: ${fmtDur(ctx.durationSec)}`
      if (ps) {
        sessionSection += `\nPitch — avg ${ps.avg} Hz, range ${ps.min}–${ps.max} Hz, σ=${ps.std} Hz, voiced ${ps.voicedPct}% of time`
        if (ps.avg < 130) sessionSection += ' [LOW register]'
        else if (ps.avg < 200) sessionSection += ' [low-mid register]'
        else if (ps.avg < 280) sessionSection += ' [mid register]'
        else sessionSection += ' [HIGH register]'
      }
      if (ds) {
        sessionSection += `\nVolume — avg ${ds.avg} dBFS, range ${ds.min}–${ds.max} dBFS`
        if (ds.max - ds.min < 6) sessionSection += ' [very flat dynamic range]'
        else if (ds.max - ds.min > 20) sessionSection += ' [wide dynamic range]'
      }
      if (ctx.comments.length > 0) {
        sessionSection += `\n\nInstructor comments (${ctx.comments.length}):\n`
        sessionSection += ctx.comments
          .map(c => `  [${Math.floor(c.timestamp / 60)}:${String(Math.floor(c.timestamp % 60)).padStart(2, '0')}] (${c.tag}) ${c.text}`)
          .join('\n')
      }
    }
  }

  const scopeSection = scopeInstruction(scope, !!knowledgeBlock)

  return `${basePersona}

${roleContext}

Keep responses focused and actionable — avoid padding. Use **bold** for section headings. Respond in 200–400 words unless the question calls for more detail.${knowledgeSection}${sessionSection}${scopeSection}`
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAIFeedback() {
  const [state, setState] = useState<AIFeedbackState>({
    isLoading: false,
    messages: [],
    streamingText: '',
    error: null
  })
  const [provider, setProvider] = useState<AIProvider>(() =>
    (localStorage.getItem('mm_ai_provider') as AIProvider) ?? 'anthropic'
  )
  const [apiKey, setApiKey] = useState(() => {
    const p = (localStorage.getItem('mm_ai_provider') as AIProvider) ?? 'anthropic'
    // Per-provider keys take precedence; fall back to legacy single-slot key (migration)
    return localStorage.getItem(`mm_ai_key_${p}`)
      ?? localStorage.getItem('mm_ai_key')
      ?? localStorage.getItem('anthropic_api_key')
      ?? ''
  })
  const [role, setRole] = useState<UserRole>(() =>
    (localStorage.getItem('mm_ai_role') as UserRole) ?? 'professor'
  )
  const [knowledgeScope, setKnowledgeScope] = useState<KnowledgeScope>(() => {
    const stored = parseInt(localStorage.getItem('mm_ai_scope') ?? '3', 10)
    return (stored >= 1 && stored <= 5 ? stored : 3) as KnowledgeScope
  })
  const abortRef = useRef<AbortController | null>(null)

  const saveApiKey = useCallback((key: string) => {
    setApiKey(key)
    if (key) localStorage.setItem(`mm_ai_key_${provider}`, key)
    else localStorage.removeItem(`mm_ai_key_${provider}`)
  }, [provider])

  const saveProvider = useCallback((p: AIProvider) => {
    setProvider(p)
    localStorage.setItem('mm_ai_provider', p)
    // Switch active key to whatever is stored for the new provider
    const storedKey = localStorage.getItem(`mm_ai_key_${p}`) ?? ''
    setApiKey(storedKey)
  }, [])

  const saveRole = useCallback((r: UserRole) => {
    setRole(r)
    localStorage.setItem('mm_ai_role', r)
  }, [])

  const saveKnowledgeScope = useCallback((s: KnowledgeScope) => {
    setKnowledgeScope(s)
    localStorage.setItem('mm_ai_scope', String(s))
  }, [])

  const send = useCallback(async (
    userText: string,
    systemPrompt: string,
    displayName?: string
  ) => {
    if (!apiKey.trim()) {
      setState(s => ({ ...s, error: 'Enter your API key in ⚙ Settings.' }))
      return
    }
    if (!userText.trim()) return

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    const userMsg: ChatMessage = { role: 'user', content: userText.trim(), displayName: displayName ?? (role === 'professor' ? 'Professor' : 'Student') }

    setState(s => ({
      ...s,
      isLoading: true,
      streamingText: '',
      error: null,
      messages: [...s.messages, userMsg]
    }))

    let assistantText = ''
    try {
      const history = [...state.messages, userMsg].map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content
      }))

      await streamCompletion(provider, apiKey, {
        system: systemPrompt,
        messages: history,
        maxTokens: 1024,
        signal: controller.signal,
        onToken: tok => {
          assistantText += tok
          setState(s => ({ ...s, streamingText: assistantText }))
        }
      })

      setState(s => ({
        ...s,
        isLoading: false,
        streamingText: '',
        messages: [...s.messages, { role: 'assistant', content: assistantText, displayName: 'AI Coach' }]
      }))
    } catch (e: unknown) {
      if (e instanceof Error && e.name === 'AbortError') {
        setState(s => ({ ...s, isLoading: false, streamingText: '' }))
        return
      }
      const msg = e instanceof Error ? e.message : 'Unknown error'
      setState(s => ({ ...s, isLoading: false, streamingText: '', error: `API error: ${msg}` }))
    }
  }, [apiKey, provider, role, state.messages])

  const sendWithImages = useCallback(async (
    displayText: string,
    frames: FrameSample[],
    systemPrompt: string
  ) => {
    if (!apiKey.trim()) {
      setState(s => ({ ...s, error: 'Enter your API key in ⚙ Settings.' }))
      return
    }
    if (frames.length === 0) return

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    const userMsg: ChatMessage = {
      role: 'user',
      content: displayText,
      displayName: role === 'professor' ? 'Professor' : 'Student'
    }

    setState(s => ({
      ...s,
      isLoading: true,
      streamingText: '',
      error: null,
      messages: [...s.messages, userMsg]
    }))

    let assistantText = ''
    try {
      const imageBlocks = frames.map(f => ({
        type: 'image' as const,
        mediaType: 'image/jpeg' as const,
        base64: f.dataUrl.replace(/^data:image\/jpeg;base64,/, '')
      }))

      const history = [...state.messages, userMsg].map((m, i, arr) => ({
        role: m.role as 'user' | 'assistant',
        content: i === arr.length - 1
          ? [...imageBlocks, { type: 'text' as const, text: m.content as string }]
          : m.content
      }))

      await streamCompletion(provider, apiKey, {
        system: systemPrompt,
        messages: history,
        maxTokens: 1500,
        signal: controller.signal,
        onToken: tok => {
          assistantText += tok
          setState(s => ({ ...s, streamingText: assistantText }))
        }
      })

      setState(s => ({
        ...s,
        isLoading: false,
        streamingText: '',
        messages: [...s.messages, { role: 'assistant', content: assistantText, displayName: 'AI Coach' }]
      }))
    } catch (e: unknown) {
      if (e instanceof Error && e.name === 'AbortError') {
        setState(s => ({ ...s, isLoading: false, streamingText: '' }))
        return
      }
      const msg = e instanceof Error ? e.message : 'Unknown error'
      setState(s => ({ ...s, isLoading: false, streamingText: '', error: `API error: ${msg}` }))
    }
  }, [apiKey, provider, role, state.messages])

  const stop = useCallback(() => {
    abortRef.current?.abort()
    setState(s => {
      if (!s.streamingText) return { ...s, isLoading: false }
      return {
        ...s,
        isLoading: false,
        streamingText: '',
        messages: [...s.messages, { role: 'assistant', content: s.streamingText, displayName: 'AI Coach' }]
      }
    })
  }, [])

  const clearChat = useCallback(() => {
    setState({ isLoading: false, messages: [], streamingText: '', error: null })
  }, [])

  const generateOnce = useCallback(async (
    prompt: string,
    systemPrompt: string,
    onToken: (token: string) => void
  ): Promise<void> => {
    if (!apiKey.trim()) throw new Error('Enter your API key in the AI tab first.')
    await streamCompletion(provider, apiKey, {
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 2048,
      onToken
    })
  }, [apiKey, provider])

  return { state, apiKey, provider, role, knowledgeScope, saveApiKey, saveProvider, saveRole, saveKnowledgeScope, send, sendWithImages, stop, clearChat, generateOnce }
}
