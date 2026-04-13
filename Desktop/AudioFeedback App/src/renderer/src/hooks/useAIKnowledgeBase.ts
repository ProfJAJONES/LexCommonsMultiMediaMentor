import { useState, useCallback } from 'react'
import type { Domain } from './useDomain'
import { DOMAIN_CONFIG } from './useDomain'

export type KnowledgeCategory = 'rubric' | 'criteria' | 'guideline' | 'note'

export interface KnowledgeItem {
  id: string
  title: string
  body: string
  category: KnowledgeCategory
  createdAt: number
}

export const CATEGORY_LABELS: Record<KnowledgeCategory, string> = {
  rubric:    'Rubric',
  criteria:  'Grading Criteria',
  guideline: 'Course Guideline',
  note:      'Student Note'
}

export const CATEGORY_COLORS: Record<KnowledgeCategory, string> = {
  rubric:    '#818cf8',
  criteria:  '#f87171',
  guideline: '#34d399',
  note:      '#fbbf24'
}

function storageKey(domain: Domain) {
  return `mm_ai_knowledge_base_${domain}`
}

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function load(domain: Domain): KnowledgeItem[] {
  try {
    const raw = localStorage.getItem(storageKey(domain))
    if (!raw) return seed(domain)
    const parsed = JSON.parse(raw) as KnowledgeItem[]
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : seed(domain)
  } catch {
    return seed(domain)
  }
}

function seed(domain: Domain): KnowledgeItem[] {
  const items = DOMAIN_CONFIG[domain].defaultKnowledge.map(d => ({
    ...d,
    id: uid(),
    createdAt: Date.now()
  }))
  localStorage.setItem(storageKey(domain), JSON.stringify(items))
  return items
}

function save(domain: Domain, items: KnowledgeItem[]) {
  localStorage.setItem(storageKey(domain), JSON.stringify(items))
}

export function useAIKnowledgeBase(domain: Domain) {
  const [items, setItems] = useState<KnowledgeItem[]>(() => load(domain))

  const loadDomain = useCallback((d: Domain) => {
    setItems(load(d))
  }, [])

  const add = useCallback((title: string, body: string, category: KnowledgeCategory) => {
    const item: KnowledgeItem = { id: uid(), title: title.trim(), body: body.trim(), category, createdAt: Date.now() }
    setItems(prev => { const next = [...prev, item]; save(domain, next); return next })
  }, [domain])

  const update = useCallback((id: string, patch: Partial<Pick<KnowledgeItem, 'title' | 'body' | 'category'>>) => {
    setItems(prev => {
      const next = prev.map(it => it.id === id ? { ...it, ...patch } : it)
      save(domain, next)
      return next
    })
  }, [domain])

  const remove = useCallback((id: string) => {
    setItems(prev => { const next = prev.filter(it => it.id !== id); save(domain, next); return next })
  }, [domain])

  const toPromptBlock = useCallback((): string => {
    if (items.length === 0) return ''
    return items.map(it =>
      `[${CATEGORY_LABELS[it.category].toUpperCase()}] ${it.title}\n${it.body}`
    ).join('\n\n')
  }, [items])

  return { items, add, update, remove, toPromptBlock, loadDomain }
}
