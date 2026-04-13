import React, { useState, useRef, useEffect } from 'react'
import type { AIFeedbackState, AIFeedbackOptions, UserRole, KnowledgeScope } from '../hooks/useAIFeedback'
import { buildSystemPrompt, SCOPE_LABELS } from '../hooks/useAIFeedback'
import { useAIKnowledgeBase, CATEGORY_LABELS, CATEGORY_COLORS } from '../hooks/useAIKnowledgeBase'
import type { KnowledgeCategory, KnowledgeItem } from '../hooks/useAIKnowledgeBase'
import type { Domain } from '../hooks/useDomain'
import { DOMAIN_CONFIG } from '../hooks/useDomain'
import { useVisualAnalysis } from '../hooks/useVisualAnalysis'
import type { FrameSample } from '../types'
import { type AIProvider, PROVIDER_CONFIG } from '../utils/aiClient'

interface Props {
  state: AIFeedbackState
  apiKey: string
  provider: AIProvider
  role: UserRole
  domain: Domain
  hasData: boolean
  hasVideo: boolean
  videoEnded: boolean
  knowledgeScope: KnowledgeScope
  onSaveApiKey: (key: string) => void
  onSaveProvider: (p: AIProvider) => void
  onSaveRole: (r: UserRole) => void
  onSaveKnowledgeScope: (s: KnowledgeScope) => void
  onSend: (text: string, systemPrompt: string, displayName?: string) => void
  onSendWithImages: (displayText: string, frames: FrameSample[], systemPrompt: string) => void
  onStop: () => void
  onClear: () => void
  getContext: () => AIFeedbackOptions
  videoRef: React.RefObject<HTMLVideoElement | null>
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export function AIFeedbackPanel({
  state,
  apiKey,
  provider,
  role,
  domain,
  hasData,
  hasVideo,
  videoEnded,
  knowledgeScope,
  onSaveApiKey,
  onSaveProvider,
  onSaveRole,
  onSaveKnowledgeScope,
  onSend,
  onSendWithImages,
  onStop,
  onClear,
  getContext,
  videoRef
}: Props) {
  const [input, setInput] = useState('')
  const [showSettings, setShowSettings] = useState(!apiKey)
  const [showKB, setShowKB] = useState(false)
  const [draftKey, setDraftKey] = useState(apiKey)
  const [showKey, setShowKey] = useState(false)

  // Keep draft in sync when the stored key changes (e.g. provider switch)
  useEffect(() => {
    setDraftKey(apiKey)
  }, [apiKey])
  const [frames, setFrames] = useState<FrameSample[]>([])
  const chatEndRef = useRef<HTMLDivElement>(null)
  const kb = useAIKnowledgeBase(domain)
  const { extractFrames, isExtracting } = useVisualAnalysis(videoRef)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [state.messages, state.streamingText])

  function getSystemPrompt() {
    return buildSystemPrompt(role, kb.toPromptBlock(), getContext(), domain, knowledgeScope)
  }

