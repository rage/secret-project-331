import React, { useCallback, useEffect, useState } from "react"

import { NewProposedBlockEdit } from "@/shared-module/common/bindings"

// Global store for click positions
const clickPositions = new Map<string, { x: number; y: number }>()

export const useParagraphEditing = (
  id: string,
  editing: boolean,
  selectedBlockId: string | null,
  content: string | null,
  setEdits: React.Dispatch<React.SetStateAction<Map<string, NewProposedBlockEdit>>>,
) => {
  const [editedContent, setEditedContent] = useState(content)
  const contentEditableRef = React.useRef<HTMLParagraphElement>(null)

  // Reset edited content when no longer editing
  useEffect(() => {
    if (!editing && editedContent !== content) {
      setEditedContent(content)
    }
  }, [content, editedContent, editing])

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

        const clickPosition = clickPositions.get(id)
        if (clickPosition) {
          // Ensure DOM is ready before positioning
          setTimeout(() => {
            if (!contentEditableRef.current) {
              return
            }

            const { x, y } = clickPosition
            const range = document.caretRangeFromPoint(x, y)
            const selection = window.getSelection()

            if (range && selection) {
              selection.removeAllRanges()
              selection.addRange(range)
            } else {
              positionAtEnd()
            }

            clickPositions.delete(id)
          }, 100)
        } else {
          positionAtEnd()
        }
      }, 50)

      return () => clearTimeout(timeoutId)
    }
  }, [editing, selectedBlockId, id, positionAtEnd])

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      clickPositions.set(id, { x: e.clientX, y: e.clientY })
    },
    [id],
  )

  const handleInput = useCallback(
    (ev: React.FormEvent<HTMLParagraphElement>) => {
      const changed = ev.currentTarget.innerText
      setEditedContent(changed)
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
    editedContent,
    contentEditableRef,
    handleClick,
    handleInput,
  }
}
