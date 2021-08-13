import { useEffect } from "react"

interface Props {
  onSelectionChange: (selection: string, rect: DOMRect | null) => void
}

const SelectionListener: React.FC<Props> = ({ onSelectionChange }) => {
  function selectionHandler(this: Document) {
    const docSelection = this.getSelection()
    const range = docSelection?.getRangeAt(0)
    const rects = range?.getClientRects()
    const contents = range?.cloneContents()?.textContent

    if (contents === undefined || contents === null) {
      return
    }
    if (rects === undefined || rects.length === 0) {
      onSelectionChange(contents, null)
      return
    }
    onSelectionChange(contents, rects[0])
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