  function handleSend(text?: string) {
    const msg = (text ?? input).trim()
    if (!msg) return
    setInput('')
    onSend(msg, getSystemPrompt())
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  function handleSaveKey() {
    const key = draftKey.trim()
    if (key) onSaveApiKey(key)
    // Don't wipe the stored key if the draft is empty (e.g. after a provider switch)
    setShowSettings(false)
  }

  async function handleVisualAnalysis() {
    const duration = videoRef.current?.duration ?? 0
    const frameCount = Math.min(40, Math.max(6, Math.round(duration / 8)))
    const captured = await extractFrames(frameCount)
    if (captured.length === 0) return
    setFrames(captured)
    const cfg = DOMAIN_CONFIG[domain]
    const prompt = `Analyze these ${captured.length} video frames from a ${cfg.label} session for physical and visual performance elements:

- **Hand gestures** — types used, rhetorical purpose, whether they reinforce or contradict the spoken content
- **Body posture & presence** — stance, weight distribution, tension or confidence signals
- **Eye contact** — direction, consistency, connection to audience/camera
- **Spatial use** — movement patterns, use of the available space
- **Facial expression** — engagement, range, congruence with content
- **Kairos moments** — where physical emphasis aligns with key arguments or emotional peaks
- **Distracting habits** — fidgeting, self-touching, gripping, swaying

Reference specific frames (Frame 1–${captured.length}) when noting patterns. Provide concrete, actionable coaching notes.`

    const sysPrompt = buildSystemPrompt(role, kb.toPromptBlock(), getContext(), domain, knowledgeScope)
    onSendWithImages(`🎥 Visual analysis — ${captured.length} frames captured`, captured, sysPrompt + '\n\nYou are now analyzing video frames. Be specific about what you observe visually in each frame. Reference frame numbers when relevant.')
  }

  const isEmpty = state.messages.length === 0 && !state.streamingText

  return (
    <div style={s.panel}>

      {/* ── Header ─────────────────────────────────────────────── */}
      <div style={s.header}>
        <span style={s.title}>AI Coach</span>
        <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
          {/* Role toggle */}
          <div style={{ display: 'flex', borderRadius: 5, overflow: 'hidden', border: '1px solid #bae6fd' }}>
            {(['professor', 'student'] as UserRole[]).map(r => (
              <button
                key={r}
                onClick={() => onSaveRole(r)}
                style={{
                  background: role === r ? (r === 'professor' ? '#7c3aed' : '#0369a1') : '#f1f5f9',
                  border: 'none',
                  color: role === r ? '#fff' : '#64748b',
                  cursor: 'pointer',
                  fontSize: 10,
                  fontWeight: 700,
                  padding: '4px 9px',
                  textTransform: 'capitalize'
                }}
              >
                {r === 'professor' ? 'Prof' : 'Student'}
              </button>
            ))}
          </div>
          {hasVideo && (
            <button
              onClick={handleVisualAnalysis}
              disabled={state.isLoading || isExtracting || !apiKey || !videoEnded}
              title={!videoEnded ? 'Watch the full recording first' : 'Analyze gestures & visual presence'}
              style={{
                ...hdrBtn('#1e293b'),
                opacity: (state.isLoading || isExtracting || !apiKey || !videoEnded) ? 0.4 : 1,
                cursor: (state.isLoading || isExtracting || !apiKey || !videoEnded) ? 'default' : 'pointer'
              }}
            >
              {isExtracting ? '⏳' : '🎥'}
            </button>
          )}
          <button onClick={() => setShowKB(v => !v)} style={hdrBtn(showKB ? '#1e3a5f' : '#1e293b')} title="Knowledge base">
            📚
          </button>
          <button onClick={() => setShowSettings(v => !v)} style={hdrBtn(showSettings ? '#1e3a5f' : '#1e293b')} title="Settings">
            ⚙
          </button>
          {!isEmpty && (
            <button onClick={onClear} style={hdrBtn('#1e293b')} title="Clear chat">
              ↺
            </button>
          )}
        </div>
      </div>

      {/* ── Settings ───────────────────────────────────────────── */}
      {showSettings && (
        <div style={s.infoBox}>
          {/* Provider selector */}
          <div style={{ color: '#64748b', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>
            AI Provider
          </div>
          <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
            {(Object.keys(PROVIDER_CONFIG) as AIProvider[]).map(p => {
              const cfg = PROVIDER_CONFIG[p]
              const active = provider === p
              return (
                <button
                  key={p}
                  onClick={() => { onSaveProvider(p) }}
                  style={{
                    flex: 1,
                    background: active ? '#eff6ff' : '#f8fafc',
                    border: `1.5px solid ${active ? '#3b82f6' : '#e2e8f0'}`,
                    borderRadius: 7,
                    color: active ? '#1d4ed8' : '#475569',
                    cursor: 'pointer',
                    fontSize: 10,
                    fontWeight: active ? 700 : 500,
                    padding: '5px 4px',
                    textAlign: 'center',
                    lineHeight: 1.3
                  }}
                >
                  <div style={{ fontSize: 14 }}>{cfg.icon}</div>
                  <div>{p === 'anthropic' ? 'Claude' : p === 'openai' ? 'GPT-4o' : 'Gemini'}</div>
                </button>
              )
            })}
          </div>

          {/* Knowledge scope slider */}
          <div style={{ color: '#64748b', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4, marginTop: 2 }}>
            Knowledge Scope
          </div>
          <div style={{ marginBottom: 10 }}>
            <input
              type="range"
              min={1}
              max={5}
              step={1}
              value={knowledgeScope}
              onChange={e => onSaveKnowledgeScope(parseInt(e.target.value, 10) as KnowledgeScope)}
              style={{ width: '100%', cursor: 'pointer', accentColor: '#3b82f6' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
              {([1, 2, 3, 4, 5] as KnowledgeScope[]).map(n => (
                <span
                  key={n}
                  style={{
                    fontSize: 9,
                    color: knowledgeScope === n ? '#1d4ed8' : '#94a3b8',
                    fontWeight: knowledgeScope === n ? 700 : 400,
                    cursor: 'pointer',
                    textAlign: 'center',
                    width: '20%'
                  }}
                  onClick={() => onSaveKnowledgeScope(n)}
                >
                  {SCOPE_LABELS[n].icon}
                </span>
              ))}
            </div>
            <div style={{
              marginTop: 4,
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              borderRadius: 5,
              padding: '4px 7px',
              fontSize: 10,
              color: '#1e40af',
              lineHeight: 1.4
            }}>
              <strong>{SCOPE_LABELS[knowledgeScope].icon} {SCOPE_LABELS[knowledgeScope].label}</strong> — {SCOPE_LABELS[knowledgeScope].description}
            </div>
          </div>

          {/* API key input */}
          <div style={{ color: '#64748b', fontSize: 10, marginBottom: 5 }}>
            {PROVIDER_CONFIG[provider].label} API Key — stored only on this device
          </div>
          <div style={{ display: 'flex', gap: 5 }}>
            <input
              type={showKey ? 'text' : 'password'}
              value={draftKey}
              onChange={e => setDraftKey(e.target.value)}
              placeholder={PROVIDER_CONFIG[provider].placeholder}
              style={s.keyInput}
              onKeyDown={e => e.key === 'Enter' && handleSaveKey()}
              onBlur={handleSaveKey}
            />
            <button onClick={() => setShowKey(v => !v)} style={smBtn('#1e293b')}>{showKey ? '🙈' : '👁'}</button>
            <button onClick={handleSaveKey} style={smBtn('#3b82f6')}>Save</button>
          </div>
          <div style={{ color: '#64748b', fontSize: 10, marginTop: 5 }}>
            Get a key:{' '}
            <a
              href={PROVIDER_CONFIG[provider].docsUrl}
              target="_blank"
              rel="noreferrer"
              style={{ color: '#0284c7', textDecoration: 'underline', cursor: 'pointer' }}
            >
              {PROVIDER_CONFIG[provider].docsLabel}
            </a>
          </div>
        </div>
      )}

      {/* ── Knowledge base ─────────────────────────────────────── */}
      {showKB && (
        <KnowledgeBaseManager items={kb.items} onAdd={kb.add} onUpdate={kb.update} onRemove={kb.remove} />
      )}

      {/* ── Persistent analysis buttons (always visible when video loaded) ── */}
      {!isEmpty && (hasData || hasVideo) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, paddingBottom: 6, borderBottom: '1px solid #bae6fd', marginBottom: 4 }}>
          {hasVideo && !videoEnded && (
            <div style={{ background: '#fef9c3', border: '1px solid #fde68a', borderRadius: 6, color: '#92400e', fontSize: 10, fontWeight: 600, padding: '5px 10px', textAlign: 'center' }}>
              Watch the full recording before analyzing
            </div>
          )}
          <div style={{ display: 'flex', gap: 5 }}>
            {hasData && (
              <button
                onClick={() => handleSend(DOMAIN_CONFIG[domain].coachTitle ? `Analyze the performance from this session and give me structured ${DOMAIN_CONFIG[domain].coachTitle.toLowerCase()} feedback` : 'Analyze this session')}
                disabled={state.isLoading || (hasVideo && !videoEnded)}
                style={{
                  flex: 1,
                  background: (state.isLoading || (hasVideo && !videoEnded)) ? '#e2e8f0' : 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                  border: 'none', borderRadius: 6,
                  color: (state.isLoading || (hasVideo && !videoEnded)) ? '#94a3b8' : '#fff',
                  cursor: (state.isLoading || (hasVideo && !videoEnded)) ? 'default' : 'pointer',
                  fontSize: 11, fontWeight: 700, padding: '7px 8px',
                  opacity: (state.isLoading || (hasVideo && !videoEnded)) ? 0.6 : 1
                }}
              >
                ✦ Analyze Session
              </button>
            )}
            {hasVideo && (
              <button
                onClick={handleVisualAnalysis}
                disabled={state.isLoading || isExtracting || !apiKey || !videoEnded}
                style={{
                  flex: 1,
                  background: (state.isLoading || isExtracting || !apiKey || !videoEnded) ? '#e2e8f0' : 'linear-gradient(135deg, #0f766e, #0369a1)',
                  border: 'none', borderRadius: 6,
                  color: (state.isLoading || isExtracting || !apiKey || !videoEnded) ? '#94a3b8' : '#fff',
                  cursor: (state.isLoading || isExtracting || !apiKey || !videoEnded) ? 'default' : 'pointer',
                  fontSize: 11, fontWeight: 700, padding: '7px 8px',
                  opacity: (state.isLoading || isExtracting || !apiKey || !videoEnded) ? 0.5 : 1
                }}
              >
                {isExtracting ? '⏳ Capturing…' : '🎥 Visual Analysis'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Chat area ──────────────────────────────────────────── */}
      <div style={s.chatArea}>
        {isEmpty && (apiKey || !showSettings) && (
          <EmptyState
            role={role}
            domain={domain}
            hasData={hasData}
            hasVideo={hasVideo}
            videoEnded={videoEnded}
            isExtracting={isExtracting}
            apiKey={apiKey}
            isLoading={state.isLoading}
            onQuickPrompt={handleSend}
            onVisualAnalysis={handleVisualAnalysis}
          />
        )}

        {state.messages.map((m, i) => (
          <ChatBubble key={i} message={m} role={role} />
        ))}

        {/* Streaming message in progress */}
        {state.streamingText && (
          <ChatBubble
            message={{ role: 'assistant', content: state.streamingText, displayName: 'AI Coach' }}
            role={role}
            streaming
          />
        )}

        {/* Loading spinner when no streaming text yet */}
        {state.isLoading && !state.streamingText && (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '6px 0' }}>
            <div style={s.thinkingDots}>
              <span /><span /><span />
            </div>
            <span style={{ color: '#64748b', fontSize: 11 }}>AI Coach is thinking…</span>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* ── Frame strip ────────────────────────────────────────── */}
      {frames.length > 0 && (
        <div style={{ borderTop: '1px solid #bae6fd', paddingTop: 6 }}>
          <div style={{ color: '#64748b', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 5 }}>
            Analyzed frames ({frames.length})
          </div>
          <div style={{ display: 'flex', gap: 4, overflowX: 'auto', paddingBottom: 2 }}>
            {frames.map((f, i) => (
              <div key={i} style={{ flexShrink: 0, position: 'relative' }}>
                <img
                  src={f.dataUrl}
                  alt={`Frame ${i + 1}`}
                  title={`Frame ${i + 1} — ${fmtTime(f.t)}`}
                  style={{ width: 56, height: 36, objectFit: 'cover', borderRadius: 3, display: 'block', border: '1px solid #bae6fd' }}
                />
                <div style={{
                  position: 'absolute', bottom: 0, left: 0, right: 0,
                  background: 'rgba(0,0,0,0.55)', color: '#fff',
                  fontSize: 8, textAlign: 'center', borderRadius: '0 0 3px 3px', padding: '1px 0'
                }}>
                  {fmtTime(f.t)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Error ──────────────────────────────────────────────── */}
      {state.error && (
        <div style={s.errorBox}>{state.error}</div>
      )}

      {/* ── Input area ─────────────────────────────────────────── */}
      <div style={s.inputArea}>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={apiKey ? 'Ask a question… (Enter to send, Shift+Enter for new line)' : 'Add your API key in ⚙ Settings to start'}
          disabled={!apiKey || state.isLoading}
          rows={2}
          style={{
            ...s.textarea,
            opacity: (!apiKey || state.isLoading) ? 0.5 : 1
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 5, marginTop: 5 }}>
          {state.isLoading ? (
            <button onClick={onStop} style={smBtn('#7f1d1d')}>■ Stop</button>
          ) : (
            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || !apiKey}
              style={{
                ...smBtn('#7c3aed'),
                opacity: (!input.trim() || !apiKey) ? 0.4 : 1,
                cursor: (!input.trim() || !apiKey) ? 'default' : 'pointer'
              }}
            >
              Send ↗
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

// ─── Empty state with quick prompts ──────────────────────────────────────────

function EmptyState({ role, domain, hasData, hasVideo, videoEnded, isExtracting, apiKey, isLoading, onQuickPrompt, onVisualAnalysis }: {
  role: UserRole
  domain: Domain
  hasData: boolean
  hasVideo: boolean
  videoEnded: boolean
  isExtracting: boolean
  apiKey: string
  isLoading: boolean
  onQuickPrompt: (text: string) => void
  onVisualAnalysis: () => void
}) {
  const cfg = DOMAIN_CONFIG[domain]
  const prompts = cfg.quickPrompts[role]
  const analyzePrompt = hasData
    ? `Analyze the performance from this session and give me structured ${cfg.coachTitle.toLowerCase()} feedback`
    : `Give me best practices and key coaching tips for ${cfg.label}`

  // If a video is loaded but hasn't finished, block analysis and explain why
  const awaitingEnd = hasVideo && !videoEnded

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 8 }}>
      <div style={{ textAlign: 'center', padding: '12px 0 6px' }}>
        <div style={{ fontSize: 24, marginBottom: 6 }}>{cfg.icon}</div>
        <div style={{ color: '#475569', fontSize: 12, fontWeight: 600 }}>
          {cfg.coachTitle} {role === 'professor' ? '— Instructor View' : '— Student View'}
        </div>
        <div style={{ color: '#64748b', fontSize: 11, marginTop: 4 }}>
          {role === 'professor'
            ? `Ask anything about this student's performance, or build the knowledge base with your ${cfg.label} materials.`
            : `Ask for feedback on your performance, tips for improvement, or how to excel in ${cfg.label}.`}
        </div>
      </div>

      {/* Primary actions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {awaitingEnd && (
          <div style={{
            background: '#fef9c3',
            border: '1px solid #fde68a',
            borderRadius: 7,
            color: '#92400e',
            fontSize: 11,
            fontWeight: 600,
            padding: '8px 12px',
            textAlign: 'center'
          }}>
            Watch the full recording before analyzing
          </div>
        )}
        <button
          onClick={() => onQuickPrompt(analyzePrompt)}
          disabled={awaitingEnd}
          style={{
            background: awaitingEnd ? '#e2e8f0' : 'linear-gradient(135deg, #7c3aed, #4f46e5)',
            border: 'none',
            borderRadius: 7,
            color: awaitingEnd ? '#94a3b8' : '#fff',
            cursor: awaitingEnd ? 'default' : 'pointer',
            fontSize: 12,
            fontWeight: 700,
            padding: '10px 14px',
            textAlign: 'center',
            opacity: awaitingEnd ? 0.6 : 1
          }}
        >
          {hasData ? '✦ Analyze This Session' : '✦ Get Coaching Tips'}
        </button>
        {hasVideo && (
          <button
            onClick={onVisualAnalysis}
            disabled={isLoading || isExtracting || !apiKey || awaitingEnd}
            style={{
              background: (isExtracting || awaitingEnd) ? '#e2e8f0' : 'linear-gradient(135deg, #0f766e, #0369a1)',
              border: 'none',
              borderRadius: 7,
              color: (isLoading || isExtracting || !apiKey || awaitingEnd) ? '#94a3b8' : '#fff',
              cursor: (isLoading || isExtracting || !apiKey || awaitingEnd) ? 'default' : 'pointer',
              fontSize: 12,
              fontWeight: 700,
              padding: '10px 14px',
              textAlign: 'center',
              opacity: (!apiKey || awaitingEnd) ? 0.5 : 1
            }}
          >
            {isExtracting ? '⏳ Capturing frames…' : '🎥 Analyze Gestures & Visual Presence'}
          </button>
        )}
      </div>

      {/* Quick prompt chips */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ color: '#64748b', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3 }}>
          Or ask something specific:
        </span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {prompts.map((p, i) => (
            <button
              key={i}
              onClick={() => onQuickPrompt(p)}
              style={{
                background: '#f0f9ff',
                border: '1px solid #bae6fd',
                borderRadius: 5,
                color: '#475569',
                cursor: 'pointer',
                fontSize: 11,
                padding: '5px 9px',
                textAlign: 'left',
                lineHeight: 1.3
              }}
            >
              {p}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Chat bubble ──────────────────────────────────────────────────────────────

function ChatBubble({ message: m, role, streaming }: {
  message: { role: 'user' | 'assistant'; content: string; displayName?: string }
  role: UserRole
  streaming?: boolean
}) {
  const isUser = m.role === 'user'
  const userColor = role === 'professor' ? '#7c3aed' : '#0369a1'

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: isUser ? 'flex-end' : 'flex-start',
      gap: 3,
      marginBottom: 8
    }}>
      <span style={{ color: '#64748b', fontSize: 10, paddingLeft: isUser ? 0 : 4, paddingRight: isUser ? 4 : 0 }}>
        {m.displayName ?? (isUser ? (role === 'professor' ? 'Professor' : 'Student') : 'AI Coach')}
      </span>
      <div style={{
        background: isUser ? userColor : '#ffffff',
        border: isUser ? 'none' : '1px solid #bae6fd',
        borderRadius: isUser ? '10px 10px 2px 10px' : '10px 10px 10px 2px',
        color: isUser ? '#fff' : '#1e293b',
        fontSize: 12,
        lineHeight: 1.6,
        maxWidth: '92%',
        padding: '8px 11px'
      }}>
        <FormattedText text={m.content} />
        {streaming && <span style={{ color: '#0284c7', animation: 'blink 1s step-end infinite' }}>▌</span>}
      </div>
    </div>
  )
}

// ─── Markdown-lite renderer ───────────────────────────────────────────────────

function FormattedText({ text }: { text: string }) {
  return (
    <>
      {text.split('\n').map((line, i) => {
        if (!line.trim()) return <div key={i} style={{ height: 5 }} />

        // **heading** on its own line
        if (/^\*\*[^*]+\*\*$/.test(line.trim())) {
          return <div key={i} style={{ color: '#0284c7', fontWeight: 700, marginTop: i > 0 ? 8 : 0, marginBottom: 1 }}>{line.replace(/\*\*/g, '')}</div>
        }

        // Inline bold
        const parts = line.split(/(\*\*[^*]+\*\*)/)
        const hasInlineBold = parts.length > 1

        const rendered = hasInlineBold
          ? parts.map((p, j) => /^\*\*.*\*\*$/.test(p)
              ? <strong key={j} style={{ color: '#0f172a' }}>{p.replace(/\*\*/g, '')}</strong>
              : p)
          : line

        if (line.startsWith('- ') || line.startsWith('• ')) {
          return <div key={i} style={{ paddingLeft: 10, marginTop: 2 }}>· {hasInlineBold ? rendered : line.slice(2)}</div>
        }

        return <div key={i}>{rendered}</div>
      })}
    </>
  )
}

// ─── Knowledge base manager ───────────────────────────────────────────────────

function KnowledgeBaseManager({
  items,
  onAdd,
  onUpdate,
  onRemove
}: {
  items: KnowledgeItem[]
  onAdd: (title: string, body: string, category: KnowledgeCategory) => void
  onUpdate: (id: string, patch: Partial<Pick<KnowledgeItem, 'title' | 'body' | 'category'>>) => void
  onRemove: (id: string) => void
}) {
  const [adding, setAdding] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newBody, setNewBody] = useState('')
  const [newCat, setNewCat] = useState<KnowledgeCategory>('guideline')
  const [editId, setEditId] = useState<string | null>(null)
  const [editField, setEditField] = useState<'title' | 'body' | null>(null)
  const [editVal, setEditVal] = useState('')
  const [filterCat, setFilterCat] = useState<KnowledgeCategory | 'all'>('all')

  function handleAdd() {
    if (!newTitle.trim() || !newBody.trim()) return
    onAdd(newTitle, newBody, newCat)
    setNewTitle(''); setNewBody(''); setAdding(false)
  }

  function startEdit(id: string, field: 'title' | 'body', val: string) {
    setEditId(id); setEditField(field); setEditVal(val)
  }

  function commitEdit() {
    if (editId && editField) onUpdate(editId, { [editField]: editVal })
    setEditId(null); setEditField(null)
  }

  const visible = filterCat === 'all' ? items : items.filter(it => it.category === filterCat)
  const cats = Object.keys(CATEGORY_LABELS) as KnowledgeCategory[]

  return (
    <div style={{ ...s.infoBox, gap: 8, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: '#0284c7', fontSize: 11, fontWeight: 700 }}>📚 Knowledge Base</span>
        <span style={{ color: '#64748b', fontSize: 10 }}>Used as context in every AI response</span>
      </div>

      {/* Category filter */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        <button onClick={() => setFilterCat('all')} style={catBtn(filterCat === 'all', '#94a3b8')}>
          All ({items.length})
        </button>
        {cats.map(c => {
          const n = items.filter(it => it.category === c).length
          return (
            <button key={c} onClick={() => setFilterCat(c)} style={catBtn(filterCat === c, CATEGORY_COLORS[c])}>
              {CATEGORY_LABELS[c]} ({n})
            </button>
          )
        })}
      </div>

      {/* Item list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflowY: 'auto' }}>
        {visible.map(it => (
          <div key={it.id} style={{
            background: '#f8fafc',
            border: `1px solid ${CATEGORY_COLORS[it.category]}44`,
            borderLeft: `3px solid ${CATEGORY_COLORS[it.category]}`,
            borderRadius: 6,
            padding: '7px 10px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
              <div style={{ flex: 1 }}>
                {/* Title */}
                {editId === it.id && editField === 'title' ? (
                  <input
                    autoFocus
                    value={editVal}
                    onChange={e => setEditVal(e.target.value)}
                    onBlur={commitEdit}
                    onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditId(null) }}
                    style={{ ...s.keyInput, marginBottom: 4, fontSize: 11, fontWeight: 700 }}
                  />
                ) : (
                  <div
                    onClick={() => startEdit(it.id, 'title', it.title)}
                    title="Click to edit"
                    style={{ color: '#1e293b', fontSize: 11, fontWeight: 700, cursor: 'text', marginBottom: 3 }}
                  >
                    {it.title}
                  </div>
                )}

                {/* Category badge */}
                <span style={{
                  background: CATEGORY_COLORS[it.category] + '22',
                  border: `1px solid ${CATEGORY_COLORS[it.category]}44`,
                  borderRadius: 3,
                  color: CATEGORY_COLORS[it.category],
                  fontSize: 9,
                  padding: '1px 5px',
                  marginBottom: 4,
                  display: 'inline-block'
                }}>
                  {CATEGORY_LABELS[it.category]}
                </span>

                {/* Body */}
                {editId === it.id && editField === 'body' ? (
                  <textarea
                    autoFocus
                    value={editVal}
                    onChange={e => setEditVal(e.target.value)}
                    onBlur={commitEdit}
                    onKeyDown={e => { if (e.key === 'Escape') setEditId(null) }}
                    rows={4}
                    style={{ ...s.keyInput, width: '100%', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit', fontSize: 11 }}
                  />
                ) : (
                  <div
                    onClick={() => startEdit(it.id, 'body', it.body)}
                    title="Click to edit"
                    style={{ color: '#475569', fontSize: 10, lineHeight: 1.5, cursor: 'text', whiteSpace: 'pre-wrap' }}
                  >
                    {it.body.length > 120 ? it.body.slice(0, 118) + '…' : it.body}
                  </div>
                )}
              </div>

              <button onClick={() => onRemove(it.id)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 14, flexShrink: 0, padding: '0 2px' }}>
                ×
              </button>
            </div>
          </div>
        ))}

        {visible.length === 0 && (
          <p style={{ color: '#64748b', fontSize: 11, textAlign: 'center', margin: '4px 0' }}>
            No items in this category.
          </p>
        )}
      </div>

      {/* Add new item */}
      {!adding ? (
        <button onClick={() => setAdding(true)} style={{ ...smBtn('#1e293b'), alignSelf: 'flex-start' }}>
          + Add knowledge item
        </button>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, background: '#f8fafc', borderRadius: 6, padding: 10, border: '1px solid #bae6fd' }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              placeholder="Title (e.g. Spring Competition Rules)"
              style={{ ...s.keyInput, flex: 1 }}
            />
            <select
              value={newCat}
              onChange={e => setNewCat(e.target.value as KnowledgeCategory)}
              style={{ ...s.keyInput, flex: 'none', width: 'auto' }}
            >
              {cats.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
            </select>
          </div>
          <textarea
            value={newBody}
            onChange={e => setNewBody(e.target.value)}
            placeholder="Paste your rubric, criteria, rules, or notes here…"
            rows={5}
            style={{ ...s.keyInput, resize: 'vertical', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' }}
          />
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={handleAdd} style={smBtn('#3b82f6')}>Save</button>
            <button onClick={() => setAdding(false)} style={smBtn('#1e293b')}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Style helpers ────────────────────────────────────────────────────────────

function hdrBtn(bg: string): React.CSSProperties {
  const isActive = bg === '#1e3a5f'
  const resolvedBg = bg === '#1e293b' ? '#f1f5f9' : (isActive ? '#dbeafe' : bg)
  return { background: resolvedBg, border: '1px solid #bae6fd', borderRadius: 5, color: isActive ? '#0284c7' : '#475569', cursor: 'pointer', fontSize: 13, padding: '3px 8px', lineHeight: 1 }
}

function smBtn(bg: string): React.CSSProperties {
  const darkNeutral = bg === '#1e293b' || bg === '#374151'
  return { background: darkNeutral ? '#f1f5f9' : bg, border: '1px solid #bae6fd', borderRadius: 5, color: darkNeutral ? '#334155' : '#f1f5f9', cursor: 'pointer', fontSize: 11, fontWeight: 600, padding: '4px 10px', whiteSpace: 'nowrap' }
}

function catBtn(active: boolean, color: string): React.CSSProperties {
  return { background: active ? color + '22' : 'transparent', border: `1px solid ${active ? color + '66' : '#bae6fd'}`, borderRadius: 4, color: active ? color : '#64748b', cursor: 'pointer', fontSize: 10, fontWeight: active ? 700 : 500, padding: '2px 7px', whiteSpace: 'nowrap' }
}

const s: Record<string, React.CSSProperties> = {
  panel: { display: 'flex', flexDirection: 'column', gap: 8, height: '100%' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  title: { color: '#64748b', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 },
  infoBox: { background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 7, padding: 10 },
  chatArea: { flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', minHeight: 80, paddingRight: 2 },
  errorBox: { background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 5, color: '#dc2626', fontSize: 11, padding: '6px 10px' },
  inputArea: { borderTop: '1px solid #bae6fd', paddingTop: 8 },
  textarea: { background: '#ffffff', border: '1px solid #bae6fd', borderRadius: 6, color: '#0f172a', fontSize: 12, outline: 'none', padding: '8px 10px', resize: 'none', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit' },
  keyInput: { background: '#ffffff', border: '1px solid #bae6fd', borderRadius: 5, color: '#0f172a', fontSize: 11, padding: '5px 8px', fontFamily: 'monospace', outline: 'none', width: '100%', boxSizing: 'border-box' },
  thinkingDots: { display: 'flex', gap: 3 },
}
