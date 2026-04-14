import React, { useRef, useState } from 'react'
import type { Annotation } from '../types'

interface Props {
  annotations: Annotation[]
  currentTime: number
  onAdd: (a: Omit<Annotation, 'id' | 'timestamp' | 'createdAt'>) => void
  onDelete: (id: string) => void
  tool: 'rect' | 'circle' | 'arrow' | 'text' | null
  color: string
  width: number
  height: number
}

const WINDOW = 2  // seconds to show annotation

export function AnnotationLayer({
  annotations,
  currentTime,
  onAdd,
  onDelete,
  tool,
  color,
  width,
  height
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [drawing, setDrawing] = useState<{ x: number; y: number } | null>(null)
  const [pendingText, setPendingText] = useState<{ x: number; y: number } | null>(null)
  const [textInput, setTextInput] = useState('')

  const visible = annotations.filter(a => Math.abs(a.timestamp - currentTime) <= WINDOW)

  function getSVGPoint(e: React.MouseEvent<SVGSVGElement>): { x: number; y: number } {
    const rect = svgRef.current!.getBoundingClientRect()
    return {
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100
    }
  }

  function handleMouseDown(e: React.MouseEvent<SVGSVGElement>) {
    if (!tool) return
    if (tool === 'text') {
      const pt = getSVGPoint(e)
      setPendingText(pt)
      return
    }
    const pt = getSVGPoint(e)
    setDrawing(pt)
  }

  function handleMouseUp(e: React.MouseEvent<SVGSVGElement>) {
    if (!drawing || !tool) return
    const end = getSVGPoint(e)
    const dx = end.x - drawing.x
    const dy = end.y - drawing.y
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) {
      setDrawing(null)
      return
    }
    onAdd({
      type: tool as Annotation['type'],
      x: drawing.x,
      y: drawing.y,
      width: dx,
      height: dy,
      color
    })
    setDrawing(null)
  }

  function commitText() {
    if (!pendingText || !textInput.trim()) {
      setPendingText(null)
      setTextInput('')
      return
    }
    onAdd({
      type: 'text',
      x: pendingText.x,
      y: pendingText.y,
      text: textInput,
      color
    })
    setPendingText(null)
    setTextInput('')
  }

  return (
    <div style={{ position: 'relative', width, height }}>
      <svg
        ref={svgRef}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        width={width}
        height={height}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          cursor: tool ? 'crosshair' : 'default',
          pointerEvents: tool ? 'auto' : 'none'
        }}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
      >
        {visible.map(a => (
          <g
            key={a.id}
            onClick={e => { e.stopPropagation(); onDelete(a.id) }}
            style={{ cursor: 'pointer' }}
          >
            {a.type === 'rect' && (
              <rect
                x={a.x}
                y={a.y}
                width={a.width}
                height={a.height}
                stroke={a.color}
                strokeWidth={0.6}
                fill={`${a.color}22`}
              />
            )}
            {a.type === 'circle' && (
              <ellipse
                cx={a.x + (a.width ?? 0) / 2}
                cy={a.y + (a.height ?? 0) / 2}
                rx={Math.abs((a.width ?? 0) / 2)}
                ry={Math.abs((a.height ?? 0) / 2)}
                stroke={a.color}
                strokeWidth={0.6}
                fill={`${a.color}22`}
              />
            )}
            {a.type === 'arrow' && (
              <line
                x1={a.x}
                y1={a.y}
                x2={a.x + (a.width ?? 0)}
                y2={a.y + (a.height ?? 0)}
                stroke={a.color}
                strokeWidth={0.8}
                markerEnd="url(#arrowhead)"
              />
            )}
            {a.type === 'text' && (
              <text
                x={a.x}
                y={a.y}
                fill={a.color}
                fontSize={3}
                fontFamily="sans-serif"
              >
                {a.text}
              </text>
            )}
          </g>
        ))}

        <defs>
          <marker id="arrowhead" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
            <path d="M0,0 L0,6 L6,3 Z" fill="#f59e0b" />
          </marker>
        </defs>
      </svg>

      {/* Text input popup */}
      {pendingText && (
        <div
          style={{
            position: 'absolute',
            left: `${pendingText.x}%`,
            top: `${pendingText.y}%`,
            zIndex: 10,
            background: '#1e293b',
            border: '1px solid #334155',
            borderRadius: 4,
            padding: '4px 6px',
            display: 'flex',
            gap: 4
          }}
        >
          <input
            autoFocus
            value={textInput}
            onChange={e => setTextInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') commitText(); if (e.key === 'Escape') { setPendingText(null); setTextInput('') } }}
            placeholder="Add text..."
            style={{
              background: 'transparent',
              border: 'none',
              color: '#f1f5f9',
              outline: 'none',
              fontSize: 12,
              width: 140
            }}
          />
          <button onClick={commitText} style={{ background: color, border: 'none', borderRadius: 3, color: '#fff', cursor: 'pointer', padding: '2px 6px', fontSize: 11 }}>
            Add
          </button>
        </div>
      )}
    </div>
  )
}
