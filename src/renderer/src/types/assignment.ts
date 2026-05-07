export interface QuizQuestion {
  id: string
  type: 'mcq' | 'short_answer' | 'true_false'
  prompt: string
  options?: string[]           // MCQ only
  correctAnswer?: string | number  // MCQ: option index; true_false: 'true'/'false'; short_answer: model answer
  points: number
  allowVoiceAnswer?: boolean
}

export interface RubricCriterion {
  criterion: string
  weight: number
  description: string
}

export interface Assignment {
  version: '1.0'
  title: string
  instructions: string
  dueDate?: string
  hasSlides: boolean
  quiz?: {
    title?: string
    questions: QuizQuestion[]
    allowRetries: boolean
    showCorrectAnswers: boolean
  }
  rubric?: RubricCriterion[]
  aiConfig?: {
    domain?: string
    systemPromptAddendum?: string
  }
  submissionConfig?: {
    requiresVideo: boolean
    requiresQuizCompletion: boolean
  }
}

export interface QuizAttempt {
  questionId: string
  answer: string | number | null
  voiceTranscript?: string
  aiScore?: number
  aiFeedback?: string
  submittedAt: number
}

export interface QuizResults {
  assignmentTitle: string
  completedAt: number
  attempts: QuizAttempt[]
  totalScore: number
  maxScore: number
}
