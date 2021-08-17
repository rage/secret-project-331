import { useEffect } from "react"

import { courseMaterialBlockClass } from "../utils/constants"

interface Props {
  onSelectionChange: (selection: string, rect: DOMRect | null) => void
}

const SelectionListener: React.FC<Props> = ({ onSelectionChange }) => {
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

  function selectionHandler(this: Document) {
    const docSelection = this.getSelection()
    const firstNode = docSelection?.anchorNode
    const lastNode = docSelection?.focusNode
    if (isChildOfCourseMaterialBlock(firstNode) && isChildOfCourseMaterialBlock(lastNode)) {
      const range = docSelection?.getRangeAt(0)
      const rects = range?.getClientRects()
      const newSelection = range?.cloneContents().textContent || ""
      const rect = rects !== undefined && rects.length > 0 ? rects[0] : null
      onSelectionChange(newSelection, rect)
    } else {
      onSelectionChange("", null)
    }
  }

  useEffect(() => {
    document.addEventListener("selectionchange", selectionHandler)

    return function cleanup() {
      document.removeEventListener("selectionchange", selectionHandler)
    }
  })

  return <div hidden={true}></div>
}

export default SelectionListener
