import { css } from "@emotion/css"
import { useEffect, useState } from "react"

import Button from "../shared-module/components/Button"

const FeedbackTooltip: React.FC<unknown> = () => {
  const [show, setShow] = useState(false)
  const [x, setX] = useState(0)
  const [y, setY] = useState(0)
  const [selection, setSelection] = useState("")
  const [tooltipTimeout, setTooltipTimeout] = useState<NodeJS.Timeout | null>(null)

  function selectionHandler(this: Document) {
    if (tooltipTimeout) {
      setShow(false)
      clearTimeout(tooltipTimeout)
    }

    const docSelection = this.getSelection()
    const range = docSelection?.getRangeAt(0)
    const rects = range?.getClientRects()
    const contents = range?.cloneContents()?.textContent
    if (contents === undefined || contents === null || contents.length === 0) {
      return
    }

    const t = setTimeout(() => {
      if (rects !== undefined && rects.length > 0) {
        const rect = rects[0]
        const newY = Math.max(10, window.scrollY + rect.y - 40)
        setShow(true)
        setX(window.scrollX + rect.x)
        setY(newY)
        setSelection(contents)
      }
    }, 300)
    setTooltipTimeout(t)
  }

  useEffect(() => {
    document.addEventListener("selectionchange", selectionHandler)

    return function cleanup() {
      document.removeEventListener("selectionchange", selectionHandler)
    }
  })

  console.log(selection)

  return (
    <Button
      size={"medium"}
      variant={"primary"}
      disabled={!show}
      className={css`
        position: absolute;
        top: ${y}px;
        left: ${x}px;
        overflow: hidden;
        width: 160px;
        height: 40px;
        user-select: none;
      `}
    >
      Give feedback
    </Button>
  )
}

export default FeedbackTooltip
