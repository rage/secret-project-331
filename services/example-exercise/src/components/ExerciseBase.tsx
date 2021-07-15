import { css } from "@emotion/css"
import { useLayoutEffect, useRef } from "react"

import { PublicAlternative } from "../util/stateInterfaces"

interface Props {
  alternatives: PublicAlternative[]
  selectedId: string | null
  port: MessagePort
  maxWidth: number | null
  onClick: (selectedId: string) => void
  interactable: boolean
}

const ExerciseBase: React.FC<Props> = ({
  port,
  maxWidth,
  alternatives,
  selectedId,
  onClick,
  interactable,
}) => {
  const contentRef = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const ref = contentRef.current
    if (!ref || !port) {
      return
    }
    onHeightChange(ref.getBoundingClientRect().height, port)
  })

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
      {alternatives.map((option) => {
        const selected = selectedId === option.id
        return (
          <button
            className={
              css`
                padding: 1rem 2rem;
                background-color: ${selected ? "#4210f5" : "#6188ff"};
                border-radius: 1rem;
                border: 0;
                color: white;
                margin-top: 0.5rem;
                margin-bottom: 0.5rem;
              ` + interactable
                ? css`
                    transition: all 0.3s;
                    cursor: pointer;
                    &:hover {
                      background-color: ${interactable
                        ? selected
                          ? "#330eb8"
                          : "#507afb"
                        : "#6188ff"};
                    }
                  `
                : ""
            }
            aria-selected={selected}
            onClick={() => onClick(option.id)}
            key={option.id}
          >
            {option.name}
          </button>
        )
      })}
    </div>
  )
}

function onHeightChange(newHeight: number, port: MessagePort) {
  port.postMessage({
    message: "height-changed",
    data: newHeight,
  })
}

export default ExerciseBase
