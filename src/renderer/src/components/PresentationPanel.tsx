import React, { useEffect, useRef, useState } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import type { QuizQuestion, QuizAttempt } from '../types/assignment'
import { QuizOverlay } from './QuizOverlay'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).href

export interface SlideEvent {
  slideIndex: number  // 0-based
  timestamp: number   // Date.now()
}

interface Props {
  pdfData: Uint8Array | null
  triggeredQuestion: QuizQuestion | null
  triggeredAttempt: QuizAttempt | null
  apiKey: string
  provider: string
  onSlideChange?: (event: SlideEvent) => void
  onAnswer: (questionId: string, answer: string | number | null) => void
  onAIGrade: (questionId: string, score: number, feedback: string) => void
  onOverlayDismiss: () => void
}

export function PresentationPanel({
  pdfData, triggeredQuestion, triggeredAttempt, apiKey, provider,
  onSlideChange, onAnswer, onAIGrade, onOverlayDismiss
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [pageCount, setPageCount] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [isRendering, setIsRendering] = useState(false)
  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null)
  const renderTaskRef = useRef<pdfjsLib.RenderTask | null>(null)

  // Load PDF document when data changes
  useEffect(() => {
    if (!pdfData) { pdfDocRef.current = null; setPageCount(0); setCurrentPage(1); return }
    let cancelled = false
    pdfjsLib.getDocument({ data: pdfData }).promise.then(pdf => {
      if (cancelled) return
      pdfDocRef.current = pdf
      setPageCount(pdf.numPages)
      setCurrentPage(1)
    }).catch(console.error)
    return () => { cancelled = true }
  }, [pdfData])

  // Render current page when page number or doc changes
  useEffect(() => {
    if (!pdfDocRef.current || !canvasRef.current || pageCount === 0) return
    let cancelled = false

    if (renderTaskRef.current) {
      renderTaskRef.current.cancel()
      renderTaskRef.current = null
    }

    setIsRendering(true)
    pdfDocRef.current.getPage(currentPage).then(page => {
      if (cancelled || !canvasRef.current || !containerRef.current) return

      const containerWidth = containerRef.current.clientWidth - 8
      const viewport = page.getViewport({ scale: 1 })
      const scale = Math.min(containerWidth / viewport.width, 2)
      const scaled = page.getViewport({ scale })

      const canvas = canvasRef.current
      canvas.width = scaled.width
      canvas.height = scaled.height

      const ctx = canvas.getContext('2d')!
      const task = page.render({ canvasContext: ctx, viewport: scaled })
      renderTaskRef.current = task
      task.promise
        .then(() => { if (!cancelled) setIsRendering(false) })
        .catch(() => { if (!cancelled) setIsRendering(false) })
    }).catch(console.error)

    return () => { cancelled = true }
  }, [currentPage, pageCount])

  // Keyboard navigation — blocked while a quiz overlay is open
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (triggeredQuestion) return
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') goTo(currentPage + 1)
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') goTo(currentPage - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [currentPage, pageCount, triggeredQuestion])  // eslint-disable-line react-hooks/exhaustive-deps

  const goTo = (page: number) => {
    const clamped = Math.max(1, Math.min(pageCount, page))
    if (clamped === currentPage) return
    setCurrentPage(clamped)
    onSlideChange?.({ slideIndex: clamped - 1, timestamp: Date.now() })
  }

  if (!pdfData) {
    return (
      <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.6 }}>
        <div style={{ fontSize: 28, marginBottom: 8 }}>🖼</div>
        No slides loaded.<br />
        <span style={{ fontSize: 11 }}>Open an assignment package to load slides.</span>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, height: '100%', minHeight: 0 }}>
      {/* Slide canvas */}
      <div
        ref={containerRef}
        style={{
          flex: 1, minHeight: 0, overflow: 'auto',
          background: '#f1f5f9', borderRadius: 6, border: '1px solid var(--border)',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 4,
          position: 'relative'
        }}
      >
        {isRendering && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
            justifyContent: 'center', background: 'rgba(248,250,252,0.7)', zIndex: 1, fontSize: 12, color: '#64748b'
          }}>
            Rendering…
          </div>
        )}
        <canvas
          ref={canvasRef}
          style={{ maxWidth: '100%', boxShadow: '0 2px 8px rgba(0,0,0,0.15)', borderRadius: 2 }}
        />
      </div>

      {/* Quiz overlay — blocks the slide when a triggered question fires */}
      {triggeredQuestion && (
        <QuizOverlay
          question={triggeredQuestion}
          attempt={triggeredAttempt}
          apiKey={apiKey}
          provider={provider}
          context="slide"
          onAnswer={onAnswer}
          onAIGrade={onAIGrade}
          onDismiss={onOverlayDismiss}
        />
      )}

      {/* Navigation controls — disabled while overlay is open */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', flexShrink: 0, paddingBottom: 4 }}>
        <button
          onClick={() => goTo(currentPage - 1)}
          disabled={currentPage <= 1 || !!triggeredQuestion}
          style={{ ...navBtn, opacity: (currentPage <= 1 || !!triggeredQuestion) ? 0.3 : 1, cursor: (currentPage <= 1 || !!triggeredQuestion) ? 'default' : 'pointer' }}
          title="Previous slide (← arrow key)"
        >
          ‹ Prev
        </button>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)', minWidth: 70, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
          {currentPage} / {pageCount}
        </span>
        <button
          onClick={() => goTo(currentPage + 1)}
          disabled={currentPage >= pageCount || !!triggeredQuestion}
          style={{ ...navBtn, opacity: (currentPage >= pageCount || !!triggeredQuestion) ? 0.3 : 1, cursor: (currentPage >= pageCount || !!triggeredQuestion) ? 'default' : 'pointer' }}
          title="Next slide (→ arrow key)"
        >
          Next ›
        </button>
      </div>
    </div>
  )
}

const navBtn: React.CSSProperties = {
  background: '#0284c7', color: '#fff', border: 'none', borderRadius: 5,
  padding: '5px 14px', fontSize: 12, fontWeight: 600
}
