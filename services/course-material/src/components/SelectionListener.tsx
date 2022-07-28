import { useEffect } from "react"

import { courseMaterialBlockClass } from "../utils/constants"

interface Props {
  onSelectionChange: (selection: string, rect: DOMRect | null) => void
  updateSelectionPosition: (pos: { x: number; y: number }) => void
}

const SelectionListener: React.FC<React.PropsWithChildren<Props>> = ({
  onSelectionChange,
  updateSelectionPosition,
}) => {
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
      onSelectionChange(newSelection, rect)
    } else {
      onSelectionChange("", null)
    }
  }

  function handleWindowChange(this: Document) {
    const selection = this.getSelection()
    if (selection && selectedCourseBlocks(selection)) {
      const rect = getRect(selection)
      if (rect) {
        updateSelectionPosition({ x: rect.x, y: rect.y })
      }
    }
  }

  useEffect(() => {
    document.addEventListener("selectionchange", selectionHandler)
    window.addEventListener("scroll", handleWindowChange)
    window.addEventListener("resize", handleWindowChange)
    return () => {
      document.removeEventListener("selectionchange", selectionHandler)
      window.removeEventListener("scroll", handleWindowChange)
      window.removeEventListener("resize", handleWindowChange)
    }
  })

  return <div hidden={true}></div>
}

export default SelectionListener
