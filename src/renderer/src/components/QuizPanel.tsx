import React, { useState } from 'react'
import type { QuizQuestion, QuizAttempt, QuizResults } from '../types/assignment'

interface Props {
  questions: QuizQuestion[]
  currentIndex: number
  currentQuestion: QuizQuestion | null
  currentAttempt: QuizAttempt | null
  completed: boolean
  results: QuizResults | null
  apiKey: string
  provider: string
  onAnswer: (questionId: string, answer: string | number | null) => void
  onNext: () => void
  onPrev: () => void
  onReset: () => void
  onAIGrade: (questionId: string, aiScore: number, aiFeedback: string) => void
}

export function QuizPanel({
  questions, currentIndex, currentQuestion, currentAttempt,
  completed, results, apiKey, provider,
  onAnswer, onNext, onPrev, onReset, onAIGrade
}: Props) {
  const [shortAnswerDraft, setShortAnswerDraft] = useState('')
  const [isGrading, setIsGrading] = useState(false)

  const handleMCQ = (idx: number) => {
    if (!currentQuestion) return
    onAnswer(currentQuestion.id, idx)
  }

  const handleTF = (val: 'true' | 'false') => {
    if (!currentQuestion) return
    onAnswer(currentQuestion.id, val)
  }

  const handleShortAnswerSubmit = async () => {
    if (!currentQuestion || !shortAnswerDraft.trim()) return
    onAnswer(currentQuestion.id, shortAnswerDraft.trim())

    if (apiKey && currentQuestion.correctAnswer) {
      setIsGrading(true)
      try {
        await gradeShortAnswer(
          currentQuestion, shortAnswerDraft.trim(), apiKey, provider,
          (score, feedback) => onAIGrade(currentQuestion.id, score, feedback)
        )
      } finally {
        setIsGrading(false)
      }
    }
    setShortAnswerDraft('')
    onNext()
  }

  if (questions.length === 0) {
    return (
      <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
        No quiz questions in this assignment.
      </div>
    )
  }

  if (completed && results) {
    return <QuizResults results={results} questions={questions} onReset={onReset} />
  }

  if (!currentQuestion) return null

  const progressPct = ((currentIndex) / questions.length) * 100

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Progress bar */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 11, color: 'var(--text-muted)' }}>
          <span>Question {currentIndex + 1} of {questions.length}</span>
          <span>{currentQuestion.points} pt{currentQuestion.points !== 1 ? 's' : ''}</span>
        </div>
        <div style={{ height: 4, background: '#e2e8f0', borderRadius: 2 }}>
          <div style={{ height: '100%', width: `${progressPct}%`, background: '#0284c7', borderRadius: 2, transition: 'width 0.3s' }} />
        </div>
      </div>

      {/* Question prompt */}
      <div style={{
        background: '#f8fafc', border: '1px solid var(--border)',
        borderRadius: 8, padding: '12px 14px',
        fontSize: 14, lineHeight: 1.55, color: 'var(--text-dark)', fontWeight: 500
      }}>
        {currentQuestion.prompt}
      </div>

      {/* Answer area */}
      {currentQuestion.type === 'mcq' && currentQuestion.options && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {currentQuestion.options.map((opt, i) => {
            const selected = currentAttempt?.answer === i
            return (
              <button
                key={i}
                onClick={() => handleMCQ(i)}
                style={{
                  textAlign: 'left', padding: '9px 13px', borderRadius: 7, fontSize: 13, cursor: 'pointer',
                  background: selected ? '#eff6ff' : '#fff',
                  border: `1.5px solid ${selected ? '#3b82f6' : '#e2e8f0'}`,
                  color: selected ? '#1d4ed8' : 'var(--text-dark)',
                  fontWeight: selected ? 600 : 400, transition: 'all 0.12s'
                }}
              >
                <span style={{ fontWeight: 600, marginRight: 8, color: selected ? '#3b82f6' : '#94a3b8' }}>
                  {String.fromCharCode(65 + i)}.
                </span>
                {opt}
              </button>
            )
          })}
        </div>
      )}

      {currentQuestion.type === 'true_false' && (
        <div style={{ display: 'flex', gap: 8 }}>
          {(['true', 'false'] as const).map(val => {
            const selected = currentAttempt?.answer === val
            return (
              <button
                key={val}
                onClick={() => handleTF(val)}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 7, fontSize: 13, cursor: 'pointer', fontWeight: 600,
                  background: selected ? (val === 'true' ? '#f0fdf4' : '#fef2f2') : '#fff',
                  border: `1.5px solid ${selected ? (val === 'true' ? '#22c55e' : '#ef4444') : '#e2e8f0'}`,
                  color: selected ? (val === 'true' ? '#16a34a' : '#dc2626') : 'var(--text-dark)'
                }}
              >
                {val === 'true' ? 'True' : 'False'}
              </button>
            )
          })}
        </div>
      )}

      {currentQuestion.type === 'short_answer' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {currentAttempt?.answer ? (
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, padding: '9px 12px', fontSize: 13, color: '#166534' }}>
              <span style={{ fontWeight: 600 }}>Your answer: </span>{currentAttempt.answer as string}
              {isGrading && <span style={{ color: '#0284c7', marginLeft: 8, fontSize: 11 }}>AI grading…</span>}
              {currentAttempt.aiFeedback && (
                <div style={{ marginTop: 6, fontSize: 12, color: '#0f766e', borderTop: '1px solid #d1fae5', paddingTop: 6 }}>
                  {currentAttempt.aiFeedback}
                  {currentAttempt.aiScore != null && (
                    <span style={{ fontWeight: 700, color: '#059669', marginLeft: 6 }}>
                      ({currentAttempt.aiScore}/{currentQuestion.points} pts)
                    </span>
                  )}
                </div>
              )}
            </div>
          ) : (
            <>
              <textarea
                value={shortAnswerDraft}
                onChange={e => setShortAnswerDraft(e.target.value)}
                placeholder="Type your answer here…"
                rows={4}
                style={{
                  resize: 'vertical', borderRadius: 6, border: '1px solid var(--border)',
                  padding: '8px 10px', fontSize: 13, fontFamily: 'inherit', width: '100%',
                  boxSizing: 'border-box', outline: 'none'
                }}
              />
              <button
                onClick={handleShortAnswerSubmit}
                disabled={!shortAnswerDraft.trim() || isGrading}
                style={{
                  background: shortAnswerDraft.trim() ? '#0284c7' : '#cbd5e1', color: '#fff',
                  border: 'none', borderRadius: 6, padding: '8px 0', fontSize: 13, fontWeight: 600,
                  cursor: shortAnswerDraft.trim() ? 'pointer' : 'default', width: '100%'
                }}
              >
                {isGrading ? 'Grading…' : 'Submit Answer'}
              </button>
            </>
          )}
        </div>
      )}

      {/* Navigation */}
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <button
          onClick={onPrev}
          disabled={currentIndex === 0}
          style={{ ...navBtn, flex: 1, background: '#64748b', opacity: currentIndex === 0 ? 0.3 : 1, cursor: currentIndex === 0 ? 'default' : 'pointer' }}
        >
          ← Back
        </button>
        <button
          onClick={() => {
            if (currentQuestion.type === 'short_answer' && !currentAttempt?.answer) return
            onNext()
          }}
          disabled={currentQuestion.type === 'short_answer' && !currentAttempt?.answer}
          style={{
            ...navBtn, flex: 2,
            background: currentAttempt?.answer != null ? '#059669' : '#0284c7',
            opacity: (currentQuestion.type === 'short_answer' && !currentAttempt?.answer) ? 0.3 : 1,
            cursor: (currentQuestion.type === 'short_answer' && !currentAttempt?.answer) ? 'default' : 'pointer'
          }}
        >
          {currentIndex === questions.length - 1 ? 'Finish Quiz' : 'Next →'}
        </button>
      </div>
    </div>
  )
}

