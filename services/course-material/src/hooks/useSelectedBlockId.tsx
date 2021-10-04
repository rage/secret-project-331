import { useEffect, useState } from "react"

import { courseMaterialBlockClass } from "../utils/constants"

export default function useSelectedBlockId(): [string | null, () => void] {
  const [selectedBlockId, setSelectedBlockId] = useState(document.activeElement?.id ?? null)
  useEffect(() => {
    const handler = (ev: MouseEvent) => {
      if (ev.target instanceof Element) {
        // go through the clicked element's parents until we find a block
        let blockId = null
        let element: Element | null = ev.target
        while (element !== null) {
          if (element.classList.contains(courseMaterialBlockClass)) {
            blockId = element.id
            break
          }
          element = element.parentElement
        }
        setSelectedBlockId(blockId)
      } else {
        setSelectedBlockId(null)
      }
    }
    document.addEventListener("click", handler)
    return () => {
      document.removeEventListener("click", handler)
    }
  }, [])

  return [selectedBlockId, () => setSelectedBlockId(null)]
}
