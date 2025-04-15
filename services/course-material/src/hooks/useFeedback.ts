import { useAtom, useSetAtom } from "jotai"
import { useCallback } from "react"

import {
  blockEditsAtom,
  currentlyOpenFeedbackDialogAtom,
  selectedBlockIdAtom,
  selectionAtom,
  writtenContentAtom,
} from "../stores/materialFeedbackStore"

import type { NewProposedBlockEdit } from "@/shared-module/common/bindings"

/**
 * Hook that provides methods for interacting with the feedback system
 * Encapsulates all the atom interactions to make components cleaner
 */
export function useFeedback() {
  const [currentDialog, setCurrentDialog] = useAtom(currentlyOpenFeedbackDialogAtom)
  const [selection, setSelectionRaw] = useAtom(selectionAtom)
  const [selectedBlockId, setSelectedBlockId] = useAtom(selectedBlockIdAtom)
  const [writtenContent, setWrittenContent] = useAtom(writtenContentAtom)
  const setBlockEdits = useSetAtom(blockEditsAtom)

  /**
   * Set text selection with optional position
   */
  const setSelection = useCallback(
    (text: string, position?: { x: number; y: number }) => {
      setSelectionRaw(text, position)
    },
    [setSelectionRaw],
  )

  /**
   * Open the written feedback dialog
   */
  const openWrittenFeedback = useCallback(() => {
    setCurrentDialog("written")
  }, [setCurrentDialog])

  /**
   * Open the proposed edits dialog
   */
  const openProposedEdits = useCallback(() => {
    setCurrentDialog("proposed-edits")
  }, [setCurrentDialog])

  /**
   * Open the feedback type selection dialog
   */
  const openFeedbackTypeSelection = useCallback(() => {
    setCurrentDialog("select-type")
  }, [setCurrentDialog])

  /**
   * Close any open feedback dialog
   */
  const closeFeedback = useCallback(() => {
    setCurrentDialog(null)
  }, [setCurrentDialog])

  /**
   * Add a proposed edit for a block
   */
  const addBlockEdit = useCallback(
    (blockId: string, edit: NewProposedBlockEdit) => {
      setBlockEdits((prev) => {
        const next = new Map(prev)
        next.set(blockId, edit)
        return next
      })
    },
    [setBlockEdits],
  )

  /**
   * Remove a proposed edit for a block
   */
  const removeBlockEdit = useCallback(
    (blockId: string) => {
      setBlockEdits((prev) => {
        const next = new Map(prev)
        next.delete(blockId)
        return next
      })
    },
    [setBlockEdits],
  )

  return {
    // State
    currentDialog,
    selection,
    selectedBlockId,
    writtenContent,

    // Setters
    setWrittenContent,
    setSelectedBlockId,
    setSelection,

    // Actions
    openWrittenFeedback,
    openProposedEdits,
    openFeedbackTypeSelection,
    closeFeedback,
    addBlockEdit,
    removeBlockEdit,
  }
}
