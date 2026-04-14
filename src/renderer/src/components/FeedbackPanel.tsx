import React, { useState, useRef } from 'react'
import type { FeedbackComment } from '../types'
import { useCommentTemplates } from '../hooks/useCommentTemplates'
import type { CommentTemplate } from '../hooks/useCommentTemplates'
import type { Domain } from '../hooks/useDomain'
import { DOMAIN_CONFIG } from '../hooks/useDomain'

interface Props {
  comments: FeedbackComment[]
  currentTime: number
  domain: Domain
  onAdd: (text: string, author: string, tag: FeedbackComment['tag'], voiceNote?: string) => void
  onDelete: (id: string) => void
  onSeek?: (t: number) => void
}

const TAG_COLORS: Record<FeedbackComment['tag'], string> = {
  pacing:       '#818cf8',
  clarity:      '#34d399',
  volume:       '#fbbf24',
  posture:      '#f472b6',
  eye_contact:  '#60a5fa',
  argument:     '#f87171',
  general:      '#94a3b8'
}

const TAGS: FeedbackComment['tag'][] = [
  'pacing', 'clarity', 'volume', 'posture', 'eye_contact', 'argument', 'general'
]

function formatTime(sec: number) {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

// ─── Voice note recorder ──────────────────────────────────────────────────────

type RecState = 'idle' | 'recording' | 'done'

const MAX_VOICE_NOTE_SEC = 120

function useVoiceRecorder() {
  const [recState, setRecState] = useState<RecState>('idle')
  const [elapsed, setElapsed] = useState(0)
  const [micError, setMicError] = useState<string | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  async function startRecording() {
    setMicError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus' : 'audio/webm'
      const recorder = new MediaRecorder(stream, { mimeType })
      chunksRef.current = []
      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      recorder.start(200)
      recorderRef.current = recorder
      setElapsed(0)
      setRecState('recording')
      timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000)
      // Auto-stop after MAX_VOICE_NOTE_SEC to prevent open mic leaks
      autoStopRef.current = setTimeout(() => stopRecording(), MAX_VOICE_NOTE_SEC * 1000)
    } catch {
      setMicError('Microphone access denied. Check System Settings → Privacy → Microphone.')
    }
  }

  async function stopRecording(): Promise<string | null> {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    if (autoStopRef.current) { clearTimeout(autoStopRef.current); autoStopRef.current = null }
    const recorder = recorderRef.current
    if (!recorder || recorder.state === 'inactive') return null
    const url = await new Promise<string>(resolve => {
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.readAsDataURL(blob)
      }
      recorder.stop()
    })
    recorder.stream.getTracks().forEach(t => t.stop())
    recorderRef.current = null
    setRecState('done')
    return url
  }

  function clear() { setElapsed(0); setRecState('idle') }

  return { recState, elapsed, micError, startRecording, stopRecording, clear }
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export function FeedbackPanel({ comments, currentTime, domain, onAdd, onDelete, onSeek }: Props) {
  const [text, setText] = useState('')
  const [author, setAuthor] = useState('Professor')
  const [tag, setTag] = useState<FeedbackComment['tag']>('general')
  const [pendingVoiceNote, setPendingVoiceNote] = useState<string | null>(null)
  const [showLibrary, setShowLibrary] = useState(false)

  const rec = useVoiceRecorder()
  const tmpl = useCommentTemplates(domain)
  const tagLabels = DOMAIN_CONFIG[domain].tagLabels

  // Quick-chips view: 'tag' shows current tag's templates; 'all' shows everything
  const [chipView, setChipView] = useState<'tag' | 'all'>('tag')

  const visibleChips = chipView === 'tag' ? tmpl.byTag(tag) : tmpl.templates

  async function handleStopRecording() {
    const url = await rec.stopRecording()
    if (url) setPendingVoiceNote(url)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const hasText = text.trim().length > 0
    if (!hasText && !pendingVoiceNote) return
    onAdd(hasText ? text.trim() : '🎙 Voice note', author, tag, pendingVoiceNote ?? undefined)
    setText('')
    setPendingVoiceNote(null)
    rec.clear()
  }

  function handleSaveTemplate() {
    if (!text.trim()) return
    tmpl.addTemplate(text.trim(), tag)
  }

  const mm = String(Math.floor(rec.elapsed / 60)).padStart(2, '0')
  const ss = String(rec.elapsed % 60).padStart(2, '0')
  const canSubmit = text.trim().length > 0 || !!pendingVoiceNote

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '100%' }}>

      {/* ── Form ────────────────────────────────────────────────── */}
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

        {/* Author + tag row */}
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            value={author}
            onChange={e => setAuthor(e.target.value)}
            placeholder="Your name"
            style={inputStyle}
          />
          <select
            value={tag}
            onChange={e => { setTag(e.target.value as FeedbackComment['tag']); setChipView('tag') }}
            style={{ ...inputStyle, flex: 'none', width: 'auto' }}
          >
            {TAGS.map(t => (
              <option key={t} value={t}>{tagLabels[t]}</option>
            ))}
          </select>
        </div>

        {/* Quick-comment chips */}
        <QuickChips
          chips={visibleChips}
          chipView={chipView}
          currentTag={tag}
          onSelect={t => setText(t.text)}
          onToggleView={() => setChipView(v => v === 'tag' ? 'all' : 'tag')}
        />

        {/* Textarea + save-as-template button */}
        <div style={{ position: 'relative' }}>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder={`Feedback at ${formatTime(currentTime)}…`}
            rows={3}
            style={{ ...inputStyle, resize: 'none', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box', paddingRight: 36 }}
          />
          {text.trim() && (
            <button
              type="button"
              onClick={handleSaveTemplate}
              title="Save as quick comment"
              style={{
                position: 'absolute',
                top: 6,
                right: 6,
                background: '#f0f9ff',
                border: '1px solid #bae6fd',
                borderRadius: 4,
                color: '#64748b',
                cursor: 'pointer',
                fontSize: 13,
                lineHeight: 1,
                padding: '3px 5px'
              }}
            >
              ＋
            </button>
          )}
        </div>

        {/* Voice note recorder */}
        <div style={{
          background: '#f0f9ff',
          border: '1px solid #bae6fd',
          borderRadius: 6,
          padding: '7px 10px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexWrap: 'wrap'
        }}>
          {rec.recState === 'idle' && !pendingVoiceNote && (
            <>
              <button type="button" onClick={rec.startRecording} style={smBtn('#374151')}>
                🎙 Voice note
              </button>
              {rec.micError && (
                <span style={{ color: '#dc2626', fontSize: 10, flex: 1 }}>{rec.micError}</span>
              )}
            </>
          )}
          {rec.recState === 'recording' && (
            <>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#f87171', animation: 'pulse 1s infinite', flexShrink: 0, display: 'inline-block' }} />
              <span style={{ color: '#334155', fontSize: 12, fontFamily: 'monospace', minWidth: 34 }}>{mm}:{ss}</span>
              <button type="button" onClick={handleStopRecording} style={smBtn('#7f1d1d')}>■ Stop</button>
            </>
          )}
          {pendingVoiceNote && (
            <>
              <span style={{ color: '#34d399', fontSize: 11 }}>🎙 Ready</span>
              <audio src={pendingVoiceNote} controls style={{ height: 26, flex: 1, minWidth: 80 }} />
              <button type="button" onClick={() => { setPendingVoiceNote(null); rec.clear() }} style={{ ...smBtn('#374151'), padding: '2px 7px' }}>×</button>
            </>
          )}
        </div>

        <button
          type="submit"
          disabled={!canSubmit}
          style={{
            background: canSubmit ? '#3b82f6' : '#e2e8f0',
            border: 'none', borderRadius: 6, color: canSubmit ? '#fff' : '#94a3b8',
            cursor: canSubmit ? 'pointer' : 'default',
            fontSize: 13, fontWeight: 600, padding: '8px 0',
            opacity: canSubmit ? 1 : 0.7
          }}
        >
          Add Feedback at {formatTime(currentTime)}
        </button>
      </form>

      {/* ── Library toggle ───────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => setShowLibrary(v => !v)}
        style={{
          background: 'transparent',
          border: '1px solid #bae6fd',
          borderRadius: 6,
          color: '#64748b',
          cursor: 'pointer',
          fontSize: 11,
          fontWeight: 600,
          padding: '5px 10px',
          textAlign: 'left',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <span>Quick Comments Library ({tmpl.templates.length})</span>
        <span style={{ fontSize: 10 }}>{showLibrary ? '▲' : '▼'}</span>
      </button>

      {showLibrary && (
        <TemplateLibrary
          templates={tmpl.templates}
          onDelete={tmpl.deleteTemplate}
          onEdit={tmpl.updateTemplate}
          onInsert={t => { setText(t.text); setTag(t.tag); setShowLibrary(false) }}
        />
      )}

      {/* ── Comment list ─────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {comments.length === 0 && (
          <p style={{ color: '#64748b', fontSize: 13, textAlign: 'center', margin: '16px 0' }}>
            No feedback yet. Play the video and add comments at specific timestamps.
          </p>
        )}
        {comments.map(c => (
          <CommentCard key={c.id} comment={c} domain={domain} onDelete={onDelete} onSeek={onSeek} />
        ))}
      </div>
    </div>
  )
}

// ─── Quick chips row ──────────────────────────────────────────────────────────

function QuickChips({
  chips,
  chipView,
  currentTag,
  onSelect,
  onToggleView
}: {
  chips: CommentTemplate[]
  chipView: 'tag' | 'all'
  currentTag: FeedbackComment['tag']
  onSelect: (t: CommentTemplate) => void
  onToggleView: () => void
}) {
  if (chips.length === 0 && chipView === 'tag') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ color: '#64748b', fontSize: 11 }}>No quick comments for this category yet —</span>
        <button type="button" onClick={onToggleView} style={{ ...smBtn('transparent'), color: '#64748b', border: 'none', padding: '2px 0' }}>
          show all
        </button>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: '#475569', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3 }}>
          Quick comments {chipView === 'all' ? '— all categories' : `— ${currentTag.replace('_', ' ')}`}
        </span>
        <button type="button" onClick={onToggleView} style={{ ...smBtn('transparent'), color: '#64748b', border: 'none', fontSize: 10, padding: '1px 0' }}>
          {chipView === 'tag' ? 'show all' : 'show current'}
        </button>
      </div>
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 5,
        maxHeight: 110,
        overflowY: 'auto',
        paddingRight: 2
      }}>
        {chips.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => onSelect(t)}
            title={t.text}
            style={{
              background: TAG_COLORS[t.tag] + '18',
              border: `1px solid ${TAG_COLORS[t.tag]}44`,
              borderRadius: 4,
              color: TAG_COLORS[t.tag],
              cursor: 'pointer',
              fontSize: 11,
              lineHeight: 1.3,
              padding: '4px 8px',
              textAlign: 'left',
              maxWidth: 200,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
          >
            {t.text.length > 38 ? t.text.slice(0, 36) + '…' : t.text}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Template library panel ───────────────────────────────────────────────────

function TemplateLibrary({
  templates,
  onDelete,
  onEdit,
  onInsert
}: {
  templates: CommentTemplate[]
  onDelete: (id: string) => void
  onEdit: (id: string, text: string) => void
  onInsert: (t: CommentTemplate) => void
}) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [filterTag, setFilterTag] = useState<FeedbackComment['tag'] | 'all'>('all')

  const visible = filterTag === 'all' ? templates : templates.filter(t => t.tag === filterTag)

  // Group by tag
  const grouped: Partial<Record<FeedbackComment['tag'], CommentTemplate[]>> = {}
  for (const t of visible) {
    if (!grouped[t.tag]) grouped[t.tag] = []
    grouped[t.tag]!.push(t)
  }

  function startEdit(t: CommentTemplate) {
    setEditingId(t.id)
    setEditText(t.text)
  }

  function commitEdit(id: string) {
    if (editText.trim()) onEdit(id, editText.trim())
    setEditingId(null)
  }

  return (
    <div style={{
      background: '#f0f9ff',
      border: '1px solid #bae6fd',
      borderRadius: 8,
      padding: '10px 12px',
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      maxHeight: 340,
      overflowY: 'auto'
    }}>
      {/* Category filter */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => setFilterTag('all')}
          style={filterBtn(filterTag === 'all', '#94a3b8')}
        >
          All ({templates.length})
        </button>
        {TAGS.map(tag => {
          const count = templates.filter(t => t.tag === tag).length
          if (count === 0) return null
          return (
            <button
              key={tag}
              type="button"
              onClick={() => setFilterTag(tag)}
              style={filterBtn(filterTag === tag, TAG_COLORS[tag])}
            >
              {tag.replace('_', ' ')} ({count})
            </button>
          )
        })}
      </div>

      {/* Template rows grouped by tag */}
      {(Object.keys(grouped) as FeedbackComment['tag'][]).map(groupTag => (
        <div key={groupTag}>
          <div style={{
            color: TAG_COLORS[groupTag],
            fontSize: 10,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            marginBottom: 4,
            paddingBottom: 3,
            borderBottom: `1px solid ${TAG_COLORS[groupTag]}22`
          }}>
            {groupTag.replace('_', ' ')}
          </div>
          {grouped[groupTag]!.map(t => (
            <div key={t.id} style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 6,
              padding: '5px 0',
              borderBottom: '1px solid #bae6fd'
            }}>
              {editingId === t.id ? (
                <textarea
                  autoFocus
                  value={editText}
                  onChange={e => setEditText(e.target.value)}
                  onBlur={() => commitEdit(t.id)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitEdit(t.id) } if (e.key === 'Escape') setEditingId(null) }}
                  rows={2}
                  style={{ ...inputStyle, flex: 1, fontSize: 11, padding: '4px 7px', resize: 'none' }}
                />
              ) : (
                <span style={{ flex: 1, color: '#334155', fontSize: 11, lineHeight: 1.5 }}>
                  {t.text}
                </span>
              )}
              <div style={{ display: 'flex', gap: 3, flexShrink: 0, paddingTop: 2 }}>
                <button
                  type="button"
                  onClick={() => onInsert(t)}
                  title="Use this comment"
                  style={iconBtn('#dbeafe', '#0284c7')}
                >
                  ↗
                </button>
                <button
                  type="button"
                  onClick={() => startEdit(t)}
                  title="Edit"
                  style={iconBtn('#f1f5f9', '#64748b')}
                >
                  ✎
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(t.id)}
                  title="Delete"
                  style={iconBtn('#f1f5f9', '#94a3b8')}
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      ))}

      {visible.length === 0 && (
        <p style={{ color: '#64748b', fontSize: 12, textAlign: 'center', margin: '8px 0' }}>
          No templates in this category.
        </p>
      )}
    </div>
  )
}

