import { useState, useCallback, useRef } from 'react'
import type { QuizQuestion, QuizAttempt, QuizResults } from '../types/assignment'

export function useQuiz(questions: QuizQuestion[], assignmentTitle: string) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [attempts, setAttempts] = useState<QuizAttempt[]>([])
  const [completed, setCompleted] = useState(false)
  // Tracks questions that have already fired as triggered overlays so they don't re-fire
  const firedTriggersRef = useRef<Set<string>>(new Set())

  const submitAnswer = useCallback((questionId: string, answer: string | number | null, voiceTranscript?: string) => {
    setAttempts(prev => {
      const attempt: QuizAttempt = { questionId, answer, voiceTranscript, submittedAt: Date.now() }
      const idx = prev.findIndex(a => a.questionId === questionId)
      if (idx >= 0) { const next = [...prev]; next[idx] = attempt; return next }
      return [...prev, attempt]
    })
  }, [])

  const applyAIGrade = useCallback((questionId: string, aiScore: number, aiFeedback: string) => {
    setAttempts(prev => prev.map(a =>
      a.questionId === questionId ? { ...a, aiScore, aiFeedback } : a
    ))
  }, [])

  const next = useCallback(() => {
    if (currentIndex < questions.length - 1) setCurrentIndex(i => i + 1)
    else setCompleted(true)
  }, [currentIndex, questions.length])

  const prev = useCallback(() => setCurrentIndex(i => Math.max(0, i - 1)), [])

  // Returns the first unfired question whose triggerSlide matches the given slide index.
  const checkSlideTrigger = useCallback((slideIndex: number): QuizQuestion | null => {
    for (const q of questions) {
      if (q.triggerSlide === slideIndex && !firedTriggersRef.current.has(q.id)) return q
    }
    return null
  }, [questions])

  // Returns the first unfired question whose triggerTimestamp is within 1 second of currentTime.
  const checkTimestampTrigger = useCallback((currentTime: number): QuizQuestion | null => {
    for (const q of questions) {
      if (q.triggerTimestamp !== undefined && !firedTriggersRef.current.has(q.id)) {
        if (Math.abs(q.triggerTimestamp - currentTime) < 1.0) return q
      }
    }
    return null
  }, [questions])

  const markTriggered = useCallback((questionId: string) => {
    firedTriggersRef.current.add(questionId)
  }, [])

  const getResults = useCallback((): QuizResults => {
    let totalScore = 0
    let maxScore = 0
    for (const q of questions) {
      maxScore += q.points
      const attempt = attempts.find(a => a.questionId === q.id)
      if (!attempt) continue
      if (q.type === 'mcq' && attempt.answer === q.correctAnswer) totalScore += q.points
      else if (q.type === 'true_false' && String(attempt.answer) === String(q.correctAnswer)) totalScore += q.points
      else if (q.type === 'short_answer' && attempt.aiScore != null) totalScore += attempt.aiScore
    }
    return { assignmentTitle, completedAt: Date.now(), attempts, totalScore, maxScore }
  }, [questions, attempts, assignmentTitle])

  const reset = useCallback(() => {
    setCurrentIndex(0)
    setAttempts([])
    setCompleted(false)
    firedTriggersRef.current = new Set()
  }, [])

  const currentAttempt = attempts.find(a => a.questionId === questions[currentIndex]?.id) ?? null

  return {
    currentIndex,
    currentQuestion: questions[currentIndex] ?? null,
    attempts,
    completed,
    currentAttempt,
    submitAnswer,
    applyAIGrade,
    next,
    prev,
    checkSlideTrigger,
    checkTimestampTrigger,
    markTriggered,
    getResults,
    reset
  }
}
