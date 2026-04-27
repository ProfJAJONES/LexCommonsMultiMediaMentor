import { useState, useCallback } from 'react'
import type { Domain } from './useDomain'
import { DOMAIN_CONFIG } from './useDomain'

export type KnowledgeCategory = 'rubric' | 'criteria' | 'guideline' | 'note' | 'document'

export interface KnowledgeSourceFile {
  name: string
  kind: 'pdf' | 'docx' | 'txt'
  size: number
  pageCount?: number
  truncated?: boolean
}

export interface KnowledgeItem {
  id: string
  title: string
  body: string
  category: KnowledgeCategory
  createdAt: number
  /** When set, this item is only injected into prompts for judges whose id is in this list.
   *  Undefined or empty means "visible to all judges in the domain" (legacy + default behavior). */
  judgeIds?: string[]
  /** Set when the item came from an uploaded file — purely informational, shown in the manager UI. */
  sourceFile?: KnowledgeSourceFile
}

export const CATEGORY_LABELS: Record<KnowledgeCategory, string> = {
  rubric:    'Rubric',
  criteria:  'Grading Criteria',
  guideline: 'Course Guideline',
  note:      'Student Note',
  document:  'Document'
}

export const CATEGORY_COLORS: Record<KnowledgeCategory, string> = {
  rubric:    '#818cf8',
  criteria:  '#f87171',
  guideline: '#34d399',
  note:      '#fbbf24',
  document:  '#0ea5e9'
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

  const add = useCallback((
    title: string,
    body: string,
    category: KnowledgeCategory,
    options: { judgeIds?: string[]; sourceFile?: KnowledgeSourceFile } = {}
  ) => {
    const item: KnowledgeItem = {
      id: uid(),
      title: title.trim(),
      body: body.trim(),
      category,
      createdAt: Date.now(),
      ...(options.judgeIds && options.judgeIds.length > 0 ? { judgeIds: options.judgeIds } : {}),
      ...(options.sourceFile ? { sourceFile: options.sourceFile } : {})
    }
    setItems(prev => { const next = [...prev, item]; save(domain, next); return next })
  }, [domain])

  const update = useCallback((id: string, patch: Partial<Pick<KnowledgeItem, 'title' | 'body' | 'category' | 'judgeIds'>>) => {
    setItems(prev => {
      const next = prev.map(it => it.id === id ? { ...it, ...patch } : it)
      save(domain, next)
      return next
    })
  }, [domain])

  const remove = useCallback((id: string) => {
    setItems(prev => { const next = prev.filter(it => it.id !== id); save(domain, next); return next })
  }, [domain])

  /**
   * Build the prompt context block.
   * - With no `judgeId`: returns ALL items (used by AI Feedback panel + general callers).
   * - With a `judgeId`: returns items that are either un-tagged ("all judges") or
   *   tagged for this specific judge.
   */
  const toPromptBlock = useCallback((judgeId?: string): string => {
    const visible = judgeId
      ? items.filter(it => !it.judgeIds || it.judgeIds.length === 0 || it.judgeIds.includes(judgeId))
      : items
    if (visible.length === 0) return ''
    return visible.map(it =>
      `[${CATEGORY_LABELS[it.category].toUpperCase()}] ${it.title}\n${it.body}`
    ).join('\n\n')
  }, [items])

  return { items, add, update, remove, toPromptBlock, loadDomain }
}
