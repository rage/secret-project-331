import { useSetAtom } from "jotai"
import { useEffect } from "react"

import { selectedBlockIdAtom, selectionAtom } from "../stores/materialFeedbackStore"
import { courseMaterialBlockClass } from "../utils/constants"

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

    function selectedCourseBlocks(selection: Selection): boolean {
      const firstNode = selection.anchorNode
      const lastNode = selection.focusNode
      return isChildOfCourseMaterialBlock(firstNode) && isChildOfCourseMaterialBlock(lastNode)
    }

    function selectionHandler(this: Document) {
      const selection = this.getSelection()
      if (selection && selectedCourseBlocks(selection)) {
        const newSelection = selection.toString()
        const range = selection.getRangeAt(0)
        const rect = range.getBoundingClientRect()
        setSelection(newSelection, { x: rect.right, y: rect.top })
      } else {
        setSelection("", undefined)
      }
    }

    function handleClick(ev: MouseEvent): void {
      // Skip updating block ID if text is selected
      const selectedText = window.getSelection()?.toString() || ""
      if (selectedText.trim().length > 0) {
        return
      }

      if (ev.target instanceof Element) {
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
