import { useSetAtom } from "jotai"
import { useEffect } from "react"

import { selectedBlockIdAtom, selectionAtom } from "../stores/materialFeedbackStore"
import { courseMaterialBlockClass } from "../utils/constants"

import { FEEDBACK_TOOLTIP_ID } from "./FeedbackTooltip"
import { SELECT_FEEDBACK_TYPE_DIALOG_CONTENT_ID } from "./FeedbackTypeDialog"

const useSelectionTracking = (): void => {
  const setSelection = useSetAtom(selectionAtom)
  const setSelectedBlockId = useSetAtom(selectedBlockIdAtom)

  useEffect(() => {
    const abortController = new AbortController()

    function isChildOfCourseMaterialBlock(node: Node | null | undefined): boolean {
      if (node === null || node === undefined) {
        return false
      }
      let element
      if (node.nodeType === Node.ELEMENT_NODE) {
        element = node as Element
      } else {
        // probably a text node
        element = node.parentElement
      }
      const closest = element?.closest(`.${courseMaterialBlockClass}`)
      return closest !== null && closest !== undefined
    }

    /** Tells whether the click or selection change is within a container within which we don't want to update the block ID */
    function isWithinIgnoredContainer(node: Node | null | undefined): boolean {
      if (node === null || node === undefined) {
        return false
      }
      let element
      if (node.nodeType === Node.ELEMENT_NODE) {
        element = node as Element
      } else {
        element = node.parentElement
      }
      const dialogContent = element?.closest(
        `#${SELECT_FEEDBACK_TYPE_DIALOG_CONTENT_ID}, #${FEEDBACK_TOOLTIP_ID}`,
      )
      return dialogContent !== null && dialogContent !== undefined
    }

    function selectedCourseBlocks(selection: Selection): boolean {
      const firstNode = selection.anchorNode
      const lastNode = selection.focusNode
      return (
        isChildOfCourseMaterialBlock(firstNode) &&
        isChildOfCourseMaterialBlock(lastNode) &&
        !isWithinIgnoredContainer(firstNode) &&
        !isWithinIgnoredContainer(lastNode)
      )
    }

    function selectionHandler(this: Document) {
      const selection = this.getSelection()
      if (selection && selectedCourseBlocks(selection)) {
        const newSelection = selection.toString()
        if (selection.rangeCount === 0) {
          return
        }
        const range = selection.getRangeAt(0)
        const rect = range.getBoundingClientRect()
        const centerX = rect.left + rect.width / 2
        const element = range.commonAncestorContainer.parentElement ?? undefined
        setSelection(
          newSelection,
          {
            x: centerX + window.scrollX,
            y: rect.top + window.scrollY,
          },
          element,
        )
      } else {
        setSelection("", undefined, undefined)
      }
    }

    function handleClick(ev: MouseEvent): void {
      // Skip updating block ID if text is selected
      const selectedText = window.getSelection()?.toString() || ""
      if (selectedText.trim().length > 0) {
        return
      }

      if (ev.target instanceof Element) {
        // Skip if click is within feedback dialog
        if (isWithinIgnoredContainer(ev.target)) {
          return
        }

        let newBlockId = null
        let element: Element | null = ev.target
        while (element !== null) {
          if (element.classList.contains(courseMaterialBlockClass)) {
            newBlockId = element.id
            break
          }
          element = element.parentElement
        }
        setSelectedBlockId(newBlockId)
      } else {
        setSelectedBlockId(null)
      }
    }

    document.addEventListener("selectionchange", selectionHandler, {
      signal: abortController.signal,
    })
    document.addEventListener("click", handleClick, { signal: abortController.signal })

    return () => {
      abortController.abort()
    }
  }, [setSelection, setSelectedBlockId])
}

const SelectionListener: React.FC = () => {
  useSelectionTracking()
  return null
}

export default SelectionListener
