import React, { useState } from 'react'
import type { QuizQuestion, QuizAttempt } from '../types/assignment'

interface Props {
  question: QuizQuestion
  attempt: QuizAttempt | null
  apiKey: string
  provider: string
  context: 'slide' | 'video'
  onAnswer: (questionId: string, answer: string | number | null) => void
  onAIGrade: (questionId: string, score: number, feedback: string) => void
  onDismiss: () => void   // called after answer submitted
}

export function QuizOverlay({ question, attempt, apiKey, provider, context, onAnswer, onAIGrade, onDismiss }: Props) {
  const [shortAnswerDraft, setShortAnswerDraft] = useState('')
  const [isGrading, setIsGrading] = useState(false)
  const answered = attempt?.answer != null

  const handleMCQ = (idx: number) => onAnswer(question.id, idx)
  const handleTF = (val: 'true' | 'false') => onAnswer(question.id, val)

  const handleShortAnswerSubmit = async () => {
    if (!shortAnswerDraft.trim()) return
    onAnswer(question.id, shortAnswerDraft.trim())
    if (apiKey && question.correctAnswer) {
      setIsGrading(true)
      try { await gradeShortAnswer(question, shortAnswerDraft.trim(), apiKey, provider, onAIGrade) }
      finally { setIsGrading(false) }
    }
    setShortAnswerDraft('')
  }

  const contextLabel = context === 'slide' ? `Slide ${(question.triggerSlide ?? 0) + 1} check-in` : `${fmtTime(question.triggerTimestamp ?? 0)} check-in`

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 50,
      background: 'rgba(15,23,42,0.72)', backdropFilter: 'blur(3px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
    }}>
      <div style={{
        background: '#fff', borderRadius: 12, boxShadow: '0 16px 48px rgba(0,0,0,0.35)',
        width: '100%', maxWidth: 440, display: 'flex', flexDirection: 'column', gap: 0, overflow: 'hidden'
      }}>
        {/* Header strip */}
        <div style={{ background: '#7c3aed', padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ color: '#e9d5ff', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            {contextLabel}
          </span>
          <span style={{ color: '#ddd6fe', fontSize: 11 }}>
            {question.points} pt{question.points !== 1 ? 's' : ''}
          </span>
        </div>

        <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Prompt */}
          <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a', lineHeight: 1.5 }}>
            {question.prompt}
          </div>

          {/* Answer area */}
          {question.type === 'mcq' && question.options && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {question.options.map((opt, i) => {
                const selected = attempt?.answer === i
                return (
                  <button key={i} onClick={() => !answered && handleMCQ(i)} style={{
                    textAlign: 'left', padding: '8px 12px', borderRadius: 6, fontSize: 13, cursor: answered ? 'default' : 'pointer',
                    background: selected ? '#eff6ff' : '#f8fafc',
                    border: `1.5px solid ${selected ? '#3b82f6' : '#e2e8f0'}`,
                    color: selected ? '#1d4ed8' : '#334155', fontWeight: selected ? 600 : 400
                  }}>
                    <span style={{ fontWeight: 700, marginRight: 8, color: selected ? '#3b82f6' : '#94a3b8' }}>
                      {String.fromCharCode(65 + i)}.
                    </span>{opt}
                  </button>
                )
              })}
            </div>
          )}

          {question.type === 'true_false' && (
            <div style={{ display: 'flex', gap: 8 }}>
              {(['true', 'false'] as const).map(val => {
                const selected = attempt?.answer === val
                return (
                  <button key={val} onClick={() => !answered && handleTF(val)} style={{
                    flex: 1, padding: '9px 0', borderRadius: 6, fontSize: 13,
                    cursor: answered ? 'default' : 'pointer', fontWeight: 600,
                    background: selected ? (val === 'true' ? '#f0fdf4' : '#fef2f2') : '#f8fafc',
                    border: `1.5px solid ${selected ? (val === 'true' ? '#22c55e' : '#ef4444') : '#e2e8f0'}`,
                    color: selected ? (val === 'true' ? '#16a34a' : '#dc2626') : '#334155'
                  }}>
                    {val === 'true' ? 'True' : 'False'}
                  </button>
                )
              })}
            </div>
          )}

          {question.type === 'short_answer' && (
            answered ? (
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, padding: '8px 12px', fontSize: 13, color: '#166534' }}>
                <span style={{ fontWeight: 600 }}>Your answer: </span>{attempt?.answer as string}
                {isGrading && <span style={{ color: '#0284c7', marginLeft: 8, fontSize: 11 }}>Grading…</span>}
                {attempt?.aiFeedback && (
                  <div style={{ marginTop: 5, fontSize: 12, color: '#0f766e', borderTop: '1px solid #d1fae5', paddingTop: 5 }}>
                    {attempt.aiFeedback}
                    {attempt.aiScore != null && <span style={{ fontWeight: 700, color: '#059669', marginLeft: 5 }}>({attempt.aiScore}/{question.points} pts)</span>}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <textarea
                  value={shortAnswerDraft}
                  onChange={e => setShortAnswerDraft(e.target.value)}
                  placeholder="Type your answer…"
                  rows={3}
                  style={{ resize: 'vertical', borderRadius: 6, border: '1px solid #e2e8f0', padding: '7px 10px', fontSize: 13, fontFamily: 'inherit', width: '100%', boxSizing: 'border-box', outline: 'none' }}
                />
                <button
                  onClick={handleShortAnswerSubmit}
                  disabled={!shortAnswerDraft.trim()}
                  style={{ background: shortAnswerDraft.trim() ? '#7c3aed' : '#cbd5e1', color: '#fff', border: 'none', borderRadius: 6, padding: '7px 0', fontSize: 13, fontWeight: 600, cursor: shortAnswerDraft.trim() ? 'pointer' : 'default', width: '100%' }}
                >
                  Submit Answer
                </button>
              </div>
            )
          )}

          {/* Continue button — appears once answered (or immediately for MCQ/TF) */}
          {answered && (
            <button
              onClick={onDismiss}
              disabled={isGrading}
              style={{ background: '#059669', color: '#fff', border: 'none', borderRadius: 7, padding: '9px 0', fontSize: 13, fontWeight: 700, cursor: isGrading ? 'default' : 'pointer', width: '100%' }}
            >
              {isGrading ? 'Grading…' : context === 'slide' ? 'Continue to next slide →' : 'Resume video →'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function fmtTime(sec: number) {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

async function gradeShortAnswer(
  question: QuizQuestion, studentAnswer: string, apiKey: string, provider: string,
  onResult: (questionId: string, score: number, feedback: string) => void
) {
  const prompt = `Grade this short-answer quiz response.

Question: ${question.prompt}
Model answer: ${question.correctAnswer}
Student answer: ${studentAnswer}
Max points: ${question.points}

Respond with JSON only: {"score": <number 0 to ${question.points}>, "feedback": "<one sentence>"}`

  try {
    if (provider === 'anthropic') {
      const { Anthropic } = await import('@anthropic-ai/sdk')
      const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true })
      const msg = await client.messages.create({ model: 'claude-haiku-4-5-20251001', max_tokens: 128, messages: [{ role: 'user', content: prompt }] })
      const text = msg.content[0].type === 'text' ? msg.content[0].text : ''
      const parsed = JSON.parse(text.match(/\{.*\}/s)?.[0] ?? '{}')
      onResult(question.id, Math.min(question.points, Math.max(0, Number(parsed.score ?? 0))), parsed.feedback ?? '')
    } else if (provider === 'openai') {
      const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model: 'gpt-4o-mini', max_tokens: 128, messages: [{ role: 'user', content: prompt }] })
      })
      const data = await resp.json()
      const text = data.choices?.[0]?.message?.content ?? ''
      const parsed = JSON.parse(text.match(/\{.*\}/s)?.[0] ?? '{}')
      onResult(question.id, Math.min(question.points, Math.max(0, Number(parsed.score ?? 0))), parsed.feedback ?? '')
    }
  } catch { /* grading failed silently */ }
}
