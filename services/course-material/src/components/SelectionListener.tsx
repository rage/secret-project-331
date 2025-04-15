import { useEffect } from "react"

import { useFeedbackStore } from "../stores/materialFeedbackStore"
import { courseMaterialBlockClass } from "../utils/constants"

const SelectionListener: React.FC = () => {
  const { setSelection } = useFeedbackStore()

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

    function getRect(selection: Selection): DOMRect | null {
      if (selection.rangeCount === 0) {
        return null
      }
      const range = selection.getRangeAt(0)
      const rects = range?.getClientRects()
      const rect = rects !== undefined && rects.length > 0 ? rects[0] : null
      return rect
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
        const rect = getRect(selection)
        setSelection(newSelection, rect ? { x: rect.x, y: rect.y } : null)
      } else {
        setSelection("", null)
      }
    }

    function handleWindowChange(this: Document) {
      const selection = this.getSelection()
      if (selection && selectedCourseBlocks(selection)) {
        const rect = getRect(selection)
        if (rect) {
          setSelection(selection.toString(), { x: rect.x, y: rect.y })
        }
      }
    }

    document.addEventListener("selectionchange", selectionHandler, {
      signal: abortController.signal,
    })
    window.addEventListener("scroll", handleWindowChange, { signal: abortController.signal })
    window.addEventListener("resize", handleWindowChange, { signal: abortController.signal })
    return () => {
      abortController.abort()
    }
  }, [setSelection])

  return <div hidden={true}></div>
}

export default SelectionListener
