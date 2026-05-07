import React, { useState, useCallback } from 'react'
import type { Assignment, QuizQuestion, RubricCriterion } from '../types/assignment'

interface Props {
  onClose: () => void
}

let qIdCounter = 0
const newQId = () => `q_${Date.now()}_${qIdCounter++}`

const emptyAssignment = (): Assignment => ({
  version: '1.0',
  title: '',
  instructions: '',
  hasSlides: false,
  quiz: { title: '', questions: [], allowRetries: true, showCorrectAnswers: true },
  rubric: [],
  submissionConfig: { requiresVideo: true, requiresQuizCompletion: false }
})

export function AssignmentBuilder({ onClose }: Props) {
  const [assignment, setAssignment] = useState<Assignment>(emptyAssignment)
  const [slidesPdfPath, setSlidesPdfPath] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [activeSection, setActiveSection] = useState<'info' | 'quiz' | 'rubric' | 'submit'>('info')

  const update = useCallback(<K extends keyof Assignment>(key: K, val: Assignment[K]) => {
    setAssignment(a => ({ ...a, [key]: val }))
  }, [])

  const updateQuiz = useCallback(<K extends keyof NonNullable<Assignment['quiz']>>(
    key: K, val: NonNullable<Assignment['quiz']>[K]
  ) => {
    setAssignment(a => ({ ...a, quiz: { ...a.quiz!, [key]: val } }))
  }, [])

  const addQuestion = (type: QuizQuestion['type']) => {
    const q: QuizQuestion = {
      id: newQId(), type, prompt: '', points: 1,
      options: type === 'mcq' ? ['', '', '', ''] : undefined,
      correctAnswer: type === 'true_false' ? 'true' : type === 'mcq' ? 0 : '',
      allowVoiceAnswer: false
    }
    updateQuiz('questions', [...(assignment.quiz?.questions ?? []), q])
  }

  const updateQuestion = (id: string, updates: Partial<QuizQuestion>) => {
    updateQuiz('questions', (assignment.quiz?.questions ?? []).map(q =>
      q.id === id ? { ...q, ...updates } : q
    ))
  }

  const removeQuestion = (id: string) => {
    updateQuiz('questions', (assignment.quiz?.questions ?? []).filter(q => q.id !== id))
  }

  const addRubricRow = () => {
    update('rubric', [...(assignment.rubric ?? []), { criterion: '', weight: 1, description: '' }])
  }

  const updateRubricRow = (i: number, updates: Partial<RubricCriterion>) => {
    const rubric = [...(assignment.rubric ?? [])]
    rubric[i] = { ...rubric[i], ...updates }
    update('rubric', rubric)
  }

  const removeRubricRow = (i: number) => {
    update('rubric', (assignment.rubric ?? []).filter((_, idx) => idx !== i))
  }

  const pickSlidesPdf = async () => {
    const result = await window.api.openMedia()
    if (result && result.filePath.endsWith('.pdf')) {
      setSlidesPdfPath(result.filePath)
      update('hasSlides', true)
    }
  }

  const handleSave = async () => {
    if (!assignment.title.trim()) { setSaveMsg({ ok: false, text: 'Assignment title is required.' }); return }
    setIsSaving(true)
    setSaveMsg(null)
    try {
      const path = await window.api.saveAssignment(assignment, slidesPdfPath)
      if (path) setSaveMsg({ ok: true, text: `Saved: ${path}` })
      else setSaveMsg({ ok: false, text: 'Save cancelled.' })
    } catch (e) {
      setSaveMsg({ ok: false, text: String(e) })
    } finally {
      setIsSaving(false)
    }
  }

  const sections = [
    { key: 'info', label: 'Info' },
    { key: 'quiz', label: `Quiz (${assignment.quiz?.questions.length ?? 0})` },
    { key: 'rubric', label: `Rubric (${assignment.rubric?.length ?? 0})` },
    { key: 'submit', label: 'Options' },
  ] as const

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center'
    }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{
        background: 'var(--bg-card)', borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        width: 560, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid var(--border)', background: '#7c3aed', color: '#fff' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Assignment Builder</div>
            <div style={{ fontSize: 11, opacity: 0.8, marginTop: 1 }}>Create a .zip package for students to upload</div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 5, color: '#fff', cursor: 'pointer', fontSize: 16, padding: '3px 9px' }}>✕</button>
        </div>

        {/* Section tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: '#f8fafc' }}>
          {sections.map(s => (
            <button key={s.key} onClick={() => setActiveSection(s.key)} style={{
              flex: 1, border: 'none', borderBottom: `2px solid ${activeSection === s.key ? '#7c3aed' : 'transparent'}`,
              background: 'transparent', color: activeSection === s.key ? '#7c3aed' : '#64748b',
              cursor: 'pointer', fontSize: 11, fontWeight: activeSection === s.key ? 700 : 500, padding: '8px 4px'
            }}>{s.label}</button>
          ))}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 18px' }}>

          {activeSection === 'info' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Field label="Title *">
                <input value={assignment.title} onChange={e => update('title', e.target.value)} placeholder="e.g. Week 3 — Oral Argument" style={inputStyle} />
              </Field>
              <Field label="Instructions">
                <textarea value={assignment.instructions} onChange={e => update('instructions', e.target.value)} placeholder="Describe the task, context, and expectations for the student…" rows={5} style={{ ...inputStyle, resize: 'vertical' }} />
              </Field>
              <Field label="Due Date (optional)">
                <input type="date" value={assignment.dueDate ?? ''} onChange={e => update('dueDate', e.target.value)} style={inputStyle} />
              </Field>
              <Field label="Slides (optional PDF)">
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button onClick={pickSlidesPdf} style={outlineBtn}>
                    {slidesPdfPath ? '✓ ' + slidesPdfPath.split('/').pop() : 'Select PDF…'}
                  </button>
                  {slidesPdfPath && (
                    <button onClick={() => { setSlidesPdfPath(null); update('hasSlides', false) }} style={{ ...outlineBtn, color: '#dc2626', borderColor: '#fca5a5' }}>Remove</button>
                  )}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Convert PPTX → PDF before selecting</div>
              </Field>
            </div>
          )}

          {activeSection === 'quiz' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button onClick={() => addQuestion('mcq')} style={addBtn}>+ Multiple Choice</button>
                <button onClick={() => addQuestion('true_false')} style={addBtn}>+ True / False</button>
                <button onClick={() => addQuestion('short_answer')} style={addBtn}>+ Short Answer</button>
              </div>
              {(assignment.quiz?.questions ?? []).length === 0 && (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12, padding: '20px 0', fontStyle: 'italic' }}>No questions yet — use the buttons above to add some.</div>
              )}
              {(assignment.quiz?.questions ?? []).map((q, i) => (
                <QuestionEditor key={q.id} question={q} index={i} onChange={upd => updateQuestion(q.id, upd)} onRemove={() => removeQuestion(q.id)} />
              ))}
            </div>
          )}

          {activeSection === 'rubric' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Define grading criteria professors will use when reviewing submissions.</div>
              {(assignment.rubric ?? []).map((row, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 60px 1fr auto', gap: 6, alignItems: 'start' }}>
                  <input value={row.criterion} onChange={e => updateRubricRow(i, { criterion: e.target.value })} placeholder="Criterion" style={inputStyle} />
                  <input type="number" value={row.weight} min={1} onChange={e => updateRubricRow(i, { weight: Number(e.target.value) })} style={inputStyle} />
                  <input value={row.description} onChange={e => updateRubricRow(i, { description: e.target.value })} placeholder="Description" style={inputStyle} />
                  <button onClick={() => removeRubricRow(i)} style={{ ...outlineBtn, color: '#dc2626', borderColor: '#fca5a5', padding: '4px 8px' }}>✕</button>
                </div>
              ))}
              <button onClick={addRubricRow} style={addBtn}>+ Add Criterion</button>
            </div>
          )}

          {activeSection === 'submit' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Field label="Submission Requirements">
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                  <input type="checkbox" checked={assignment.submissionConfig?.requiresVideo ?? true}
                    onChange={e => update('submissionConfig', { ...assignment.submissionConfig!, requiresVideo: e.target.checked })} />
                  Requires video recording
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', marginTop: 6 }}>
                  <input type="checkbox" checked={assignment.submissionConfig?.requiresQuizCompletion ?? false}
                    onChange={e => update('submissionConfig', { ...assignment.submissionConfig!, requiresQuizCompletion: e.target.checked })} />
                  Requires quiz completion
                </label>
              </Field>
              {assignment.quiz && (
                <Field label="Quiz Options">
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                    <input type="checkbox" checked={assignment.quiz.allowRetries}
                      onChange={e => updateQuiz('allowRetries', e.target.checked)} />
                    Allow quiz retries
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', marginTop: 6 }}>
                    <input type="checkbox" checked={assignment.quiz.showCorrectAnswers}
                      onChange={e => updateQuiz('showCorrectAnswers', e.target.checked)} />
                    Show correct answers after completion
                  </label>
                </Field>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '10px 18px', borderTop: '1px solid var(--border)', background: '#f8fafc', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {saveMsg && (
            <div style={{ fontSize: 11, color: saveMsg.ok ? '#059669' : '#dc2626', wordBreak: 'break-all' }}>
              {saveMsg.text}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={{ ...outlineBtn, flex: 1 }}>Cancel</button>
            <button onClick={handleSave} disabled={isSaving} style={{
              flex: 2, background: isSaving ? '#cbd5e1' : '#7c3aed', color: '#fff',
              border: 'none', borderRadius: 6, padding: '8px 0', fontSize: 13, fontWeight: 700,
              cursor: isSaving ? 'default' : 'pointer'
            }}>
              {isSaving ? 'Saving…' : '💾 Save Assignment Package'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 5 }}>{label}</div>
      {children}
    </div>
  )
}

function QuestionEditor({ question, index, onChange, onRemove }: {
  question: QuizQuestion
  index: number
  onChange: (updates: Partial<QuizQuestion>) => void
  onRemove: () => void
}) {
  const typeLabel = { mcq: 'Multiple Choice', true_false: 'True / False', short_answer: 'Short Answer' }[question.type]

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', background: '#fff' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, alignItems: 'center' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase' }}>
          Q{index + 1} · {typeLabel}
        </span>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>pts:
            <input type="number" value={question.points} min={1} onChange={e => onChange({ points: Number(e.target.value) })}
              style={{ ...inputStyle, width: 44, marginLeft: 4, padding: '2px 5px', display: 'inline' }} />
          </label>
          <button onClick={onRemove} style={{ ...outlineBtn, color: '#dc2626', borderColor: '#fca5a5', padding: '2px 7px', fontSize: 12 }}>✕</button>
        </div>
      </div>

      <textarea
        value={question.prompt}
        onChange={e => onChange({ prompt: e.target.value })}
        placeholder="Question prompt…"
        rows={2}
        style={{ ...inputStyle, resize: 'vertical', marginBottom: 8 }}
      />

      {question.type === 'mcq' && question.options && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
          {question.options.map((opt, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input
                type="radio"
                name={`correct_${question.id}`}
                checked={question.correctAnswer === i}
                onChange={() => onChange({ correctAnswer: i })}
                title="Mark as correct answer"
                style={{ cursor: 'pointer' }}
              />
              <input
                value={opt}
                onChange={e => {
                  const opts = [...question.options!]
                  opts[i] = e.target.value
                  onChange({ options: opts })
                }}
                placeholder={`Option ${String.fromCharCode(65 + i)}`}
                style={{ ...inputStyle, flex: 1, padding: '4px 8px' }}
              />
            </div>
          ))}
          <button
            onClick={() => onChange({ options: [...(question.options ?? []), ''] })}
            style={{ ...outlineBtn, alignSelf: 'flex-start', fontSize: 11, padding: '3px 8px' }}
          >
            + Option
          </button>
          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Select the radio button next to the correct answer.</div>
        </div>
      )}

      {question.type === 'true_false' && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          {(['true', 'false'] as const).map(val => (
            <label key={val} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13 }}>
              <input type="radio" name={`tf_${question.id}`} checked={question.correctAnswer === val} onChange={() => onChange({ correctAnswer: val })} />
              {val === 'true' ? 'True' : 'False'}
            </label>
          ))}
        </div>
      )}

      {question.type === 'short_answer' && (
        <input
          value={question.correctAnswer as string ?? ''}
          onChange={e => onChange({ correctAnswer: e.target.value })}
          placeholder="Model answer (used by AI for grading)"
          style={{ ...inputStyle, marginBottom: 8 }}
        />
      )}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', border: '1px solid var(--border)',
  borderRadius: 5, padding: '6px 9px', fontSize: 13, fontFamily: 'inherit',
  outline: 'none', background: '#fff', color: 'var(--text-dark)'
}

const outlineBtn: React.CSSProperties = {
  background: '#fff', border: '1px solid var(--border)', borderRadius: 6,
  padding: '6px 12px', fontSize: 12, cursor: 'pointer', color: 'var(--text-secondary)', fontWeight: 500
}

const addBtn: React.CSSProperties = {
  background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 6,
  padding: '5px 11px', fontSize: 12, cursor: 'pointer', color: '#1d4ed8', fontWeight: 600
}
