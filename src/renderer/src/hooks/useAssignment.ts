import { useState, useCallback } from 'react'
import type { Assignment } from '../types/assignment'

interface AssignmentState {
  assignment: Assignment | null
  slidesPdfData: Uint8Array | null
  isLoading: boolean
  error: string | null
}

export function useAssignment() {
  const [state, setState] = useState<AssignmentState>({
    assignment: null,
    slidesPdfData: null,
    isLoading: false,
    error: null
  })

  const openAssignment = useCallback(async () => {
    setState(s => ({ ...s, isLoading: true, error: null }))
    try {
      const result = await window.api.openAssignment()
      if (!result) { setState(s => ({ ...s, isLoading: false })); return }
      if ('error' in result) {
        setState(s => ({ ...s, isLoading: false, error: result.error }))
        return
      }

      let slidesPdfData: Uint8Array | null = null
      if (result.slidesTempPath) {
        const buf = await window.api.readFileAsBuffer(result.slidesTempPath)
        if (buf) slidesPdfData = buf
      }

      setState({ assignment: result.assignment, slidesPdfData, isLoading: false, error: null })
    } catch (e) {
      setState(s => ({ ...s, isLoading: false, error: String(e) }))
    }
  }, [])

  const clearAssignment = useCallback(() => {
    setState({ assignment: null, slidesPdfData: null, isLoading: false, error: null })
  }, [])

  return { ...state, openAssignment, clearAssignment }
}
