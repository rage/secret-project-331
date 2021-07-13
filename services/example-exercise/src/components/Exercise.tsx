import { css } from "@emotion/css"
import { useLayoutEffect, useRef, useState } from "react"

import { PublicAlternative } from "../util/stateInterfaces"

interface Props {
  state: PublicAlternative[]
  onHeightChange: (newHeight: number, port: MessagePort) => void
  port: MessagePort
  maxWidth: number | null
}

const Exercise: React.FC<Props> = ({ onHeightChange, port, maxWidth, state }) => {
  const contentRef = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const ref = contentRef.current
    if (!ref || !port) {
      return
    }
    onHeightChange(ref.getBoundingClientRect().height, port)
  })

  const [selectedId, _setSelectedId] = useState<string | null>(null)

  const setSelectedId: typeof _setSelectedId = (value) => {
    const res = _setSelectedId(value)
    if (!port) {
      console.error("Cannot send current state to parent because I don't have a port")
      return
    }
    console.log("Posting current state to parent")
    port.postMessage({ message: "current-state", data: { selectedOptionId: value } })
    return res
  }

  return (
    <div
      ref={contentRef}
      className={css`
        width: 100%;
        ${maxWidth && `max-width: ${maxWidth}px;`}
        margin: 0 auto;
        display: flex;
        flex-direction: column;
      `}
    >
      {state.map((option) => {
        const selected = selectedId === option.id
        return (
          <button
            className={css`
              padding: 1rem 2rem;
              background-color: ${selected ? "#4210f5" : "#6188ff"};
              border-radius: 1rem;
              border: 0;
              color: white;
              transition: all 0.3s;
              cursor: pointer;
              margin-top: 0.5rem;
              margin-bottom: 0.5rem;

              &:hover {
                background-color: ${selected ? "#330eb8" : "#507afb"};
              }
            `}
            aria-selected={selected}
            onClick={() => setSelectedId(option.id)}
            key={option.id}
          >
            {option.name}
          </button>
        )
      })}
    </div>
  )
}

export default Exercise
