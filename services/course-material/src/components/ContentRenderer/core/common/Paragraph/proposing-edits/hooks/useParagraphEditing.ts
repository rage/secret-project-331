import React, { useCallback, useEffect, useRef, useState } from "react"

import { NewProposedBlockEdit } from "@/shared-module/common/bindings"

// Global store for edited content (shared between instances)
const editedContents = new Map<string, string | null>()

export const useParagraphEditing = (
  id: string,
  editing: boolean,
  selectedBlockId: string | null,
  content: string | null,
  setEdits: React.Dispatch<React.SetStateAction<Map<string, NewProposedBlockEdit>>>,
) => {
  // We don't use this state for rendering anymore, just for tracking
  const editedContentRef = useRef(content)
  const contentEditableRef = React.useRef<HTMLParagraphElement>(null)
  // Keep a stateful version for components that need to know the current value
  const [editedContent, setEditedContent] = useState(() => {
    // Initialize from global map if available, otherwise use content
    return editedContents.get(id) ?? content
  })

  // Initialize global map with content if not already set
  useEffect(() => {
    if (!editedContents.has(id)) {
      editedContents.set(id, content)
    }
  }, [id, content])

  // Reset edited content when no longer editing
  useEffect(() => {
    if (!editing && editedContentRef.current !== content) {
      editedContentRef.current = content
      setEditedContent(content)
      editedContents.set(id, content)

      // If the component has DOM content, update it
      if (contentEditableRef.current) {
        contentEditableRef.current.innerText = content || ""
      }
    }
  }, [content, editing, id])

  // Sync with global edited content map
  useEffect(() => {
    // Only update if we're the source of truth (selected for editing)
    if (selectedBlockId !== id) {
      // We're not the source of truth, so get updates from global map
      const globalContent = editedContents.get(id)
      if (globalContent !== undefined && globalContent !== editedContent) {
        setEditedContent(globalContent)
        editedContentRef.current = globalContent
      }
    }
  }, [id, selectedBlockId, editedContent])

  // Position cursor at the end of content
  const positionAtEnd = useCallback(() => {
    if (!contentEditableRef.current) {
      return
    }

    const range = document.createRange()
    const selection = window.getSelection()

    if (selection) {
      range.selectNodeContents(contentEditableRef.current)
      range.collapse(false)
      selection.removeAllRanges()
      selection.addRange(range)
    }
  }, [])

  // Auto-focus and position cursor when paragraph becomes selected
  useEffect(() => {
    if (editing && selectedBlockId === id) {
      // Give React time to finish render work
      const timeoutId = setTimeout(() => {
        if (!contentEditableRef.current) {
          return
        }

        contentEditableRef.current.focus()
        positionAtEnd()
      }, 50)

      return () => clearTimeout(timeoutId)
    }
  }, [editing, selectedBlockId, id, positionAtEnd])

  const handleClick = useCallback(() => {
    // Just a placeholder for onClick events, no position tracking anymore
  }, [])

  const handleInput = useCallback(
    (ev: React.FormEvent<HTMLParagraphElement>) => {
      const changed = ev.currentTarget.innerText
      editedContentRef.current = changed

      // Update state version too, but this won't affect the contentEditable element
      setEditedContent(changed)

      // Update global map so all instances stay in sync
      editedContents.set(id, changed)

      if (content !== changed) {
        setEdits((edits) => {
          edits.set(id, {
            block_id: id,
            block_attribute: "content",
            original_text: content ?? "",
            changed_text: changed,
          })
          return new Map(edits)
        })
      } else {
        setEdits((edits) => {
          edits.delete(id)
          return new Map(edits)
        })
      }
    },
    [content, id, setEdits],
  )

  return {
    // Return the actual edited content for components that need it
    editedContent,
    contentEditableRef,
    handleClick,
    handleInput,
  }
}
