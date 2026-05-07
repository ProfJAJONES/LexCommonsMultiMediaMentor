import { useState, useCallback } from 'react'
import type { QuizQuestion, QuizAttempt, QuizResults } from '../types/assignment'

export function useQuiz(questions: QuizQuestion[], assignmentTitle: string) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [attempts, setAttempts] = useState<QuizAttempt[]>([])
  const [completed, setCompleted] = useState(false)

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
    getResults,
    reset
  }
}
