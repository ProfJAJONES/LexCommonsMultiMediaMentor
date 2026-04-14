import { useState, useCallback } from 'react'
import type { FeedbackComment } from '../types'
import type { Domain } from './useDomain'
import { DOMAIN_CONFIG } from './useDomain'

export interface CommentTemplate {
  id: string
  tag: FeedbackComment['tag']
  text: string
  createdAt: number
}

function storageKey(domain: Domain) {
  return `mm_comment_templates_${domain}`
}

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function load(domain: Domain): CommentTemplate[] {
  try {
    const raw = localStorage.getItem(storageKey(domain))
    if (!raw) return seed(domain)
    const parsed = JSON.parse(raw) as CommentTemplate[]
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : seed(domain)
  } catch {
    return seed(domain)
  }
}

function seed(domain: Domain): CommentTemplate[] {
  const templates = DOMAIN_CONFIG[domain].defaultTemplates.map(d => ({
    ...d,
    id: uid(),
    createdAt: Date.now()
  }))
  localStorage.setItem(storageKey(domain), JSON.stringify(templates))
  return templates
}

function save(domain: Domain, templates: CommentTemplate[]) {
  localStorage.setItem(storageKey(domain), JSON.stringify(templates))
}

export function useCommentTemplates(domain: Domain) {
  const [templates, setTemplates] = useState<CommentTemplate[]>(() => load(domain))

  // Re-load when domain changes
  const loadDomain = useCallback((d: Domain) => {
    setTemplates(load(d))
  }, [])

  const addTemplate = useCallback((text: string, tag: FeedbackComment['tag']) => {
    const t: CommentTemplate = { id: uid(), tag, text: text.trim(), createdAt: Date.now() }
    setTemplates(prev => {
      const next = [...prev, t]
      save(domain, next)
      return next
    })
  }, [domain])

  const deleteTemplate = useCallback((id: string) => {
    setTemplates(prev => {
      const next = prev.filter(t => t.id !== id)
      save(domain, next)
      return next
    })
  }, [domain])

  const updateTemplate = useCallback((id: string, text: string) => {
    setTemplates(prev => {
      const next = prev.map(t => t.id === id ? { ...t, text: text.trim() } : t)
      save(domain, next)
      return next
    })
  }, [domain])

  const byTag = useCallback((tag: FeedbackComment['tag']) =>
    templates.filter(t => t.tag === tag),
    [templates]
  )

  return { templates, addTemplate, deleteTemplate, updateTemplate, byTag, loadDomain }
}
