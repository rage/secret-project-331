import { css, cx } from "@emotion/css"
import { useRouter } from "next/dist/client/router"
import { useLayoutEffect, useRef, useState } from "react"

const placeholderSpec = [
  {
    id: "d7fb22c3-038f-4ae4-a09c-80129e8d8117",
    name: "a",
  },
  {
    id: "25c3c38e-fe08-440c-b454-a10fd834a00a",
    name: "b",
  },
  {
    id: "d97391a8-127b-46a2-a000-717fa55e1dcd",
    name: "c",
  },
]

const Editor: React.FC = () => {
  const router = useRouter()
  const rawMaxWidth = router?.query?.width
  let maxWidth: number | null = null
  if (rawMaxWidth) {
    maxWidth = Number(rawMaxWidth)
  }

  const contentRef = useRef<HTMLDivElement>(null)
  // Automatic height resizing events
  const [selectedId, _setSelectedId] = useState<string | null>(null)

  const setSelectedId: typeof _setSelectedId = (value) => {
    const res = _setSelectedId(value)
    console.log("Posting current state to parent")
    window.parent.postMessage(
      {
        message: "current-state2",
        message_type: "moocfi/exercise-message",
        data: { selectedValue: value },
      },
      "*",
    )
    return res
  }

  useLayoutEffect(() => {
    const ref = contentRef.current
    if (!ref) {
      return
    }
    onHeightChange(ref.getBoundingClientRect().height)
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
      {placeholderSpec.map((option) => {
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

function onHeightChange(newHeight: number) {
  window.parent.postMessage(
    {
      message: "height-changed",
      data: newHeight,
      message_type: "moocfi/exercise-message",
    },
    "*",
  )
}

export default Editor