function QuizResults({ results, questions, onReset }: {
  results: QuizResults
  questions: QuizQuestion[]
  onReset: () => void
}) {
  const pct = results.maxScore > 0 ? Math.round((results.totalScore / results.maxScore) * 100) : 0
  const color = pct >= 70 ? '#059669' : pct >= 50 ? '#d97706' : '#dc2626'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Score summary */}
      <div style={{ background: '#f8fafc', border: `1.5px solid ${color}`, borderRadius: 8, padding: '14px 16px', textAlign: 'center' }}>
        <div style={{ fontSize: 32, fontWeight: 800, color }}>{pct}%</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
          {results.totalScore} / {results.maxScore} points
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
          Completed {new Date(results.completedAt).toLocaleString()}
        </div>
      </div>

      {/* Per-question breakdown */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {questions.map((q, i) => {
          const attempt = results.attempts.find(a => a.questionId === q.id)
          const isCorrect =
            q.type === 'mcq' ? attempt?.answer === q.correctAnswer :
            q.type === 'true_false' ? String(attempt?.answer) === String(q.correctAnswer) :
            attempt?.aiScore != null && attempt.aiScore > 0

          return (
            <div key={q.id} style={{
              background: '#fff', border: '1px solid var(--border)',
              borderRadius: 6, padding: '8px 10px', fontSize: 12
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontWeight: 600, color: 'var(--text-dark)' }}>Q{i + 1}. {q.prompt.slice(0, 60)}{q.prompt.length > 60 ? '…' : ''}</span>
                <span style={{ color: isCorrect ? '#059669' : '#dc2626', fontWeight: 700 }}>
                  {isCorrect ? '✓' : '✗'}
                </span>
              </div>
              {attempt?.answer != null && (
                <div style={{ color: '#64748b' }}>
                  Your answer: {q.type === 'mcq' && q.options
                    ? q.options[attempt.answer as number] ?? String(attempt.answer)
                    : String(attempt.answer)}
                </div>
              )}
              {!attempt && <div style={{ color: '#94a3b8', fontStyle: 'italic' }}>Not answered</div>}
              {q.type === 'short_answer' && attempt?.aiFeedback && (
                <div style={{ color: '#0284c7', marginTop: 4 }}>{attempt.aiFeedback}</div>
              )}
            </div>
          )
        })}
      </div>

      <button onClick={onReset} style={{ ...navBtn, width: '100%', background: '#64748b' }}>
        Retake Quiz
      </button>
    </div>
  )
}