// ─── Comment card ─────────────────────────────────────────────────────────────

function CommentCard({
  comment: c,
  domain,
  onDelete,
  onSeek
}: {
  comment: FeedbackComment
  domain: Domain
  onDelete: (id: string) => void
  onSeek?: (t: number) => void
}) {
  return (
    <div style={{ background: '#ffffff', borderRadius: 8, padding: '10px 12px', borderLeft: `3px solid ${TAG_COLORS[c.tag]}`, border: `1px solid #bae6fd`, borderLeft: `3px solid ${TAG_COLORS[c.tag]}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => onSeek?.(c.timestamp)}
            style={{
              background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 4,
              color: '#0284c7', cursor: 'pointer', fontSize: 11, fontFamily: 'monospace', padding: '1px 6px'
            }}
          >
            {formatTime(c.timestamp)}
          </button>
          <span style={{
            background: TAG_COLORS[c.tag] + '22',
            border: `1px solid ${TAG_COLORS[c.tag]}44`,
            borderRadius: 4, color: TAG_COLORS[c.tag], fontSize: 10, padding: '1px 5px'
          }}>
            {DOMAIN_CONFIG[domain].tagLabels[c.tag]}
          </span>
          <span style={{ color: '#64748b', fontSize: 11 }}>{c.author}</span>
        </div>
        <button
          onClick={() => onDelete(c.id)}
          style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 0, flexShrink: 0 }}
        >
          ×
        </button>
      </div>
      {c.text && c.text !== '🎙 Voice note' && (
        <p style={{ color: '#1e293b', fontSize: 13, margin: 0, lineHeight: 1.5 }}>{c.text}</p>
      )}
      {c.voiceNote && (
        <div style={{ marginTop: c.text && c.text !== '🎙 Voice note' ? 8 : 0, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ color: '#64748b', fontSize: 10 }}>🎙</span>
          <audio src={c.voiceNote} controls style={{ height: 28, flex: 1 }} />
        </div>
      )}
    </div>
  )
}

// ─── Style helpers ────────────────────────────────────────────────────────────

function smBtn(bg: string): React.CSSProperties {
  const darkNeutral = bg === '#374151' || bg === '#1e293b'
  return {
    background: darkNeutral ? '#f1f5f9' : bg,
    border: '1px solid #bae6fd',
    borderRadius: 5,
    color: (darkNeutral || bg === 'transparent') ? '#475569' : '#f1f5f9',
    cursor: 'pointer',
    fontSize: 11,
    fontWeight: 600,
    padding: '4px 10px',
    whiteSpace: 'nowrap'
  }
}

function filterBtn(active: boolean, color: string): React.CSSProperties {
  return {
    background: active ? color + '22' : 'transparent',
    border: `1px solid ${active ? color + '66' : '#bae6fd'}`,
    borderRadius: 4,
    color: active ? color : '#64748b',
    cursor: 'pointer',
    fontSize: 10,
    fontWeight: active ? 700 : 500,
    padding: '3px 8px',
    whiteSpace: 'nowrap'
  }
}

function iconBtn(bg: string, color: string): React.CSSProperties {
  return {
    background: bg,
    border: 'none',
    borderRadius: 4,
    color,
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 700,
    lineHeight: 1,
    padding: '3px 6px'
  }
}

const inputStyle: React.CSSProperties = {
  background: '#ffffff',
  border: '1px solid #bae6fd',
  borderRadius: 6,
  color: '#0f172a',
  flex: 1,
  fontSize: 13,
  outline: 'none',
  padding: '7px 10px'
}
