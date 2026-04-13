import { useState, useCallback } from 'react'
import type { Annotation, FeedbackComment } from '../types'

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export function useAnnotations(getCurrentTime: () => number) {
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [comments, setComments] = useState<FeedbackComment[]>([])
  const [activeAnnotation, setActiveAnnotation] = useState<Annotation | null>(null)

  const addAnnotation = useCallback((partial: Omit<Annotation, 'id' | 'timestamp' | 'createdAt'>) => {
    const annotation: Annotation = {
      ...partial,
      id: uid(),
      timestamp: getCurrentTime(),
      createdAt: Date.now()
    }
    setAnnotations(prev => [...prev, annotation])
    setActiveAnnotation(annotation)
    return annotation
  }, [getCurrentTime])

  const updateAnnotation = useCallback((id: string, updates: Partial<Annotation>) => {
    setAnnotations(prev =>
      prev.map(a => a.id === id ? { ...a, ...updates } : a)
    )
  }, [])

  const deleteAnnotation = useCallback((id: string) => {
    setAnnotations(prev => prev.filter(a => a.id !== id))
    setActiveAnnotation(a => a?.id === id ? null : a)
  }, [])

  const addComment = useCallback((
    text: string,
    author: string,
    tag: FeedbackComment['tag'] = 'general',
    voiceNote?: string
  ) => {
    const comment: FeedbackComment = {
      id: uid(),
      timestamp: getCurrentTime(),
      author,
      text,
      tag,
      createdAt: Date.now(),
      ...(voiceNote ? { voiceNote } : {})
    }
    setComments(prev =>
      [...prev, comment].sort((a, b) => a.timestamp - b.timestamp)
    )
    return comment
  }, [getCurrentTime])

  const deleteComment = useCallback((id: string) => {
    setComments(prev => prev.filter(c => c.id !== id))
  }, [])

  const getAnnotationsAtTime = useCallback((t: number, window = 2) => {
    return annotations.filter(a => Math.abs(a.timestamp - t) <= window)
  }, [annotations])

  return {
    annotations,
    comments,
    activeAnnotation,
    setActiveAnnotation,
    addAnnotation,
    updateAnnotation,
    deleteAnnotation,
    addComment,
    deleteComment,
    getAnnotationsAtTime,
    setAnnotations,
    setComments
  }
}