async function gradeShortAnswer(
  question: QuizQuestion,
  studentAnswer: string,
  apiKey: string,
  provider: string,
  onResult: (score: number, feedback: string) => void
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
      const msg = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 128,
        messages: [{ role: 'user', content: prompt }]
      })
      const text = msg.content[0].type === 'text' ? msg.content[0].text : ''
      const parsed = JSON.parse(text.match(/\{.*\}/s)?.[0] ?? '{}')
      onResult(Math.min(question.points, Math.max(0, Number(parsed.score ?? 0))), parsed.feedback ?? '')
    } else if (provider === 'openai') {
      const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model: 'gpt-4o-mini', max_tokens: 128, messages: [{ role: 'user', content: prompt }] })
      })
      const data = await resp.json()
      const text = data.choices?.[0]?.message?.content ?? ''
      const parsed = JSON.parse(text.match(/\{.*\}/s)?.[0] ?? '{}')
      onResult(Math.min(question.points, Math.max(0, Number(parsed.score ?? 0))), parsed.feedback ?? '')
    }
  } catch {
    // grading failed silently — student still gets credit for answering
  }
}

const navBtn: React.CSSProperties = {
  background: '#0284c7', color: '#fff', border: 'none',
  borderRadius: 6, padding: '8px 0', fontSize: 13, fontWeight: 600
}
