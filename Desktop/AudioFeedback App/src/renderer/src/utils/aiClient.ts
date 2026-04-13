/**
 * Unified AI streaming client.
 * Supports Anthropic (Claude), OpenAI (GPT-4o), and Google Gemini.
 * No Grok support.
 */
import Anthropic from '@anthropic-ai/sdk'

export type AIProvider = 'anthropic' | 'openai' | 'gemini'

export interface ProviderConfig {
  label: string
  icon: string
  placeholder: string
  docsLabel: string
  docsUrl: string
  mainModel: string
  fastModel: string
  supportsVision: boolean
}

export const PROVIDER_CONFIG: Record<AIProvider, ProviderConfig> = {
  anthropic: {
    label: 'Anthropic (Claude)',
    icon: '◈',
    placeholder: 'sk-ant-api03-...',
    docsLabel: 'console.anthropic.com',
    docsUrl: 'https://console.anthropic.com/settings/keys',
    mainModel: 'claude-opus-4-6',
    fastModel: 'claude-haiku-4-5-20251001',
    supportsVision: true
  },
  openai: {
    label: 'OpenAI (GPT-4o)',
    icon: '◯',
    placeholder: 'sk-proj-...',
    docsLabel: 'platform.openai.com/api-keys',
    docsUrl: 'https://platform.openai.com/api-keys',
    mainModel: 'gpt-4o',
    fastModel: 'gpt-4o-mini',
    supportsVision: true
  },
  gemini: {
    label: 'Google Gemini',
    icon: '✦',
    placeholder: 'AIzaSy...',
    docsLabel: 'aistudio.google.com/app/apikey',
    docsUrl: 'https://aistudio.google.com/app/apikey',
    mainModel: 'gemini-2.0-flash',
    fastModel: 'gemini-2.0-flash',
    supportsVision: true
  }
}

export interface ImageBlock {
  type: 'image'
  mediaType: 'image/jpeg' | 'image/png'
  base64: string  // raw base64, no data-URL prefix
}

export interface TextBlock {
  type: 'text'
  text: string
}

export type ContentBlock = TextBlock | ImageBlock

export interface AIMessage {
  role: 'user' | 'assistant'
  content: string | ContentBlock[]
}

export interface StreamParams {
  system: string
  messages: AIMessage[]
  maxTokens: number
  signal?: AbortSignal
  onToken: (text: string) => void
  /** Use the fast/cheap model (haiku/mini/flash) instead of the main model */
  fast?: boolean
}

// ─── Public entry point ───────────────────────────────────────────────────────

export async function streamCompletion(
  provider: AIProvider,
  apiKey: string,
  params: StreamParams
): Promise<void> {
  switch (provider) {
    case 'anthropic': return _anthropic(apiKey, params)
    case 'openai':    return _openai(apiKey, params)
    case 'gemini':    return _gemini(apiKey, params)
  }
}

// ─── Anthropic ────────────────────────────────────────────────────────────────

async function _anthropic(apiKey: string, params: StreamParams): Promise<void> {
  const cfg = PROVIDER_CONFIG.anthropic
  const model = params.fast ? cfg.fastModel : cfg.mainModel

  const client = new Anthropic({ apiKey: apiKey.trim(), dangerouslyAllowBrowser: true })

  const messages: Anthropic.MessageParam[] = params.messages.map(m => {
    if (typeof m.content === 'string') {
      return { role: m.role, content: m.content }
    }
    const content: Anthropic.ContentBlockParam[] = m.content.map(b => {
      if (b.type === 'text') return { type: 'text', text: b.text }
      return {
        type: 'image',
        source: { type: 'base64', media_type: b.mediaType, data: b.base64 }
      } as Anthropic.ImageBlockParam
    })
    return { role: m.role, content }
  })

  // thinking: adaptive is only stable on full-size Opus/Sonnet models, skip on haiku
  const useThinking = !params.fast

  const reqBody: Anthropic.MessageStreamParams = {
    model,
    max_tokens: params.maxTokens,
    system: params.system,
    messages,
    ...(useThinking ? { thinking: { type: 'adaptive' as const } } : {})
  }

  const stream = await client.messages.stream(reqBody, { signal: params.signal })
  for await (const chunk of stream) {
    if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
      params.onToken(chunk.delta.text)
    }
  }
}

// ─── OpenAI ───────────────────────────────────────────────────────────────────

async function _openai(apiKey: string, params: StreamParams): Promise<void> {
  const cfg = PROVIDER_CONFIG.openai
  const model = params.fast ? cfg.fastModel : cfg.mainModel

  // Build messages array in OpenAI format
  const messages: object[] = [
    { role: 'system', content: params.system },
    ...params.messages.map(m => {
      if (typeof m.content === 'string') return { role: m.role, content: m.content }
      const content = m.content.map(b => {
        if (b.type === 'text') return { type: 'text', text: b.text }
        return { type: 'image_url', image_url: { url: `data:${b.mediaType};base64,${b.base64}`, detail: 'low' } }
      })
      return { role: m.role, content }
    })
  ]

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey.trim()}`
    },
    body: JSON.stringify({ model, stream: true, max_tokens: params.maxTokens, messages }),
    signal: params.signal
  })

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}))
    throw new Error((errBody as { error?: { message?: string } })?.error?.message ?? `OpenAI error ${res.status}`)
  }

  const reader = res.body!.getReader()
  const dec = new TextDecoder()
  let buf = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += dec.decode(value, { stream: true })
    const lines = buf.split('\n')
    buf = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const raw = line.slice(6).trim()
      if (raw === '[DONE]') return
      try {
        const chunk = JSON.parse(raw) as { choices?: { delta?: { content?: string } }[] }
        const tok = chunk.choices?.[0]?.delta?.content
        if (tok) params.onToken(tok)
      } catch { /* partial JSON, skip */ }
    }
  }
}

// ─── Google Gemini ────────────────────────────────────────────────────────────

async function _gemini(apiKey: string, params: StreamParams): Promise<void> {
  const cfg = PROVIDER_CONFIG.gemini
  const model = params.fast ? cfg.fastModel : cfg.mainModel

  // Gemini roles: 'user' | 'model'
  const contents = params.messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: typeof m.content === 'string'
      ? [{ text: m.content }]
      : m.content.map(b => {
          if (b.type === 'text') return { text: b.text }
          return { inlineData: { mimeType: b.mediaType, data: b.base64 } }
        })
  }))

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${apiKey.trim()}&alt=sse`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: params.system }] },
      contents,
      generationConfig: { maxOutputTokens: params.maxTokens }
    }),
    signal: params.signal
  })

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}))
    const msg = (errBody as { error?: { message?: string } })?.error?.message
    throw new Error(msg ?? `Gemini error ${res.status}`)
  }

  const reader = res.body!.getReader()
  const dec = new TextDecoder()
  let buf = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += dec.decode(value, { stream: true })
    const lines = buf.split('\n')
    buf = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      try {
        const chunk = JSON.parse(line.slice(6)) as {
          candidates?: { content?: { parts?: { text?: string }[] } }[]
        }
        const tok = chunk.candidates?.[0]?.content?.parts?.[0]?.text
        if (tok) params.onToken(tok)
      } catch { /* skip */ }
    }
  }
}
